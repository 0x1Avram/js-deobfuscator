"use strict";


const stageDeobfuscator = require('./stage_deobfuscator');


class StageInitializing extends stageDeobfuscator.StageDeobfuscator{
    constructor(logger, obfuscatedSourceCode, ast, argv, stageName){
        super(logger, obfuscatedSourceCode, ast, argv, stageName);
    }

    _initiateTransformers(){
        this.transformers = {
            'InitializingCommentsTransformer': InitializingCommentsTransformer,
            'InitializingCustomCodeHelpersTransformer': InitializingCustomCodeHelpersTransformer
        }
    }
}


class InitializingCommentsTransformer extends stageDeobfuscator.TransformerDeobfuscator{
    constructor(logger, obfuscatedSourceCode, ast, argv){
        super(logger, obfuscatedSourceCode, ast, argv);
    }

    deobfuscate(){
        ;
    }
}


class InitializingCustomCodeHelpersTransformer extends stageDeobfuscator.TransformerDeobfuscator{
    constructor(logger, obfuscatedSourceCode, ast, argv){
        super(logger, obfuscatedSourceCode, ast, argv);
    }

    deobfuscate(){
        ;
    }
}


module.exports = {StageInitializing};
