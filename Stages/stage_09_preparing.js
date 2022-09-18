"use strict";


const esquery = require('esquery');
const stageDeobfuscator = require('./stage_deobfuscator');
const astOperations = require('../ast_operations');


class StagePreparing extends stageDeobfuscator.StageDeobfuscator{
    constructor(logger, obfuscatedSourceCode, ast, argv, stageName){
        super(logger, obfuscatedSourceCode, ast, argv, stageName);
    }

    _initiateTransformers(){
        this.transformers = {
            'PreparingParentificationTransformer': PreparingParentificationTransformer,
            'PreparingRenamePropertiesTransformer': PreparingRenamePropertiesTransformer,
            'PreparingVariablePreserveTransformer': PreparingVariablePreserveTransformer,
            'PreparingCustomCodeHelpersTransformer': PreparingCustomCodeHelpersTransformer,
            'PreparingEvalCallExpressionTransformer': PreparingEvalCallExpressionTransformer,
            'PreparingMetadataTransformer': PreparingMetadataTransformer,
            'PreparingObfuscatingGuardsTransformer': PreparingObfuscatingGuardsTransformer,
            'PreparingDirectivePlacementTransformer': PreparingDirectivePlacementTransformer
        }
    }
}


class PreparingParentificationTransformer extends stageDeobfuscator.TransformerDeobfuscator{
    constructor(logger, obfuscatedSourceCode, ast, argv){
        super(logger, obfuscatedSourceCode, ast, argv);
    }

    deobfuscate(){
        ;
    }
}


class PreparingRenamePropertiesTransformer extends stageDeobfuscator.TransformerDeobfuscator{
    constructor(logger, obfuscatedSourceCode, ast, argv){
        super(logger, obfuscatedSourceCode, ast, argv);
    }

    deobfuscate(){
        ;
    }
}


class PreparingVariablePreserveTransformer extends stageDeobfuscator.TransformerDeobfuscator{
    constructor(logger, obfuscatedSourceCode, ast, argv){
        super(logger, obfuscatedSourceCode, ast, argv);
    }

    deobfuscate(){
        ;
    }
}


class PreparingCustomCodeHelpersTransformer extends stageDeobfuscator.TransformerDeobfuscator{
    constructor(logger, obfuscatedSourceCode, ast, argv){
        super(logger, obfuscatedSourceCode, ast, argv);
    }

    deobfuscate(){
        const removerClasses = {
            'ConsoleOutputDisableRemover': ConsoleOutputDisableRemover,
            'SelfDefendingRemover': SelfDefendingRemover,
            'DebugProtectionRemover': DebugProtectionRemover,
            'DomainLockRemover': DomainLockRemover,
            'CallsControllerRemover': CallsControllerRemover
        };

        for (const className in removerClasses){
            const removerClass = removerClasses[className];
            const removerObject = new removerClass(this.logger, this.obfuscatedSourceCode, this.ast, this.argv);
            this.logger.info(`[stage_09_preparing.js] Remover '${className}'.`);
            try{
                removerObject.deobfuscate();
            }
            catch(e){
                this.logger.error(`[stage_09_preparing.js] Deobfuscation error for Preparing remover `
                + `class '${className}'. error = ${e}. Stack = ${e.stack}`);
            }
        }
    }
}


class ConsoleOutputDisableRemover{
    constructor(logger, obfuscatedSourceCode, ast, argv){
        this.logger = logger;
        this.obfuscatedSourceCode = obfuscatedSourceCode;
        this.ast = ast;
        this.argv = argv;
    }

    deobfuscate(){
        const literalNodes = esquery(this.ast, `VariableDeclaration CallExpression > `
        + `ThisExpression ~ FunctionExpression ArrayExpression > Literal[value='log'] ~ Literal[value='warn']`
        + ` ~ Literal[value='info'] ~ Literal[value='error'] ~ Literal[value='exception'] ~ Literal[value='table']`
        + ` ~ Literal[value='trace']`);
        for(let i = 0; i < literalNodes.length; i++){
            const literalNode = literalNodes[i];
            const functionExpressionParent = astOperations.ASTRelations.getParentNodeOfType(literalNode, 'FunctionExpression');
            const variableDeclaration = astOperations.ASTRelations.getParentNodeOfType(functionExpressionParent, 'VariableDeclaration');
            this.logger.info(`Found 'disableConsoleOutput' related nodes and removing them.`);
            if(this._removeCalls(variableDeclaration)){
                astOperations.ASTModifier.removeSingleNode(variableDeclaration, this.logger, this.obfuscatedSourceCode);
            }
            
        }
    }

    _removeCalls(variableDeclaration){
        let removedANode = false;
        const identifier = astOperations.ASTUtility.getVariableNameFromVariableDeclaration(variableDeclaration);
        if(!identifier){
            return false;
        }

        const callExpressionNodes = esquery(this.ast, `CallExpression[callee.type='Identifier'][callee.name=${identifier}]`);
        for(let i = 0; i < callExpressionNodes.length; i++){
            let nodeToRemove = callExpressionNodes[i];
            if(nodeToRemove.parent.type == 'ExpressionStatement'){
                nodeToRemove = nodeToRemove.parent;
            }
            astOperations.ASTModifier.removeSingleNode(nodeToRemove, this.logger, this.obfuscatedSourceCode);
            removedANode = true;
        }

        return removedANode;
    }
}


class SelfDefendingRemover{
    constructor(logger, obfuscatedSourceCode, ast, argv){
        this.logger = logger;
        this.obfuscatedSourceCode = obfuscatedSourceCode;
        this.ast = ast;
        this.argv = argv;
    }

    deobfuscate(){
        var literalNodes = esquery(this.ast, `VariableDeclaration[declarations.length=1] > VariableDeclarator > `
        + `CallExpression ThisExpression ~ FunctionExpression > BlockStatement > ReturnStatement `
        + `MemberExpression[property.name='search'] Literal[value='(((.+)+)+)+$']`);

        var method2SelfDefending = false;
        if(literalNodes.length == 0){
            literalNodes = esquery(this.ast, `VariableDeclaration[declarations.length=1] > VariableDeclarator > `
            + `CallExpression ThisExpression ~ FunctionExpression > BlockStatement Literal[value='^([^ ]+( +[^ ]+)+)+[^ ]}']`);
            method2SelfDefending = true;
        }

        for(let i = 0; i < literalNodes.length; i++){
            const literalNode = literalNodes[i];
            let functionExpressionParent = astOperations.ASTRelations.getParentNodeOfType(literalNode, 'FunctionExpression');
            if(method2SelfDefending){
                functionExpressionParent = astOperations.ASTRelations.getParentNodeOfType(functionExpressionParent.parent, 'FunctionExpression');
            }
            const variableDeclaration = astOperations.ASTRelations.getParentNodeOfType(functionExpressionParent, 'VariableDeclaration');
            this.logger.info(`Found 'selfDefending' related nodes and removing them.`);
            if(this._removeCalls(variableDeclaration)){
                astOperations.ASTModifier.removeSingleNode(variableDeclaration, this.logger, this.obfuscatedSourceCode);
            }
            
        }
    }

    _removeCalls(variableDeclaration){
        let removedANode = false;
        const identifier = astOperations.ASTUtility.getVariableNameFromVariableDeclaration(variableDeclaration);
        if(!identifier){
            return false;
        }

        const callExpressionNodes = esquery(this.ast, `CallExpression[callee.type='Identifier'][callee.name=${identifier}]`);
        for(let i = 0; i < callExpressionNodes.length; i++){
            let nodeToRemove = callExpressionNodes[i];
            if(nodeToRemove.parent.type == 'ExpressionStatement'){
                nodeToRemove = nodeToRemove.parent;
            }
            astOperations.ASTModifier.removeSingleNode(nodeToRemove, this.logger, this.obfuscatedSourceCode);
            removedANode = true;
        }

        return removedANode;
    }
}


class DebugProtectionRemover extends stageDeobfuscator.TransformerDeobfuscator{
    constructor(logger, obfuscatedSourceCode, ast, argv){
        super(logger, obfuscatedSourceCode, ast, argv);
    }

    deobfuscate(){
        const debugProtectionClasses = {
            'DebugProtectionFunctionTemplate': DebugProtectionFunctionTemplate,
            'DebugProtectionFunctionCallTemplate': DebugProtectionFunctionCallTemplate,
            'DebugProtectionFunctionIntervalTemplate': DebugProtectionFunctionIntervalTemplate
        };

        for (const className in debugProtectionClasses){
            const removerClass = debugProtectionClasses[className];
            const removerObject = new removerClass(this.logger, this.obfuscatedSourceCode, this.ast, this.argv);
            this.logger.info(`[stage_09_preparing.js] Debug protection remover '${className}'.`);
            try{
                removerObject.deobfuscate();
            }
            catch(e){
                this.logger.error(`[stage_09_preparing.js] Deobfuscation error for Debug protection remover `
                + `class '${className}'. error = ${e}. Stack = ${e.stack}`);
            }
        }
    }
}


class DebugProtectionFunctionTemplate{
    constructor(logger, obfuscatedSourceCode, ast, argv){
        this.logger = logger;
        this.obfuscatedSourceCode = obfuscatedSourceCode;
        this.ast = ast;
        this.argv = argv;
    }

    deobfuscate(){
        const updateExpressionNodes = esquery(this.ast, `FunctionDeclaration[params.length=1] > BlockStatement > `
        + `FunctionDeclaration[params.length=1] > BlockStatement > IfStatement[test.type='BinaryExpression']`
        + `[test.operator='==='][test.left.type='UnaryExpression'][test.left.operator='typeof']`
        + `[test.left.argument.type='Identifier'][test.right.type='Literal'][test.right.value='string'] `
        + `~ ExpressionStatement > CallExpression[arguments.length=1] > UpdateExpression[operator='++']`);
        
        if(updateExpressionNodes.length == 0){
            return;
        }
        if(updateExpressionNodes.length != 1){
            this.logger.warn(`Found ${updateExpressionNodes.length} 'DebugProtectionFunctionTemplate' nodes. `
            + `Please check.`);
            return;
        }
        let updateExpression = updateExpressionNodes[0];

        let functionDeclaration = astOperations.ASTRelations.getParentNodeOfType(updateExpression, 'FunctionDeclaration');
        functionDeclaration = functionDeclaration.parent.parent;
        if(functionDeclaration.type != 'FunctionDeclaration'){
            this.logger.warn(`Something went wrong when removing DebugProtectionFunctionTemplate related nodes.`);
        }

        this.logger.info(`Found 'DebugProtectionFunctionTemplate' related nodes and removing them.`);
        astOperations.ASTModifier.removeSingleNode(functionDeclaration, this.logger, this.obfuscatedSourceCode);
    }
}


class DebugProtectionFunctionCallTemplate{
    constructor(logger, obfuscatedSourceCode, ast, argv){
        this.logger = logger;
        this.obfuscatedSourceCode = obfuscatedSourceCode;
        this.ast = ast;
        this.argv = argv;
    }

    deobfuscate(){
        const literalNodes = esquery(this.ast, `ExpressionStatement > CallExpression[arguments.length=0] > `
        + `FunctionExpression[params.length=0][id=null] > BlockStatement CallExpression[arguments.length=2] > `
        + `ThisExpression ~ FunctionExpression NewExpression[callee.type='Identifier'][callee.name='RegExp'] > `
        + `Literal[value='\\\\+\\\\+ *(?:[a-zA-Z_$][0-9a-zA-Z_$]*)']`);
        
        if(literalNodes.length == 0){
            return;
        }
        if(literalNodes.length != 1){
            this.logger.warn(`Found ${literalNodes.length} 'DebugProtectionFunctionCallTemplate' nodes. `
            + `Please check.`);
            return;
        }
        let literal = literalNodes[0];

        let functionExpression = astOperations.ASTRelations.getParentNodeOfType(literal, 'FunctionExpression');
        let expressionStatement = astOperations.ASTRelations.getParentNodeOfType(functionExpression, 'ExpressionStatement');

        this.logger.info(`Found 'DebugProtectionFunctionCallTemplate' related nodes and removing them.`);
        astOperations.ASTModifier.removeSingleNode(expressionStatement, this.logger, this.obfuscatedSourceCode);
    }
}


class DebugProtectionFunctionIntervalTemplate{
    constructor(logger, obfuscatedSourceCode, ast, argv){
        this.logger = logger;
        this.obfuscatedSourceCode = obfuscatedSourceCode;
        this.ast = ast;
        this.argv = argv;
    }

    deobfuscate(){
        const memberExpressionNodes = esquery(this.ast, `ExpressionStatement > CallExpression[arguments.length=0] > `
        + `FunctionExpression > BlockStatement > ExpressionStatement > CallExpression[arguments.length=2] > `
        + `MemberExpression[object.type='Identifier'][property.type='Identifier'][property.name='setInterval']`);
        
        if(memberExpressionNodes.length == 0){
            return;
        }
        if(memberExpressionNodes.length != 1){
            this.logger.warn(`Found ${memberExpressionNodes.length} 'DebugProtectionFunctionIntervalTemplate' nodes. `
            + `Please check.`);
            return;
        }
        let memberExpression = memberExpressionNodes[0];

        let expressionStatement = astOperations.ASTRelations.getParentNodeOfType(memberExpression, 'ExpressionStatement');
        expressionStatement = astOperations.ASTRelations.getParentNodeOfType(expressionStatement.parent, 
            'ExpressionStatement');

        this.logger.info(`Found 'DebugProtectionFunctionIntervalTemplate' related nodes and removing them.`);
        astOperations.ASTModifier.removeSingleNode(expressionStatement, this.logger, this.obfuscatedSourceCode);
    }
}


class DomainLockRemover{
    constructor(logger, obfuscatedSourceCode, ast, argv){
        this.logger = logger;
        this.obfuscatedSourceCode = obfuscatedSourceCode;
        this.ast = ast;
        this.argv = argv;
    }

    deobfuscate(){
        const binaryExpressionNodes = esquery(this.ast, `VariableDeclaration[declarations.length=1] > VariableDeclarator > `
        + `CallExpression[arguments.length=2] > ThisExpression ~ FunctionExpression > BlockStatement > ForInStatement `
        + `+ IfStatement > UnaryExpression[operator='!'] > BinaryExpression[operator='>'][left.type='Literal']`
        + `[left.value='~'][right.type='Identifier']`);

        if(binaryExpressionNodes.length == 0){
            return;
        }
        if(binaryExpressionNodes.length != 1){
            this.logger.warn(`Found ${binaryExpressionNodes.length} 'DomainLockRemover' nodes. Please check.`);
            return;
        }
        let binaryExpression = binaryExpressionNodes[0];

        let variableDeclaration = astOperations.ASTRelations.getParentNodeOfType(binaryExpression, 'VariableDeclaration');

        this.logger.info(`Found 'DomainLockRemover' related nodes and removing them.`);
        astOperations.ASTModifier.removeSingleNode(variableDeclaration, this.logger, this.obfuscatedSourceCode);

        this._removeCalls(variableDeclaration);
    }

    _removeCalls(variableDeclaration){
        const identifier = astOperations.ASTUtility.getVariableNameFromVariableDeclaration(variableDeclaration);
        if(!identifier){
            return false;
        }

        const callExpressionNodes = esquery(this.ast, `CallExpression[callee.type='Identifier'][callee.name=${identifier}]`);
        for(let i = 0; i < callExpressionNodes.length; i++){
            let nodeToRemove = callExpressionNodes[i];
            if(nodeToRemove.parent.type == 'ExpressionStatement'){
                nodeToRemove = nodeToRemove.parent;
            }
            astOperations.ASTModifier.removeSingleNode(nodeToRemove, this.logger, this.obfuscatedSourceCode);
        }
    }
}


class CallsControllerRemover{
    constructor(logger, obfuscatedSourceCode, ast, argv){
        this.logger = logger;
        this.obfuscatedSourceCode = obfuscatedSourceCode;
        this.ast = ast;
        this.argv = argv;
    }

    deobfuscate(){
        const identifierNodes = esquery(this.ast, `VariableDeclaration[declarations.length=1] > VariableDeclarator > `
        + `CallExpression[arguments.length=0] > FunctionExpression > BlockStatement > VariableDeclaration`
        + `[declarations.length=1] + ReturnStatement > FunctionExpression[id=null][params.length=2] > BlockStatement > `
        + `VariableDeclaration[declarations.length=1] > VariableDeclarator > ConditionalExpression[test.type='Identifier']`
        + `[alternate.type='FunctionExpression'][alternate.id=null][alternate.params.length=0][alternate.body.body.length=0]`
        +` > FunctionExpression > BlockStatement > IfStatement CallExpression[callee.type='MemberExpression']`
        + `[callee.property.name='apply'] > Identifier[name='arguments']`);

        if(identifierNodes.length == 0){
            return;
        }
        
        for(let i = 0; i < identifierNodes.length; i++){
            let identifier = identifierNodes[i];

            let returnStatement = astOperations.ASTRelations.getParentNodeOfType(identifier, 'ReturnStatement');
            let variableDeclaration = astOperations.ASTRelations.getParentNodeOfType(returnStatement, 'VariableDeclaration');
    
            this.logger.info(`Found 'CallsControllerRemover' related nodes and removing them.(${i+1}/${identifierNodes.length})`);
            astOperations.ASTModifier.removeSingleNode(variableDeclaration, this.logger, this.obfuscatedSourceCode);
        }

    }
}


class PreparingEvalCallExpressionTransformer extends stageDeobfuscator.TransformerDeobfuscator{
    constructor(logger, obfuscatedSourceCode, ast, argv){
        super(logger, obfuscatedSourceCode, ast, argv);
    }

    deobfuscate(){
        ;
    }
}


class PreparingMetadataTransformer extends stageDeobfuscator.TransformerDeobfuscator{
    constructor(logger, obfuscatedSourceCode, ast, argv){
        super(logger, obfuscatedSourceCode, ast, argv);
    }

    deobfuscate(){
        ;
    }
}


class PreparingObfuscatingGuardsTransformer extends stageDeobfuscator.TransformerDeobfuscator{
    constructor(logger, obfuscatedSourceCode, ast, argv){
        super(logger, obfuscatedSourceCode, ast, argv);
    }

    deobfuscate(){
        ;
    }
}


class PreparingDirectivePlacementTransformer extends stageDeobfuscator.TransformerDeobfuscator{
    constructor(logger, obfuscatedSourceCode, ast, argv){
        super(logger, obfuscatedSourceCode, ast, argv);
    }

    deobfuscate(){
        ;
    }
}


module.exports = {StagePreparing};
