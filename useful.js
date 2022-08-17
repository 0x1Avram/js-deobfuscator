"use strict";


const fs = require('fs');


class StringOperations{
    static strContainsOnlyDoubleEscapedChars(strToCheck){
        if(strToCheck.match(/(?:\\x[0-9a-fA-F][0-9a-fA-F])+/)){
            const allEscapedCharMatches = [...strToCheck.matchAll(/\\x([0-9a-fA-F][0-9a-fA-F])/g)];
            allEscapedCharMatches.forEach((escapedCharMatchStr) => {
                const asciiCode = Number(`0x${escapedCharMatchStr}`);
                if(asciiCode > 0x7F){
                    return false;
                }
            });
            return true;
        }
        return false;
    }

    static unescapeStrWithDoubleEscapedChars(strToParse){
        return eval(`"${strToParse}"`);
    }

    static isValidIdentifierName(strToCheck){
        if(strToCheck.length == 0){
            return false;
        }

        const firstChar = strToCheck[0];
        if((firstChar.toLowerCase() == firstChar.toUpperCase()) && (firstChar != '$') && (firstChar != '_')){
            return false;
        }

        if(strToCheck.indexOf('-') != -1){
            return false;
        }

        return true;
    }
}


class NumberOperations{
    static numberIsFloat(nr){
        return nr.toString().indexOf('.') != -1;
    }
}

function writeTextFile(path, content){
    fs.writeFileSync(path, content, {flag: 'w'});
}



module.exports = {
    StringOperations,
    NumberOperations,
    writeTextFile
};
