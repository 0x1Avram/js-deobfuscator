# JS-Deobfuscator
Deobfuscator for [Timofey Kachalov's](https://github.com/sanex3339) [javascript-obfuscator](https://github.com/javascript-obfuscator/javascript-obfuscator) - also available at [obfuscator.io](https://obfuscator.io/).

# :warning: !!! WARNING !!!
The code here is not secure. It uses 'eval' for convenience purposes and could easily be exploited by someone with malicious intent. That is why this should only be used in secure and isolated environments. Under no circumstances should anyone run this on a real environment - at least, use a virtual machine or something to protect your system !!!


## Setup
1) Clone this project:
```
git clone https://github.com/0x1Avram/js-deobfuscator.git
```
2) Install node.js (I used version 16.15)
3) Install dependencies by running this command in the folder root:
```
npm install
```
4) Enjoy



## Binaries
I included binaries built for Windows/Linux in the release section (for the windows one, you will need to add the proper '.exe' extension in order to use it). Those binaries where built using pkg and can be run on a system standalone, without the need to install node.js or any other dependencies.

Their respective SHA256 hashes are:
```
js-deobfuscator-linux - 50FDEAB594CD3DF6DB9DA62B6C893E49665438545D99F384802539C2BA0C89D3
js-deobfuscator-win -   4A4EDAF482D51DE74035BC1A9DF312E9D8023DBFB96909EE63C1EC1A0A43C596
```

For those wanting to build this into an executable themselves, install [pkg](https://www.npmjs.com/package/pkg) and then run this command in the folder root
```
pkg index.js
```


## Examples
To showcase the deobfuscator capabilities, I included some sets of original + obfuscated + deobfuscated samples in the 'Examples' folder. 
Some of those use examples from [javascript-obfuscator](https://github.com/javascript-obfuscator/javascript-obfuscator) or [javascript-algorithms](https://github.com/trekhleb/javascript-algorithms/).
Here are their respective copyright licenses:

[javascript-obfuscator](https://github.com/javascript-obfuscator/javascript-obfuscator)

```
Copyright (C) 2016-2022 Timofey Kachalov.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

[javascript-algorithms](https://github.com/trekhleb/javascript-algorithms/)

```
The MIT License (MIT)

Copyright (c) 2018 Oleksii Trekhleb

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Usage
The "main" script is index.js. Calling it with a '-h' argument should display the command line options.
The deobfuscator tries to automatically detect the stringarray related code. If it manages to do so correctly, it can be run by just specifying the input and output path.
```
node ./index.js -i obfuscated.txt -o deobfuscated.txt
```
Otherwise, the code for the stringarray needs to be placed in separate files and given as input. Example:
```
node ./index.js -s stringarray.txt -w stringarraywrappers.txt -n _0x471d,_0x9cad,_0x4cd9 
-r stringarrayrotate.txt -i obfuscated.txt -o output.txt
```
More examples regarding how the stringarray related code looks like along with command lines can be found in the 'Examples' folder.

Detailed information about the command line options:
```
node .\index.js -h
Usage: program [options]

Options:
      --version                  Show version number                   [boolean]
  -i, --inputPath                Path of input (obfuscated) file.
                                                 [string] [default: "input.txt"]
  -o, --outputPath               Path where the output (deobfuscated) file is
                                 stored.        [string] [default: "output.txt"]
  -d, --debug                    Display debug log messages (for large input
                                 files, debug log might be large).
                                                      [boolean] [default: false]
  -a, --debugall                 Display all AST operations for debugging. The
                                 'debug' option needs to be set for this to
                                 work.                [boolean] [default: false]
  -l, --separateloggers          Use a separate logger for each deobfuscation
                                 stage. This will lead to the creation of a
                                 debug log file for each deobfuscation stage (11
                                 stages). This is useful so that instead of a
                                 single huge debug log file, several smaller
                                 ones are created (one per each stage). The
                                 'debug' option needs to be set for this to
                                 work.                [boolean] [default: false]
  -f, --writedifffiles           Write before&after files for each
                                 transformation modifying the source code(used
                                 for debugging). The files are written in the
                                 working directory of the script.
                                                      [boolean] [default: false]
  -s, --stringarray              [StringArray] The path at which the code for
                                 the string array is found(can be just an array
                                 or a function containing the array).
                                                          [string] [default: ""]
  -w, --stringarraywrappers      [StringArray] The path at which the code for
                                 the string wrappers is found(there can be
                                 multiple wrappers depending on the
                                 'string-array-encoding' obfuscation option)
                                 (the wrappers can contain the self defending
                                 code).                   [string] [default: ""]
  -n, --stringarraywrappernames  [StringArray] The names of the string array
                                 wrapper functions in a comma separated string
                                 without spaces. (these are the functions from
                                 the code indicated by the 'stringarraywrappers'
                                 path).                   [string] [default: ""]
  -r, --stringarrayrotate                                 [string] [default: ""]
  -c, --cleanuplog                                    [boolean] [default: false]
  -h, --help                     Show help                             [boolean]

Examples:
  -s stringarray.txt -w stringarraywrappers.txt -n _0x471d,_0x9cad,_0x4cd9 -r
  stringarrayrotate.txt -i obfuscated.txt -o output.txt
  -i obfuscated.txt -o deobfuscated.txt
```

## Notes
From my testing, this seems to work fine with current versions of the obfuscator. 
However, older versions of the obfuscator may output a different AST and that
might complicate things. If you happen to stumble across an issue, open an issue
and I'll look into it.

## License

The MIT License (MIT)

Copyright (c) 2022 [0x1Avram](https://github.com/0x1Avram)

Permission is hereby granted, free of charge, to any person obtaining a copy of this 
software and associated documentation files (the "Software"), to deal in the Software 
without restriction, including without limitation the rights to use, copy, modify, 
merge, publish, distribute, sublicense, and/or sell copies of the Software, and to 
permit persons to whom the Software is furnished to do so, subject to the following 
conditions:

The above copyright notice and this permission notice shall be included in all copies 
or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, 
INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A 
PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT 
HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION 
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE 
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

