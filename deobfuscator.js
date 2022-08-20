"use strict";


const estraverse = require('estraverse');
const astOperations = require('./ast_operations');
const usefulModule = require('./useful');
const stageDeobfuscator = require('./Stages/stage_deobfuscator');
const stageFinalizing = require('./Stages/stage_01_finalizing');
const stageSimplifying = require('./Stages/stage_02_simplifying');
const stageStringArray = require('./Stages/stage_03_stringarray');
const stageRenameIdentifiers = require('./Stages/stage_04_renameidentifiers');
const stageConverting = require('./Stages/stage_05_converting');
const stageRenameProperties = require('./Stages/stage_06_renameproperties');
const stageControlFlowFlattening = require('./Stages/stage_07_controlflowflattening');
const stageDeadCodeInjection = require('./Stages/stage_08_deadcodeinjection');
const stagePreparing = require('./Stages/stage_09_preparing');
const stageInitializing = require('./Stages/stage_10_initializing');
const stageFinishing = require('./Stages/stage_11_finishing');


class SourceCodeDeobfuscator{
    constructor(logger, obfuscatedSourceCode, argv, currentCallIsFromEmbeddedEval=false){
        this.logger = logger;
        this.obfuscatedSourceCode = obfuscatedSourceCode;
        this.argv = argv;
        this.currentCallIsFromEmbeddedEval = currentCallIsFromEmbeddedEval;
    }

    deobfuscate(){
        this._generateASTFromObfuscatedSourceCode();
        this._deobfuscateAST();
        this._generateSourceCodeFromDeobfuscatedAST();
        return this.deobfuscatedSourceCode;
    }

    _generateASTFromObfuscatedSourceCode(){
        this.logger.info('[deobfuscator.js] Generating AST from obfuscated source code.');
        this.ast = astOperations.ASTSourceCodeOperations.generateASTFromSourceCode(this.obfuscatedSourceCode);
    }

    _deobfuscateAST(){
        this.logger.info('[deobfuscator.js] Deobfuscating AST.');
        const astDeobfuscator = new ASTDeobfuscator(this.logger, this.obfuscatedSourceCode, this.ast, 
            this.argv, this.currentCallIsFromEmbeddedEval);
        astDeobfuscator.deobfuscate();
    }

    _generateSourceCodeFromDeobfuscatedAST(){
        this.logger.info('[deobfuscator.js] Generating source code from deobfuscated AST.');
        this.deobfuscatedSourceCode = astOperations.ASTSourceCodeOperations.generateSourceCodeFromAST(this.ast);
    }
}


class StageFinalizingEmbeddedEval extends stageDeobfuscator.StageDeobfuscator{
    constructor(logger, obfuscatedSourceCode, ast, argv, stageName){
        super(logger, obfuscatedSourceCode, ast, argv, stageName);
    }

    _initiateTransformers(){
        this.transformers = {
            'FinalizingEvalCallExpressionTransformer': FinalizingEvalCallExpressionTransformer,
            'FinalizingEscapeSequenceTransformer': FinalizingEscapeSequenceTransformer,
        }
    }

    deobfuscate(currentCallIsFromEmbeddedEval=false){
        this._getSourceCodeBeforeDeobfuscation();

        let i = 0;
        const nrTransformers = Object.keys(this.transformers).length;
        for (const transformerName in this.transformers){
            const transformerDeobfuscatorObject = this._instantiateTransformerObject(transformerName);
            this.logger.info(`[deobfuscator.js] ${i + 1}/${nrTransformers}) Transform '${transformerName}'.`);
            try{
                this._callDeobfuscationForTransformerObject(transformerDeobfuscatorObject, transformerName, 
                    currentCallIsFromEmbeddedEval);
            }
            catch(e){
                this.logger.error(`[deobfuscator.js] Deobfuscation error for eval-transform '${transformerName}'. ` + 
                `error = ${e}. Stack = ${e.stack}`);
            }
        }

        this._displaySourceCodeBeforeAndAfterDeobfuscation();
    }

    _callDeobfuscationForTransformerObject(transformerDeobfuscatorObject, transformerName, currentCallIsFromEmbeddedEval){
        transformerDeobfuscatorObject.deobfuscate(currentCallIsFromEmbeddedEval);
        transformerDeobfuscatorObject.displaySourceCodeBeforeAndAfterTransformation(transformerName);
    }
}


class FinalizingEvalCallExpressionTransformer extends stageDeobfuscator.TransformerDeobfuscator{
    constructor(logger, obfuscatedSourceCode, ast, argv){
        super(logger, obfuscatedSourceCode, ast, argv);
    }

    deobfuscate(currentCallIsFromEmbeddedEval=false){
        if(currentCallIsFromEmbeddedEval){
            return;
        }
        var thisObj = this;
        estraverse.replace(this.ast, {
            enter: function (node) {
                if(thisObj._nodeIsEvalWithString(node)){
                    return thisObj._deobfuscateEvalledString(node);
                }
            }
        });
    }

    _nodeIsEvalWithString(node){
        if(node && node.type == 'CallExpression' && (node.callee.type == 'Identifier')
        && (node.callee.name == 'eval') && (node.arguments.length == 1)
        && (node.arguments[0].type == 'Literal') && (typeof node.arguments[0].value == 'string')){
            return true;
        }
        return false;
    }

    _deobfuscateEvalledString(node){
        const evalledString = node.arguments[0].value;
        const evalContentsDeobfuscator = new SourceCodeDeobfuscator(this.logger, evalledString, this.argv, true);

        this.logger.info(`${'$'.repeat(150)}\nSTART - deobfuscating contents of eval string: ${evalledString}`);
        const deobfuscatedEvalString = evalContentsDeobfuscator.deobfuscate();
        this.logger.info(`${'$'.repeat(150)}\nFINISH - deobfuscating contents of eval string.`);

        return this._createNewEvalNode(node, deobfuscatedEvalString);
    }

    _createNewEvalNode(oldNode, deobfuscatedEvalString){
        const newNode = {
            type: 'CallExpression',
            callee: {type: 'Identifier', name: 'eval'},
            arguments: [{type: 'Literal', value: deobfuscatedEvalString}],
            parent: oldNode.parent
        };
        astOperations.ASTRelations.addParentsToASTNodesExcludingRoot(newNode);

        astOperations.ASTModifier.logDebugEstraverseReplace(oldNode, newNode, this.logger, this.obfuscatedSourceCode);

        return newNode;
    }
}


class FinalizingEscapeSequenceTransformer extends stageDeobfuscator.TransformerDeobfuscator{
    constructor(logger, obfuscatedSourceCode, ast, argv){
        super(logger, obfuscatedSourceCode, ast, argv);
    }

    deobfuscate(currentCallIsFromEmbeddedEval=false){
        if(!currentCallIsFromEmbeddedEval){
            return;
        }
        var thisObj = this;

        estraverse.replace(this.ast, {    
            enter: function(node){
                if(thisObj._nodeIsDoubleEscapedString(node)){
                    return thisObj._createNewUnescapedStringNode(node);
                }
            }
        });
    }

    _nodeIsDoubleEscapedString(node){
        return (node.type == 'Literal') && (typeof node.value == 'string')
            && usefulModule.StringOperations.strContainsOnlyDoubleEscapedChars(node.value)
    }

    _createNewUnescapedStringNode(oldNode){
        this.logger.debug(`[EVAL][EscapedString] ${oldNode.value}`);
        const newNode = {
            type: 'Literal', 
            value: usefulModule.StringOperations.unescapeStrWithDoubleEscapedChars(oldNode.value),
            parent: oldNode.parent
        };

        astOperations.ASTModifier.logDebugEstraverseReplace(oldNode, newNode, this.logger, this.obfuscatedSourceCode);

        return newNode;
    }
}


class ASTDeobfuscator{
    constructor(logger, obfuscatedSourceCode, ast, argv, currentCallIsFromEmbeddedEval){
        this.logger = logger;
        this.obfuscatedSourceCode = obfuscatedSourceCode;
        this.ast = ast;
        this.argv = argv;
        this.currentCallIsFromEmbeddedEval = currentCallIsFromEmbeddedEval;
    }

    static DeobfuscateStageClasses = {
        'StringArray': stageStringArray.StringArrayStageDeobfuscator,
        'EmbeddedEval': StageFinalizingEmbeddedEval,
        'Finalizing': stageFinalizing.StageFinalizing,
        'Simplifying': stageSimplifying.StageSimplifying,
        'RenameIdentifiers': stageRenameIdentifiers.StageRenameIdentifiers,
        'Converting': stageConverting.StageConverting,
        'RenameProperties': stageRenameProperties.StageRenameProperties,
        'ControlFlowFlattening': stageControlFlowFlattening.StageControlFlowFlattening,
        'DeadCodeInjection': stageDeadCodeInjection.StageDeadCodeInjection,
        'Preparing': stagePreparing.StagePreparing,
        'Initializing': stageInitializing.StageInitializing,
        'Finishing': stageFinishing.StageFinishing
    }

    deobfuscate(){
        let i = 0;
        const nrStages = Object.keys(ASTDeobfuscator.DeobfuscateStageClasses).length;

        for (const stageName in ASTDeobfuscator.DeobfuscateStageClasses){
            const stageDeobfuscatorObject = this._instantiateStageObject(stageName);
            
            this.logger.info(`[deobfuscator.js] ${i + 1}/${nrStages}) Deobfuscating stage '${stageName}'.`);
            try{
                this._callDeobfuscationForStageObject(stageDeobfuscatorObject, stageName);
            }
            catch(e){
                this.logger.error(`[deobfuscator.js] Deobfuscation error for stage '${stageName}'. ` + 
                `error = ${e}. Stack = ${e.stack}`);
            }
            i++;
        }
    }

    _instantiateStageObject(stageName){
        const stageDeobfuscatorClass = ASTDeobfuscator.DeobfuscateStageClasses[stageName];
        return new stageDeobfuscatorClass(this.logger, this.obfuscatedSourceCode, this.ast, this.argv, stageName);
    }

    _callDeobfuscationForStageObject(stageDeobfuscatorObj, stageName){
        if(stageName == 'EmbeddedEval'){
            stageDeobfuscatorObj.deobfuscate(this.currentCallIsFromEmbeddedEval);
        }
        else{
            stageDeobfuscatorObj.deobfuscate();
        }
    }
}


module.exports = {SourceCodeDeobfuscator};
