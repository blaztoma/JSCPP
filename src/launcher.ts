// logger = require("tracer").colorConsole();
import { CRuntime, IncludeModule, JSCPPConfig, mergeConfig } from "./rt";

import { Interpreter } from "./interpreter";
const ast = require("./ast");
const preprocessor = require("./preprocessor");
import Debugger from "./debugger"
// @ts-ignore;
import * as PEGUtil from "pegjs-util";

const includes: { [fileName: string]: IncludeModule } = {
    ifstream: require("./includes/ifstream"),
    ofstream: require("./includes/ofstream"),
    fstream: require("./includes/fstream"),
    sstream: require("./includes/sstream"),
    string: require("./includes/string"),
    iostream: require("./includes/iostream"),
    cctype: require("./includes/cctype"),
    climits: require("./includes/climits"),
    cstring: require("./includes/cstring"),
    cmath: require("./includes/cmath"),
    cstdio: require("./includes/cstdio"),
    cstdlib: require("./includes/cstdlib"),
    ctime: require("./includes/ctime"),
    iomanip: require("./includes/iomanip"),
    vector: require("./includes/vector"),
    algorithm: require("./includes/algorithm"),
    functional: require("./includes/functional"),
    utility: require("./includes/utility"),
    _bits__stdcpp: require("./includes/bits/stdcpp"),
    foo: require("./includes/dummy_class_foo")
};

const headerAlias: { [filename: string]: string } = {
    "ctype.h": "cctype",
    "limits.h": "climits",
    "string.h": "cstring",
    "math.h": "cmath",
    "stdio.h": "cstdio",
    "stdlib.h": "cstdlib",
    "bits/stdc++.h": "_bits__stdcpp",
    "time.h": "ctime"
};

for (const alias of Object.keys(headerAlias)) {
    const realName = headerAlias[alias];
    includes[alias] = includes[realName];
}

export type InputFunction = () => Promise<string>;

function run(code: string, input: InputFunction, config: JSCPPConfig): Debugger | number {
    let step;
    let inputbuffer: string = null;
    let proceed = true;
    let startTime: number;
    let readResult = "";

    const fstream = (function() {
        const testFiles: any = {
            "TestInput.txt": { value: "4 2 2 147.00 80.15 1 2 163.00 95.50 2 1 147.00 80.15 1 1 163.00 95.50" },
            "TestOutput.txt": { value: "" }
        };

        const openFiles: any = {};

        return {
            open(context: object, fileName: string) {
                const openFileNode: any = testFiles[fileName] || ({ [fileName]: { value: "" } });
                openFiles[fileName] = {
                    name: fileName,
                    _open: openFileNode != null,
                    is_open() {
                        return this._open;
                    },
                    read() {
                        if (!this.is_open())
                            return;

                        return openFileNode.value;
                    },
                    clear() {
                        openFileNode.value = "";
                    },
                    write(data: string) {
                        if (!this.is_open())
                            return;

                        openFileNode.value += data;
                    },
                    close() {
                        this._open = false;
                    }
                };

                return openFiles[fileName];
            }
        };
    })();

    const _config: JSCPPConfig = {
        fstream,
        stdio: {
            promiseError(promise_error) {
                console.log(promise_error);
            },
            cinStop() {
                handleStop();
            },
            cinProceed() {
                handleProceed();
            },
            cinState() {
                return proceed;
            },
            setReadResult(_result: string) {
                readResult = _result;
            },
            getReadResult() {
                return readResult;
            },
            // Filled from the input function on first use rather than at
            // start-up: <cstdio> drains on load, and a program that reads with
            // cin would otherwise have its input taken by an include.
            drain() {
                if (inputbuffer === null) inputbuffer = (input?.() as any) ?? "";
                const x = inputbuffer;
                inputbuffer = "";
                return x;
            },
            getInput() {
                return Promise.resolve(input?.() ?? "'InputFunction' is missing.");
            },
            finishCallback(ExitCode: number) {

            },
            write(s) {
                process.stdout?.write(s); // write to node.js standard output
            }
        },
        includes: this.includes,
        unsigned_overflow: "error",
    };

    function handleStop() {
        proceed = false;
    }

    function handleProceed() {
        proceed = true;
        performStep();
    }

    let performedSteps = 0;
    async function performStep() {
        try {
            while (proceed) {
                if (_config.stopExecutionCheck?.())
                    throw new Error("Execution terminated.");

                step = mainGen.next();
                performedSteps++;

                if (step.done) {
                    const exitCode = step.value.v as number
                    _config.stdio.finishCallback(exitCode);
                    return exitCode;
                }

                if (performedSteps > _config.maxExecutionSteps)
                    throw new Error("The execution step limit has been reached.");
                else if (_config.maxTimeout && ((Date.now() - startTime) > _config.maxTimeout))
                    throw new Error("Time limit exceeded.");

                if ((performedSteps % _config.eventLoopSteps) === 0) {
                    await new Promise((resolve) => setImmediate(resolve));
                }
            }
        } catch (error) {
            _config.stdio.promiseError(error.message);
        }
    }

    mergeConfig(_config, config);
    const rt = new CRuntime(_config);
    code = code.toString();
    const oldCode = code;
    code = preprocessor.parse(rt, code);

    const mydebugger = new Debugger(code, oldCode);

    const result = PEGUtil.parse(ast, code);
    if (result.error != null) {
        throw new Error("ERROR: Parsing Failure:\n" + PEGUtil.errorMessage(result.error, true));
    }
    const interpreter = new Interpreter(rt);
    const defGen = interpreter.run(result.ast, code);
    while (true) {
        step = defGen.next();
        if (step.done) { break; }
    }
    const mainGen = rt.getFunc("global", "main", [])(rt, null);
    if (_config.debug) {
        mydebugger.start(rt, mainGen);
        return mydebugger;
    } else {
        startTime = Date.now();
        performStep();
        /*
        while (true) {
            step = mainGen.next();
            if (step.done) { break; }
            if (_config.maxTimeout && ((Date.now() - startTime) > _config.maxTimeout)) {
                throw new Error("Time limit exceeded.");
            }
        }
        */
        // return step.value.v as number;
    }
}

export default {
    includes,
    run,
};
