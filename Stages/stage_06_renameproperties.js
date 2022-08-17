

"use strict";


const stageDeobfuscator = require('./stage_deobfuscator');


class StageRenameProperties extends stageDeobfuscator.StageDeobfuscator{
    constructor(logger, obfuscatedSourceCode, ast, argv, stageName){
        super(logger, obfuscatedSourceCode, ast, argv, stageName);
    }

    _initiateTransformers(){
        this.transformers = {
            'RenamePropertiesRenamePropertiesTransformer': RenamePropertiesRenamePropertiesTransformer,
        }
    }
}


class RenamePropertiesRenamePropertiesTransformer extends stageDeobfuscator.TransformerDeobfuscator{
    constructor(logger, obfuscatedSourceCode, ast, argv){
        super(logger, obfuscatedSourceCode, ast, argv);
    }

    deobfuscate(){
        ;
    }
}


module.exports = {StageRenameProperties};
