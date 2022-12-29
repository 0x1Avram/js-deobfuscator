"use strict";


const esquery = require('esquery');
const astOperations = require('../ast_operations');
const stageDeobfuscator = require('./stage_deobfuscator');
const usefulModule = require('../useful');


class StageControlFlowFlattening extends stageDeobfuscator.StageDeobfuscator{
    constructor(logger, obfuscatedSourceCode, ast, argv, stageName){
        super(logger, obfuscatedSourceCode, ast, argv, stageName);
    }

    _initiateTransformers(){
        this.transformers = {
            'ControlFlowFlatteningFunctionControlFlowTransformer': ControlFlowFlatteningFunctionControlFlowTransformer,
            'ControlFlowFlatteningCustomCodeHelpersTransformer': ControlFlowFlatteningCustomCodeHelpersTransformer,
            'ControlFlowFlatteningBlockStatementControlFlowTransformer': ControlFlowFlatteningBlockStatementControlFlowTransformer,
        }
    }
}


class ControlFlowFlatteningFunctionControlFlowTransformer extends stageDeobfuscator.TransformerDeobfuscator{
    constructor(logger, obfuscatedSourceCode, ast, argv){
        super(logger, obfuscatedSourceCode, ast, argv);
    }

    deobfuscate(){
        const controlFlowReplacerClasses = {
            'ControlFlowFlatteningBinaryExpressionControlFlowReplacer': ControlFlowFlatteningBinaryExpressionControlFlowReplacer,
            'ControlFlowFlatteningCallExpressionControlFlowReplacer': ControlFlowFlatteningCallExpressionControlFlowReplacer,
            'ControlFlowFlatteningLogicalExpressionControlFlowReplacer': ControlFlowFlatteningLogicalExpressionControlFlowReplacer,
            'ControlFlowFlatteningStringLiteralControlFlowReplacer': ControlFlowFlatteningStringLiteralControlFlowReplacer
        };
        let i = 0;
        for (const className in controlFlowReplacerClasses){
            const replacerClass = controlFlowReplacerClasses[className];
            const replacerObject = new replacerClass(this.logger, this.obfuscatedSourceCode, this.ast, this.argv);
            this.logger.info(`[stage_07_controflowflattening.js] ${i + 1}/4) Replacer '${className}'.`);
            console.log(`[stage_07_controflowflattening.js] ${i + 1}/4) Replacer '${className}'.`);
            try{
                this.sourceCodeBeforeReplacer = astOperations.ASTSourceCodeOperations.generateSourceCodeFromAST(this.ast);
                replacerObject.deobfuscate();
                this._displaySourceCodeBeforeAndAfterReplacer(className);
            }
            catch(e){
                this.logger.error(`[stage_07_controlflowflattening.js] Deobfuscation error for ControlFlowFlattening ` + `
                replacer class '${className}'. error = ${e}. Stack = ${e.stack}`);
            }
            i++;
        }
        this._removeEmptyObjectExpressionDeclarations();
    }

    _removeEmptyObjectExpressionDeclarations(){
        const objectExpressionNodes = esquery(this.ast, `VariableDeclaration > VariableDeclarator > `
        + `ObjectExpression[properties.length=0]`);
        objectExpressionNodes.forEach((objectExpression) => {
            let variableDeclarator = objectExpression.parent;
            const identifier = variableDeclarator.id.name;

            let objectExpressionLexicalScope = astOperations.ASTRelations.getParentNodeWithLexicalScope(objectExpression);
            const identifiersWithObjExpressionName = esquery(objectExpressionLexicalScope, `Identifier[name=${identifier}]`);
            if(identifiersWithObjExpressionName.length == 1){
                let variableDeclaration = variableDeclarator.parent;
                if(variableDeclaration.type != 'VariableDeclaration'){
                    return;
                }
                if(!variableDeclaration.declarations || (variableDeclaration.declarations.length > 1)){
                    return;
                }
                astOperations.ASTModifier.removeSingleNode(variableDeclaration, this.logger, this.obfuscatedSourceCode);
            }
        });
    }

    _displaySourceCodeBeforeAndAfterReplacer(className){
        const sourceCodeAfterReplacer = astOperations.ASTSourceCodeOperations.generateSourceCodeFromAST(this.ast);

        if(sourceCodeAfterReplacer == this.sourceCodeBeforeReplacer){
            this.logger.debug(`Replacer ${className} does not modify contents.`);
            return;
        }

        this._writeTransformationReplcerDiffFiles(className, sourceCodeAfterReplacer);
    }

    _writeTransformationReplcerDiffFiles(className, sourceCodeAfterReplacer){
        this.logger.debug(`${'*'.repeat(100)}\nControlFlowFlattening replacer '${className}':\n` + 
        `Before replacer (${className}):\n${this.sourceCodeBeforeReplacer}\n` +
        `After replacer (${className}):\n${sourceCodeAfterReplacer}\n` +
        `${'*'.repeat(100)}`);

        if(this.argv.writedifffiles){
            const fileName = `transform_replacer_${("0" + this.argv.replacerNumber).slice(-2)}_${className}`;
            usefulModule.writeTextFile(`${fileName}.in`, this.sourceCodeBeforeReplacer);
            usefulModule.writeTextFile(`${fileName}.out`, sourceCodeAfterReplacer);
            this.argv.replacerNumber++;
        }
    }
}


class FunctionControlFlowFlatteningReplacer extends stageDeobfuscator.TransformerDeobfuscator{
    constructor(logger, obfuscatedSourceCode, ast, argv){
        super(logger, obfuscatedSourceCode, ast, argv);
    }

    deobfuscate(){
        throw `Method 'deobfuscate' from 'ControlFlowFlatteningReplacer' needs to be overriden.`;
    }

    _restore(node){
        var found = this._replaceMemberExpressionCalls(node);
        if(found){
            this._removeProperty(node);
        }
        return found;
    }

    _replaceMemberExpressionCalls(node){
        throw `Method '_replaceMemberExpressionCalls' from 'ControlFlowFlatteningReplacer' needs to be overriden.`;
    }

    _getLexicalScopeOfObjectExpression(node){
        const objectExpressionNode = astOperations.ASTRelations.getParentNodeOfType(node, 'ObjectExpression');
        return astOperations.ASTRelations.getParentNodeWithLexicalScope(objectExpressionNode);
    }

    _getMemberExpressionNames(node){
        const propertyNode = astOperations.ASTRelations.getParentNodeOfType(node, 'Property');
        const variableDeclaratorNode = astOperations.ASTRelations.getParentNodeOfType(node, 
            'VariableDeclarator');
        return {
            'objectName': variableDeclaratorNode.id.name,
            'functionName': propertyNode.key.name
        };
    }

    _removeProperty(node){
        const propertyNode = astOperations.ASTRelations.getParentNodeOfType(node, 'Property');
        astOperations.ASTModifier.removeSingleNode(propertyNode, this.logger, this.obfuscatedSourceCode);
    }
}


class ControlFlowFlatteningBinaryExpressionControlFlowReplacer extends FunctionControlFlowFlatteningReplacer{
    constructor(logger, obfuscatedSourceCode, ast, argv){
        super(logger, obfuscatedSourceCode, ast, argv);
    }

    deobfuscate(){
        let nrIterations = 0;
        do{
            nrIterations++;
            console.log(`[stage_07][ControlFlowFlatteningBinaryExpressionControlFlowReplacer] nrIterations = ${nrIterations}.`);
            var foundControlFlowFlattenedBinaryExpresion = false;
            const binaryExpressionNodes = esquery(this.ast, `VariableDeclaration > VariableDeclarator > ObjectExpression > ` + 
            `Property[key.type='Identifier'] > FunctionExpression > BlockStatement > ReturnStatement > BinaryExpression`);
            const totalBinaryExpressions = binaryExpressionNodes.length;
            let nrExpr = 0;
            binaryExpressionNodes.forEach((binaryExpressionNode) => {
                nrExpr++;
                if(nrExpr == 1 || nrExpr % 100 == 0){
                    console.log(`[stage_07][ControlFlowFlatteningBinaryExpressionControlFlowReplacer] nrExpr = ${nrExpr}/${totalBinaryExpressions}.`);
                }
                if(!this._binaryExpressionWasCFFlattened(binaryExpressionNode)){
                    return;
                }
                if(this._restore(binaryExpressionNode)){
                    foundControlFlowFlattenedBinaryExpresion = true;
                }
            });
        }while(foundControlFlowFlattenedBinaryExpresion);
    }

    _binaryExpressionWasCFFlattened(node){
        const blockStatementNode = astOperations.ASTRelations.getParentNodeOfType(node, 'BlockStatement');
        if(!blockStatementNode.body || (blockStatementNode.body.length != 1)){
            return false;
        }

        if((node.left.type != 'Identifier') || (node.right.type != 'Identifier')){
            return false;
        }

        const functionExpressionNode = astOperations.ASTRelations.getParentNodeOfType(node, 'FunctionExpression');
        if(!functionExpressionNode.params || (functionExpressionNode.params.length != 2)
        || (functionExpressionNode.params[0].type != 'Identifier')
        || (functionExpressionNode.params[1].type != 'Identifier')){
            return false;
        }

        if((node.left.name != functionExpressionNode.params[0].name)
        || (node.right.name != functionExpressionNode.params[1].name)){
            return false;
        }

        return true;
    }

    _restore(node){
        var foundControlFlowFlattenedBinaryExpresion = this._replaceMemberExpressionCalls(node);
        if(foundControlFlowFlattenedBinaryExpresion){
            this._removeProperty(node);
        }
        return foundControlFlowFlattenedBinaryExpresion;
    }

    _replaceMemberExpressionCalls(binaryExpressionNode){
        var foundControlFlowFlattenedBinaryExpresion = false;

        let objectExpressionLexicalScope = this._getLexicalScopeOfObjectExpression(binaryExpressionNode);
        const memberExpressionNames = this._getMemberExpressionNames(binaryExpressionNode);

        const memberExpressionNodes = esquery(objectExpressionLexicalScope, `CallExpression > MemberExpression`
        + `[object.type='Identifier'][object.name=${memberExpressionNames.objectName}][property.type='Identifier']`
        + `[property.name=${memberExpressionNames.functionName}]`);
        memberExpressionNodes.forEach((memberExpression) => {
            let callExpression = memberExpression.parent
            if(callExpression.arguments.length != 2){
                return;
            }

            astOperations.ASTModifier.replaceNode(callExpression, {
                type: 'BinaryExpression',
                operator: binaryExpressionNode.operator,
                left: callExpression.arguments[0],
                right: callExpression.arguments[1]
            }, this.logger, this.obfuscatedSourceCode);
            foundControlFlowFlattenedBinaryExpresion = true;
        });

        return foundControlFlowFlattenedBinaryExpresion;
    }

    _getLexicalScopeOfObjectExpression(binaryExpressionNode){
        const objectExpressionNode = astOperations.ASTRelations.getParentNodeOfType(binaryExpressionNode, 
            'ObjectExpression');
        return astOperations.ASTRelations.getParentNodeWithLexicalScope(objectExpressionNode);
    }

    _getMemberExpressionNames(binaryExpressionNode){
        const propertyNode = astOperations.ASTRelations.getParentNodeOfType(binaryExpressionNode, 'Property');
        const variableDeclaratorNode = astOperations.ASTRelations.getParentNodeOfType(binaryExpressionNode, 'VariableDeclarator');
        return {
            'objectName': variableDeclaratorNode.id.name,
            'functionName': propertyNode.key.name
        };
    }

    _removeProperty(binaryExpressionNode){
        const propertyNode = astOperations.ASTRelations.getParentNodeOfType(binaryExpressionNode, 'Property');
        astOperations.ASTModifier.removeSingleNode(propertyNode, this.logger, this.obfuscatedSourceCode);
    }
}


class ControlFlowFlatteningCallExpressionControlFlowReplacer extends FunctionControlFlowFlatteningReplacer{
    constructor(logger, obfuscatedSourceCode, ast, argv){
        super(logger, obfuscatedSourceCode, ast, argv);
    }

    deobfuscate(){
        let nrIterations = 0;
        do{
            nrIterations++;
            console.log(`[stage_07][ControlFlowFlatteningCallExpressionControlFlowReplacer] nrIterations = ${nrIterations}.`);
            var foundControlFlowFlattenedCallExpression = false; 
            
            const callExpressionNodes = esquery(this.ast, `VariableDeclaration > VariableDeclarator > ObjectExpression > ` + 
            `Property[key.type='Identifier'] > FunctionExpression > BlockStatement > ReturnStatement > CallExpression`);
            const totalNrCalls = callExpressionNodes.length;
            let currentNrCalls = 0;
            callExpressionNodes.forEach((callExpression) => {
                currentNrCalls++;
                if((currentNrCalls == 1) || (currentNrCalls % 100 == 0)){
                    console.log(`[stage_07][ControlFlowFlatteningCallExpressionControlFlowReplacer] currentNrCalls = ${currentNrCalls}/${totalNrCalls}.`);
                }

                if(!this._callExpressionWasCFFlattened(callExpression)){
                    return;
                }
                if(this._restore(callExpression)){
                    foundControlFlowFlattenedCallExpression = true;
                }
            });
        }while(foundControlFlowFlattenedCallExpression);
    }

    _callExpressionWasCFFlattened(callExpression){
        const blockStatementNode = astOperations.ASTRelations.getParentNodeOfType(callExpression, 'BlockStatement');
        if(!blockStatementNode.body || (blockStatementNode.body.length != 1)){
            return false;
        }
        const functionExpression = astOperations.ASTRelations.getParentNodeOfType(callExpression, 'FunctionExpression');
        if(functionExpression.params.length == 0){
            return false;
        }

        if((functionExpression.params.length - 1) != callExpression.arguments.length){
            return false;
        }

        if(functionExpression.params[0].name != callExpression.callee.name){
            return false;
        }

        if(callExpression.arguments.length
        && !astOperations.NodeComparer.arraysWithIdentifierNodesAreEqual(functionExpression.params.slice(1), 
                callExpression.arguments)){
            return false;
        }

        return true;
    }

    _restore(callExpression){
        var foundControlFlowFlattenedCallExpression = this._replaceMemberExpressionCalls(callExpression);
        if(foundControlFlowFlattenedCallExpression){
            this._removeProperty(callExpression);
        }
        return foundControlFlowFlattenedCallExpression;
    }

    _replaceMemberExpressionCalls(callExpression){
        var foundControlFlowFlattenedCallExpression = false;

        let objectExpressionLexicalScope = this._getLexicalScopeOfObjectExpression(callExpression);
        const memberExpressionNames = this._getMemberExpressionNames(callExpression);

        const memberExpressionNodes = esquery(objectExpressionLexicalScope, `CallExpression > MemberExpression`
        + `[object.type='Identifier'][object.name=${memberExpressionNames.objectName}][property.type='Identifier']`
        + `[property.name=${memberExpressionNames.functionName}]`);
        memberExpressionNodes.forEach((memberExpression) => {
            let callExpression = memberExpression.parent;
            
            astOperations.ASTModifier.replaceNode(callExpression, {
                type: 'CallExpression',
                callee: {
                    type: 'Identifier',
                    name: callExpression.arguments[0].name
                },
                arguments: callExpression.arguments.slice(1)
            }, this.logger, this.obfuscatedSourceCode);
            foundControlFlowFlattenedCallExpression = true;
        });
        return foundControlFlowFlattenedCallExpression;
    }
}


class ControlFlowFlatteningLogicalExpressionControlFlowReplacer extends FunctionControlFlowFlatteningReplacer{
    constructor(logger, obfuscatedSourceCode, ast, argv){
        super(logger, obfuscatedSourceCode, ast, argv);
    }

    deobfuscate(){
        let nrIterations = 0;
        do{
            nrIterations++;
            console.log(`[stage_07][ControlFlowFlatteningLogicalExpressionControlFlowReplacer] nrIterations = ${nrIterations}.`);
            var foundControlFlowFlattenedLogicalExpression = false;
            
            const logicalExpressionNodes = esquery(this.ast, `VariableDeclaration > VariableDeclarator > ObjectExpression > ` +
            `Property[key.type='Identifier'] > FunctionExpression > BlockStatement > ReturnStatement > LogicalExpression`);
            const totalNrLogicalExpressions = logicalExpressionNodes.length;
            let currentNrLogicalExpressions = 0;
            logicalExpressionNodes.forEach((logicalExpressiion) => {
                currentNrLogicalExpressions++;
                if((currentNrLogicalExpressions == 1) || (currentNrLogicalExpressions % 100 == 0)){
                    console.log(`[stage_07][ControlFlowFlatteningLogicalExpressionControlFlowReplacer] currentNrLogicalExpressions = ` + 
                                `${currentNrLogicalExpressions}/${totalNrLogicalExpressions}.`);
                }
                if(!this._logicalExpressionWasControlFlowFlattened(logicalExpressiion)){
                    return;
                }
                if(this._restore(logicalExpressiion)){
                    foundControlFlowFlattenedLogicalExpression = true;
                }
            });
        }while(foundControlFlowFlattenedLogicalExpression);
    }

    _logicalExpressionWasControlFlowFlattened(logicalExpression){
        const blockStatementNode = astOperations.ASTRelations.getParentNodeOfType(logicalExpression, 'BlockStatement');
        if(!blockStatementNode.body || (blockStatementNode.body.length != 1)){
            return false;
        }

        const functionExpression = astOperations.ASTRelations.getParentNodeOfType(logicalExpression, 'FunctionExpression');
        if(functionExpression.params.length != 2){
            return false;
        }

        if((logicalExpression.left.type != 'Identifier') || (logicalExpression.right.type != 'Identifier')){
            return false;
        }

        if((functionExpression.params[0].type != 'Identifier') || (functionExpression.params[1].type != 'Identifier')){
            return false;
        }

        if((logicalExpression.left.name != functionExpression.params[0].name)
        || (logicalExpression.right.name != functionExpression.params[1].name)){
            return false;
        }

        return true;
    }

    _restore(logicalExpression){
        var foundControlFlowFlattenedLogicalExpression = this._replaceMemberExpressionCalls(logicalExpression);
        if(foundControlFlowFlattenedLogicalExpression){
            this._removeProperty(logicalExpression);
        }
        return foundControlFlowFlattenedLogicalExpression;
    }

    _replaceMemberExpressionCalls(logicalExpression){
        var foundControlFlowFlattenedLogicalExpression = false;

        let objectExpressionLexicalScope = this._getLexicalScopeOfObjectExpression(logicalExpression);
        const memberExpressionNames = this._getMemberExpressionNames(logicalExpression);
        const memberExpressionNodes = esquery(objectExpressionLexicalScope, `CallExpression > MemberExpression`
        + `[object.type='Identifier'][object.name=${memberExpressionNames.objectName}][property.type='Identifier']`
        + `[property.name=${memberExpressionNames.functionName}]`);

        memberExpressionNodes.forEach((memberExpression) => {
            let callExpression = memberExpression.parent;
            
            astOperations.ASTModifier.replaceNode(callExpression, {
                type: 'LogicalExpression',
                operator: logicalExpression.operator,
                left: callExpression.arguments[0],
                right: callExpression.arguments[1]
            }, this.logger, this.obfuscatedSourceCode);
            foundControlFlowFlattenedLogicalExpression = true;
        });

        return foundControlFlowFlattenedLogicalExpression;
    }
}


class ControlFlowFlatteningStringLiteralControlFlowReplacer extends FunctionControlFlowFlatteningReplacer{
    constructor(logger, obfuscatedSourceCode, ast, argv){
        super(logger, obfuscatedSourceCode, ast, argv);
    }

    deobfuscate(){
        let nrIterations = 0;
        do{
            nrIterations++;
            console.log(`[stage_07][ControlFlowFlatteningStringLiteralControlFlowReplacer] nrIterations = ${nrIterations}.`);
            var foundControlFlowFlattenedCallExpression = false; 
            
            const literalNodes = esquery(this.ast, `VariableDeclaration > VariableDeclarator > ObjectExpression > ` + 
            `Property[key.type='Identifier'] > Literal`);
            const totalNrLiteralNodes = literalNodes.length;
            let currentNrLiteralNodes = 0;

            literalNodes.forEach((stringLiteralNode) => {
                currentNrLiteralNodes++;
                if((currentNrLiteralNodes == 1) || (currentNrLiteralNodes % 100 == 0)){
                    console.log(`[stage_07][ControlFlowFlatteningCallExpressionControlFlowReplacer] currentNrCalls = ` + 
                                `${currentNrLiteralNodes}/${totalNrLiteralNodes}.`);
                }

                if(typeof stringLiteralNode.value != 'string'){
                    return;
                }
                if(this._restore(stringLiteralNode)){
                    foundControlFlowFlattenedCallExpression = true;
                }
            });
        }while(foundControlFlowFlattenedCallExpression);
    }

    _restore(stringLiteralNode){
        var foundControlFlowFlattenedStringLiteral = this._replaceMemberExpressionCalls(stringLiteralNode);
        if(foundControlFlowFlattenedStringLiteral){
            this._removeProperty(stringLiteralNode);
        }
        return foundControlFlowFlattenedStringLiteral;
    }
    
    _replaceMemberExpressionCalls(stringLiteralNode){
        var foundControlFlowFlattenedStringLiteral = false;

        let objectExpressionLexicalScope = this._getLexicalScopeOfObjectExpression(stringLiteralNode);
        const memberExpressionNames = this._getMemberExpressionNames(stringLiteralNode);
        let memberExpressionNodes = esquery(objectExpressionLexicalScope, `MemberExpression[object.type='Identifier']`
        + `[object.name=${memberExpressionNames.objectName}][property.type='Identifier']`
        + `[property.name=${memberExpressionNames.propertyName}]`);
        
        memberExpressionNodes.forEach((memberExpression) => {
            astOperations.ASTModifier.replaceNode(memberExpression, {
                type: 'Literal',
                value: stringLiteralNode.value
            }, this.logger, this.obfuscatedSourceCode);
            foundControlFlowFlattenedStringLiteral = true;
        });

        return foundControlFlowFlattenedStringLiteral;
    }

    _getMemberExpressionNames(stringLiteralNode){
        const propertyNode = astOperations.ASTRelations.getParentNodeOfType(stringLiteralNode, 'Property');
        const variableDeclaratorNode = astOperations.ASTRelations.getParentNodeOfType(stringLiteralNode, 'VariableDeclarator');
        return {
            'objectName': variableDeclaratorNode.id.name,
            'propertyName': propertyNode.key.name
        };
    }
}


class ControlFlowFlatteningCustomCodeHelpersTransformer extends stageDeobfuscator.TransformerDeobfuscator{
    constructor(logger, obfuscatedSourceCode, ast, argv){
        super(logger, obfuscatedSourceCode, ast, argv);
    }

    deobfuscate(){
        ;
    }
}


class ControlFlowFlatteningBlockStatementControlFlowTransformer extends stageDeobfuscator.TransformerDeobfuscator{
    constructor(logger, obfuscatedSourceCode, ast, argv){
        super(logger, obfuscatedSourceCode, ast, argv);
    }

    deobfuscate(){
        this._deobfuscateNodes(this.ast);
    }

    _deobfuscateNodes(astNodes){
        if(!Array.isArray(astNodes)){
            astNodes = [astNodes];
        }

        for(let i = 0; i < astNodes.length; i++){
            let controllerNodes = this._getControllerNodes(astNodes[i]);
            controllerNodes.forEach((controllerNode) => {
                this._deobfuscateControllerNode(controllerNode);
            });
        }
    }

    _getControllerNodes(ast){
        let controllerNodes = [];

        const possibleControllerNodes = esquery(ast, `VariableDeclaration > VariableDeclarator > CallExpression[arguments.length=1] > ` + 
        `MemberExpression[object.type='Literal'][property.type='Identifier'][property.name='split']`);
        possibleControllerNodes.forEach((possibleControllerNode) => {
            if(this._isControllerNodeForBlockStatement(possibleControllerNode)){
                controllerNodes.push(possibleControllerNode);
            }
        });
        
        return controllerNodes;
    }

    _isControllerNodeForBlockStatement(memberExpressionNode){
        let callExpression = memberExpressionNode.parent;
        if((callExpression.arguments[0].type != 'Literal') || (callExpression.arguments[0].value != '|')){
            return false;
        }
        
        if(!memberExpressionNode.object){
            return false;
        }
        const controlFlowOrderStr = memberExpressionNode.object.value;
        if((typeof controlFlowOrderStr != 'string') || !controlFlowOrderStr.match(/^(?:\d+\|)+\d+/)){
            return false;
        }

        const controlFlowOrder = this._getControlFlowOrder(memberExpressionNode);
        const numericallySortedCFOrder = controlFlowOrder.sort(function(a, b) {
            return a - b;
          });
        for(let i = 0; i < numericallySortedCFOrder.length; i++){
            if(numericallySortedCFOrder[i] != i){
                return false;
            }
        }

        let whileTrueNode = this._getWhileTrueNode(memberExpressionNode);
        if(!whileTrueNode){
            return false;
        }

        let indexerNode = this._getIndexerNode(whileTrueNode);
        if(!indexerNode){
            return false;
        }

        return true;
    }

    _getControlFlowOrder(controllerNodeMemberExpression){
        const controlFlowOrderStr = controllerNodeMemberExpression.object.value;
        return controlFlowOrderStr.split('|');
    }

    _getWhileTrueNode(controllerNodeMemberExpression){
        const variableDeclarator = astOperations.ASTRelations.getParentNodeOfType(controllerNodeMemberExpression, 
            'VariableDeclarator');
        const controllerNodeName = variableDeclarator.id.name;

        let controllerNodeLexicalScope = astOperations.ASTRelations.getParentNodeWithLexicalScope(
            controllerNodeMemberExpression);
        const whileTrueNodes = esquery(controllerNodeLexicalScope, `WhileStatement[test.type='Literal']` 
        + `[test.value='true'] > BlockStatement > `
        + `SwitchStatement[discriminant.type='MemberExpression'][discriminant.object.type='Identifier']` + 
        `[discriminant.object.name=${controllerNodeName}]` +
        `[discriminant.property.type='UpdateExpression'][discriminant.property.operator='++']` + 
        `[discriminant.property.argument.type='Identifier'] ~ BreakStatement`);
        if(whileTrueNodes.length != 1){
            return null;
        } 

        if(this._isGetWhileTrueNodeBlockValid(whileTrueNodes[0], controllerNodeMemberExpression)){
            return whileTrueNodes[0];
        }

        return null;
    }

    _isGetWhileTrueNodeBlockValid(whileTrueNode, controllerNodeMemberExpression){
        const controlFlowOrder = this._getControlFlowOrder(controllerNodeMemberExpression);
        const nrSwitchesItShouldHave = controlFlowOrder.length;

        const switchStatementNode = whileTrueNode.parent.body[0];
        if(nrSwitchesItShouldHave == switchStatementNode.cases.length){
            return true;
        }

        return false;
    }

    _getIndexerNode(whileTrueNode){
        const switchStatementNode = whileTrueNode.parent.body[0];
        const indexerNodeName = switchStatementNode.discriminant.property.argument.name;

        let whileTrueNodeLexicalScope = astOperations.ASTRelations.getParentNodeWithLexicalScope(whileTrueNode);
        const indexerNodes = esquery(whileTrueNodeLexicalScope, `VariableDeclaration > VariableDeclarator[id.type='Identifier']` + 
        `[id.name=${indexerNodeName}][init.type='Literal'][init.value='0']`);
        if(indexerNodes.length != 1){
            return null;
        }
        return indexerNodes[0].parent; 
    }

    _deobfuscateControllerNode(controllerNodeMemberExpression){
        let controllerVariableDeclarationNode = astOperations.ASTRelations.getParentNodeOfType(controllerNodeMemberExpression, 
            'VariableDeclaration');

        let whileTrueBreakStatementNode = this._getWhileTrueNode(controllerNodeMemberExpression);
        if(whileTrueBreakStatementNode == null){
            return;
        }
        let indexerNode = this._getIndexerNode(whileTrueBreakStatementNode);

        let whileStatementNode = astOperations.ASTRelations.getParentNodeOfType(whileTrueBreakStatementNode, 'WhileStatement');
        
        const controlFlowOrder = this._getControlFlowOrder(controllerNodeMemberExpression);
        let deobfuscatedStatements = [];
        let foundError = false;
        controlFlowOrder.forEach((nextCase) => {
            const switchCaseNodes = esquery(whileStatementNode, `WhileStatement > BlockStatement > SwitchStatement > `
            + `SwitchCase[test.type='Literal'][test.value=${nextCase}]`);
            var switchCase = null;

            if(switchCaseNodes.length != 1){
                for(let i = 0; i < switchCaseNodes.length; i++){
                    let tempSwitchCase = switchCaseNodes[i];
                    let tempWhileStatement = astOperations.ASTRelations.getParentNodeOfType(tempSwitchCase, 'WhileStatement');
                    if(tempWhileStatement == whileStatementNode){
                        switchCase = tempSwitchCase;
                        break;
                    }
                }

                if(!switchCase){
                    const controllerSource = astOperations.ASTSourceCodeOperations.generateSourceCodeFromAST(controllerNodeMemberExpression);
                    const indexerSource = astOperations.ASTSourceCodeOperations.generateSourceCodeFromAST(indexerNode);
                    this.logger.warn(`[stage_07_controlflowflattening.js] Something is wrong while deobfuscating switch cases ` +
                    `for NodeBlockStatementControlFlowTransformer. Error 1. length = ${switchCaseNodes.length}, controllerSource = `
                    + `${controllerSource}, indexerSource = ${indexerSource}, nextCase = ${nextCase}.`);
                    foundError = true;
                    return;
                }
            }
            else{
                switchCase = switchCaseNodes[0];
            }

            if(switchCase.consequent.length < 1){
                this.logger.warn(`[stage_07_controlflowflattening.js] Something is wrong while deobfuscating switch cases ` +
                `for NodeBlockStatementControlFlowTransformer. Error 2.`);
                foundError = true;
                return;
            }

            for(let i = 0; i < (switchCase.consequent.length - 1); i++){
                deobfuscatedStatements.push(switchCase.consequent[i]);
            }
            if(switchCase.consequent[switchCase.consequent.length-1].type != 'ContinueStatement'){
                deobfuscatedStatements.push(switchCase.consequent[switchCase.consequent.length-1]);
            }
        });
        if(foundError){
            return;
        }

        let blockStatementNode = astOperations.ASTRelations.getParentNodeOfType(whileStatementNode, 'BlockStatement');
        if(!blockStatementNode){
            blockStatementNode = astOperations.ASTRelations.getParentNodeOfType(whileStatementNode, 'Program');
        }
        astOperations.ASTModifier.insertNodesAfter(whileStatementNode, deobfuscatedStatements, this.logger, this.obfuscatedSourceCode);
        this._deobfuscateNodes(deobfuscatedStatements);
        astOperations.ASTModifier.removeSingleNode(whileStatementNode, this.logger, this.obfuscatedSourceCode);

        astOperations.ASTModifier.removeSingleNode(controllerVariableDeclarationNode, this.logger, this.obfuscatedSourceCode);
        astOperations.ASTModifier.removeSingleNode(indexerNode, this.logger, this.obfuscatedSourceCode);
    }
}


module.exports = {StageControlFlowFlattening};
