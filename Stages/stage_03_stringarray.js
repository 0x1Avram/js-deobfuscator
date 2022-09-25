"use strict";


const esquery = require('esquery');
const estraverse = require('estraverse');
const astOperations = require('../ast_operations');
const stageDeobfuscator = require('./stage_deobfuscator');



class StringArrayStageDeobfuscator extends stageDeobfuscator.StageDeobfuscator{
    constructor(logger, obfuscatedSourceCode, ast, argv, stageName){
        super(logger, obfuscatedSourceCode, ast, argv, stageName);
    }

    _initiateTransformers(){
        this.transformers = {
            'StringArraySyntheticTransformer': StringArraySyntheticTransformer,
        }
    }
}


class NodeFinder{
    constructor(logger, obfuscatedSourceCode, ast){
        this.logger = logger;
        this.obfuscatedSourceCode = obfuscatedSourceCode;
        this.ast = ast;
    }

    findNode(){
        throw `Method 'findNode' from 'NodeFinder' needs to be overriden.`;
    }

    getNode(){
        throw `Method 'getNode' from 'NodeFinder' needs to be overriden.`;
    }

    getIdentifierName(){
        throw `Method 'getIdentifierName' from 'NodeFinder' needs to be overriden.`;
    }
}


class StringArrayTemplateNodeFinder extends NodeFinder{
    constructor(logger, obfuscatedSourceCode, ast){
        super(logger, obfuscatedSourceCode, ast);
    }

    findNode(){
        this._findNodeInAST();
        this._findIdentifierName();
    }

    _findNodeInAST(){
        this.stringArrayTemplateNode = null;
        
        this._searchForFunctionDeclarationTemplate();
        if(!this.stringArrayTemplateNode){
            this._searchForVariableDeclarationTemplate();
        }
    }

    _searchForFunctionDeclarationTemplate(){
        let possibleArrayTemplateNodes = this._findPossibleFunctionDeclarationTemplateNodes();
        possibleArrayTemplateNodes.forEach((functionDeclarationNode) => {
            if(this._functionDeclarationisStringArrayTemplate(functionDeclarationNode)){
                this.stringArrayTemplateNode = functionDeclarationNode;
            }
        });
    }


    _findPossibleFunctionDeclarationTemplateNodes(){
        let nodes = [];
    
        const queryResult = esquery(this.ast, `Program > FunctionDeclaration > BlockStatement > ` + 
            `VariableDeclaration ~ ExpressionStatement ~ ReturnStatement`);
        queryResult.forEach((returnStatementNode) => {
            const functionDeclarationNode = returnStatementNode.parent.parent;
            nodes.push(functionDeclarationNode);
        });
    
        return nodes;
    }

    _functionDeclarationisStringArrayTemplate(node){
        if(node.type != 'FunctionDeclaration'){
            return false;
        }

        if((node.id.type != 'Identifier') || !node.id.name){
            return false;
        }

        if(node.params.length != 0){
            return false;
        }

        const functionName = node.id.name;

        const blockStatement = node.body;
        if(blockStatement.type != 'BlockStatement'){
            return false;
        }
        if(blockStatement.body.length != 3){
            return false;
        }

        const variableDeclarationNode = blockStatement.body[0];
        if(variableDeclarationNode.type != 'VariableDeclaration'){
            return false;
        }

        if(variableDeclarationNode.declarations.length == 0){
            return false;
        }
        if(variableDeclarationNode.declarations[0].type != 'VariableDeclarator'){
            return false;
        }

        const variableDeclaratorNode = variableDeclarationNode.declarations[0];
        if(variableDeclaratorNode.init.type != 'ArrayExpression'){
            return false;
        }
        const internalArrayName = variableDeclaratorNode.id.name;

        const arrayExpressionNode = variableDeclaratorNode.init;
        if(arrayExpressionNode.elements.length == 0){
            return false;
        }
        for(let i = 0; i < arrayExpressionNode.elements.length; i++){
            if((arrayExpressionNode.elements[i].type != 'Literal')
            || (typeof arrayExpressionNode.elements[i].value != 'string')){
                return false;
            }
        }

        const expressionStatementNode = blockStatement.body[1];
        if(expressionStatementNode.type != 'ExpressionStatement'){
            return false;
        }

        if((expressionStatementNode.expression.type != 'AssignmentExpression')
        || (expressionStatementNode.expression.operator != '=')){
            return false
        }
        const assignmentExpressionNode = expressionStatementNode.expression;
        
        if(assignmentExpressionNode.left.type != 'Identifier'){
            return false;
        }
        if(assignmentExpressionNode.left.name != functionName){
            return false;
        }

        if(assignmentExpressionNode.right.type != 'FunctionExpression'){
            return false;
        }
        const functionExpressionNode = assignmentExpressionNode.right;

        if(functionExpressionNode.params.length != 0){
            return false;
        }

        if((functionExpressionNode.body.type != 'BlockStatement')
        || (functionExpressionNode.body.body.length != 1)
        || (functionExpressionNode.body.body[0].type != 'ReturnStatement')){
            return false;
        }

        const returnStatementOfInternalFunctionNode = functionExpressionNode.body.body[0];
        if((returnStatementOfInternalFunctionNode.argument.type != 'Identifier')
        || (returnStatementOfInternalFunctionNode.argument.name != internalArrayName)){
            return false;
        }

        const returnStatementNode = blockStatement.body[2];
        if(returnStatementNode.type != 'ReturnStatement'){
            return false;
        }

        if((returnStatementNode.argument.type != 'CallExpression')
        || (returnStatementNode.argument.arguments.length != 0)){
            return false;
        }
        
        const calleeNode = returnStatementNode.argument.callee;
        if((calleeNode.type != 'Identifier')
        || (calleeNode.name != functionName)){
            return false;
        }

        return true;
    }

    _searchForVariableDeclarationTemplate(){
        if(!this.ast.body || (this.ast.body.length == 0)){
            return;
        }

        for(let i = 0; i < this.ast.body.length; i++){
            const statement = this.ast.body[i];
            if(!statement || (statement.type != 'VariableDeclaration')){
                continue;
            }
            if(this._variableDeclarationIsStringArrayTemplate(statement)){
                this.stringArrayTemplateNode = statement;
            }
        }
    }

    _variableDeclarationIsStringArrayTemplate(node){
        if(node.type != 'VariableDeclaration'){
            return false;
        }

        if(!node.declarations || (node.declarations.length != 1)){
            return false;
        }

        const variableDeclarator = node.declarations[0];
        if(variableDeclarator.type != 'VariableDeclarator'){
            return false;
        }

        if(!variableDeclarator.id || (variableDeclarator.id.type != 'Identifier')){
            return false;
        }

        if(!variableDeclarator.init){
            return false;
        }

        const arrayExpression = variableDeclarator.init;
        if((arrayExpression.type != 'ArrayExpression') || !arrayExpression.elements || (arrayExpression.elements.length == 0)){
            return false;
        }

        for(let i = 0; i < arrayExpression.length; i++){
            const element  = arrayExpression[i];
            if(!element || (element.type != 'Literal') || (typeof element.value != 'string')){
                return false;
            }
        }

        return true;
    }

    _findIdentifierName(){
        this.stringArrayTemplateIdentifierName = null;
        if(!this.stringArrayTemplateNode){
            return;
        }

        if((this.stringArrayTemplateNode.type != 'FunctionDeclaration') 
        && (this.stringArrayTemplateNode.type != 'VariableDeclaration')){
            return;
        }

        if(this.stringArrayTemplateNode.type == 'FunctionDeclaration'){
            this._findIdentifierNameForFunctionDeclarationNode()
        }
        else if(this.stringArrayTemplateNode.type == 'VariableDeclaration'){
            this._findIdentifierNameForVariableDeclarationnode();
        }
    }

    _findIdentifierNameForFunctionDeclarationNode(){
        const functionDeclaration = this.stringArrayTemplateNode;

        if(!functionDeclaration.id){
            return;
        }

        this.stringArrayTemplateIdentifierName = functionDeclaration.id.name;
    }

    _findIdentifierNameForVariableDeclarationnode(){
        const variableDeclarationNode = this.stringArrayTemplateNode;

        if(!variableDeclarationNode.declarations || (variableDeclarationNode.declarations.length != 1)){
            return;
        }

        const variableDeclarator = variableDeclarationNode.declarations[0];
        if(variableDeclarator.type != 'VariableDeclarator'){
            return;
        }

        if(!variableDeclarator.id || (variableDeclarator.id.type != 'Identifier')){
            return;
        }

        this.stringArrayTemplateIdentifierName = variableDeclarator.id.name;
    }

    getNode(){
        return this.stringArrayTemplateNode;
    }

    getIdentifierName(){
        return this.stringArrayTemplateIdentifierName;
    }
}


class StringArrayWrapperTemplateNodesFinder extends NodeFinder{
    constructor(logger, obfuscatedSourceCode, ast, stringArrayTemplateIdentifierName){
        super(logger, obfuscatedSourceCode, ast);
        this.stringArrayTemplateIdentifierName = stringArrayTemplateIdentifierName;
    }

    findNode(){
        this._findNodesInAST();
        this._findIdentifierNames();
    }

    _findNodesInAST(){
        this.wrapperNodes = [];
        if(!this.stringArrayTemplateIdentifierName){
            return;
        }
        
        let possibleWrapperNodes = this._findPossibleArrayWrapperNodes();
        possibleWrapperNodes.forEach((arrayWrapper) => {
            if(this._isStringArrayWrapperTemplateFunction(arrayWrapper)){
                this.wrapperNodes.push(arrayWrapper);
            }
        });

        if(this.wrapperNodes.length == 0){
            this._findArrayWrapperTemplatesForOlderObfuscatorVersions();
        }
    }

    _findPossibleArrayWrapperNodes(){
        let possibleFunctions = [];

        const returnStatementNodes = esquery(this.ast, `Program > FunctionDeclaration > BlockStatement  VariableDeclaration ~ ` + 
            `ReturnStatement`);
        returnStatementNodes.forEach((node) => {
            const functionDeclarationNode = astOperations.ASTRelations.getParentNodeOfType(node, 'FunctionDeclaration');
            if(possibleFunctions.indexOf(functionDeclarationNode) == -1){
                possibleFunctions.push(functionDeclarationNode);
            }
        });

        return possibleFunctions;
    }

    _isStringArrayWrapperTemplateFunction(node){
        if(node.type != 'FunctionDeclaration'){
            return false;
        }

        if(!node.id || (node.id.type != 'Identifier')){
            return false;
        }

        if(!node.params || (node.params.length != 2)
        || (node.params[0].type != 'Identifier') || (node.params[1].type != 'Identifier')){
            return false;
        }

        const wrapperFunctionName = node.id.name;
        const param1Name = node.params[0].name;
        const param2Name = node.params[1].name;

        if(!node.body){
            return false;
        }
        const blockStatement = node.body;
        if(blockStatement.type != 'BlockStatement'){
            return false;
        }
        if(!blockStatement.body || (blockStatement.body.length == 0)){
            return false;
        }

        var foundStringArraytemplateIdentifier = false;
        var thisObj = this;
        estraverse.traverse(blockStatement.body[0], {
            enter: function(node){
                if(node.type != 'VariableDeclaration'){
                    return;
                }
                if(thisObj._variableDeclarationContainsStringArrayTemplateIdentifier(node)){
                    foundStringArraytemplateIdentifier = true;
                    this.break();
                }
            },
        });
        if(!foundStringArraytemplateIdentifier){
            return false;
        }

        const assignmentExpressions = esquery(node, `FunctionExpression[params.length=2] > BlockStatement >` + 
        `ExpressionStatement > AssignmentExpression[left.type='Identifier'][right.type='BinaryExpression']`);
        if(assignmentExpressions.length == 0){
            return false;
        }

        const callExpressionsAtTheEnd = esquery(node, `ReturnStatement CallExpression[callee.type='Identifier']` + 
        `[callee.name=${wrapperFunctionName}][arguments.length=2]`);
        for(let i = 0; i < callExpressionsAtTheEnd.length; i++){
            const callExpressionNode = callExpressionsAtTheEnd[i];
            const arg1Name = callExpressionNode.arguments[0].name;
            const arg2Name = callExpressionNode.arguments[1].name;
            if((arg1Name == param1Name) && (arg2Name == param2Name)){
                return true;
            }
        }

        return false;
    }

    _variableDeclarationContainsStringArrayTemplateIdentifier(node){
        if(node.type != 'VariableDeclaration'){
            return false;
        }

        if(!node.declarations || (node.declarations.length != 1)
        || (node.declarations[0].type != 'VariableDeclarator')){
            return false;
        }

        const variableDeclaratorNode = node.declarations[0];
        if(!variableDeclaratorNode.id || (variableDeclaratorNode.id.type != 'Identifier')){
            return false;
        }
        
        if(!variableDeclaratorNode.init){
            return false;
        }
        if((variableDeclaratorNode.init.type != 'CallExpression') && (variableDeclaratorNode.init.type != 'MemberExpression')){
            return false;
        }

        if(variableDeclaratorNode.init.type == 'CallExpression'){
            const callExpressionNode = variableDeclaratorNode.init;
            if(!this._callExpressionContainsStringArrayTemplateIdentifier(callExpressionNode)){
                return false;
            }
        }
        else if(variableDeclaratorNode.init.type == 'MemberExpression'){
            const memberExpressionNode = variableDeclaratorNode.init;
            if(!this._memberExpressionContainsStringArrayTemplateIdentifier(memberExpressionNode)){
                return false;
            }
        }

        return true;
    }

    _callExpressionContainsStringArrayTemplateIdentifier(node){
        if(node.type != 'CallExpression'){
            return false;
        }

        if(!node.arguments || (node.arguments.length != 0)){
            return false;
        }

        if(!node.callee || (node.callee.type != 'Identifier')
        || (node.callee.name != this.stringArrayTemplateIdentifierName)){
            return false;
        }
        
        return true;
    }

    _memberExpressionContainsStringArrayTemplateIdentifier(node){
        if(node.type != 'MemberExpression'){
            return false;
        }

        if(!node.property || (node.property.type != 'Identifier')){
            return false;
        }

        if(!node.object || (node.object.type != 'Identifier') 
        || (node.object.name != this.stringArrayTemplateIdentifierName)){
            return false;
        }

        return true;
    }

    _findArrayWrapperTemplatesForOlderObfuscatorVersions(){
        const memberExpressions = esquery(this.ast, `Program > VariableDeclaration[declarations.length=1] > `
        + `VariableDeclarator[id.type='Identifier'][init.type='FunctionExpression'] > FunctionExpression`
        + `[params.length>0] > BlockStatement > VariableDeclaration > VariableDeclarator > MemberExpression`
        + `[object.type='Identifier'][object.name='${this.stringArrayTemplateIdentifierName}']`);
        for(let i = 0; i < memberExpressions.length; i++){
            const memberExpression = memberExpressions[i];
            const functionExpression = astOperations.ASTRelations.getParentNodeOfType(memberExpression, 'FunctionExpression');
            const variableDeclaration = astOperations.ASTRelations.getParentNodeOfType(functionExpression, 'VariableDeclaration');
            if(!this.wrapperNodes.includes(variableDeclaration)){
                this.wrapperNodes.push(variableDeclaration);
            }
        }
    }

    _findIdentifierNames(){
        this.wrapperNames = [];

        for(let i = 0; i < this.wrapperNodes.length; i++){
            const wrapper = this.wrapperNodes[i];
            if(wrapper.type == 'FunctionDeclaration'){
                this.wrapperNames.push(wrapper.id.name);
            }
            else if(wrapper.type == 'VariableDeclaration'){
                this.wrapperNames.push(wrapper.declarations[0].id.name);
            }
        }
    }

    getNode(){
        return this.wrapperNodes;
    }

    getIdentifierName(){
        return this.wrapperNames;
    }
}


class StringArrayRotateTemplateNodeFinder extends NodeFinder{
    constructor(logger, obfuscatedSourceCode, ast, stringArrayTemplateIdentifierName, wrapperNames){
        super(logger, obfuscatedSourceCode, ast);
        this.stringArrayTemplateIdentifierName = stringArrayTemplateIdentifierName;
        this.wrapperNames = wrapperNames;
    }

    findNode(){
        this.stringArrayRotateNode = null;
        
        let possibleArrayRotateNodes = this._findPossibleStringArrayRotateTemplateNodes();
        var nrSuitableNodes = 0;
        possibleArrayRotateNodes.forEach((arrayRotateFunctionTemplateNode) => {
            if(this._isStringArrayRotateFunctionTemplate(arrayRotateFunctionTemplateNode)){
                this.stringArrayRotateNode = arrayRotateFunctionTemplateNode;
                nrSuitableNodes++;
            }
        });
        this._fixCaseWhereStringArrayRotateFunctionTemplateIsDirectlyUnderExpressionStatement();

        if(nrSuitableNodes > 1){
            this.logger.warn(`Found more than one string array rotate nodes.`);
            this.stringArrayRotateNode = null;
        }

        if(nrSuitableNodes == 0){
            this._findArrayRotateTemplateForOlderObfuscatorVersions();
        }
    }

    _findPossibleStringArrayRotateTemplateNodes(){
        let suitableRotateNodes = [];
    
        let identifierNodes = esquery(this.ast, `ExpressionStatement CallExpression[arguments.length=2] >` + 
        `Identifier[name=${this.stringArrayTemplateIdentifierName}]`);

        identifierNodes.forEach((node) => {
            let callExpressionNode = astOperations.ASTRelations.getParentNodeOfType(node, 'CallExpression');
            suitableRotateNodes.push(callExpressionNode);
        });
    
        return suitableRotateNodes;
    }

    _isStringArrayRotateFunctionTemplate(node){
        if((node.type != 'CallExpression') || !node.arguments){
            return false;
        }

        if(node.arguments.length != 2){
            return false;
        }

        if((node.arguments[0].type != 'Identifier')
        || (node.arguments[0].name != this.stringArrayTemplateIdentifierName)){
            return false;
        }

        if(node.callee.type != 'FunctionExpression'){
            return false;
        }
        
        const functionExpressionNode = node.callee;
        if(functionExpressionNode.id != null){
            return false;
        }

        let foundWrapper = false;
        for(let i = 0; i < this.wrapperNames.length; i++){
            const wrapperName = this.wrapperNames[i];
            const identifierStringArrayCallsWrapperTemplate = esquery(functionExpressionNode, `Identifier[name=${wrapperName}]`);
            if(identifierStringArrayCallsWrapperTemplate.length != 0){
                foundWrapper = true;
            }
        }
        if(!foundWrapper){
            return false;
        }


        if(!functionExpressionNode.params || (functionExpressionNode.params.length != 2)
        || (functionExpressionNode.params[1].type != 'Identifier')){
            return false;
        }
        const param2Name = functionExpressionNode.params[1].name;

        // skipping over wrapper variables/functions

        const identifierInsideWhileNodes = esquery(functionExpressionNode, `WhileStatement > BlockStatement > TryStatement ` + 
        `Identifier[name=${param2Name}]`);
        if(identifierInsideWhileNodes.length != 1){
            return false;
        }
        
        const whileNode = astOperations.ASTRelations.getParentNodeOfType(identifierInsideWhileNodes[0], 'WhileStatement');

        const parseIntNodes = esquery(whileNode, `CallExpression > Identifier[name='parseInt']`);
        if(parseIntNodes.length < 4){
            return false;
        }

        const breakStatementNode = esquery(whileNode, `TryStatement > BlockStatement > IfStatement BreakStatement`);
        if(breakStatementNode.length != 1){
            return false;
        }
        
        const catchClauseExpressionStatements = esquery(whileNode, `TryStatement > CatchClause > BlockStatement > ExpressionStatement`);
        const pushIdentifiers = esquery(catchClauseExpressionStatements[0], `MemberExpression > Literal[value='push']`);
        const pushLiterals = esquery(catchClauseExpressionStatements[0], `MemberExpression > Identifier[name='push']`);
        if((pushIdentifiers.length != 1)
        && (pushLiterals.length != 1)){
            return false;
        }
        const shiftIdentifiers = esquery(catchClauseExpressionStatements[0], `MemberExpression > Literal[value='shift']`);
        const shiftLiterals = esquery(catchClauseExpressionStatements[0], `MemberExpression > Identifier[name='shift']`);
        if((shiftIdentifiers.length != 1)
        && (shiftLiterals.length != 1)){
            return false;
        }

        return true;
    }

    _fixCaseWhereStringArrayRotateFunctionTemplateIsDirectlyUnderExpressionStatement(){
        if(!this.stringArrayRotateNode){
            return;
        }
        if(this.stringArrayRotateNode.parent.type == 'ExpressionStatement'){
            this.stringArrayRotateNode = this.stringArrayRotateNode.parent;
        }
    }

    _findArrayRotateTemplateForOlderObfuscatorVersions(){
        const functionExpressions = esquery(this.ast, `Program > ExpressionStatement > CallExpression[arguments.length=2] `
        + `> FunctionExpression[id=null]`);

        let nrSuitableNodes = 0;
        for(let i = 0; i < functionExpressions.length; i++){
            const functionExpression = functionExpressions[i];
            const callExpression = functionExpression.parent;
            const expressionStatement = callExpression.parent;
            const firstArgument = callExpression.arguments[0];
            if(firstArgument.type != 'Identifier'){
                continue;
            }
            if(firstArgument.name != this.stringArrayTemplateIdentifierName){
                continue;
            }

            let foundPush = false;
            let foundShift = false;

            const literalsPush = esquery(functionExpression, `Literal[value='push']`);
            if(literalsPush.length != 0){
                foundPush = true;
            }
            else{
                const identifiersPush = esquery(functionExpression, `Identifier[name='push']`);
                if(identifiersPush.length != 0){
                    foundPush = true;
                }
            }

            const literalsShift = esquery(functionExpression, `Literal[value='shift']`);
            if(literalsShift.length != 0){
                foundShift = true;
            }
            else{
                const identifiersShift = esquery(functionExpression, `Identifier[name='shift']`);
                if(identifiersShift.length != 0){
                    foundShift = true;
                }
            }

            if(!foundPush || !foundShift){
                continue;
            }

            this.stringArrayRotateNode = expressionStatement;
            nrSuitableNodes++;
        }

        if(nrSuitableNodes > 1){
            this.logger.warn(`Found more than one string array rotate nodes (old version).`);
            this.stringArrayRotateNode = null;
        }
        
        if(nrSuitableNodes == 0){
            this.logger.warn(`Could not find string array rotate node (old version).`);
        }
    }

    getNode(){
        return this.stringArrayRotateNode;
    }
}


class StringArrayNodesFinder{
    constructor(logger, obfuscatedSourceCode, ast, argv){
        this.logger = logger;
        this.obfuscatedSourceCode = obfuscatedSourceCode;
        this.ast = ast;
        this.argv = argv;
    }

    findNodes(){
        if(this.argv.stringArrayCmdLineSpecificNodesInfo){
            return; 
        }

        this._findNodesInAST();
    }

    _findNodesInAST(){
        this._findNodeWithStringArrayTemplate();
        this._findNodesWithStringArrayCallWrapperTemplate();

        if(!this.foundStringArraySpecificNodes()){
            this.logger.warn(`Cound not find string array and wrappers.`);
            return;
        }

        this._getNodeWithStringArrayRotateFunctionTemplate();
    }

    _findNodeWithStringArrayTemplate(){
        let finder = new StringArrayTemplateNodeFinder(this.logger, this.obfuscatedSourceCode, this.ast);
        finder.findNode();
        this.nodeWithStringArrayTemplate = finder.getNode();
        this.stringArrayTemplateFunctionName = finder.getIdentifierName();
        this.logger.info(`[stage_03_stringarray.js] stringArrayTemplateFunctionName = `
        + `${this.stringArrayTemplateFunctionName}.`);
    }

    _findNodesWithStringArrayCallWrapperTemplate(){
        if(!this.stringArrayTemplateFunctionName){
            return;
        }

        let finder = new StringArrayWrapperTemplateNodesFinder(this.logger, this.obfuscatedSourceCode, 
            this.ast, this.stringArrayTemplateFunctionName);
        finder.findNode();
        this.nodesWithStringArrayCallWrapperTemplate = finder.getNode();
        this.stringArrayCallWrapperTemplateFunctionNames = finder.getIdentifierName();
        this.logger.info(`[stage_03_stringarray.js] stringArrayCallsWrapperTemplateFunctionName = `
        + `${this.stringArrayCallWrapperTemplateFunctionNames.join(', ')}.`);
    }

    foundStringArraySpecificNodes(){
        return this.argv.stringArrayCmdLineSpecificNodesInfo ||
               (this.nodeWithStringArrayTemplate && this.stringArrayTemplateFunctionName
                && (this.nodesWithStringArrayCallWrapperTemplate.length != 0) 
                && (this.stringArrayCallWrapperTemplateFunctionNames.length != 0));
    }

    _getNodeWithStringArrayRotateFunctionTemplate(){
        let finder = new StringArrayRotateTemplateNodeFinder(this.logger, this.obfuscatedSourceCode, 
            this.ast, this.stringArrayTemplateFunctionName, this.stringArrayCallWrapperTemplateFunctionNames);
        finder.findNode();
        this.nodeWithStringArrayRotateFunction = finder.getNode();
        if(this.nodeWithStringArrayRotateFunction){
            this.logger.info(`[stage_03_stringarray.js] Found nodeWithStringArrayRotateFunction.`);
        }
    }

    getStringArrayCallWrapperFunctionNames(){
        if(this.argv.stringArrayCmdLineSpecificNodesInfo){
            return this.argv.stringArrayCmdLineSpecificNodesInfo.stringArrayWrapperNames; 
        }
        return this.stringArrayCallWrapperTemplateFunctionNames;
    }

    addNodesToExecutionContext(){
        if(this.argv.stringArrayCmdLineSpecificNodesInfo){
            this._addCommandLineStringArrayCodeToExecutionContext();
        }
        else{
            this._addFoundInASTStringArrayNodesToExecutionContext();
        }
        this.logger.info(`Finished adding stringarray specific nodes.`);
    }

    _addCommandLineStringArrayCodeToExecutionContext(){
        this.logger.info(`[CommandLineInput] Addding found stringarray template to execution context.`);
        this.logger.debug(`[EVAL][CommandLineInput][StringArray] ${
            this.argv.stringArrayCmdLineSpecificNodesInfo.stringArrayTemplateCode}`);
        eval.call(module, this.argv.stringArrayCmdLineSpecificNodesInfo.stringArrayTemplateCode);
    
        this._fixStringArrayWrappersCommandLineCode();
        this.logger.info(`[CommandLineInput] Addding found stringarray calls wrappers templates to execution context.`);
        this.logger.debug(`[EVAL][CommandLineInput][StringArrayWrappers] ${
            this.argv.stringArrayCmdLineSpecificNodesInfo.stringArrayWrapperTemplates}`);
        eval.call(module, this.argv.stringArrayCmdLineSpecificNodesInfo.stringArrayWrapperTemplates);

        if(this.argv.stringArrayCmdLineSpecificNodesInfo.stringArrayRotate){
            this.logger.info(`[CommandLineInput] Addding found stringarray rotate template to execution context.`);
            this.logger.debug(`[EVAL][CommandLineInput][StringArrayRotate] ${
                this.argv.stringArrayCmdLineSpecificNodesInfo.stringArrayRotate}`);
            eval.call(module, this.argv.stringArrayCmdLineSpecificNodesInfo.stringArrayRotate);
        }
    }

    _fixStringArrayWrappersCommandLineCode(){
        this.argv.stringArrayCmdLineSpecificNodesInfo.stringArrayWrapperTemplates = 
            astOperations.ASTSourceCodeOperations.compactSourceCode(
            this.argv.stringArrayCmdLineSpecificNodesInfo.stringArrayWrapperTemplates);
    }

    _addFoundInASTStringArrayNodesToExecutionContext(){
        this._addStringArrayTemplateToExecutionContext();
        this._addStringArrayCallWrappersToExecutionContext();
        this._addStringArrayRotateFunctionToExecutionContext();
    }

    _addStringArrayTemplateToExecutionContext(){
        this.logger.info(`Addding found stringarray template to execution context.`);
        let correspondingCode = this.obfuscatedSourceCode.substring(this.nodeWithStringArrayTemplate.range[0], 
            this.nodeWithStringArrayTemplate.range[1]);
        let codeToAdd = correspondingCode.replace(/^\s*function\s+[^(]+\(/, 'function (');
        if(codeToAdd.startsWith('const ')){
            codeToAdd = `var ${codeToAdd.substring(6)}`;
        }
        else if(codeToAdd.startsWith('let ')){
            codeToAdd = `var ${codeToAdd.substring(4)}`;
        }
        else if(!codeToAdd.startsWith('var ')){
            codeToAdd = `var ${this.stringArrayTemplateFunctionName} = ${codeToAdd}`;
        }
        this.logger.debug(`[EVAL][NodesFinder][StringArray] ${codeToAdd}`);
        eval.call(module, codeToAdd);
    }
    
    _addStringArrayCallWrappersToExecutionContext(){
        this.logger.info(`Addding found stringarray calls wrappers templates to execution context.`);
        for(let i = 0 ; i < this.nodesWithStringArrayCallWrapperTemplate.length; i++){
            const wrapper = this.nodesWithStringArrayCallWrapperTemplate[i];
            const wrapperName = this.stringArrayCallWrapperTemplateFunctionNames[i];
            let correspondingCode = this.obfuscatedSourceCode.substring(wrapper.range[0], wrapper.range[1]);
            let codeToAdd = null;
            if(correspondingCode.startsWith('var ')){
                codeToAdd = correspondingCode;
            }
            else if(correspondingCode.startsWith('const ')){
                codeToAdd = `var ${correspondingCode.substring(6)}`;
            }
            else if(correspondingCode.startsWith('let ')){
                codeToAdd = `var ${correspondingCode.substring(4)}`;
            }
            else{
                codeToAdd = correspondingCode.replace(/^\s*function\s+[^(]+\(/, 'function (');
                codeToAdd = `var ${wrapperName} = ${codeToAdd}`;
            }
            this.logger.debug(`[EVAL][NodesFinder][StringArrayWrappers] ${codeToAdd}`);
            eval.call(module, codeToAdd);
        }
    }
    
    _addStringArrayRotateFunctionToExecutionContext(){
        if(!this.nodeWithStringArrayRotateFunction){
            return;
        }
        this.logger.info(`Addding found stringarray rotate template to execution context.`);
        let codeStringArrayRotateFunction = this.obfuscatedSourceCode.substring(
            this.nodeWithStringArrayRotateFunction.range[0], this.nodeWithStringArrayRotateFunction.range[1]);
        if(codeStringArrayRotateFunction[0] != '('){
            codeStringArrayRotateFunction = `(${codeStringArrayRotateFunction});`;    
        }
        this.logger.debug(`[EVAL][NodesFinder][StringArrayRotate] ${codeStringArrayRotateFunction}`);
        eval.call(module, codeStringArrayRotateFunction);
    }

    removeStringArrayNodesFromSourceCode(){
        if(this.argv.stringArrayCmdLineSpecificNodesInfo){
            return;
        }

        this._removeStringArrayNodesFoundInAST();
    }

    _removeStringArrayNodesFoundInAST(){
        astOperations.ASTModifier.removeSingleNode(this.nodeWithStringArrayTemplate, this.logger, 
            this.obfuscatedSourceCode);
        for(let i = 0; i < this.nodesWithStringArrayCallWrapperTemplate.length; i++){
            astOperations.ASTModifier.removeSingleNode(this.nodesWithStringArrayCallWrapperTemplate[i], 
                this.logger, this.obfuscatedSourceCode);
        }
        if(this.nodeWithStringArrayRotateFunction){
            astOperations.ASTModifier.removeSingleNode(this.nodeWithStringArrayRotateFunction, this.logger, 
                this.obfuscatedSourceCode);
        }
    }
}


class StringArrayCallsReplacer{
    constructor(logger, obfuscatedSourceCode, ast, stringArrayCallWrapperTemplateFunctionNames){
        this.logger = logger;
        this.obfuscatedSourceCode = obfuscatedSourceCode;
        this.ast = ast;
        this.stringArrayCallWrapperTemplateFunctionNames = stringArrayCallWrapperTemplateFunctionNames;

        this.allVariableWrappers = [];
        this.allFunctionWrappers = [];
    }

    replace(){
        this._initializeVariableAndFunctionWrappers();
        
        var i = 0;
        var thisObj = this;
        estraverse.traverse(this.ast, {
            enter: function(node){
                if(astOperations.NodeChecker.nodeHasBodyWithLexicalScope(node)){
                    i++;
                    console.log(`Replacing calls in scope nr. ${i}.`);
                    thisObj.logger.info(`Replacing calls in scope nr. ${i}.`);
                    thisObj._fixStringArrayCallsInLexicalScope(node);
                }
            },
        });
    }

    _initializeVariableAndFunctionWrappers(){
        for(let i = 0 ; i < this.stringArrayCallWrapperTemplateFunctionNames.length; i++){
            const wrapperName = this.stringArrayCallWrapperTemplateFunctionNames[i];
            this.allVariableWrappers.push(wrapperName);
            this.allFunctionWrappers.push(wrapperName);
        }

    }

     _fixStringArrayCallsInLexicalScope(node){
        this._fixHostNodes(node);
        this._replaceStringArrayCallsUsingVariableWrappers(node);
        this._replaceStringArrayCallsUsingFunctionWrappers(node);
    }

    _fixHostNodes(node){
        if(!node || !node.body || (node.body.type != 'BlockStatement') || !node.body.body || !node.body.body.length){
            return;
        }
    
        let nodesToRemove = [];
        const body = node.body.body;
        for(let i = 0; i < body.length; i++){
            let variableDeclaration = body[i];
            if(!variableDeclaration || !variableDeclaration.type || (variableDeclaration.type != 'VariableDeclaration')
            || !variableDeclaration.declarations || (variableDeclaration.declarations.length == 0)){
                break;
            }
            const variableDeclaratorsWithHostNodes = this._getVariableDeclaratorsWithHostNodes(variableDeclaration.declarations);
            const nodesToRemoveForCurrentVariableDeclarationNode = this._getNodesRelatedToHostNodesThatNeedToBeRemoved(
                variableDeclaration, variableDeclaratorsWithHostNodes);
            nodesToRemove.push(...nodesToRemoveForCurrentVariableDeclarationNode);
    
            this._addHostNodesToExecutionContext(variableDeclaratorsWithHostNodes);
        }
        astOperations.ASTModifier.removeMultipleNodesWithSameParent(nodesToRemove, this.logger, this.obfuscatedSourceCode);
    }

    _getVariableDeclaratorsWithHostNodes(declarations){
        let variableDeclaratorHostNodes = [];
        for(let i = 0; i < declarations.length; i++){
            const variableDeclarator = declarations[i];
            if(!variableDeclarator || (variableDeclarator.type != 'VariableDeclarator')){
                continue;
            }
            if(!this._isVariableDeclaratorAssociatedWithHostNode(variableDeclarator)){
                break;
            }
            variableDeclaratorHostNodes.push(variableDeclarator);
        }
        return variableDeclaratorHostNodes;
    }

    _isVariableDeclaratorAssociatedWithHostNode(node){
        if(!node || (node.type != 'VariableDeclarator')){
            return false;
        }
        if(!node.id || !node.init){
            return false;
        }
        if(node.id.type != 'Identifier'){
            return false;
        }
        if(node.init.type != 'ObjectExpression'){
            return false;
        }

        const objectExpression = node.init;
        if(!objectExpression.properties || (objectExpression.properties.length == 0)){
            return false;
        }
        for(let i = 0; i < objectExpression.properties.length; i++){
            const property = objectExpression.properties[i];
            if(!property || (property.type != 'Property')){
                return false;
            }

            if(!property.key || !property.value){
                return false;
            }

            if(property.key.type != 'Identifier'){
                return false;
            }

            if(property.value.type != 'Literal'){
                return false;
            }
        }

        return true;
    }

    _getNodesRelatedToHostNodesThatNeedToBeRemoved(variableDeclaration, variableDeclaratorsWithHostNodes){
        let nodesToRemove = []
        if(variableDeclaration.declarations.length == variableDeclaratorsWithHostNodes.length){
            nodesToRemove.push(variableDeclaration);
        }
        else{
            nodesToRemove.push(...variableDeclaratorsWithHostNodes);
        }
        return nodesToRemove;
    }

    _addHostNodesToExecutionContext(variableDeclaratorsWithHostNodes){
        for(let i = 0; i < variableDeclaratorsWithHostNodes.length; i++){
            const variableDeclarator = variableDeclaratorsWithHostNodes[i];
            let codeToEval = `var ` + `${this.obfuscatedSourceCode.substring(variableDeclarator.range[0], 
                variableDeclarator.range[1])}`;
                this.logger.debug(`[EVAL][Wrappers][HostNode] ${codeToEval}`);
            eval.call(module, codeToEval);
        }
    }

    _replaceStringArrayCallsUsingVariableWrappers(node){
        let variableDeclaratorWrappers = this._getVariableDeclaratorWrappersInScope(node);
        this._addVariableDeclaratorWrappersToExecutionContext(variableDeclaratorWrappers);
        this._replaceVariableDeclaratorWrappersCalls(node, variableDeclaratorWrappers);
        this._removeVariableDeclaratorWrappers(variableDeclaratorWrappers);
    }

    _getVariableDeclaratorWrappersInScope(node){
        let wrappers = [];

        let body = (node.type == 'Program') ? node.body : node.body.body;
        for (let i = 0; i < body.length; i++){
            const statement = body[i];
            const variableDeclaratorWrappers = this._getVariableDeclaratorWrappersFromStatement(statement);
            if(variableDeclaratorWrappers.length != 0){
                wrappers.push(...variableDeclaratorWrappers);
                this.allVariableWrappers.push(...variableDeclaratorWrappers);
            }
        }

        return wrappers;
    }

    _getVariableDeclaratorWrappersFromStatement(node){
        let variableDeclaratorWrappers = [];
        if(!node){
            return [];
        }
        if(node.type != 'VariableDeclaration'){
            return [];
        }
    
        if(!node.declarations || (node.declarations.length == 0)){
            return [];
        }
        
        for(let i = 0; i < node.declarations.length; i++){
            const variableDeclarator = node.declarations[i];
            if(variableDeclarator.type != 'VariableDeclarator'){
                continue;
            }
        
            if(!variableDeclarator.id || (variableDeclarator.id.type != 'Identifier')){
                continue;
            }
        
            if(!variableDeclarator.init){
                continue;
            }
        
            const initNode = variableDeclarator.init;
            if((initNode.type != 'Identifier') && (initNode.type != 'FunctionExpression')){
                continue;
            }
        
            let allVariableWrapperNames = this._getIdentifierNamesForVariableDeclaratorNodes(this.allVariableWrappers);

            if(initNode.type == 'Identifier'){
                if(allVariableWrapperNames.includes(initNode.name)){
                    variableDeclaratorWrappers.push(variableDeclarator);
                }
            }
            else if(initNode.type == 'FunctionExpression'){
                const callExpressionNodes = esquery(initNode, `FunctionExpression[params.length>0] > BlockStatement > `
                + `ReturnStatement > CallExpression[callee.type='Identifier']`);
                for(let j = 0; j < callExpressionNodes.length; j++){
                    const callExpression = callExpressionNodes[j];
                    const functionExpressionNode = astOperations.ASTRelations.getParentNodeOfType(callExpression, 'FunctionExpression');
                    if(functionExpressionNode != initNode){
                        continue;
                    }
                    const identifier = callExpression.callee;
                    if(allVariableWrapperNames.includes(identifier.name)){
                        variableDeclaratorWrappers.push(variableDeclarator);
                        break;
                    }
                }
            }
            
        }
        return variableDeclaratorWrappers;
    }
    
    _getIdentifierNamesForVariableDeclaratorNodes(variableDeclaratorNodes){
        let names = [];
        for(let i = 0; i < variableDeclaratorNodes.length; i++){
            const variableDeclarator = variableDeclaratorNodes[i];
            if(typeof variableDeclarator == 'string'){
                names.push(variableDeclarator);
            }
            else{
                const name = this._getIdentifierNameForVariableWrapper(variableDeclarator);
                if(name){
                    names.push(name);
                }
            }
        }
        return names;
    }

    _getIdentifierNameForVariableWrapper(node){
        if(!node || (node.type != 'VariableDeclarator')){
            return null;
        }

        const identifier = node.id;
        if(!identifier || (identifier.type != 'Identifier') || !identifier.name){
            return null;
        }

        return identifier.name;
    }

    _addVariableDeclaratorWrappersToExecutionContext(wrappers){
        for(let i = 0; i < wrappers.length; i++){
            const wrapper = wrappers[i];
            let wrapperCode = `var ${this.obfuscatedSourceCode.substring(wrapper.range[0], wrapper.range[1])}`;
            this.logger.debug(`[EVAL][VariableWrapper] ${wrapperCode}`);
            eval.call(module, wrapperCode);
        }
    }

    _replaceVariableDeclaratorWrappersCalls(node, currentNodeVariableWrappers){
        let nodesWithCallsToReplace = this._getVariableWrapperCallsInScope(node, currentNodeVariableWrappers);
        for(let i = 0; i < nodesWithCallsToReplace.length; i++){
            const callExpressionNode = nodesWithCallsToReplace[i];
            this.logger.debug(`[EVAL][VariableWrapperReplace] ${this.obfuscatedSourceCode.substring(
                callExpressionNode.range[0], callExpressionNode.range[1])}`);
            const stringToReplaceWith = astOperations.NodeEvaller.evalCallExpressionNodeBasedOnSourceCode(
                callExpressionNode, this.obfuscatedSourceCode);
            astOperations.ASTModifier.replaceNode(callExpressionNode, {
                type: 'Literal',
                value: stringToReplaceWith
            }, this.logger, this.obfuscatedSourceCode);
        }
    }

    _getVariableWrapperCallsInScope(nodeWithBody, currentNodeVariableWrappers){
        let wrapperCalls = []

        const curentNodeWrapperNames = this._getIdentifierNamesForVariableDeclaratorNodes(currentNodeVariableWrappers);
        const allWrapperNames = this._getIdentifierNamesForVariableDeclaratorNodes(this.allVariableWrappers);
        let wrapperNamesSearchedInCurrentScope = this._getVariableWrapperNamesToSearchInCurrentScope(nodeWithBody, 
            curentNodeWrapperNames, allWrapperNames);
       
        var firstNode = true;
        estraverse.traverse(nodeWithBody, {
            enter: function(node, parent){
                if(!firstNode && astOperations.NodeChecker.nodeHasBodyWithLexicalScope(node)){
                    this.skip();
                }
                firstNode = false;

                if((node.type == 'Identifier') && (parent.type == 'CallExpression')){
                    let identifierName = node.name;
                    if(wrapperNamesSearchedInCurrentScope.includes(identifierName) 
                      && (parent.callee.name == identifierName)){
                        wrapperCalls.push(parent);
                    }
                }
            },
        });
        return wrapperCalls;
    }

    _getVariableWrapperNamesToSearchInCurrentScope(nodeWithBody, curentNodeWrapperNames, allWrapperNames){
        let wrapperNames = [];

        for(let i = 0; i < allWrapperNames.length; i++){
            const wrapperName = allWrapperNames[i];
            const variableDeclaratorWrapper = this.allVariableWrappers[i];

            if(curentNodeWrapperNames.includes(wrapperName) || (nodeWithBody.type == 'Program')){
                wrapperNames.push(wrapperName);
                continue;
            }

            if(!this._wrapperIsRedefinedInCurrentScope(wrapperName, nodeWithBody)
                && ((typeof variableDeclaratorWrapper == 'string') 
                    || this._wrapperWasDefinedInAScopeThatIsParentOfCurrentScope(variableDeclaratorWrapper, nodeWithBody))){
                wrapperNames.push(wrapperName);
            }
        }

        return wrapperNames;
    }

    _wrapperIsRedefinedInCurrentScope(wrapperName, nodeWithBody){
        return this._wrapperIsRedefinedInCurrentScopeAsNewVariable(wrapperName, nodeWithBody) 
        || this._wrapperIsRedefinedInCurrentScopeAsNewFunction(wrapperName, nodeWithBody)
        || this._wrapperIsRedefinedInCurrentScopeAsAssignmentExpression(wrapperName, nodeWithBody);

    }

    _wrapperIsRedefinedInCurrentScopeAsNewVariable(wrapperName, nodeWithBody){
        var firstNode = true;
        var foundRedefined = false;
        estraverse.traverse(nodeWithBody, {
            enter: function(node, parent){
                if(!firstNode && astOperations.NodeChecker.nodeHasBodyWithLexicalScope(node)){
                    this.skip();
                }
                firstNode = false;

                if((node.type == 'Identifier') && (node.name == wrapperName) 
                   && (parent.type == 'VariableDeclarator') && (parent.id.name == wrapperName)){
                    foundRedefined = true;
                    this.break();
                }
            },
        });
        return foundRedefined;
    }

    _wrapperIsRedefinedInCurrentScopeAsNewFunction(wrapperName, nodeWithBody){
        var firstNode = true;
        var foundRedefined = false;
        estraverse.traverse(nodeWithBody, {
            enter: function(node, parent){
                if(!firstNode && astOperations.NodeChecker.nodeHasBodyWithLexicalScope(node)){
                    this.skip();
                }
                firstNode = false;

                if((node.type == 'Identifier') && (node.name == wrapperName) && (parent.type == 'FunctionDeclaration')){
                    foundRedefined = true;
                    this.break();
                }
            },
        });
        return foundRedefined;
    }

    _wrapperIsRedefinedInCurrentScopeAsAssignmentExpression(wrapperName, nodeWithBody){
        var firstNode = true;
        var foundRedefined = false;
        estraverse.traverse(nodeWithBody, {
            enter: function(node, parent){
                if(!firstNode && astOperations.NodeChecker.nodeHasBodyWithLexicalScope(node)){
                    this.skip();
                }
                firstNode = false;

                if((node.type == 'Identifier') && (node.name == wrapperName) 
                && (parent.type == 'AssignmentExpression') && parent.left && (parent.left.name == wrapperName)){
                    foundRedefined = true;
                    this.break();
                }
            },
        });
        return foundRedefined;
    }

    _wrapperWasDefinedInAScopeThatIsParentOfCurrentScope(wrapper, nodeWithBody){
        const wrapperLexicalScope = astOperations.ASTRelations.getParentNodeWithLexicalScope(wrapper);

        var node = nodeWithBody;
        var parent = null;
        do{
            if(parent == wrapperLexicalScope){
                return true;
            }
            parent = astOperations.ASTRelations.getParentNodeWithLexicalScope(node);
            node = parent;
        }while(parent.type != 'Program');

        if(parent == wrapperLexicalScope){
            return true;
        }
        else{
            return false;
        }
    }

    _removeVariableDeclaratorWrappers(wrappers){
        for(let i = 0; i < wrappers.length; i++){
            let wrapper = wrappers[i];
            if((wrapper.parent.type == 'VariableDeclaration') && (wrapper.parent.declarations.length == 1)){
                wrapper = wrapper.parent;
            }
            astOperations.ASTModifier.removeSingleNode(wrapper, this.logger, this.obfuscatedSourceCode);
        }
    }

    _replaceStringArrayCallsUsingFunctionWrappers(nodeWithBody){
        let currentNodeFunctionWrappers = this._getFunctionDeclarationWrappersInScope(nodeWithBody);
        this._addFunctionDeclarationWrappersToExecutionContext(currentNodeFunctionWrappers);
        this._replaceFunctionDeclarationWrappersCalls(nodeWithBody, currentNodeFunctionWrappers);
        this._removeFunctionDeclarationWrappers(currentNodeFunctionWrappers);
    }

    _getFunctionDeclarationWrappersInScope(nodeWithBody){
        let wrappers = [];

        let body = (nodeWithBody.type == 'Program') ? nodeWithBody.body : nodeWithBody.body.body;

        for (let i = 0; i < body.length; i++){
            const statement = body[i];
            if(this._nodeIsFunctionDeclarationWrapper(statement)){
                wrappers.push(statement);
                this.allFunctionWrappers.push(statement);
            }
        }

        return wrappers;
    }

    _nodeIsFunctionDeclarationWrapper(node){
        if(!node){
            return false;
        }

        if(!node.type || (node.type != 'FunctionDeclaration')){
            return false;
        }
    
        if(!node.params || (node.params.length == 0)){
            return false;
        }
    
        const functionBody = node.body;
        if(!functionBody || (functionBody.type != 'BlockStatement') || (functionBody.body.length != 1)){
            return false;
        }
    
        const returnStatement = functionBody.body[0];
        if((returnStatement.type != 'ReturnStatement') || !returnStatement.argument){
            return false;
        }
    
        const callExpression = returnStatement.argument;
        if((callExpression.type != 'CallExpression') || !callExpression.callee){
            return false;
        }
    
        const identifier = callExpression.callee;
        if (identifier.type != 'Identifier'){
            return false;
        }
    
        let allFunctionWrapperNames = this._getIdentifierNamesForFunctionDeclarationNodes(this.allFunctionWrappers);
        return allFunctionWrapperNames.includes(identifier.name);
    }

    _getIdentifierNamesForFunctionDeclarationNodes(functionDeclarationNodes){
        let names = [];
        for(let i = 0; i < functionDeclarationNodes.length; i++){
            const node = functionDeclarationNodes[i];
            if(typeof node == 'string'){
                names.push(node);
            }
            else{
                const name = this._getIdentifierNameForFunctionWrapper(node);
                if(name){
                    names.push(name);
                }
            }
        }
        return names;
    }

    _getIdentifierNameForFunctionWrapper(node){
        if(!node || (node.type != 'FunctionDeclaration')){
            return null;
        }

        if(!node.id){
            return null;
        }

        const identifier = node.id;
        if(identifier.type != 'Identifier'){
            return null;
        }
        
        return identifier.name;
    }

    _addFunctionDeclarationWrappersToExecutionContext(wrappers){
        for(let i = 0; i < wrappers.length; i++){
            const wrapper = wrappers[i];
            let wrapperCode = this.obfuscatedSourceCode.substring(wrapper.range[0], wrapper.range[1]);
            this.logger.debug(`[EVAL][FunctionWrapper] ${wrapperCode}`);
            eval.call(module, wrapperCode);
        }
    }

    _replaceFunctionDeclarationWrappersCalls(nodeWithBody, currentNodeFunctionWrappers){
        let nodesWithCallsToReplace = this._getFunctionWrapperCallsInScope(nodeWithBody, currentNodeFunctionWrappers);
        for(let i = 0; i < nodesWithCallsToReplace.length; i++){
            const callExpressionNode = nodesWithCallsToReplace[i];
            this.logger.debug(`[EVAL][FunctionWrapperReplace] ${this.obfuscatedSourceCode.substring(
                callExpressionNode.range[0], callExpressionNode.range[1])}`);
            const stringToReplaceWith = astOperations.NodeEvaller.evalCallExpressionNodeBasedOnSourceCode(
                callExpressionNode, this.obfuscatedSourceCode);
            astOperations.ASTModifier.replaceNode(callExpressionNode, {
                type: 'Literal',
                value: stringToReplaceWith
            }, this.logger, this.obfuscatedSourceCode);
        }
    }

    _getFunctionWrapperCallsInScope(nodeWithBody, currentNodeFunctionWrappers){
        let wrapperCalls = [];

        const curentNodeWrapperNames = this._getIdentifierNamesForFunctionDeclarationNodes(currentNodeFunctionWrappers);
        const allWrapperNames = this._getIdentifierNamesForFunctionDeclarationNodes(this.allFunctionWrappers);
        let wrapperNamesForSearching = this._getFunctionWrapperNamesToSearchInCurrentScope(nodeWithBody, 
            curentNodeWrapperNames, allWrapperNames);

        var firstNode = true;
        estraverse.traverse(nodeWithBody, {
            enter: function(node, parent){
                if(!firstNode && astOperations.NodeChecker.nodeHasBodyWithLexicalScope(node)){
                    this.skip();
                }
                firstNode = false;

                if((node.type == 'Identifier') && (parent.type == 'CallExpression')){
                    let identifierName = node.name;
                    if(wrapperNamesForSearching.includes(identifierName)
                       && (parent.callee.name == identifierName)){
                        wrapperCalls.push(parent);
                    }
                }
            },
        });

        return wrapperCalls;
    }

    _getFunctionWrapperNamesToSearchInCurrentScope(nodeWithBody, curentNodeWrapperNames, allWrapperNames){
        let wrapperNames = [];
        for(let i = 0; i < allWrapperNames.length; i++){
            const wrapperName = allWrapperNames[i];
            const functionDeclaratorWrapper = this.allFunctionWrappers[i];

            if(curentNodeWrapperNames.includes(wrapperName) || (nodeWithBody.type == 'Program')){
                wrapperNames.push(wrapperName);
                continue;
            }
            if((!this._wrapperIsRedefinedInCurrentScope(wrapperName, nodeWithBody)
                && ((typeof functionDeclaratorWrapper == 'string') 
                    || this._wrapperWasDefinedInAScopeThatIsParentOfCurrentScope(functionDeclaratorWrapper, nodeWithBody)))
              ){
                wrapperNames.push(wrapperName);
            }
        }
        return wrapperNames;
    }

    _removeFunctionDeclarationWrappers(wrappers){
        for(let i = 0; i < wrappers.length; i++){
            const wrapper = wrappers[i];
            astOperations.ASTModifier.removeSingleNode(wrapper, this.logger, this.obfuscatedSourceCode);
        }
    }
}


class StringArraySyntheticTransformer extends stageDeobfuscator.TransformerDeobfuscator{
    constructor(logger, obfuscatedSourceCode, ast, argv){
        super(logger, obfuscatedSourceCode, ast, argv);
        this.stringArrayCallWrapperTemplateFunctionNames = null;
    }

    deobfuscate(){

        this._findStringArraySpecificNodes();
        if(!this.stringArrayNodesFinder.foundStringArraySpecificNodes()){
            return;
        }
        
        this._replaceStringArrayCallsWithCorrespondingString();
    }

    _findStringArraySpecificNodes(){
        this.stringArrayNodesFinder = new StringArrayNodesFinder(this.logger, this.obfuscatedSourceCode, 
            this.ast, this.argv);
        this.stringArrayNodesFinder.findNodes();
        if(!this.stringArrayNodesFinder.foundStringArraySpecificNodes()){
            return;
        }

        this.stringArrayCallWrapperTemplateFunctionNames = this.stringArrayNodesFinder.
            getStringArrayCallWrapperFunctionNames();
        this.stringArrayNodesFinder.addNodesToExecutionContext();
        this.stringArrayNodesFinder.removeStringArrayNodesFromSourceCode();
    }

    _replaceStringArrayCallsWithCorrespondingString(){
        this.logger.info('Replacing stringarray calls with actual strings - START.');
        this.stringArrayCallsReplacer = new StringArrayCallsReplacer(this.logger, this.obfuscatedSourceCode, 
            this.ast, this.stringArrayCallWrapperTemplateFunctionNames);
        this.stringArrayCallsReplacer.replace();
        this.logger.info('Replacing stringarray calls with actual strings - FINISH.');
    }

}


module.exports = {StringArrayStageDeobfuscator};
