"use strict";


const esquery = require('esquery');
const estraverse = require('estraverse');
const stageDeobfuscator = require('./stage_deobfuscator');
const astOperations = require('../ast_operations');


class StageDeadCodeInjection extends stageDeobfuscator.StageDeobfuscator{
    constructor(logger, obfuscatedSourceCode, ast, argv, stageName){
        super(logger, obfuscatedSourceCode, ast, argv, stageName);
    }

    _initiateTransformers(){
        this.transformers = {
            'DeadCodeInjectionDeadCodeInjectionTransformer': DeadCodeInjectionDeadCodeInjectionTransformer
        }
    }
}


class DeadCodeInjectionDeadCodeInjectionTransformer extends stageDeobfuscator.TransformerDeobfuscator{
    constructor(logger, obfuscatedSourceCode, ast, argv){
        super(logger, obfuscatedSourceCode, ast, argv);
        this.nrBlockStatements = 0;
    }

    deobfuscate(){
        this.deadCodePropertiesNames = [];
        this._deobfuscateNodes(this.ast);
        this._removeDeadCodeDanglingDictionaries();
    }

    _deobfuscateNodes(astNodes){
        var thisObj = this;
        
        if(!Array.isArray(astNodes)){
            astNodes = [astNodes];
        }

        
        const totalNr = astNodes.length;
        for(let i = 0; i < astNodes.length; i++){
            estraverse.traverse(astNodes[i], {
                enter: function(node){
                    thisObj.nrBlockStatements++;
                    if(thisObj.nrBlockStatements % 1000 == 0){
                        console.log(`[stage_08][DeadCodeInjectionDeadCodeInjectionTransformer] Deobfuscate nrBlockStatements = ${thisObj.nrBlockStatements}.`);
                    }
                    
                    if(node.type == 'BlockStatement'){
                        thisObj._deobfuscateBlockStatementWithDeadCodeInjected(node);
                    }
                },
            })
        }
    }

    _deobfuscateBlockStatementWithDeadCodeInjected(node){
        if(!node || (node.type != 'BlockStatement')){
            return;
        }
        if(!node.body || (node.body.length == 0)){
            return;
        }
        
        for(let i = 0; i < node.body.length; i++){
            let ifStatement = node.body[i];

            if(!ifStatement || !ifStatement.type || (ifStatement.type != 'IfStatement')){
                continue;
            }
            if(!ifStatement.test || !ifStatement.consequent || !ifStatement.alternate){
                continue;
            }
            if(!ifStatement.consequent.body || !ifStatement.alternate.body ||
            (ifStatement.consequent.body.length == 0) || (ifStatement.alternate.body.length == 0)){
                continue;
            }
        
            if(!this._isTestConditionFoundInIfStatementOfInjectedDeadCode(ifStatement.test)){
                continue;
            }
        
            var bodyWithoutDeadCode = null;
            var bodyWithDeadCode = null;
            let partRemoved = '';
            if(this._isTestConditionTrue(ifStatement.test)){
                bodyWithoutDeadCode = ifStatement.consequent.body;
                bodyWithDeadCode = ifStatement.alternate.body;
                partRemoved = 'alternate';
            }
            else{
                bodyWithoutDeadCode = ifStatement.alternate.body;
                bodyWithDeadCode = ifStatement.consequent.body;
                partRemoved = 'consequent';
            }
            bodyWithoutDeadCode.parent = node;
            this._getDeadCodePropertiesFromMemberExpressions(bodyWithDeadCode);
    
            astOperations.ASTModifier.insertNodesAfter(ifStatement, bodyWithoutDeadCode, this.logger, this.obfuscatedSourceCode);
            this._deobfuscateNodes(bodyWithoutDeadCode);
            astOperations.ASTModifier.removeSingleNode(ifStatement, this.logger, this.obfuscatedSourceCode)
        }

    }

    _isTestConditionFoundInIfStatementOfInjectedDeadCode(node){
        if(!node || (node.type != 'BinaryExpression')){
            return false;
        }

        if(!node.operator || ((node.operator != '===') && (node.operator != '!=='))){
            return false;
        }

        if(!node.left || !node.right){
            return false;
        }
        const left = node.left;
        const right = node.right;
        if(!left.type || (left.type != 'Literal') || (typeof left.value != 'string')){
            return false;
        }
        if(!right.type || (right.type != 'Literal') || (typeof right.value != 'string')){
            return false;
        }

        return true;
    }

    _isTestConditionTrue(node){
        const operator = node.operator;
        const leftStr = node.left.value;
        const rightStr = node.right.value;
    
        if(operator == '==='){
            return leftStr == rightStr;
        }
        else{
            return leftStr != rightStr;
        }
    }

    _getDeadCodePropertiesFromMemberExpressions(body){
        for(let i = 0; i < body.length; i++){
            const statement = body[i];

            const memberExpressionNodes = esquery(statement, ` MemberExpression[object.type='Identifier']`
            + `[property.type='Identifier']`);    

            for(let j = 0; j < memberExpressionNodes.length; j++){
                const memberExpression = memberExpressionNodes[j];
                const propertyName = memberExpression.property.name;
                if(!propertyName){
                    continue;
                }
                if(!this.deadCodePropertiesNames.includes(propertyName)){
                    this.deadCodePropertiesNames.push(propertyName);
                }
            }
        }
    }

    _removeDeadCodeDanglingDictionaries(){
        console.log(`[stage_08][DeadCodeInjectionDeadCodeInjectionTransformer] Dangling remove-START.`);

        let objectExpressionNodes = esquery(this.ast, `VariableDeclaration[declarations.length=1] > VariableDeclarator`
        + `[id.type='Identifier'] > ObjectExpression`);

        const totalNrObjectExprNodes = objectExpressionNodes.length;
        let nrObjExprNodes = 0;
        for(let i = 0; i < objectExpressionNodes.length; i++){
            nrObjExprNodes++;
            if((nrObjExprNodes == 1) && (nrObjExprNodes % 100 == 0)){
                console.log(`[stage_08][DeadCodeInjectionDeadCodeInjectionTransformer] Dangling remove ` + 
                            `nrObjExprNodes = ${nrObjExprNodes}/${totalNrObjectExprNodes}.`);
            }

            const objectExpression = objectExpressionNodes[i];
            if(!objectExpression.properties){
                continue;
            }

            const nrProperties = objectExpression.properties.length;
            let propertiesToRemove = [];

            for(let j = 0; j < objectExpression.properties.length; j++){
                let property = objectExpression.properties[j];
                
                if(!property || (property.type != 'Property')){
                    continue;
                }

                if(!property.key || (property.key.type != 'Identifier')){
                    continue;
                }

                const propertyName = property.key.name;
                if(!propertyName){
                    continue;
                }
                if(!this.deadCodePropertiesNames.includes(propertyName)){
                    continue;
                }

                const objectExpressionLexicalScope = astOperations.ASTRelations.getParentNodeWithLexicalScope(
                    objectExpression);
                const identifiersWithProperty = esquery(objectExpressionLexicalScope, `Identifier[name=${propertyName}]`);
                if(identifiersWithProperty.length == 1){
                    propertiesToRemove.push(property);
                }
            }

            if(nrProperties == propertiesToRemove.length){
                const variableDeclaration = objectExpression.parent.parent;
                astOperations.ASTModifier.removeSingleNode(variableDeclaration, this.logger, this.obfuscatedSourceCode);
            }
            else if(propertiesToRemove.length > 0){
                astOperations.ASTModifier.removeMultipleNodesWithSameParent(propertiesToRemove, this.logger, this.obfuscatedSourceCode);
            }
        }
    }
}


module.exports = {StageDeadCodeInjection};
