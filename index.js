"use strict";


const winston = require('winston');
const yargs = require('yargs');
const fs = require('fs');
const deobfuscatorModule = require('./deobfuscator');
const usefulModule = require('./useful');




Error.stackTraceLimit = Infinity;


function parseCommandLineArgs(){
    const argv = yargs
        .usage('Usage: program [options]')
        .example('-s stringarray.txt -w stringarraywrappers.txt -n _0x471d,_0x9cad,_0x4cd9 '
        + '-r stringarrayrotate.txt -i obfuscated.txt -o output.txt')
        .example('-i obfuscated.txt -o deobfuscated.txt')
        .option('inputPath', {
            alias: 'i',
            description: 'Path of input (obfuscated) file.',
            type: 'string',
            default: 'input.txt'
        })
        .option('outputPath', {
            alias: 'o',
            description: 'Path where the output (deobfuscated) file is stored.',
            type: 'string',
            default: 'output.txt'
        })
        .option('debug', {
            alias: 'd',
            description: 'Display debug log messages (for large input files, debug log might be large).',
            type: 'boolean',
            default: false 
        })
        .option('debugall', {
            alias: 'a',
            description: 'Display all AST operations for debugging. The \'debug\' option needs to be set '
            + 'for this to work.',
            type: 'boolean',
            default: false 
        })
        .option('separateloggers', {
            alias: 'l',
            description: 'Use a separate logger for each deobfuscation stage. This will lead to the creation of a '
            + 'debug log file for each deobfuscation stage (11 stages). This is useful so that instead of a single '
            + 'huge debug log file, several smaller ones are created (one per each stage). The \'debug\' option '
            + 'needs to be set for this to work.',
            type: 'boolean',
            default: false 
        })
        .option('writedifffiles', {
            alias: 'f',
            description: 'Write before&after files for each transformation modifying the source code'
            + '(used for debugging). The files are written in the working directory of the script.',
            type: 'boolean',
            default: false 
        })
        .option('stringarray', {
            alias: 's',
            description: '[StringArray] The path at which the code for the string array is found' 
            + '(can be just an array or a function containing the array).',
            type: 'string',
            default: '' 
        })
        .option('stringarraywrappers', {
            alias: 'w',
            description: '[StringArray] The path at which the code for the string wrappers is found' 
            + '(there can be multiple wrappers depending on the \'string-array-encoding\' obfuscation option) '
            + '(the wrappers can contain the self defending code).',
            type: 'string',
            default: '' 
        })
        .option('stringarraywrappernames', {
            alias: 'n',
            description: '[StringArray] The names of the string array wrapper functions in a comma separated string '
            + 'without spaces. (these are the functions from the code indicated by the \'stringarraywrappers\' path).',
            type: 'string',
            default: '' 
        })
        .option('stringarrayrotate', {
            alias: 'r',
            desscription: '[StringArray] The path at which the code for the string array rotate function '
            + 'is found. (This is optional as it is not mandatory for the stringarray rotate option to be used '
            + 'when obfuscating.)',
            type: 'string',
            default: '' 
        })
        .option('cleanuplog', {
            alias: 'c',
            desscription: 'The log files are created by appending to existing ones. This option deletes the existing '
            + 'log files before deobfuscation so that \'fresh\' logs without information from other deobfuscation '
            + 'runs are created.',
            type: 'boolean',
            default: false
        })
        .help()
        .alias('help', 'h').argv;
    
    if(argv.writedifffiles){
        argv.transformNumber = 1;
        argv.replacerNumber = 1;
    }

    _validateCommandLineArgs(argv);
    _extractStringArraySpecificCmdLineNodesInfo(argv);
    _setGlobalVariablesRelatedToCmdLine(argv);

    return argv;
}

function _validateCommandLineArgs(argv){
    _validateStringArrayCommandLineArgs(argv);
    _validateDebugCommandLineArgs(argv);
}

function _validateStringArrayCommandLineArgs(argv){
    if((argv.stringarray != '') || (argv.stringarraywrappers != '')
    || (argv.stringarraywrappernames != '') || (argv.stringarrayrotate != '')){
        if((argv.stringarray == '') || (argv.stringarraywrappers == '') || (argv.stringarraywrappernames == '')){
            console.log('Invalid command line usage. If any of the \'[StringArray]\' non-optional command line '
            + 'arguments is useed, the rest of the non-optional \'[StringArray]\' arguments need to be used'
            + 'as well.');
            process.exit(1);
        }
    }
}

function _validateDebugCommandLineArgs(argv){
    if(!argv.debug){
        argv.debugall = false;
        argv.separateloggers = false;
    }
}

function _extractStringArraySpecificCmdLineNodesInfo(argv){
    argv.stringArrayCmdLineSpecificNodesInfo = null;
    
    if(argv.stringarray == ''){
        return;
    }

    argv.stringArrayCmdLineSpecificNodesInfo = {
        stringArrayTemplateCode: _readCodeForStringArrayCmdLineSpecificInfo(argv.stringarray),
        stringArrayWrapperTemplates: _readCodeForStringArrayCmdLineSpecificInfo(argv.stringarraywrappers),
        stringArrayWrapperNames: argv.stringarraywrappernames.split(','),
        stringArrayRotate: ((argv.stringarrayrotate != '') ? readTextFile(argv.stringarrayrotate) : null)
    };

}

function _readCodeForStringArrayCmdLineSpecificInfo(path){
    let code = readTextFile(path);
    if(code.startsWith('const')){
        code = `var ${code.substring(6)}`;
    }
    return code;
}

function _setGlobalVariablesRelatedToCmdLine(argv){
    global.global_createDebugLogEachOperation = false;
    if(argv.debugall){
        global.global_createDebugLogEachOperation = true;
    }
}


function createLogger(createDebugLog){
    const logger = winston.createLogger({
        level: 'info',
        format: winston.format.combine(
            winston.format.timestamp({format: 'HH:mm:ss'}),
            winston.format.simple()
        ),
        transports: [
            new winston.transports.File({ filename: 'warn.log', level: 'warn', options: {flags: 'a'}}),
            new winston.transports.File({ filename: 'info.log', level: 'info', options: {flags: 'a'}}),
            new winston.transports.Console({
                level: 'info',
                format: winston.format.combine(
                    winston.format.colorize(),
                    winston.format.simple()
                )
            })
        ]
    });
    
    if(createDebugLog){
        logger.add(new winston.transports.File({ filename: 'debug.log', level: 'debug', options: {flags: 'w'}}));
    }

    return logger;
}


function cleanupLogFiles(logger){
    const logFileNames = ['debug.log', 'debug_ControlFlowFlattening.log', 'debug_Converting.log', 
    'debug_DeadCodeInjection.log', 'debug_EmbeddedEval.log', 'debug_Finalizing.log', 
    'debug_Finishing.log', 'debug_Initializing.log', 'debug_Preparing.log', 
    'debug_RenameIdentifiers.log', 'debug_RenameProperties.log', 'debug_Simplifying.log', 
    'debug_StringArray.log', 'info.log', 'warn.log'];
    for(let i = 0; i < logFileNames.length; i++){
        const fileName = logFileNames[i];
        try{
            fs.unlinkSync(fileName);
        }
        catch(e){
            if(e.toString().includes('no such file or directory')){
                logger.warn(`[index.js] Could not delete log file with name = '${fileName}' as it does not exist.`);
            }
            else{
                logger.warn(`[index.js] Could not delete log file with name = '${fileName}'. error = ${e}. `
                + `Stack = \n${e.stack}`);
            }
        }
    }
}


function readTextFile(path){
    return fs.readFileSync(path).toString();
}


function main(){
    const argv = parseCommandLineArgs();
    const logger = createLogger(argv.debug);
    if(argv.cleanuplog){
        cleanupLogFiles(logger);
    }

    logger.info(`[index.js] Starting deobfuscation process for file ${argv.inputPath}.`);

    const obfuscatedSourceCode = readTextFile(argv.inputPath);
    logger.debug(`[index.js] Obfuscated source code: \n${obfuscatedSourceCode}`);

    let deobfuscatedSourceCode = null;
    const myDeobfuscator = new deobfuscatorModule.SourceCodeDeobfuscator(logger, obfuscatedSourceCode, argv);
    try{
        deobfuscatedSourceCode = myDeobfuscator.deobfuscate();
    }
    catch(e){
        logger.error(`[index.js] Deobfuscation error in main function. error = ${e}. Stack = \n${e.stack}`);
    }

    usefulModule.writeTextFile(argv.outputPath, deobfuscatedSourceCode);
    logger.debug(`[index.js] Deobfuscated source code: \n${deobfuscatedSourceCode}`);

    logger.info('[index.js] Finished deobfuscation process.');
}

main();
