"use strict";


const estraverse = require('estraverse');
const winston = require('winston');
const astOperations = require('../ast_operations');
const usefulModule = require('../useful');


class StageDeobfuscator{
    constructor(logger, obfuscatedSourceCode, ast, argv, stageName){
        this.obfuscatedSourceCode = obfuscatedSourceCode;
        this.ast = ast;
        this.argv = argv;
        this.stageName = stageName;

        if(argv.separateloggers){
            this._createSeparateLogger();
        }
        else{
            this.logger = logger;
        }

        this._initiateTransformers();
    }

    _createSeparateLogger(){
        this.logger = winston.createLogger({
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp({format: 'HH:mm:ss'}),
                winston.format.simple()
            ),
            transports: [
                new winston.transports.File({ filename: `debug_${this.stageName}.log`, level: 'debug', options: {flags: 'a'}}),
                new winston.transports.Console({
                    level: 'info',
                    format: winston.format.combine(
                        winston.format.colorize(),
                        winston.format.simple()
                    )
                })
            ]
        });
    }

    _initiateTransformers(){
        throw `Method '_initiateTransformers' from 'StageDeobfuscator' needs to be overriden.`;
    }

    deobfuscate(){
        this._getSourceCodeBeforeDeobfuscation();

        let i = 0;
        const nrTransformers = Object.keys(this.transformers).length;
        for (const transformerName in this.transformers){
            const transformerDeobfuscatorObject = this._instantiateTransformerObject(transformerName);
            this.logger.info(`[stage_deobfuscator.js] ${i + 1}/${nrTransformers}) Transform '${transformerName}'.`);
            try{
                this._callDeobfuscationForTransformerObject(transformerDeobfuscatorObject, transformerName);
            }
            catch(e){
                this.logger.error(`[stage_deobfuscator.js] Deobfuscation error for transform '${transformerName}'. ` +
                `error = ${e}. Stack = ${e.stack}`);
                console.log(`[stage_deobfuscator.js] Deobfuscation error for transform '${transformerName}'. ` +
                `error = ${e}. Stack = ${e.stack}`);
            }
            i++;
        }

        this._displaySourceCodeBeforeAndAfterDeobfuscation();
    }

    _getSourceCodeBeforeDeobfuscation(){
        this.sourceCodeBeforeStage = astOperations.ASTSourceCodeOperations.generateSourceCodeFromAST(this.ast);
    }

    _instantiateTransformerObject(transformerName){
        const transformerClass = this.transformers[transformerName];
        return new transformerClass(this.logger, this.obfuscatedSourceCode, this.ast, this.argv);
    }
    
    _callDeobfuscationForTransformerObject(transformerDeobfuscatorObject, transformerName){
        transformerDeobfuscatorObject.deobfuscate();
        transformerDeobfuscatorObject.displaySourceCodeBeforeAndAfterTransformation(transformerName);
    }

    _displaySourceCodeBeforeAndAfterDeobfuscation(){
        const sourceCodeAfterStage = astOperations.ASTSourceCodeOperations.generateSourceCodeFromAST(this.ast);
        if(sourceCodeAfterStage == this.sourceCodeBeforeStage){
            this.logger.debug(`Stage ${this.stageName} does not modify contents.`);
            return;
        }
        this.logger.debug(`${'-'.repeat(100)}\nStage ${this.stageName}:\n`
        + `Before stage (${this.stageName}):\n${this.sourceCodeBeforeStage}\n`
        + `After stage (${this.stageName}):\n${sourceCodeAfterStage}\n`
        + `${'-'.repeat(100)}`);
    }
}


class TransformerDeobfuscator{
    constructor(logger, obfuscatedSourceCode, ast, argv){
        this.logger = logger;
        this.obfuscatedSourceCode = obfuscatedSourceCode;
        this.ast = ast;
        this.argv = argv;
        this._getSourceCodeBeforeTransformation();
    }

    static transformNamesToSkipFromDisplaying = [
        'FinalizingDirectivePlacementTransformer',
        'FinalizingCustomCodeHelpersTransformer',
        'FinalizingCommentsTransformer',
        'SimplifyingCustomCodeHelpersTransformer',
        'RenameIdentifiersCustomCodeHelpersTransformer',
        'RenameIdentifiersScopeThroughIdentifiersTransformer',
        'RenameIdentifiersScopeIdentifiersTransformer',
        'RenameIdentifiersLabeledStatementTransformer',
        'RenameIdentifiersVariablePreserveTransformer',
        'ConvertingNumberLiteralTransformer',
        'ConvertingCustomCodeHelpersTransformer',
        'ConvertingTemplateLiteralTransformer',
        'ConvertingExportSpecifierTransformer',
        'ConvertingVariablePreserveTransformer',
        'RenamePropertiesRenamePropertiesTransformer',
        'ControlFlowFlatteningCustomCodeHelpersTransformer',
        'PreparingParentificationTransformer',
        'PreparingRenamePropertiesTransformer',
        'PreparingVariablePreserveTransformer',
        //'PreparingCustomCodeHelpersTransformer',
        'PreparingEvalCallExpressionTransformer',
        'PreparingMetadataTransformer',
        'PreparingObfuscatingGuardsTransformer',
        'PreparingDirectivePlacementTransformer',
        'InitializingCommentsTransformer',
        'InitializingCustomCodeHelpersTransformer'
    ];

    _getSourceCodeBeforeTransformation(){
        this.sourceCodeBeforeTransformation = astOperations.ASTSourceCodeOperations.generateSourceCodeFromAST(this.ast);
    }

    deobfuscate(){
        throw `Method 'deobfuscate' from 'TransformerDeobfuscator' needs to be overriden.`;
    }

    displaySourceCodeBeforeAndAfterTransformation(transformName){
        if(this.argv.debug){
            this._checkForMissingParentsInAST(transformName);
        }

        if(TransformerDeobfuscator.transformNamesToSkipFromDisplaying.includes(transformName)){
            this.logger.debug(`Not displaying before&after transformation for ${transformName} because `
            + `this transform does not modify the ast.`);
            return;
        }

        const sourceCodeAfterTransformation = astOperations.ASTSourceCodeOperations.generateSourceCodeFromAST(this.ast);
        if(sourceCodeAfterTransformation == this.sourceCodeBeforeTransformation){
            this.logger.debug(`Transformation ${transformName} does not modify contents.`);
            return;
        }

        this._writeTransformationDiffFiles(transformName, sourceCodeAfterTransformation);
    }

    _checkForMissingParentsInAST(transformName){ 
        let foundMissingParent = false;

        estraverse.traverse(this.ast, {
            enter: function(node, parent){
                if(!node.parent){         
                    foundMissingParent = true;
                    this.break();
                }
            }
        });

        if(foundMissingParent){
            this.logger.warn(`Missing parent after transformation '${transformName}.'`);
        }
        else{
            this.logger.debug(`All parents are present for transformation '${transformName}.'`);
        }
    }

    _writeTransformationDiffFiles(transformName, sourceCodeAfterTransformation){
        this.logger.debug(`${'&'.repeat(100)}\nTransformation ${transformName}:\n` + 
        `Before transformation (${transformName}):\n${this.sourceCodeBeforeTransformation}\n` +
        `After transformation (${transformName}):\n${sourceCodeAfterTransformation}\n` +
        `${'&'.repeat(100)}`);

        if(this.argv.writedifffiles){
            const fileName = `transform_${("0" + this.argv.transformNumber).slice(-2)}_${transformName}`;
            usefulModule.writeTextFile(`${fileName}.in`, this.sourceCodeBeforeTransformation);
            usefulModule.writeTextFile(`${fileName}.out`, sourceCodeAfterTransformation);
            this.argv.transformNumber++;
        }
    }
}


module.exports = {StageDeobfuscator, TransformerDeobfuscator};