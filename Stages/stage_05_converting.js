"use strict";


const estraverse = require('estraverse');
const esquery = require('esquery');
const astOperations = require('../ast_operations');
const stageDeobfuscator = require('./stage_deobfuscator');
const usefulModule = require('../useful');



class StageConverting extends stageDeobfuscator.StageDeobfuscator{
    constructor(logger, obfuscatedSourceCode, ast, argv, stageName){
        super(logger, obfuscatedSourceCode, ast, argv, stageName);
    }

    _initiateTransformers(){
        this.transformers = {
            'ConvertingSplitStringTransformer': ConvertingSplitStringTransformer,
            'ConvertingNumberLiteralTransformer': ConvertingNumberLiteralTransformer,
            'ConvertingCustomCodeHelpersTransformer': ConvertingCustomCodeHelpersTransformer,
            'ConvertingObjectExpressionKeysTransformer': ConvertingObjectExpressionKeysTransformer,
            'ConvertingTemplateLiteralTransformer': ConvertingTemplateLiteralTransformer,
            'ConvertingObjectPatternPropertiesTransformer': ConvertingObjectPatternPropertiesTransformer,
            'ConvertingObjectExpressionTransformer': ConvertingObjectExpressionTransformer,
            'ConvertingNumberToNumericalExpressionTransformer': ConvertingNumberToNumericalExpressionTransformer,
            'ConvertingMemberExpressionTransformer': ConvertingMemberExpressionTransformer,
            'ConvertingExportSpecifierTransformer': ConvertingExportSpecifierTransformer,
            'ConvertingVariablePreserveTransformer': ConvertingVariablePreserveTransformer,
            'ConvertingClassFieldTransformer': ConvertingClassFieldTransformer,
            'ConvertingBooleanLiteralTransformer': ConvertingBooleanLiteralTransformer,
        }
    }
}


class ConvertingSplitStringTransformer extends stageDeobfuscator.TransformerDeobfuscator{
    constructor(logger, obfuscatedSourceCode, ast, argv){
        super(logger, obfuscatedSourceCode, ast, argv);
    }

    deobfuscate(){
        var thisObj = this;
        estraverse.replace(this.ast, {
            enter: function(node){
                if(thisObj._nodeIsStringSplittedInBinaryExpression(node)){
                    return thisObj._recursiveCombineStrings(node);
                }
            }
        });
    }

    _nodeIsStringSplittedInBinaryExpression(node){
        if((node.type != 'BinaryExpression') || (node.operator != '+')){
            return false;
        }

        if(!node.left || !node.right){
            return false;
        }
    
        if((node.left.type == 'Literal') 
        && ((node.right.type == 'Literal') || (node.right.type == 'BinaryExpression'))){
            return true;
        }
    
        if((node.right.type == 'Literal') 
        && ((node.left.type == 'Literal') || (node.left.type == 'BinaryExpression'))){
            return true;
        }
    
        return false;
    }
    
    _recursiveCombineStrings(node){
        do{
            var foundSplitString = false; 
            var thisObj = this;
            estraverse.replace(node, {
                enter: function(node){
                    if(thisObj._nodeIsStringSplittedInBinaryExpressionWithLiteralsOnly(node)){
                        foundSplitString = true;
                        return thisObj._concatenateStringLiteralNodes(node);
                    }
                }
            });

            if(this._nodeIsStringSplittedInBinaryExpressionWithLiteralsOnly(node)){
                return this._concatenateStringLiteralNodes(node);
            }
        }while(foundSplitString);

        return node;
    }

    _nodeIsStringSplittedInBinaryExpressionWithLiteralsOnly(node){
        if((node.type == 'BinaryExpression') && (node.operator == '+')
        && (node.left.type == 'Literal') && (node.right.type == 'Literal')
        && (typeof node.left.value == 'string') && (typeof node.right.value == 'string')){
            return true;
        }
        return false;
    }

    _concatenateStringLiteralNodes(node){
        const newNode = {
            type: 'Literal', 
            value: node.left.value + node.right.value,
            parent: node.parent
        }; 
        astOperations.ASTModifier.logDebugEstraverseReplace(node, newNode, this.logger, this.obfuscatedSourceCode, true);
        return newNode;
    }
}


class ConvertingNumberLiteralTransformer extends stageDeobfuscator.TransformerDeobfuscator{
    constructor(logger, obfuscatedSourceCode, ast, argv){
        super(logger, obfuscatedSourceCode, ast, argv);
    }

    deobfuscate(){
        ;
    }
}


class ConvertingCustomCodeHelpersTransformer extends stageDeobfuscator.TransformerDeobfuscator{
    constructor(logger, obfuscatedSourceCode, ast, argv){
        super(logger, obfuscatedSourceCode, ast, argv);
    }

    deobfuscate(){
        ;
    }
}


class ConvertingObjectExpressionKeysTransformer extends stageDeobfuscator.TransformerDeobfuscator{
    constructor(logger, obfuscatedSourceCode, ast, argv){
        super(logger, obfuscatedSourceCode, ast, argv);
    }

    deobfuscate(){
        this._deobfuscateBasePropertiesExtractor();
        this._deobfuscateObjectExpressionToVariableDeclarationExtractor();
    }

    _deobfuscateBasePropertiesExtractor(){
        const variableDeclaratorNodes = esquery(this.ast, `VariableDeclaration > VariableDeclarator` + 
            `[id.type='Identifier'][init.type='ObjectExpression']`);

        variableDeclaratorNodes.forEach((variableDeclarator) => {
            let objectExpressionNode = variableDeclarator.init;

            const expressionStatementNodes = this._getExpressionStatementNodesContainingMemberExpressionWithIdentifier(
                variableDeclarator);
            
            for(let i = 0; i < expressionStatementNodes.length; i++){
                let expressionStatement = expressionStatementNodes[i];
                if(!expressionStatement.expression){
                    continue;
                }
                const leftPartOfAssignmentExpression = expressionStatement.expression.left;
                const rightPartOfAssignmentExpression = expressionStatement.expression.right; 

                const keysPath = this._getPropertiesOfExpressionStatementForBasePropertiesExtractor(
                    leftPartOfAssignmentExpression);
                if(this._addToObjectExpressionNodeForBasePropertiesExtractor(objectExpressionNode, 
                    keysPath, rightPartOfAssignmentExpression)){
                    astOperations.ASTModifier.removeSingleNode(expressionStatement, this.logger, this.obfuscatedSourceCode);
                }
            }
        });
    }

    _getExpressionStatementNodesContainingMemberExpressionWithIdentifier(variableDeclarator){
        let nodes = [];
        if(!variableDeclarator.id){
            return nodes;
        }
        const identifierName = variableDeclarator.id.name;

        const variableDeclaratorLexicalScope = astOperations.ASTRelations.getParentNodeWithLexicalScope(
            variableDeclarator);
        const identifierNodes = esquery(variableDeclaratorLexicalScope, `ExpressionStatement > `
        + `AssignmentExpression[operator='='][left.type='MemberExpression'][left.property.type='Literal'] `
        + `MemberExpression > Identifier[name=${identifierName}]`);
        for(let i = 0; i < identifierNodes.length; i++){
            const identifierNode = identifierNodes[i];
            const expressionStatement = astOperations.ASTRelations.getParentNodeOfType(identifierNode, 
                'ExpressionStatement');
            if(this._expressionStatementWasExtractedFromBaseProperty(expressionStatement, identifierName)){
                nodes.push(expressionStatement);
            }
        }
        
        return nodes;
    }

    _expressionStatementWasExtractedFromBaseProperty(expressionStatement, identifier){
        if(!expressionStatement || (expressionStatement.type != 'ExpressionStatement')){
            return false;
        }

        if(!expressionStatement.expression){
            return false;
        }

        const assignmentExpression = expressionStatement.expression;
        if((assignmentExpression.type != 'AssignmentExpression') || (assignmentExpression.operator != '=')){
            return false;
        }

        if(!assignmentExpression.left){
            return false;
        }

        let leftNode = assignmentExpression.left;
        if(leftNode.type != 'MemberExpression'){
            return false;
        }

        while(leftNode){
            if(leftNode.type == 'Identifier'){
                if(leftNode.name == identifier){
                    return true;
                }
                else{
                    return false;
                }
            }
            else if(leftNode.type == 'MemberExpression'){
                const property = leftNode.property;
                if(!property){
                    return false;
                }
                if((property.type != 'Literal') || (typeof property.value != 'string')){
                    return false;
                }

                if(!leftNode.object){
                    return false;
                }
                leftNode = leftNode.object;
            }
            else{
                return false;
            }
        }

        return false;
    }

    _getPropertiesOfExpressionStatementForBasePropertiesExtractor(expressionStatementNode){
        let path = [];
        const literalNodes = esquery(expressionStatementNode, `MemberExpression > Literal`);
        literalNodes.forEach((literalNode) => {
            path.push(literalNode.value);
        });
        return path;
    }

    _addToObjectExpressionNodeForBasePropertiesExtractor(objectExpressionNode, keysPath, rightPartOfAssignmentExpression){
        let objectExpressionNodeToAddTo = this._getObjectExpressionNodeToAddToForBasePropertiesExtractor(
            objectExpressionNode, keysPath);
        if(!objectExpressionNodeToAddTo){
            return false;
        }
        if((objectExpressionNodeToAddTo.type != 'ObjectExpression')){
            return false;
        }

        let newProperty = {
            type: 'Property',
            key: {
                type: 'Literal',
                value: keysPath[keysPath.length - 1]
            },
            computed: false,
            value: rightPartOfAssignmentExpression,
            kind: 'init',
            method: false,
            shorthand: false,
            parent: objectExpressionNodeToAddTo
        }
        astOperations.ASTRelations.addParentsToASTNodesExcludingRoot(newProperty);
        astOperations.ASTModifier.logDebugNode('[Converting][KeysTransformer-BaseProperties][Adding property to dictionary]'
        + '[Old]', objectExpressionNodeToAddTo, this.logger, this.obfuscatedSourceCode, true);
        objectExpressionNodeToAddTo.properties.push(newProperty);
        astOperations.ASTModifier.logDebugNode('[Converting][KeysTransformer-BaseProperties][Adding property to dictionary]'
        + '[New]', objectExpressionNodeToAddTo, this.logger, this.obfuscatedSourceCode, true);
        return true;
    }

    _getObjectExpressionNodeToAddToForBasePropertiesExtractor(objectExpressionToAddTo, keysPath){
        let searchScope = [];
        let i = 0;
        do{
            const key = keysPath[i];
            searchScope = esquery(objectExpressionToAddTo, `ObjectExpression > Property[key.value=${key}]`);
            if(searchScope.length == 0){
                searchScope = esquery(objectExpressionToAddTo, `ObjectExpression > Property[key.name=${key}]`);
            }

            if(searchScope.length == 1){
                objectExpressionToAddTo = searchScope[0].value;
            }
            if(searchScope.length > 1){
                return null;
            }
            if(objectExpressionToAddTo.type == 'Literal'){
                return null;
            }
            i++;
        }while(searchScope.length > 0);
    
        return objectExpressionToAddTo;
    }

    _deobfuscateObjectExpressionToVariableDeclarationExtractor(){
        const variableDeclaratorNodes = esquery(this.ast, `VariableDeclaration > VariableDeclarator`
        + `[id.type='Identifier'][init.type='ObjectExpression']`);

        variableDeclaratorNodes.forEach((variableDeclarator) => {
            const oldIdentifier = variableDeclarator.id.name;
            const variableDeclaration = variableDeclarator.parent;
            const variableKind = variableDeclaration.kind;

            const variableDeclarationLexicalScope = astOperations.ASTRelations.getParentNodeWithLexicalScope(
                variableDeclaration);
            const extractedVariableDeclarationNodes = esquery(variableDeclarationLexicalScope, 
                `VariableDeclaration[kind=${variableKind}] > VariableDeclarator[id.type='Identifier'][init.type='Identifier']`
                + `[init.name=${oldIdentifier}]`);
            
            if(extractedVariableDeclarationNodes.length == 1){
                let newIdentifier = extractedVariableDeclarationNodes[0].id.name; 
                const nodeToRemove = extractedVariableDeclarationNodes[0].parent;
                astOperations.ASTModifier.removeSingleNode(nodeToRemove, this.logger, this.obfuscatedSourceCode);

                this._renameVariableDeclarator(variableDeclarator, newIdentifier);
                this._renameVariableInExpressions(variableDeclarationLexicalScope, oldIdentifier, newIdentifier);
            }
        });    
    }

    _renameVariableDeclarator(variableDeclarator, newName){
        const variableDeclaration = variableDeclarator.parent;
        astOperations.ASTModifier.logDebugNode('[Converting][KeysTransformer-VariableDeclaration][Rename dictionary]'
        + '[Old]', variableDeclaration, this.logger, this.obfuscatedSourceCode, true);
        variableDeclarator.id.name = newName;
        astOperations.ASTModifier.logDebugNode('[Converting][KeysTransformer-VariableDeclaration][Rename dictionary]'
        + '[New]', variableDeclaration, this.logger, this.obfuscatedSourceCode, true);
    }

    _renameVariableInExpressions(variableDeclarationLexicalScope, oldIdentifier,newIdentifier){
        const identifierExpressionStatementNodes = esquery(variableDeclarationLexicalScope, `ExpressionStatement > ` + 
        `AssignmentExpression[operator='='][left.type='MemberExpression'][left.property.type='Literal'] `
        + `Identifier[name=${oldIdentifier}]`);
        identifierExpressionStatementNodes.forEach((identifierNode) => {
            const expressionStatement = astOperations.ASTRelations.getParentNodeOfType(identifierNode, 'ExpressionStatement');
            astOperations.ASTModifier.logDebugNode('[Converting][KeysTransformer-VariableDeclaration][Rename in expressions]'
            + '[Old]', expressionStatement, this.logger, this.obfuscatedSourceCode, true);
            identifierNode.name = newIdentifier;
            astOperations.ASTModifier.logDebugNode('[Converting][KeysTransformer-VariableDeclaration][Rename in expressions]'
            + '[New]', expressionStatement, this.logger, this.obfuscatedSourceCode, true);
        });
    }
}


class ConvertingTemplateLiteralTransformer extends stageDeobfuscator.TransformerDeobfuscator{
    constructor(logger, obfuscatedSourceCode, ast, argv){
        super(logger, obfuscatedSourceCode, ast, argv);
    }

    deobfuscate(){
        ;
    }
}


class ConvertingObjectPatternPropertiesTransformer extends stageDeobfuscator.TransformerDeobfuscator{
    constructor(logger, obfuscatedSourceCode, ast, argv){
        super(logger, obfuscatedSourceCode, ast, argv);
    }

    deobfuscate(){
        const propertyNodes = esquery(this.ast, `ObjectPattern > Property[shorthand=false]`);
        propertyNodes.forEach((propertyNode) => {
            if(this._objectPatternPropertyNodeIsCloned(propertyNode)){
                astOperations.ASTModifier.logDebugNode('[Converting][PatternProperties][Changing to shorthand]'
                + '[Old]', propertyNode.parent, this.logger, this.obfuscatedSourceCode, true);
                propertyNode.shorthand = true;
                astOperations.ASTModifier.logDebugNode('[Converting][PatternProperties][Changing to shorthand]'
                + '[New]', propertyNode.parent, this.logger, this.obfuscatedSourceCode, true);
            }
        });
    }

    _objectPatternPropertyNodeIsCloned(node){
        if(!node || !node.key){
            return false;
        }

        if(!node.shorthand && (node.key.type == node.value.type) && (node.key.name == node.value.name)){
            return true;
        }
        return false;
    }
}


class ConvertingObjectExpressionTransformer extends stageDeobfuscator.TransformerDeobfuscator{
    constructor(logger, obfuscatedSourceCode, ast, argv){
        super(logger, obfuscatedSourceCode, ast, argv);
    }

    deobfuscate(){
        var thisObj = this;
        estraverse.traverse(this.ast, {
            enter: function(node){
                if(node.type == 'ObjectExpression'){
                    thisObj._deobfuscateObjectExpressionNodeWithStringKey(node);
                }
            }
        });
    }

    _deobfuscateObjectExpressionNodeWithStringKey(objectExpressionNode){
        if(!objectExpressionNode.properties){
            return;
        }

        for(let i = 0; i < objectExpressionNode.properties.length; i++){
            let property = objectExpressionNode.properties[i];
            if(property.type != 'Property'){
                continue;
            }
            if(!property.key){
                continue;
            }
    
            const literalNode = property.key;
            if((literalNode.type != 'Literal') || (typeof literalNode.value != 'string')){
                continue;
            }

            if(!usefulModule.StringOperations.isValidIdentifierName(literalNode.value)){
                continue;
            }
    
            astOperations.ASTModifier.logDebugNode('[Converting][ObjectExpression][Changing to non string property]'
            + '[Old]', property, this.logger, this.obfuscatedSourceCode, true);
            property.key = {
                type: 'Identifier',
                name: literalNode.value,
                parent: property
            }
            astOperations.ASTModifier.logDebugNode('[Converting][ObjectExpression][Changing to non string property]'
            + '[New]', property, this.logger, this.obfuscatedSourceCode, true);
        }
    }
}


class ConvertingNumberToNumericalExpressionTransformer extends stageDeobfuscator.TransformerDeobfuscator{
    constructor(logger, obfuscatedSourceCode, ast, argv){
        super(logger, obfuscatedSourceCode, ast, argv);
    }

    deobfuscate(){
        do{
            var foundBinaryExpressionWithLiterals = false; 
            const binaryExpressionNodesWithLiterals = esquery(this.ast, `BinaryExpression:matches([left.type='Literal'], `
            + `[left.type='UnaryExpression']):matches([right.type='Literal'], [right.type='UnaryExpression'])`);
            binaryExpressionNodesWithLiterals.forEach((binaryExpression) => {
                if(!this._binaryExpressionCanBeEvalled(binaryExpression)){
                    return;
                }
                foundBinaryExpressionWithLiterals = true;

                let newNode = this._createNewLiteralNode(binaryExpression);
                astOperations.ASTModifier.replaceNode(binaryExpression, newNode, this.logger, this.obfuscatedSourceCode);
            });
        }while(foundBinaryExpressionWithLiterals);
    }

    _binaryExpressionCanBeEvalled(binaryExpression){
        if(binaryExpression.left.type == 'UnaryExpression'){
            if(!this._unaryExpressionCanBeEvalled(binaryExpression.left)){
                return false;
            }
        }
        if(binaryExpression.right.type == 'UnaryExpression'){
            if(!this._unaryExpressionCanBeEvalled(binaryExpression.right)){
                return false;
            }
        }
        if(this._binaryExpressionComparesStrings(binaryExpression)){
            return false;
        }
    
        return true;
    }

    _unaryExpressionCanBeEvalled(unaryExpression){
        if(!unaryExpression.argument){
            return false;
        }

        if((unaryExpression.operator == '-') && (unaryExpression.argument.type == 'Literal')){
            return true;
        }
        return false;
    }

    _binaryExpressionComparesStrings(node){
        const operator = node.operator;
        const left = node.left;
        const right = node.right;
        if((left.type != 'Literal') || (right.type != 'Literal')){
            return false;
        }
        if((operator != '===') && (operator != '!==')){
            return false;
        }
        if((typeof left.value != 'string') || (typeof right.value != 'string')){
            return false;
        }

        return true;
    }

    _createNewLiteralNode(binaryExpression){
        const newLiteralValue = astOperations.NodeEvaller.evalNodeFromASTRepresentation(binaryExpression);

        if(typeof newLiteralValue == 'string'){
            return {
                type: 'Literal',
                value: newLiteralValue
            };
        }
        else{
            // number node
            return astOperations.NodeCreator.createNodeLiteralNumber(newLiteralValue);
        }
    }
}


class ConvertingMemberExpressionTransformer extends stageDeobfuscator.TransformerDeobfuscator{
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
            const memberExpressionNodes = esquery(astNodes[i], `MemberExpression[property.type='Literal']`);
            memberExpressionNodes.forEach((memberExpression) => {
                const propertyNode = memberExpression.property;
                if(typeof propertyNode.value != 'string'){
                    return;
                }
                if(!usefulModule.StringOperations.isValidIdentifierName(propertyNode.value)){
                    return;
                }

                const newNode = {
                    type: 'Identifier',
                    name: propertyNode.value
                };
                astOperations.ASTModifier.replaceNode(propertyNode, newNode, this.logger, this.obfuscatedSourceCode);
                memberExpression.computed = false;
                this._deobfuscateNodes(newNode);
            });
        }
    }
}


class ConvertingExportSpecifierTransformer extends stageDeobfuscator.TransformerDeobfuscator{
    constructor(logger, obfuscatedSourceCode, ast, argv){
        super(logger, obfuscatedSourceCode, ast, argv);
    }

    deobfuscate(){
        ;
    }
}


class ConvertingVariablePreserveTransformer extends stageDeobfuscator.TransformerDeobfuscator{
    constructor(logger, obfuscatedSourceCode, ast, argv){
        super(logger, obfuscatedSourceCode, ast, argv);
    }

    deobfuscate(){
        ;
    }
}


class ConvertingClassFieldTransformer extends stageDeobfuscator.TransformerDeobfuscator{
    constructor(logger, obfuscatedSourceCode, ast, argv){
        super(logger, obfuscatedSourceCode, ast, argv);
    }

    deobfuscate(){
        const literalInsideMemberDefinitionNodes = esquery(this.ast, `MethodDefinition[computed=true] > Literal`);
        literalInsideMemberDefinitionNodes.forEach((literalNode) => {
            if(typeof literalNode.value != 'string'){
                return;
            }

            let methodDefinitionNode = literalNode.parent;
            methodDefinitionNode.computed = false;
            const newNode = {
                type: 'Identifier',
                name: literalNode.value
            };
            astOperations.ASTModifier.replaceNode(literalNode, newNode, this.logger, this.obfuscatedSourceCode);
        });
    }
}


class ConvertingBooleanLiteralTransformer extends stageDeobfuscator.TransformerDeobfuscator{
    constructor(logger, obfuscatedSourceCode, ast, argv){
        super(logger, obfuscatedSourceCode, ast, argv);
    }

    deobfuscate(){
        this._debobfuscateTrueBooleanLiteralTransformer();
        this._debobfuscateFalseBooleanLiteralTransformer();
    }

    _debobfuscateTrueBooleanLiteralTransformer(){
        const allArrayExpressionNodes = esquery(this.ast, `UnaryExpression[operator='!'] > ` + 
        `UnaryExpression[operator='!'] > ArrayExpression`);
        allArrayExpressionNodes.forEach((arrayExpressionNode) => {
            if(arrayExpressionNode.elements.length != 0){
                return;
            }
    
            const nodeToReplace = arrayExpressionNode.parent.parent;
            // grandparent ^ 
    
            astOperations.ASTModifier.replaceNode(nodeToReplace, {
                type: 'Literal',
                value: true
            }, this.logger, this.obfuscatedSourceCode);
        });
    }

    _debobfuscateFalseBooleanLiteralTransformer(){
        const allArrayExpressionNodes = esquery(this.ast, `UnaryExpression[operator='!'] > ArrayExpression`);
        allArrayExpressionNodes.forEach((arrayExpressionNode) => {
            if(arrayExpressionNode.elements.length != 0){
                return;
            }
    
            const nodeToReplace = arrayExpressionNode.parent;
            astOperations.ASTModifier.replaceNode(nodeToReplace, {
                type: 'Literal',
                value: false
            }, this.logger, this.obfuscatedSourceCode);
        });
    }
}


module.exports = {
    StageConverting, 
    ConvertingNumberToNumericalExpressionTransformer
};
