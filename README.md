# JSCPP

This is a simple C++ interpreter written in JavaScript. It originates from felixhao28 project: https://github.com/felixhao28/JSCPP. It is largely upgraded.

## Purpose of the project

As far as I know, every public online C++ excuting environment requires backend servers to compile and run the produced executable. A portable and lightweight interpreter that can be run in browsers can be a fine substitute for those who do not intend to pay for such services.

We are using this project to create learning courses for Moodle. Code examples run inside a browser. Also, we created tasks with tests to be run on client browser and the results to be reported to Moodle using SCORM standard.

## Prerequisites

* NodeJS version >= 0.11
* A modern browser

## Main API: `JSCPP.run(code, input, config)`:

- **code**: *string* The C++ source code to be interpreted.
- **input**: *string* The text to be sent into standard input (can be overriden with `config.stdio`).
- **config**: *&lt;optional&gt; JSCPPConfig* The configuration object. All configuration items have default value. So you only need to set the ones you want different from the defaults.
  + **specifiers**: *&lt;optional&gt; string[]*
    * Allowed specifiers. By default all specifiers are allowed.
    * Default: `["const", "inline", "_stdcall", "extern", "static", "auto", "register"]`
  + **charTypes**: *&lt;optional&gt; string[]*
    * Allowed char types. By default all char types are allowed.
    * Default: `["char", "signed char", "unsigned char", "wchar_t",
        "unsigned wchar_t", "char16_t", "unsigned char16_t",
        "char32_t", "unsigned char32_t"]`
  + **intTypes**: *&lt;optional&gt; string[]*
    * Allowed integer types. By default all integer types are allowed.
    * Default: `["short", "short int", "signed short", "signed short int",
        "unsigned short", "unsigned short int", "int", "signed int",
        "unsigned", "unsigned int", "long", "long int", "long int",
        "signed long", "signed long int", "unsigned long",
        "unsigned long int", "long long", "long long int",
        "long long int", "signed long long", "signed long long int",
        "unsigned long long", "unsigned long long int", "bool"]`
  + **limits**: *&lt;optional&gt; {[type: string]: { max: number, min: number, bytes: number}}*
    * The minimal and the maximum value on number types. You can just set a subset of all the types, and the unset types will use the default limits.
    * Default:
    ```js
    {
        "char": {
            max: 0x7f,
            min: 0x00,
            bytes: 1
        },
        "signed char": {
            max: 0x7f,
            min: -0x80,
            bytes: 1
        },
        "unsigned char": {
            max: 0xff,
            min: 0x00,
            bytes: 1
        },
        "wchar_t": {
            max: 0x7fffffff,
            min: -0x80000000,
            bytes: 4
        },
        "unsigned wchar_t": {
            max: 0xffffffff,
            min: 0x00000000,
            bytes: 4
        },
        "char16_t": {
            max: 0x7fff,
            min: -0x8000,
            bytes: 4
        },
        "unsigned char16_t": {
            max: 0xffff,
            min: 0x0000,
            bytes: 4
        },
        "char32_t": {
            max: 0x7fffffff,
            min: -0x80000000,
            bytes: 4
        },
        "unsigned char32_t": {
            max: 0xffffffff,
            min: 0x00000000,
            bytes: 4
        },
        "short": {
            max: 0x7fff,
            min: -0x8000,
            bytes: 2
        },
        "unsigned short": {
            max: 0xffff,
            min: 0x0000,
            bytes: 2
        },
        "int": {
            max: 0x7fffffff,
            min: -0x80000000,
            bytes: 4
        },
        "unsigned": {
            max: 0xffffffff,
            min: 0x00000000,
            bytes: 4
        },
        "long": {
            max: 0x7fffffff,
            min: -0x80000000,
            bytes: 4
        },
        "unsigned long": {
            max: 0xffffffff,
            min: 0x00000000,
            bytes: 4
        },
        "long long": {
            max: 0x7fffffffffffffff,
            min: -0x8000000000000000,
            bytes: 8
        },
        "unsigned long long": {
            max: 0xffffffffffffffff,
            min: 0x0000000000000000,
            bytes: 8
        },
        "float": {
            max: 3.40282346638529e+038,
            min: -3.40282346638529e+038,
            bytes: 4
        },
        "double": {
            max: 1.79769313486232e+308,
            min: -1.79769313486232e+308,
            bytes: 8
        },
        "pointer": {
            max: undefined,
            min: undefined,
            bytes: 4
        },
        "bool": {
            max: 1,
            min: 0,
            bytes: 1
        }
    }
    ```
  + **includes**: *&lt;optional&gt; { [fileName: string]: IncludeModule }*
    * Define additional include files. This is extremely useful if you are defining new types, variables or functions to be used in the C++ source code.
    * `IncludeModule` is an object that has a `load(rt: CRuntime): void` member function. For example,
      ```js
      {
        "myheader.h": {
          load: function(rt) {
            rt.regFunc(function(rt, _this, x, y) {
              var firstValue = x.v;
              var secondValue = y.v;
              var returnType = x.t;
              return rt.val(returnType, firstValue + secondValue);
            }, "global", "myfunction", [rt.intTypeLiteral, rt.intTypeLiteral], rt.intTypeLiteral);
          }
        }
      }
      ```
      will register a global function equivalent to the following, **before** interpreting the source code:
      ```c++
      // C++ code
      int myfunction(int x, int y) {
        return x + y;
      }
      ```
      so that user C++ code like this can be interpreted:
      ```c++
      // C++ code
      #include "myheader.h"
      int main() {
        return myfunction(1, 2); // will return 3
      }
      ```
      For more examples on writing a custom `IncludeModule`, including how to properly use types, values and variables, please take a look at the files inside [src/includes](src/includes). For custom classes (experimental), please take a look at [src/includes/dummy_class_foo.ts](src/includes/dummy_class_foo.ts) and [test/class_basics.cpp](test/class_basics.cpp).
  + **loadedLibraries**: *&lt;optional&gt; string[]*
    * **loadedLibraries** keeps track of loaded headers. It can also be used to skip loading certain headers if given initial value.
  + **stdio**: *&lt;optional if in NodeJS&gt; string[]* `{
       drain?: () => string;
       write: (s: string) => void;
    }`
    * This controls the behavior of standard input/output. This is **required** if you are running JSCPP on webpages, since the default behavior of writing to standard output stream is to print to the console, which is invisible to end users.
    * **drain**: *&lt;optional&gt; () => string*
      - Executed whenever the standard input buffer needs new content. The returned string will be concatenated to the existing buffer. If `drain` is set, `drain` will be favored over `input`. This is useful if the standard input is extremely large or is not immediately available at the start but only available later during the interpretation, for example, debugging. You don't normally need to set `drain`.
    * **write**: *(s: string) => void*
      - Write the string `s` to standard output stream. By default it is implemeted as `(s) => process.stdout.write(s);`. You need to override this if you want to capture the console output and do something with it.

  + **unsigned_overflow**: *&lt;optional&gt; "error" (default) | "warn" | "ignore"*
    * Overflowing an unsigned type is an undefined behavior. This configuration controls what to do if a such overflow happens.
      - "error": immediately throw an exception.
      - "warn": print a warning to standard error stream.
      - "ignore": ignore the overflow and carry on interpreting.
  + **maxTimeout**: *&lt;optional&gt; number*
    * If set, JSCPP will throw an exception if the milliseconds since the beginnig of execution exceeds `maxTimeout`. This is not used in debug mode.
  + **debug**: *&lt;optional&gt; boolean*
    * If `false` (default), JSCPP will run normally and the return value of `JSCPP.run` will be the exit code of the C++ program.
    * If `true`, JSCPP will enter debug mode, break on the first AST node and an debugger instance will be immediately returned instead. Please refer to the "Using __debugger__" part of this document for further details.

Using __debugger__

There is a simple but functional real debugger available.

A list of debugger API:

- methods
	+ debugger.next(): one step further
	+ debugger.continue(): continue until breakpoint
	+ debugger.nextNode(): the AST node to be executed
		* sLine
		* sColumn
		* sOffset
		* eLine
		* eColumn
		* eOffset
	+ debugger.nextLine()
	+ debugger.type(typeName)
	+ debugger.variable()
	+ debugger.variable(variableName)
- properties
	+ src: preprocessed source
	+ prevNode: previous AST node
	+ done
	+ conditions
	+ stopConditions
	+ rt: the internal runtime instance
	+ gen: the internal generator

```js
var JSCPP = require("JSCPP")
var mydebugger = JSCPP.run(code, input, { debug: true });
// continue to the next interpreting operation
var done = mydebugger.next();
// if you have an active breakpoint condition, you can just continue
var done = mydebugger.continue();
// by default, debugger pauses at every new line, but you can change it
mydebugger.setStopConditions({
    isStatement: true
    positionChanged: true
    lineChanged: false
});
// so that debugger only stops at a statement of a new position
// or you can add your own condition, i.e. stops at line 10
mydebugger.setCondition("line10", function (prevNode, nextNode) {
	if (nextNode.sLine === 10) {
		// disable itself so that it only triggers once on line 10
		mydebugger.disableCondition("line10");
		return true;
	} else {
		return false;
	}
});
// then enable it
mydebugger.enableCondition("line10");
// we need to explicitly use "false" because exit code can be 0
if (done !== false) {
	console.log("program exited with code " + done.v);
}
// the AST node to be executed next
var s = mydebugger.nextNode();
// sometimes a breakpoint can be set without a statement to be executed next,
// i.e. entering a function call.
while ((s = mydebugger.nextNode()) == null) {
	mydebugger.next();
}
// the content of the statement to be executed next
var nextLine = mydebugger.nextLine();
// it is essentially same as
nextLine = mydebugger.getSource().slice(s.sOffset, s.eOffset).trim()

console.log("from " + s.sLine + ":" + s.sColumn + "(" + s.sOffset + ")");
console.log("to " + s.eLine + ":" + s.eColumn + "(" + s.eOffset + ")");
console.log("==> " + nextLine);
// examine the internal registry for a type
mydebugger.type("int");
// examine the value of variable "a"
mydebugger.variable("a");
// or list all local variables
mydebugger.variable();
```

### With a browser

There should be a newest version of _JSCPP.js_ or _JSCPP.es5.js_ in _dist_ ready for you. If not, use `npm run build` to generate one.

Then you can add it to your html. The exported global name for this package is "JSCPP".

```html
<script src="JSCPP.es5.min.js"></script>
<script type="text/javascript">
	var code = 	"#include <iostream>"+
				"using namespace std;"+
				"int main() {"+
				"    int a;"+
				"    cin >> a;"+
				"    cout << a << endl;"+
				"    return 0;"+
				"}"
	;
	var input = "4321";
	var output = "";
	var config = {
		stdio: {
			write: function(s) {
				output += s;
			}
		},
		unsigned_overflow: "error" // can be "error"(default), "warn" or "ignore"
	};
	var exitCode = JSCPP.run(code, input, config);
	alert(output + "\nprogram exited with code " + exitCode);
</script>
```

If you do not provide a customized `write` method for `stdio` configuration, console output will not be correctly shown. See _demo/demo.html_ for example.

### Running in WebWorker

There are two Helper classes to make JSCPP easier to run in WebWorkers. One is `JSCPP.WebWorkerHelper` in an old callback style and `JSCPP.AsyncWebWorkerHelper` in a modern Promise/async-await style.

```html
<script src="JSCPP.es5.min.js"></script>
<script type="text/javascript">
	var helper = new JSCPP.WebWorkerHelper("./JSCPP.es5.min.js"); // it is a class
	var output = "";
	helper.run(`#include <iostream>
		using namespace std;
		int main() {
		int a;
		cin >> a;
		a += 7;
		cout << a*10 << endl;
		return 0;
	}`, "5", {
		stdio: {
			write: function(s) {
				output += s;
			}
		}
	}, function (err, returnCode) {
		if (err) {
			alert("An error occurred: " + (err.message || err));
		} else {
			alert("Program exited with code " + returnCode);
		}
	});

	helper.worker.terminate(); // directly control the Worker instance
</script>
```


```html
<script src="JSCPP.es5.min.js"></script>
<script type="text/javascript">
	async function asyncWrapper() {
		var helper = new JSCPP.AsyncWebWorkerHelper("./JSCPP.es5.min.js"); // it is a class
		var output = "";
		try {
			var returnCode = await helper.run(`#include <iostream>
				using namespace std;
				int main() {
				int a;
				cin >> a;
				a += 7;
				cout << a*10 << endl;
				return 0;
			}`, "5", {
				stdio: {
					write: function(s) {
						output += s;
					}
				}
			});
			alert("Program exited with code " + returnCode);
		} catch (err) {
			alert("An error occurred: " + (err.message || err));
		}
		helper.worker.terminate(); // directly control the Worker instance
	}
	asyncWrapper();
</script>
```

The helper classes are implemented in `src/index.js`, and a test page is available in `dist/index.html`.

### Run tests

```
npm run test
```

## Implemented features

* (Most) operators
* Primitive types
* Variables
* Structs
* Arrays
    - ~~Multidimensional array with initializers.~~
* Pointers
* If...else control flow
* Switch...case control flow
    - ~~Declarations inside switch block.~~
* For loop
* While loop
* Do...while loop
* Functions
* Variable scopes
* Preprocessor directives
	- Macro
	- Include

### Not implemented yet

* Goto statements
* Object-oriented features

### Performance

If you want to run C++ programs effciently, compile your C++ code to [LLVM-bitcode](https://en.wikipedia.org/wiki/LLVM) and then use [Emscripten](https://github.com/kripken/emscripten).

## Supported libraries

See current progress in [_includes_](src/includes) folder.

* algorithm 
  * sort
  * find
  * reverse
  * swap
* cctype
* cmath
* cstdio
* cstdlib
* cstring
* ctime
* fstream
* ifstream
* iostream
* ofstream
* sstream
* string
* vector

## Bug report? Feedback?

Post it on Issues.

## Acknowledgments

<table cellspacing="0" cellpadding="0" border=0>
<tr border=0>
<td border=0>
This software has been developed as a part of the FGPE++ Gamified Programming Learning at Scale (https://fgpeplus2.usz.edu.pl/) project, which was co-funded by the European Union.
</td>
<td border=0>
![Framework for Gamified Programming Education project](logo_FGPE.jpg) ![Erasmus+](logo_erasmus.jpg)
</td>
</tr>
</table>
