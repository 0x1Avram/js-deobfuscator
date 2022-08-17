"use strict";


const estraverse = require('estraverse');
const astOperations = require('../ast_operations');
const stageDeobfuscator = require('./stage_deobfuscator');


class StageSimplifying extends stageDeobfuscator.StageDeobfuscator{
    constructor(logger, obfuscatedSourceCode, ast, argv, stageName){
        super(logger, obfuscatedSourceCode, ast, argv, stageName);
    }

    _initiateTransformers(){
        this.transformers = {
            'SimplifyingIfStatementSimplifyTransformer': SimplifyingIfStatementSimplifyTransformer,
            'SimplifyingBlockStatementSimplifyTransformer': SimplifyingBlockStatementSimplifyTransformer,
            'SimplifyingExpressionStatementsMergeTransformer': SimplifyingExpressionStatementsMergeTransformer,
            'SimplifyingCustomCodeHelpersTransformer': SimplifyingCustomCodeHelpersTransformer,
            'SimplifyingVariableDeclarationsMergeTransformer': SimplifyingVariableDeclarationsMergeTransformer,
        }
    }

    deobfuscate(){
        var foundDifference = false;
        do{
            foundDifference = false;
            this._getSourceCodeBeforeDeobfuscation();
            super.deobfuscate();
            const sourceCodeAfterStage = astOperations.ASTSourceCodeOperations.generateSourceCodeFromAST(this.ast);
            if(this.sourceCodeBeforeStage != sourceCodeAfterStage){
                foundDifference = true;
                this.logger.info(`[stage_02_simplifying.js] Found difference in simplifying. Running again.`);
            }
        }while(foundDifference);
    }


}


class SimplifyingIfStatementSimplifyTransformer extends stageDeobfuscator.TransformerDeobfuscator{
    constructor(logger, obfuscatedSourceCode, ast, argv){
        super(logger, obfuscatedSourceCode, ast, argv);
    }

    deobfuscate(){
        this._deobfuscateNodes(this.ast);
    }

    _deobfuscateNodes(astNodes){
        var thisObj = this;

        if(!Array.isArray(astNodes)){
            astNodes = [astNodes];
        }
        
        for(let i = 0; i < astNodes.length; i++){
            estraverse.traverse(astNodes[i], {
                enter: function(node){
                    if((node.type == 'IfStatement') || (node.type == 'ExpressionStatement')
                    || (node.type == 'ReturnStatement')){
                        thisObj._expandSimplifiedIfStatement(node);
                    }
                },
            })
        }
        
    }

    _expandSimplifiedIfStatement(node){
        if(node.type == 'IfStatement'){
            this._expandIfStatementNodeByAddingBlocks(node);
        }
        else if(node.type == 'ExpressionStatement'){
            this._expandExpressionStatementWithLogicalAnd(node);
            this._expandExpressionStatementTenaryConditional(node);
        }
        else if(node.type == 'ReturnStatement'){
            this._expandReturnStatementTenaryConditional(node);
        }
    }

    _expandIfStatementNodeByAddingBlocks(node){
        if(node.consequent && (node.consequent.type != 'BlockStatement')){
            this._expandIfStatementConsequentWithBlockStatement(node);
            this._deobfuscateNodes(node.consequent);
        }
        
        if(node.alternate && (node.alternate.type != 'BlockStatement')){
            this._expandIfStatementAlternateWithBlockStatement(node);
            this._deobfuscateNodes(node.alternate);
        }
    }

    _expandIfStatementConsequentWithBlockStatement(node){
        astOperations.ASTModifier.logDebugNode('[Simplify][IfStatement][Adding BlockStatement][Consequent][Old]', 
            node.consequent, this.logger, this.obfuscatedSourceCode);
        node.consequent = this._createConsequentOrAlternateWithBlockStatement(node.consequent);
        astOperations.ASTModifier.logDebugNode('[Simplify][IfStatement][Adding BlockStatement][Consequent][New]', 
            node.consequent, this.logger, this.obfuscatedSourceCode);
    }

    _expandIfStatementAlternateWithBlockStatement(node){
        astOperations.ASTModifier.logDebugNode('[Simplify][IfStatement][Adding BlockStatement][Alternate][Old]', 
                node.alternate, this.logger, this.obfuscatedSourceCode);
        node.alternate = this._createConsequentOrAlternateWithBlockStatement(node.alternate);
        astOperations.ASTModifier.logDebugNode('[Simplify][IfStatement][Adding BlockStatement][Alternate][New]', 
            node.alternate, this.logger, this.obfuscatedSourceCode);
    }

    _createConsequentOrAlternateWithBlockStatement(node){
        const newNode = {
            type: 'BlockStatement',
            body: [node],
            parent: node.parent
        };
        astOperations.ASTRelations.addParentsToASTNodesExcludingRoot(newNode);
        return newNode;
    }

    _expandExpressionStatementWithLogicalAnd(node){
        if(!node.expression){
            return;
        }
        
        let expression = node.expression;
        if((expression.type != 'LogicalExpression') || !expression.operator || (expression.operator != '&&')){
            return;
        }

        if(!expression.left || !expression.right){
            return;
        }

        const rightExpression = expression.right;
        if(!rightExpression.type){
            return;
        }

        let newBody = [];
        if(rightExpression.type == 'SequenceExpression'){
            if(!rightExpression.expressions){
                return;
            }
            for(let i = 0; i < rightExpression.expressions.length; i++){
                newBody.push({
                    type: 'ExpressionStatement',
                    expression: rightExpression.expressions[i],
                });
            }   
        }
        else{
            newBody.push({
                type: 'ExpressionStatement',
                expression: rightExpression,
            });
        }

        if(newBody.length == 0){
            return;
        }

        const newNode = {
            type: 'IfStatement',
            test: expression.left,
            consequent: {
                type: 'BlockStatement',
                body: newBody
            },
            alternate: null
        }
        astOperations.ASTModifier.replaceNode(node, newNode, this.logger, this.obfuscatedSourceCode);
        this._deobfuscateNodes(newNode);
    }

    _expandExpressionStatementTenaryConditional(node){
        if(node.type != 'ExpressionStatement'){
            return;
        }

        if(!node.expression){
            return;
        }
        const conditionalExpression = node.expression;

        if(conditionalExpression.type != 'ConditionalExpression'){
            return;
        }

        if(!conditionalExpression.test || !conditionalExpression.consequent || !conditionalExpression.alternate){
            return;
        }

        const newNode = {
            type: 'IfStatement',
            test: conditionalExpression.test,
            consequent: {
                type: 'BlockStatement',
                body: [{
                    type: 'ExpressionStatement',
                    expression: conditionalExpression.consequent
                }]
            },
            alternate: {
                type: 'BlockStatement',
                body: [{
                    type: 'ExpressionStatement',
                    expression: conditionalExpression.alternate
                }]
            }   
        }
        astOperations.ASTModifier.replaceNode(node, newNode, this.logger, this.obfuscatedSourceCode);
        this._deobfuscateNodes(newNode);
    }

    _expandReturnStatementTenaryConditional(node){
        if(!node.argument){
            return;
        }

        let argument = node.argument;
        if(argument.type != 'ConditionalExpression'){
            return;
        }

        if(!argument.test || !argument.consequent || !argument.alternate){
            return;
        }

        const newNode = {
            type: 'IfStatement',
            test: argument.test,
            consequent: {
                type: 'BlockStatement',
                body: [{
                    type: 'ReturnStatement',
                    argument: argument.consequent
                }],
            },
            alternate: {
                type: 'BlockStatement',
                body: [{
                    type: 'ReturnStatement',
                    argument: argument.alternate
                }],
            }
        }
        astOperations.ASTModifier.replaceNode(node, newNode, this.logger, this.obfuscatedSourceCode);
        this._deobfuscateNodes(newNode);
    }
}


class SimplifyingBlockStatementSimplifyTransformer extends stageDeobfuscator.TransformerDeobfuscator{
    constructor(logger, obfuscatedSourceCode, ast, argv){
        super(logger, obfuscatedSourceCode, ast, argv);
    }

    deobfuscate(){
        this._deobfuscateNodes(this.ast);
    }

    _deobfuscateNodes(astNodes){
        var thisObj = this;
        
        if(!Array.isArray(astNodes)){
            astNodes = [astNodes];
        }

        for(let i = 0; i < astNodes.length; i++){
            estraverse.traverse(astNodes[i], {
                enter: function(node){
                    if(node.type == 'ReturnStatement'){
                        thisObj._expandMergedReturnAndExpressionStatements(node);
                    }
                },
            })
        }
    }

    _expandMergedReturnAndExpressionStatements(node){
        if(!node.argument){
            return;
        }
    
        let sequenceExpression = node.argument;
        if((sequenceExpression.type != 'SequenceExpression') || !sequenceExpression.expressions){
            return;
        }
        
        let expressions = sequenceExpression.expressions;
        if(expressions.length <= 1){
            return;
        }
    
        const expressionsToExpand = expressions.slice(0, -1);
        let nodesToAdd = [];
        for(let i = 0; i < expressionsToExpand.length; i++){
            const singleExpression = expressionsToExpand[i];
            const newNode = {
                type: 'ExpressionStatement',
                expression: singleExpression
            };
            nodesToAdd.push(newNode);
        }

        if(nodesToAdd.length == 0){
            return;
        }

        astOperations.ASTModifier.insertNodesBefore(node, nodesToAdd, this.logger, this.obfuscatedSourceCode);
        this._deobfuscateNodes(nodesToAdd);
        this._removeExtraNodesFromReturnStatement(node, expressions);
        this._deobfuscateNodes(node);
    }

    _removeExtraNodesFromReturnStatement(returnStatement, expressions){
        astOperations.ASTModifier.logDebugNode('[Simplify][ReturnStatement][Removing sequence expression ' + 
            'from return statement ][Old]', returnStatement, this.logger, this.obfuscatedSourceCode);
        expressions.splice(0, expressions.length - 1);
        astOperations.ASTModifier.logDebugNode('[Simplify][ReturnStatement][Removing sequence expression ' + 
            'from return statement ][New]', returnStatement, this.logger, this.obfuscatedSourceCode, true);
    }
}


class SimplifyingExpressionStatementsMergeTransformer extends stageDeobfuscator.TransformerDeobfuscator{
    constructor(logger, obfuscatedSourceCode, ast, argv){
        super(logger, obfuscatedSourceCode, ast, argv);
    }

    deobfuscate(){
        this._deobfuscateNodes(this.ast);
    }

    _deobfuscateNodes(astNodes){
        var thisObj = this;

        if(!Array.isArray(astNodes)){
            astNodes = [astNodes];
        }

        for(let i = 0; i < astNodes.length; i++){
            estraverse.traverse(astNodes[i], {
                enter: function(node){
                    if(node.type == 'ExpressionStatement'){
                        thisObj._expandMergedExpressionStatements(node);
                    }
                },
            })
        }
    }

    _expandMergedExpressionStatements(node){
        if(!node.expression){
            return;
        }
        const expression = node.expression;
        if((expression.type != 'SequenceExpression') || !expression.expressions){
            return;
        }
        let expressionsArray = expression.expressions;
        if(expressionsArray.length <= 1){
            return;
        }
    
        const expressionsToExpand = expressionsArray.slice(1);
        let nodesToAdd = [];
        for(let i = 0; i < expressionsToExpand.length; i++){
            const singleExpression = expressionsToExpand[i];
            const newNode = {
                type: 'ExpressionStatement',
                expression: singleExpression
            };
            nodesToAdd.push(newNode);
        }

        if(nodesToAdd.length == 0){
            return;
        }
    
        astOperations.ASTModifier.insertNodesAfter(node, nodesToAdd, this.logger, this.obfuscatedSourceCode);
        this._deobfuscateNodes(nodesToAdd);
        
        const newNode = {
            type: 'ExpressionStatement',
            expression: expressionsArray[0]
        };
        
        astOperations.ASTModifier.replaceNode(node, newNode, this.logger, this.obfuscatedSourceCode);
        this._deobfuscateNodes(newNode);
    }
}


class SimplifyingCustomCodeHelpersTransformer extends stageDeobfuscator.TransformerDeobfuscator{
    constructor(logger, obfuscatedSourceCode, ast, argv){
        super(logger, obfuscatedSourceCode, ast, argv);
    }

    deobfuscate(){
        ;
    }
}


class SimplifyingVariableDeclarationsMergeTransformer extends stageDeobfuscator.TransformerDeobfuscator{
    constructor(logger, obfuscatedSourceCode, ast, argv){
        super(logger, obfuscatedSourceCode, ast, argv);
    }

    deobfuscate(){
        this._deobfuscateNodes(this.ast);
    }

    _deobfuscateNodes(astNodes){
        var thisObj = this;

        if(!Array.isArray(astNodes)){
            astNodes = [astNodes];
        }

        for(let i = 0; i < astNodes.length; i++){
            estraverse.traverse(astNodes[i], {
                enter: function(node){
                    if(node.type == 'VariableDeclaration'){
                        thisObj._expandMergedVariableDeclarationNode(node);
                    }
                },
            })
        }
    }

    _expandMergedVariableDeclarationNode(node){
        if(!node.declarations || (node.declarations.length <= 1)){
            return;
        }
    
        const declarationsToExpand = node.declarations.slice(1);
        let nodesToAdd = [];
        for(let i = 0; i < declarationsToExpand.length; i++){
            const variableDeclarator = declarationsToExpand[i];
            const newNode = {
                type: 'VariableDeclaration',
                declarations: [variableDeclarator],
                kind: node.kind
            };
            nodesToAdd.push(newNode);
        }
        if(nodesToAdd.length == 0){
            return;
        }

        astOperations.ASTModifier.insertNodesAfter(node, nodesToAdd, this.logger, this.obfuscatedSourceCode);
        this._deobfuscateNodes(nodesToAdd);
        this._removeExtraVariableDeclaratorsFromVariableDeclaration(node);
        this._deobfuscateNodes(node);
    }

    _removeExtraVariableDeclaratorsFromVariableDeclaration(node){
        astOperations.ASTModifier.logDebugNode('[Simplify][VariableDeclaration][Removing extra VariableDeclarators ' + 
            'from return VariabeDeclaration][Old]', node, this.logger, this.obfuscatedSourceCode);
        node.declarations.splice(1);
        astOperations.ASTModifier.logDebugNode('[Simplify][VariableDeclaration][Removing extra VariableDeclarators ' + 
            'from return VariabeDeclaration][New]', node, this.logger, this.obfuscatedSourceCode, true);
    }
}


module.exports = {StageSimplifying};
