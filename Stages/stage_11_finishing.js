"use strict";


const stageDeobfuscator = require('./stage_deobfuscator');
const stageConverting = require('./stage_05_converting');


class StageFinishing extends stageDeobfuscator.StageDeobfuscator{
    constructor(logger, obfuscatedSourceCode, ast, argv, stageName){
        super(logger, obfuscatedSourceCode, ast, argv, stageName);
    }

    _initiateTransformers(){
        this.transformers = {
            'FinishingConvertingNumberToNumericalExpressionTransformer': stageConverting.ConvertingNumberToNumericalExpressionTransformer,
        }
    }
}


module.exports = {StageFinishing};
