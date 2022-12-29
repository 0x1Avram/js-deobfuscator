"use strict";


const estraverse = require('estraverse');
const esprima = require('esprima');
const escodegen = require('escodegen');
const usefulModule = require('./useful');


class NodeChecker{
    static nodeHasBodyWithLexicalScope(node){
        if(!node){
            return false;
        }

        if((node.type == 'Program') && node.body){
            return true;
        }
    
        if(NodeChecker.nodeIsFunctionRelated(node)
        && node.body && (node.body.type == 'BlockStatement')){
            return true;
        }
    
        return false;
    }

    static nodeHasBodyWithLexicalScopeStringArrayCallsReplace(node){
        if(!node){
            return false;
        }

        if(NodeChecker.nodeHasBodyWithLexicalScope(node)){
            return true;
        }

        if((node.type == 'WhileStatement') && node.body){
            return true;
        }

        if((node.type == 'SwitchCase') && node.consequent){
            return true;
        }
    
        return false;
    }

    static nodeIsFunctionRelated(node){
        if(!node){
            return false;
        }

        if((node.type == 'FunctionExpression') 
        || (node.type == 'ArrowFunctionExpression')
        || (node.type == 'FunctionDeclaration')){
            return true;
        }

        return false;
    }
}


class NodeComparer{
    static arraysWithIdentifierNodesAreEqual(array1, array2){
        if(array1 === array2){
            return true;
        }
        if(!array1 || !array2 || (array1.length != array2.length)){
            return false;
        }
      
        for(let i = 0; i < array1.length; i++){
            if(!NodeComparer._identifierNodesAreEqual(array1[i], array2[i])){
                return false;
            } 
        }
    
        return true;
    }

    static _identifierNodesAreEqual(identifier1, identifier2){
        if(!identifier1 || !identifier2){
            return false;
        }

        if((identifier1.name != identifier2.name)
        || (identifier1.type != 'Identifier')
        || (identifier2.type != 'Identifier')){
            return false;
        }

        return true;
    }
}


class NodeCreator{
    static createNodeLiteralNumber(nr){
        let newNode = null;
        if(usefulModule.NumberOperations.numberIsFloat(nr)){
            nr = parseFloat(nr.toFixed(4));
        }
        if(nr >= 0){
            newNode = NodeCreator._createNodeLiteralNumberPositive(nr);
        }
        else{
            newNode = NodeCreator._createNodeLiteralNumberNegative(nr);
        }
        return newNode;
    }

    static _createNodeLiteralNumberPositive(nr){
        return {
            type: 'Literal',
            value: nr
        }
    }

    static _createNodeLiteralNumberNegative(nr){
        return {
            type: 'UnaryExpression',
            operator: '-',
            argument: {
                type: 'Literal',
                value: -nr
            },
            prefix: true
        }
    }
}


class NodeEvaller{
    static evalNodeFromASTRepresentation(node){
        const sourceCode = ASTSourceCodeOperations.generateSourceCodeFromAST(node);
        return eval(sourceCode);
    }

    static evalCallExpressionNodeBasedOnSourceCode(callExpressionNode, sourceCode){
        const callSourceCode = sourceCode.substring(callExpressionNode.range[0], callExpressionNode.range[1]);
        return eval.call(module, callSourceCode);
    }
}


class ASTSourceCodeOperations{
    static generateASTFromSourceCode(sourceCode){
        let ast = null;
        const esprimaOptions = {
            range: true, 
            loc: true, 
            comment: true, 
            tolerant: true
        };

        try{
            ast = esprima.parseScript(sourceCode, esprimaOptions);
        }
        catch(err){
            ast = esprima.parseModule(sourceCode, esprimaOptions);
        }
        ASTRelations.addParentsToASTNodes(ast);
        return ast;
    }

    static generateSourceCodeFromAST(ast, escodegenOptions=null){
        if(!escodegenOptions){
            escodegenOptions = {
                format: {quotes: 'single'}, 
                comment: true
            };
        }
        return escodegen.generate(ast, escodegenOptions);    
    }

    static getASTStrRepresentation(ast){
        return JSON.stringify(ast, null, ' ');
    }

    static compactSourceCode(sourceCode){
        const ast = ASTSourceCodeOperations.generateASTFromSourceCode(sourceCode);
        return ASTSourceCodeOperations.generateSourceCodeFromAST(ast, {
            format: {
                compact: true
            }
        });
    }
}


class ASTRelations{
    static createParentsMapping(ast){
        let parentsMap = new Map();
        estraverse.traverse(ast, {
            enter: function(node, parent){
                parentsMap.set(node, parent ?? node);
            }
        });
        return parentsMap;
    }

    static addParentsToASTNodes(ast){
        estraverse.traverse(ast, {
            enter: function(node, parent){
                node.parent = parent ?? node;
            }
        });
    }

    static addParentsToASTNodesExcludingRoot(ast){
        var rootNode = true;
        estraverse.traverse(ast, {
            enter: function(node, parent){
                if(!rootNode){
                    node.parent = parent ?? node;
                }
                rootNode = false;
            }
        });
    }

    static getParentNodeWithLexicalScope(node){
        node = node.parent;
        var parent = node;
        do{
            node = parent;
            if(NodeChecker.nodeHasBodyWithLexicalScope(node)){
                return node;
            }
            var parent = node.parent;

        }while(node != parent);
        return node;
    }

    static getParentNodeOfType(node, searchedType){
        while(node){
            if(node.type == searchedType){
                return node;
            }
    
            const parent = node.parent;
            if(node == parent){
                return null;
            }
            node = parent;
        }
        return null;
    }

    static getProgramOrBlockScopeParent(node){
        while(node){
            if((node.type == 'Program') || (node.type == 'BlockStatement') || (node.type == 'SwitchCase')){
                return node;
            }

            const parent = node.parent;
            if(node == parent){
                return null;
            }
            node = parent;
        }
        return null;
    }
}


class ASTModifier{
    static removeSingleNode(nodeToRemove, logger=null, sourceCode=null){
        var nodeHasBeenRemoved = false;
        var parent = nodeToRemove.parent;
        
        estraverse.replace(parent, {
            enter: function(node){
                if(nodeHasBeenRemoved){
                    this.break();
                }
                if(node === nodeToRemove){
                    ASTModifier.logDebugNode('[Remove single node]', node, logger, sourceCode);
                    this.remove();
                    nodeHasBeenRemoved = true;
                }
            }
        });
    }
    
    static logDebugNode(msg, node, logger, sourceCode, forceASTGeneration=false){
        if(!logger || !global_createDebugLogEachOperation){
            return;
        }

        let nodeSourceCode = '';
        if(node.range && sourceCode && !forceASTGeneration){
            nodeSourceCode = sourceCode.substring(node.range[0], node.range[1]);
        }
        else{
            try{
                nodeSourceCode = ASTSourceCodeOperations.generateSourceCodeFromAST(node);
            }
            catch(e){
                ;
            }
        }
        
        logger.debug(`[ASTModifier] ${msg} Node type = \`${node.type}\`. Parent type = \`${node.parent.type}\`. `
        + `Node source code: \`${nodeSourceCode}\`.`)
    }

    static logDebugEstraverseReplace(oldNode, newNode, logger, sourceCode, forceASTGeneration=false){
        ASTModifier.logDebugNode('[Replace node estraverse][OldNode]', oldNode, logger, sourceCode, forceASTGeneration);
        ASTModifier.logDebugNode('[Replace node estraverse][NewNode]', newNode, logger, sourceCode, forceASTGeneration); 
    }

    static removeMultipleNodesWithSameParent(nodesToRemove, logger=null, sourceCode=null){
        if(nodesToRemove.length == 0){
            return;
        }

        var parent = nodesToRemove[0].parent;
        ASTModifier.logDebugNode('[Remove multiple nodes with same parent][Parent]', parent, logger, sourceCode);

        var removedAllNodesOfInterest = false;
        estraverse.replace(parent, {
            enter: function(node){
                if(removedAllNodesOfInterest){
                    this.break();
                }
                if(nodesToRemove.includes(node)){
                    ASTModifier.logDebugNode('[Remove multiple nodes with same parent][Node]', 
                    node, logger, sourceCode);
                    this.remove();
                    nodesToRemove.splice(nodesToRemove.indexOf(node), 1); 
                    if(nodesToRemove.length == 0){
                        removedAllNodesOfInterest = true;
                    }
                }
            }
        });
    }

    static replaceNode(oldNode, newNode, logger=null, sourceCode=null){
        var parent = oldNode.parent;

        var nodeHasBeenReplaced = false;
        estraverse.replace(parent, {
            enter: function(node){
                if(nodeHasBeenReplaced){
                    this.break();
                }
                if(node === oldNode){
                    newNode.parent = parent;
                    ASTModifier.logDebugNode('[Replace node][OldNode]', oldNode, logger, sourceCode);
                    ASTModifier.logDebugNode('[Replace node][NewNode]', newNode, logger, sourceCode);
                    ASTRelations.addParentsToASTNodesExcludingRoot(newNode);
                    nodeHasBeenReplaced = true;
                    return newNode;
                }
            }
        });
    }

    static insertNodesAfter(nodeToInsertAfter, nodesToInsert, logger=null, sourceCode=null){
        const parentProgramOrBlockStatement = ASTRelations.getProgramOrBlockScopeParent(nodeToInsertAfter);
        ASTModifier._insertNodesAfterInSameBlockScope(parentProgramOrBlockStatement, nodeToInsertAfter, nodesToInsert, logger);
        ASTModifier.logDebugNode('[Insert nodes after][ExistingNode]', nodeToInsertAfter, logger, sourceCode);
        
        const parent = nodeToInsertAfter.parent;
        for(let i = 0; i < nodesToInsert.length; i++){
            let singleNode = nodesToInsert[i];
            singleNode.parent = parent;
            ASTModifier.logDebugNode('[Insert nodes after][NewInsertedNode]', singleNode, logger, sourceCode);
            ASTRelations.addParentsToASTNodesExcludingRoot(singleNode);
        }
    }
    
    static _insertNodesAfterInSameBlockScope(blockStatementOrProgramNode, nodeToInsertAfter, nodesToInsert, logger=null){
        var statements = null;
        if(blockStatementOrProgramNode.type == 'SwitchCase'){
            statements = blockStatementOrProgramNode.consequent;
        }
        else{
            statements = blockStatementOrProgramNode.body;
        }
        
        const positionToInsertAt = statements.indexOf(nodeToInsertAfter) + 1;
        if(positionToInsertAt == 0){
            logger.warn(`Could not find node after which to insert new nodes. `
            + `Node = ${ASTSourceCodeOperations.generateSourceCodeFromAST(nodeToInsertAfter)}`);
            logger.warn('Nodes that should have been inserted:');
            for(let i = 0; i < nodesToInsert.length; i++){
                logger.warn(`Node ${i+1}: ${ASTSourceCodeOperations.generateSourceCodeFromAST(nodesToInsert[i])}`);
            }
            return;
        }
    
        let newStatements = [...statements.slice(0, positionToInsertAt),
            ...nodesToInsert,
            ...statements.slice(positionToInsertAt)
        ];
        
        if(blockStatementOrProgramNode.type == 'SwitchCase'){
            blockStatementOrProgramNode.consequent = newStatements;
        }
        else{
            blockStatementOrProgramNode.body = newStatements;
        }
    }

    static insertNodesBefore(nodeToInsertBefore, nodesToInsert, logger=null, sourceCode=null){
        const parentProgramOrBlockStatement = ASTRelations.getProgramOrBlockScopeParent(nodeToInsertBefore);
        ASTModifier._insertNodesBeforeInSameBlockScope(parentProgramOrBlockStatement, 
            nodeToInsertBefore, nodesToInsert, logger);
        ASTModifier.logDebugNode('[Insert nodes before][ExistingNode]', nodeToInsertBefore, logger, sourceCode);

        const parent = nodeToInsertBefore.parent;
        for(let i = 0; i < nodesToInsert.length; i++){
            let singleNode = nodesToInsert[i];
            singleNode.parent = parent;
            ASTModifier.logDebugNode('[Insert nodes before][NewInsertedNode]', singleNode, logger, sourceCode);
            ASTRelations.addParentsToASTNodesExcludingRoot(singleNode);
        }
    }

    static _insertNodesBeforeInSameBlockScope(blockStatementOrProgramNode, nodeToInsertBefore, nodesToInsert, logger=null){
        var statements = null;
        if(blockStatementOrProgramNode.type == 'SwitchCase'){
            statements = blockStatementOrProgramNode.consequent;
        }
        else{
            statements = blockStatementOrProgramNode.body;
        }

        const positionToInsertAt = statements.indexOf(nodeToInsertBefore);
        if(positionToInsertAt == -1){
            logger.warn(`Could not find node before which to insert new nodes.`
            + `Node = ${ASTSourceCodeOperations.generateSourceCodeFromAST(nodeToInsertBefore)}`);
            logger.warn('Nodes that should have been inserted:');
            for(let i = 0; i < nodesToInsert.length; i++){
                logger.warn(`Node ${i+1}: ${ASTSourceCodeOperations.generateSourceCodeFromAST(nodesToInsert[i])}`);
            }

            return;
        }

        let newStatements = [...statements.slice(0, positionToInsertAt),
            ...nodesToInsert,
            ...statements.slice(positionToInsertAt)
        ];

        if(blockStatementOrProgramNode.type == 'SwitchCase'){
            blockStatementOrProgramNode.consequent = newStatements;
        }
        else{
            blockStatementOrProgramNode.body = newStatements;
        }
    }
}

class ASTUtility{
    static getVariableNameFromVariableDeclaration(variableDeclaration){
        if(variableDeclaration.type != 'VariableDeclaration'){
            return null;
        }

        if(!variableDeclaration.declarations || (variableDeclaration.declarations.length != 1)){
            return null;
        }

        const variableDeclarator = variableDeclaration.declarations[0];
        if(variableDeclarator.type != 'VariableDeclarator'){
            return null;
        }

        if(!variableDeclarator.id){
            return null;
        }

        return variableDeclarator.id.name;
    }
}


module.exports = {
    NodeChecker,
    NodeComparer,
    NodeCreator,
    NodeEvaller,
    ASTSourceCodeOperations,
    ASTRelations,
    ASTModifier,
    ASTUtility
};
