"use strict";


const stageDeobfuscator = require('./stage_deobfuscator');


class StageFinalizing extends stageDeobfuscator.StageDeobfuscator{
    constructor(logger, obfuscatedSourceCode, ast, argv, stageName){
        super(logger, obfuscatedSourceCode, ast, argv, stageName);
    }

    _initiateTransformers(){
        this.transformers = {
            'FinalizingDirectivePlacementTransformer': FinalizingDirectivePlacementTransformer,
            'FinalizingCustomCodeHelpersTransformer': FinalizingCustomCodeHelpersTransformer,
            'FinalizingCommentsTransformer': FinalizingCommentsTransformer
        }
    }
}


class FinalizingDirectivePlacementTransformer extends stageDeobfuscator.TransformerDeobfuscator{
    constructor(logger, obfuscatedSourceCode, ast, argv){
        super(logger, obfuscatedSourceCode, ast, argv);
    }

    deobfuscate(){
        ;
    }
}


class FinalizingCustomCodeHelpersTransformer extends stageDeobfuscator.TransformerDeobfuscator{
    constructor(logger, obfuscatedSourceCode, ast, argv){
        super(logger, obfuscatedSourceCode, ast, argv);
    }

    deobfuscate(){
        ;
    }
}


class FinalizingCommentsTransformer extends stageDeobfuscator.TransformerDeobfuscator{
    constructor(logger, obfuscatedSourceCode, ast, argv){
        super(logger, obfuscatedSourceCode, ast, argv);
    }

    deobfuscate(){
        ;
    }
}


module.exports = {StageFinalizing};
