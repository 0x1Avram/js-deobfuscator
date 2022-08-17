"use strict";


const stageDeobfuscator = require('./stage_deobfuscator');


class StageRenameIdentifiers extends stageDeobfuscator.StageDeobfuscator{
    constructor(logger, obfuscatedSourceCode, ast, argv, stageName){
        super(logger, obfuscatedSourceCode, ast, argv, stageName);
    }

    _initiateTransformers(){
        this.transformers = {
            'RenameIdentifiersCustomCodeHelpersTransformer': RenameIdentifiersCustomCodeHelpersTransformer,
            'RenameIdentifiersScopeThroughIdentifiersTransformer': RenameIdentifiersScopeThroughIdentifiersTransformer,
            'RenameIdentifiersScopeIdentifiersTransformer': RenameIdentifiersScopeIdentifiersTransformer,
            'RenameIdentifiersLabeledStatementTransformer': RenameIdentifiersLabeledStatementTransformer,
            'RenameIdentifiersVariablePreserveTransformer': RenameIdentifiersVariablePreserveTransformer,
        }
    }
}


class RenameIdentifiersCustomCodeHelpersTransformer extends stageDeobfuscator.TransformerDeobfuscator{
    constructor(logger, obfuscatedSourceCode, ast, argv){
        super(logger, obfuscatedSourceCode, ast, argv);
    }

    deobfuscate(){
        ;
    }
}


class RenameIdentifiersScopeThroughIdentifiersTransformer extends stageDeobfuscator.TransformerDeobfuscator{
    constructor(logger, obfuscatedSourceCode, ast, argv){
        super(logger, obfuscatedSourceCode, ast, argv);
    }

    deobfuscate(){
        ;
    }
}


class RenameIdentifiersScopeIdentifiersTransformer extends stageDeobfuscator.TransformerDeobfuscator{
    constructor(logger, obfuscatedSourceCode, ast, argv){
        super(logger, obfuscatedSourceCode, ast, argv);
    }

    deobfuscate(){
        ;
    }
}


class RenameIdentifiersLabeledStatementTransformer extends stageDeobfuscator.TransformerDeobfuscator{
    constructor(logger, obfuscatedSourceCode, ast, argv){
        super(logger, obfuscatedSourceCode, ast, argv);
    }

    deobfuscate(){
        ;
    }
}


class RenameIdentifiersVariablePreserveTransformer extends stageDeobfuscator.TransformerDeobfuscator{
    constructor(logger, obfuscatedSourceCode, ast, argv){
        super(logger, obfuscatedSourceCode, ast, argv);
    }

    deobfuscate(){
        ;
    }
}


module.exports = {StageRenameIdentifiers};
