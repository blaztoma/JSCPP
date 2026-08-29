import * as defaults from "./defaults";
import * as Flatted from 'flatted';
import { BaseInterpreter, Interpreter } from "./interpreter";
import { resolveIdentifier } from "./includes/shared/string_utils";
export type Specifier = "const" | "inline" | "_stdcall" | "extern" | "static" | "auto" | "register";
export type CCharType = "char" | "signed char" | "unsigned char" | "wchar_t" | "unsigned wchar_t" | "char16_t" | "unsigned char16_t" | "char32_t" | "unsigned char32_t";
export type CIntType = "short" | "short int" | "signed short" | "signed short int" | "unsigned short" | "unsigned short int" | "int" | "signed int" | "unsigned" | "unsigned int" | "long" | "long int" | "long int" | "signed long" | "signed long int" | "unsigned long" | "unsigned long int" | "long long" | "long long int" | "long long int" | "signed long long" | "signed long long int" | "unsigned long long" | "unsigned long long int" | "bool";
export type CFloatType = "float" | "double";
export type CBasicType = CCharType | CIntType | CFloatType | "void";
export type TypeSignature = "global" | "(char)" | "(signed char)" | "(unsigned char)" | "(short)" | "(short int)" | "(signed short)" | "(signed short int)" | "(unsigned short)" | "(unsigned short int)" | "(int)" | "(signed int)" | "(unsigned)" | "(unsigned int)" | "(long)" | "(long int)" | "(long int)" | "(signed long)" | "(signed long int)" | "(unsigned long)" | "(unsigned long int)" | "(long long)" | "(long long int)" | "(long long int)" | "(signed long long)" | "(signed long long int)" | "(unsigned long long)" | "(unsigned long long int)" | "(float)" | "(double)" | "(bool)";

export interface IncludeModule {
    load(rt: CRuntime): void;
}

export interface JSCPPConfig {
    specifiers?: Specifier[];
    charTypes?: CCharType[];
    intTypes?: CIntType[];
    limits?: {
        [typeName in CBasicType | "pointer"]?: {
            max: number;
            min: number;
            bytes: number;
        }
    };
    includes?: { [fileName: string]: IncludeModule };
    loadedLibraries?: string[];
    fstream?: {
        open: (context: object, fileName: string) => object
    };
    stdio?: {
        isMochaTest?: boolean;
        promiseError: (promise_error: string) => void;
        drain?: () => string;
        cinStop: () => void;
        cinProceed: () => void;
        cinState: () => boolean;
        setReadResult: (result: string) => void;
        getReadResult: () => string;
        getInput: () => Promise<string>;
        finishCallback: (ExitCode: number) => void;
        write: (s: string) => void;
    };
    unsigned_overflow?: "error" | "warn" | "ignore";

    debug?: boolean;
    maxExecutionSteps?: number;
    maxTimeout?: number;
    eventLoopSteps?: number;
    stopExecutionCheck?: () => boolean;
}

export type OpHandler = {
    functions?: { [paramSignature: string]: CFunction };
    reg?: FunctionRegistry;
    default?: CFunction;
};
export type OpSignature = "o(--)" | "o(-)" | "o(-=)" | "o(->)" | "o(,)" | "o(!)" | "o(!=)" | "o(())" | "o([])" | "o(*)" | "o(*=)" | "o(/)" | "o(/=)" | "o(&)" | "o(&=)" | "o(%)" | "o(%=)" | "o(^)" | "o(^=)" | "o(+)" | "o(++)" | "o(+=)" | "o(<)" | "o(<<)" | "o(<<=)" | "o(<=)" | "o(=)" | "o(==)" | "o(>)" | "o(>=)" | "o(>>)" | "o(>>=)" | "o(|)" | "o(|=)" | "o(~)";

export interface FunctionRegistry {
    [signature: string]: {
        args: (VariableType | "?")[];  // question mark ignores further parameter type compatibility check, useful for functions like "printf" and "scanf"
        optionalArgs: OptionalArg[];
    }
}

export interface Member {
    type: VariableType;
    name: string;
    initialize?: (rt: CRuntime, _this: Variable) => Variable;
}

export interface OpHandlerMap {
    handlers: { [opSignature: string]: OpHandler; };
    cConstructor?: (rt: CRuntime, _this: Variable, args?: Variable[]) => void;
    members?: Member[];
    father?: string;
};

export interface BoolType {
    type: "primitive";
    name: "bool";
}

export interface IntType {
    type: "primitive";
    name: CCharType | CIntType;
}

export interface FloatType {
    type: "primitive";
    name: CFloatType;
}

export interface VoidType {
    type: "primitive";
    name: "void";
}

type PrimitiveType = BoolType | IntType | FloatType | VoidType;

export interface NormalPointerType {
    type: "pointer";
    ptrType: "normal";
    targetType: VariableType;
}

export interface ArrayType {
    type: "pointer";
    ptrType: "array";
    size: number;
    eleType: VariableType;
}

export interface FunctionPointerType {
    type: "pointer";
    ptrType: "function";
    targetType: FunctionType;
}

export type PointerType = NormalPointerType | ArrayType | FunctionPointerType;

export interface ReferenceType {
    type: "reference";
    targetType: VariableType;
}

export interface StructType {
    type: "struct";
    name: string;
}

export interface OperatorFunctionType {
    type: "function";
}

export interface FunctionType {
    type: "function";
    retType?: VariableType;
    signature?: (VariableType | "?")[];
}

export interface ClassType {
    type: "class";
    name: string;
}

export type VariableType = PrimitiveType | ReferenceType | StructType | PointerType | FunctionType | ClassType;

export type BasicValue = number | boolean;

export interface NormalPointerValue {
    target: Variable | null;
}

export interface ArrayValue {
    position: number;
    target: Variable[];
}

export type PointerValue = NormalPointerValue | ArrayValue | FunctionPointerValue;

export interface ObjectValue {
    members?: { [name: string]: Variable };
}

export type VariableValue = PointerValue | ObjectValue | BasicValue | FunctionValue;

export interface BoolVariable {
    t: PrimitiveType;
    v: boolean;
}

export interface IntVariable {
    t: PrimitiveType;
    v: number;
}

export interface FloatVariable {
    t: FloatType;
    v: number;
}

type PrimitiveVariable = BoolVariable | IntVariable | FloatVariable;

export interface NormalPointerVariable {
    t: NormalPointerType;
    v: NormalPointerValue;
}

export interface ArrayVariable {
    t: ArrayType;
    v: ArrayValue;
}

export interface FunctionPointerValue {
    target: FunctionVariable,
    name: string,
    defineType: VariableType | "global",
    args: (VariableType | "?")[],
    retType: VariableType,
};

export interface FunctionPointerVariable {
    t: FunctionPointerType;
    v: FunctionPointerValue;
}

// Dummy is used to differentiate "pre-" or "post-" ++/-- operator
export interface DummyVariable {
    t: "dummy";
    v: null;
}

type PointerVariable = NormalPointerVariable | ArrayVariable | FunctionPointerVariable;

export interface ObjectVariable {
    t: ClassType;
    v: ObjectValue;
    left?: boolean;
}

export interface FunctionValue {
    target?: CFunction;
    defineType: VariableType | "global";
    name: string;
    bindThis: Variable;
}

export interface FunctionVariable {
    t: FunctionType | OperatorFunctionType;
    v: FunctionValue;
}

export interface ArrayElementVariable {
    t: VariableType;
    v: VariableValue;
    array: Variable[];
    arrayIndex: number;
}

export type Variable = {
    left?: boolean;
    readonly?: boolean;
    dataType?: PrimitiveType;
} & (PrimitiveVariable | PointerVariable | ObjectVariable | FunctionVariable | ArrayElementVariable);

export interface RuntimeScope {
    "$name": string;
    variables: {
        [name: string]: Variable;
    };
}

export interface NamespaceScope {
    [namespace: string]: {
        [objectName: string]: Variable;
    };
}

export interface OptionalArg { name: string, type: VariableType, expression: any }

type CFunction = (rt: CRuntime, _this: Variable, ...args: (Variable | DummyVariable)[]) => any;

export interface MakeValueStringOptions {
    noArray?: boolean;
    noPointer?: boolean;
}

export function mergeConfig(a: any, b: any) {
    for (const o in b) {
        if (b.hasOwnProperty(o)) {
            if (o in a && (typeof b[o] === "object")) {
                mergeConfig(a[o], b[o]);
            } else {
                a[o] = b[o];
            }
        }
    }
};

export class CRuntime {
    config: JSCPPConfig;
    numericTypeOrder: string[];
    types: { [typeSignature: string]: OpHandlerMap }
    intTypeLiteral: IntType;
    unsignedintTypeLiteral: IntType;
    longTypeLiteral: IntType;
    floatTypeLiteral: FloatType;
    doubleTypeLiteral: FloatType;
    charTypeLiteral: IntType;
    wcharTypeLiteral: IntType;
    unsignedcharTypeLiteral: IntType;
    boolTypeLiteral: IntType;
    voidTypeLiteral: VoidType;
    nullPointerValue: PointerValue;
    voidPointerType: PointerType;
    nullPointer: PointerVariable;
    scope: RuntimeScope[];
    namespace: NamespaceScope;
    typedefs: { [name: string]: VariableType };
    interp: BaseInterpreter;

    constructor(config: JSCPPConfig) {
        this.config = defaults.getDefaultConfig();
        mergeConfig(this.config, config);
        this.numericTypeOrder = defaults.numericTypeOrder;
        this.types = defaults.getDefaultTypes();

        this.intTypeLiteral = this.primitiveType("int") as IntType;
        this.unsignedintTypeLiteral = this.primitiveType("unsigned int") as IntType;
        this.longTypeLiteral = this.primitiveType("long") as IntType;
        this.floatTypeLiteral = this.primitiveType("float") as FloatType;
        this.doubleTypeLiteral = this.primitiveType("double") as FloatType;
        this.charTypeLiteral = this.primitiveType("char") as IntType;
        this.wcharTypeLiteral = this.primitiveType("wchar_t") as IntType;
        this.unsignedcharTypeLiteral = this.primitiveType("unsigned char") as IntType;
        this.boolTypeLiteral = this.primitiveType("bool") as IntType;
        this.voidTypeLiteral = this.primitiveType("void") as VoidType;
        this.nullPointerValue = this.makeNormalPointerValue(null);
        this.voidPointerType = this.normalPointerType(this.voidTypeLiteral);
        this.nullPointer = this.val(this.voidPointerType, this.nullPointerValue) as PointerVariable;
        this.scope = [{ "$name": "global", variables: {} }];

        // NULL and nullptr are seeded as globals rather than left to the
        // preprocessor, so that <cstddef> need not be included for the spelling
        // most coursework uses. Both name the same void null pointer the runtime
        // already carried; castable() below lets it convert to any pointer type,
        // which is what makes `node->next = NULL` and `while (p != NULL)` work.
        this.scope[0].variables["NULL"] = this.nullPointer;
        this.scope[0].variables["nullptr"] = this.nullPointer;
        this.namespace = {};
        this.typedefs = {};
    }

    include(name: string) {
        const {
            includes
        } = this.config;
        if (name in includes) {
            const lib = includes[name];
            if (this.config.loadedLibraries.includes(name))
                return;
            this.config.loadedLibraries.push(name);
            // lib.load(this);
        } else {
            this.raiseException("cannot find library: " + name);
        }
    };

    getSize(element: Variable) {
        let ret = 0;
        if (this.isArrayType(element) && (element.v.position === 0)) {
            let i = 0;
            while (i < element.v.target.length) {
                ret += this.getSize(element.v.target[i]);
                i++;
            }
        } else {
            ret += this.getSizeByType(element.t);
        }
        return ret;
    };

    getSizeByType(t: VariableType) {
        if (this.isPointerType(t)) {
            return this.config.limits["pointer"].bytes;
        } else if (this.isPrimitiveType(t)) {
            return this.config.limits[t.name].bytes;
        } else {
            this.raiseException("not implemented");
        }
    };

    captureValue(t: any): any {
        if (t.v !== undefined) {
            return t;
        }
        if (t.type === "pointer" && t.array !== undefined && t.arrayIndex !== undefined/* && this.isArrayType(t) */) {
            if (t.arrayIndex >= t.array.length) {
                this.raiseException("index out of bound " + t.arrayIndex + " >= " + t.array.length);
            } else if (t.arrayIndex < 0) {
                this.raiseException("negative index " + t.arrayIndex);
            }
            // debugger;
            const u = t.array[t.arrayIndex];
            u.array = t.array;
            u.arrayIndex = t.arrayIndex;
            return u;
        } else {
            this.raiseException("internal error: attempt to capture an undefined lvalue type other than pointer");
        }
    }

    getMember(l: Variable, r: string): Variable {
        l = this.captureValue(l);
        const lt = l.t;
        if (this.isClassType(l) || this.isStructType(l)) {
            const ltsig = this.getTypeSignature(lt);
            if (this.types.hasOwnProperty(ltsig)) {
                const t = this.types[ltsig].handlers;
                if (t.hasOwnProperty(r)) {
                    return {
                        t: {
                            type: "function",
                        },
                        v: {
                            defineType: lt,
                            name: r,
                            bindThis: l
                        }
                    };
                } else {
                    if (l.v.members.hasOwnProperty(r)) {
                        return l.v.members[r];
                    } else {
                        this.raiseException("type '" + this.makeTypeString(lt) + "' does not have a member named '" + r + "'")
                    }

                }
            } else {
                this.raiseException("type '" + this.makeTypeString(lt) + "' is unknown");
            }
        } else {
            this.raiseException("only a class can have members");
        }
    };

    defFunc(lt: VariableType, name: string, retType: VariableType, argTypes: VariableType[], argNames: string[], stmts: any, interp: Interpreter, optionalArgs: OptionalArg[], readonlyArgs: boolean[]) {
        if (stmts != null) {
            const f = function* (rt: CRuntime, _this: Variable, ...args: Variable[]) {
                // logger.warn("calling function: %j", name);
                rt.enterScope("function " + name);
                argNames.forEach(function(argName, i) {
                    args[i].readonly = readonlyArgs[i];
                    rt.defVar(argName, argTypes[i], args[i]);
                });
                for (let i = 0, end = optionalArgs.length; i < end; i++) {
                    const optionalArg = optionalArgs[i];
                    if (args[argNames.length + i] != null) {
                        rt.defVar(optionalArg.name, optionalArg.type, args[argNames.length + i]);
                    } else {
                        const argValue = yield* interp.visit(interp, optionalArg.expression);
                        rt.defVar(optionalArg.name, optionalArg.type, rt.cast(optionalArg.type, argValue));
                    }
                }
                let ret = yield* interp.run(stmts, interp.source, { scope: "function" });
                if (!rt.isTypeEqualTo(retType, rt.voidTypeLiteral)) {
                    if (ret instanceof Array && (ret[0] === "return")) {
                        ret = rt.cast(retType, ret[1]);
                    } else {
                        rt.raiseException("you must return a value");
                    }
                } else {
                    if (Array.isArray(ret)) {
                        if ((ret[0] === "return") && ret[1]) {
                            rt.raiseException("you cannot return a value from a void function");
                        }
                    }
                    ret = undefined;
                }
                rt.exitScope("function " + name);
                // logger.warn("function: returing %j", ret);
                return ret;
            };

            this.regFunc(f, lt, name, argTypes, retType, optionalArgs);
        } else {
            this.regFuncPrototype(lt, name, argTypes, retType, optionalArgs);
        }
    };

    makeParametersSignature(args: (VariableType | "?" | "dummy")[]) {
        const ret = new Array(args.length);
        let i = 0;
        while (i < args.length) {
            const arg = args[i];
            ret[i] = this.getTypeSignature(arg);
            i++;
        }
        return ret.join(",");
    };

    /**
     * How far an argument type is from a parameter type, as a cost.
     *
     * C++ ORDERS the viable candidates for a call rather than treating every
     * convertible one as equally good: an exact match outranks a promotion,
     * which outranks a wider conversion. This is that ordering in miniature,
     * and it is what lets `add(int, int)` sit beside `add(double, double)`.
     * Ranking flatly by "is it castable" reports `add(2, 3)` as ambiguous,
     * because an integer literal types as unsigned int here and so neither
     * candidate is an identity match.
     *
     * Lower is better. Both overload resolution and constructor selection score
     * candidates with this, so the two cannot disagree about which call wins.
     */
    rankConversion(argumentType: any, parameterType: any): number {
        const IDENTITY = 0;
        const WITHIN_INTEGER_FAMILY = 1;
        const ACROSS_NUMERIC_FAMILIES = 2;
        const OTHER_CONVERSION = 3;

        if ((argumentType === "dummy") || (parameterType === "dummy")) { return OTHER_CONVERSION; }
        if (this.isTypeEqualTo(argumentType, parameterType)) { return IDENTITY; }

        if (this.isNumericType(argumentType) && this.isNumericType(parameterType)) {
            return (this.isIntegerType(argumentType) === this.isIntegerType(parameterType))
                ? WITHIN_INTEGER_FAMILY
                : ACROSS_NUMERIC_FAMILIES;
        }
        return OTHER_CONVERSION;
    };

    getCompatibleFunc(lt: VariableType | "global", name: string, args: (Variable | DummyVariable)[]) {
        let ret;
        const ltsig = this.getTypeSignature(lt);
        if (ltsig in this.types) {
            const t = this.types[ltsig].handlers;
            if (name in t) {
                // logger.info("method found");
                const ts = args.map(v => v.t);
                const sig = this.makeParametersSignature(ts);
                if (sig in t[name].functions) {
                    ret = t[name].functions[sig];
                } else {
                    const compatibles: CFunction[] = [];
                    // Ranked against the arguments, so that the best candidate
                    // wins instead of every viable one tying. See rankConversion.
                    const costs: number[] = [];
                    const reg = t[name].reg;
                    Object.keys(reg).forEach(signature => {
                        let newTs: (VariableType | "dummy")[];
                        const regArgInfo = reg[signature];
                        const dts = regArgInfo.args;
                        let newDts: (VariableType | "dummy")[];
                        const {
                            optionalArgs
                        } = regArgInfo;
                        if ((dts[dts.length - 1] === "?") && ((dts.length - 1) <= ts.length)) {
                            newTs = ts.slice(0, dts.length - 1);
                            newDts = dts.slice(0, -1) as VariableType[];
                        } else {
                            newTs = ts;
                            newDts = dts as VariableType[];
                        }
                        if (newDts.length <= newTs.length) {
                            let ok = true;
                            let i = 0;
                            while (ok && (i < newDts.length)) {
                                ok = this.castable(newTs[i], newDts[i]);
                                i++;
                            }
                            while (ok && (i < newTs.length)) {
                                ok = this.castable(newTs[i], optionalArgs[i - newDts.length].type);
                                i++;
                            }
                            if (ok) {
                                const fn = t[name].functions[this.makeParametersSignature(regArgInfo.args)];
                                compatibles.push(fn);
                                let cost = 0;
                                for (let j = 0; j < newDts.length; j++) {
                                    cost += this.rankConversion(newTs[j], newDts[j]);
                                }
                                costs.push(cost);
                            }
                        }
                    });
                    if (compatibles.length === 0) {
                        if ("#default" in t[name]) {
                            ret = t[name].functions["#default"];
                        } else {
                            const argsStr = ts.map(v => {
                                return this.makeTypeString(v);
                            }).join(", ");
                            this.raiseException("no method " + name + " in " + this.makeTypeString(lt) + " accepts " + argsStr);
                        }
                    } else if (compatibles.length > 1) {
                        const best = Math.min(...costs);
                        const winners = compatibles.filter((_, idx) => costs[idx] === best);
                        if (winners.length === 1) {
                            ret = winners[0];
                        } else {
                            this.raiseException("ambiguous method invoking, " + compatibles.length + " compatible methods");
                        }
                    } else {
                        ret = compatibles[0];
                    }
                }
            } else {
                this.raiseException("method " + name + " is not defined in " + this.makeTypeString(lt));
            }
        } else {
            this.raiseException("type " + this.makeTypeString(lt) + " is unknown");
        }
        if ((ret == null)) {
            this.raiseException("method " + name + " does not seem to be implemented");
        }
        return ret;
    };

    matchVarArg(methods: OpHandler, sig: string) {
        for (let _sig in methods) {
            if (_sig[_sig.length - 1] === "?") {
                _sig = _sig.slice(0, -1);
                if (sig.startsWith(_sig)) {
                    return methods.functions[_sig];
                }
            }
        }
        return null;
    };

    getFunc(lt: (VariableType | "global"), name: string, args: (VariableType | "dummy")[]) {
        if (lt !== "global" && (this.isPointerType(lt) || this.isFunctionType(lt))) {
            let f;
            if (this.isArrayType(lt)) {
                f = "pointer_array";
            } else if (this.isFunctionType(lt)) {
                f = "function";
            } else {
                f = "pointer_normal";
            }
            let t = null;
            if (name in this.types[f].handlers) {
                t = this.types[f].handlers;
            } else if (name in this.types["pointer"].handlers) {
                t = this.types["pointer"].handlers;
            }
            if (t) {
                const sig = this.makeParametersSignature(args);
                let method;
                if (t[name].functions != null && sig in t[name].functions) {
                    return t[name].functions[sig];
                } else if ((method = this.matchVarArg(t[name], sig)) !== null) {
                    return method;
                } else if (t[name].default) {
                    return t[name].default;
                } else {
                    this.raiseException("no method " + name + " in " + this.makeTypeString(lt) + " accepts (" + sig + ")");
                }
            }
        }
        const ltsig = this.getTypeSignature(lt);
        if (ltsig in this.types) {
            const t = this.types[ltsig].handlers;
            if (name in t) {
                const sig = this.makeParametersSignature(args);
                let method;
                if (t[name].functions != null && sig in t[name].functions) {
                    return t[name].functions[sig];
                } else if ((method = this.matchVarArg(t[name], sig)) !== null) {
                    return method;
                } else if (t[name].default) {
                    return t[name].default;
                } else {
                    this.raiseException("no method " + name + " in " + this.makeTypeString(lt) + " accepts (" + sig + ")");
                }
            } else {
                this.raiseException("method " + name + " is not defined in " + this.makeTypeString(lt));
            }
        } else {
            if (lt !== "global" && this.isPointerType(lt)) {
                this.raiseException("this pointer has no proper method overload");
            } else {
                this.raiseException("type " + this.makeTypeString(lt) + " is not defined");
            }
        }
    };

    makeOperatorFuncName = (name: string) => `o(${name})`;

    regOperator(f: CFunction, lt: VariableType, name: string, args: VariableType[], retType: VariableType) {
        return this.regFunc(f, lt, this.makeOperatorFuncName(name), args, retType);
    };

    regFuncPrototype(lt: VariableType | "global", name: string, args: VariableType[], retType: VariableType, optionalArgs?: OptionalArg[]) {
        const ltsig = this.getTypeSignature(lt);
        if (ltsig in this.types) {
            const t = this.types[ltsig].handlers;
            if (!(name in t)) {
                t[name] = {
                    functions: {},
                    reg: {},
                };
            }
            if (!("reg" in t[name])) {
                t[name]["reg"] = {};
            }
            const sig = this.makeParametersSignature(args);
            if (sig in t[name]) {
                this.raiseException("method " + name + " with parameters (" + sig + ") is already defined");
            }
            const type = this.functionType(retType, args);
            if (lt === "global") {
                this.defVar(name, type, this.val(type, {
                    bindThis: null,
                    defineType: lt,
                    name,
                    target: null
                }));
            }
            t[name].functions[sig] = null;
            if (t[name].reg[sig] == null) {
                t[name].reg[sig] = {
                    args,
                    optionalArgs
                };
            }
        } else {
            this.raiseException("type " + this.makeTypeString(lt) + " is unknown");
        }
    };

    regFunc(f: CFunction, lt: VariableType | "global", name: string, args: (VariableType | "?")[], retType: VariableType, optionalArgs?: OptionalArg[]) {
        const ltsig = this.getTypeSignature(lt);
        if (ltsig in this.types) {
            if (!optionalArgs) { optionalArgs = []; }
            const t = this.types[ltsig].handlers;
            if (!(name in t)) {
                t[name] = {
                    functions: {},
                    reg: {},
                };
            }
            if (t[name].functions == null) {
                t[name].functions = {};
            }
            if (t[name].reg == null) {
                t[name].reg = {};
            }
            const sig = this.makeParametersSignature(args);
            // console.log("regFunc " + name + "(" + sig + ")");
            if (t[name].functions[sig] != null && t[name].reg[sig] != null) {
                this.raiseException("method " + name + " with parameters (" + sig + ") is already defined");
            }
            const type = this.functionType(retType, args);
            if (lt === "global") {
                if (this.varAlreadyDefined(name)) {
                    const func = this.scope[0].variables[name];
                    if (this.isFunctionType(func)) {
                        const v = func.v;
                        if (v.target !== null) {
                            this.raiseException("global method " + name + " with parameters (" + sig + ") is already defined");
                        } else {
                            v.target = f;
                        }
                    } else {
                        this.raiseException(name + " is already defined as " + this.makeTypeString(func?.t));
                    }
                } else {
                    this.defVar(name, type, this.val(type, {
                        bindThis: null,
                        defineType: lt,
                        name,
                        target: f
                    }));
                }
            }
            t[name].functions[sig] = f;
            t[name].reg[sig] = {
                args,
                optionalArgs
            };
        } else {
            this.raiseException("type " + this.makeTypeString(lt) + " is unknown");
        }
    };

    registerTypedef(basttype: VariableType, name: string) {
        return this.typedefs[name] = basttype;
    };

    promoteNumeric(l: VariableType, r: VariableType) {
        if (this.isNumericType(l) && this.isNumericType(r)) {
            if (this.isTypeEqualTo(l, r)) {
                if (this.isTypeEqualTo(l, this.boolTypeLiteral)) {
                    return this.intTypeLiteral;
                }
                if (this.isTypeEqualTo(l, this.charTypeLiteral)) {
                    return this.intTypeLiteral;
                }
                if (this.isTypeEqualTo(l, this.unsignedcharTypeLiteral)) {
                    return this.unsignedintTypeLiteral;
                }
                return l;
            } else if (this.isIntegerType(l) && this.isIntegerType(r)) {
                let rett;
                const slt = this.getSignedType(l);
                const srt = this.getSignedType(r);
                if (this.isTypeEqualTo(slt, srt)) {
                    rett = slt;
                } else {
                    const slti = this.numericTypeOrder.indexOf(slt.name);
                    const srti = this.numericTypeOrder.indexOf(srt.name);
                    if (slti <= srti) {
                        if (this.isUnsignedType(l) && this.isUnsignedType(r)) {
                            rett = r;
                        } else {
                            rett = srt;
                        }
                    } else {
                        if (this.isUnsignedType(l) && this.isUnsignedType(r)) {
                            rett = l;
                        } else {
                            rett = slt;
                        }
                    }
                }
                return rett;
            } else if (!this.isIntegerType(l) && this.isIntegerType(r)) {
                return l;
            } else if (this.isIntegerType(l) && !this.isIntegerType(r)) {
                return r;
            } else if (!this.isIntegerType(l) && !this.isIntegerType(r)) {
                return this.primitiveType("double");
            }
        } else {
            this.raiseException("you cannot promote (to) a non numeric type");
        }
    };

    readScopedVar(scope: RuntimeScope, varname: string) {
        return this.resolveNamespacePath(scope.variables, varname);
    };

    readVar(varname: string) {
        let i = this.scope.length - 1;
        while (i >= 0) {
            const vc = this.scope[i];
            if (vc.variables[varname] != null) {
                const ret = vc.variables[varname];
                return ret;
            }
            i--;
        }
        this.raiseException("variable " + varname + " does not exist");
    };

    deleteVar(varname: string) {
        let i = this.scope.length - 1;
        while (i >= 0) {
            const vc = this.scope[i];
            if (vc.variables[varname] != null) {
                delete vc.variables[varname];
                return;
            }
            i--;
        }
        this.raiseException("variable " + varname + " does not exist");
    };

    varAlreadyDefined(varname: string) {
        const vc = this.scope[this.scope.length - 1];
        return varname in vc;
    };

    defVar(varname: string, type: VariableType, initval: Variable) {
        initval = this.captureValue(initval);
        if (varname == null) {
            this.raiseException("cannot define a variable without name");
        }
        if (this.varAlreadyDefined(varname)) {
            this.raiseException("variable " + varname + " already defined");
        }

        const dataType = initval.dataType;
        const readonly = initval.readonly;
        const vc = this.scope[this.scope.length - 1];
        // logger.log("defining variable: %j, %j", varname, type);
        if (this.isReferenceType(type)) {
            initval = this.cast(type, initval);
        } else {
            initval = this.clone(this.cast(type, initval), true);
        }

        vc.variables[varname] = initval === undefined ? this.defaultValue(type) : initval;
        vc.variables[varname].readonly = readonly;
        vc.variables[varname].left = true;
        if (dataType)
            vc.variables[varname].dataType = dataType;
    };

    booleanToNumber(b: BasicValue) {
        if (typeof (b) === "boolean") {
            return b ? 1 : 0;
        }
        return b;
    }

    inrange(type: VariableType, value: BasicValue, errorMsg?: string) {
        if (this.isPrimitiveType(type)) {
            value = this.booleanToNumber(value);
            const limit = this.config.limits[type.name];
            const overflow = !((value <= limit.max) && (value >= limit.min));
            if (errorMsg && overflow) {
                if (this.isUnsignedType(type)) {
                    if (this.config.unsigned_overflow === "error") {
                        console.error(errorMsg);
                        this.raiseException(errorMsg);
                        return false;
                    } else if (this.config.unsigned_overflow === "warn") {
                        console.error(errorMsg);
                        return true;
                    } else {
                        return true;
                    }
                } else {
                    this.raiseException(errorMsg);
                }
            }
            return !overflow;
        } else {
            return true;
        }
    };

    ensureUnsigned(type: VariableType, value: BasicValue) {
        value = this.booleanToNumber(value);
        if (this.isUnsignedType(type)) {
            const limit = this.config.limits[type.name];
            const period = limit.max - limit.min;
            if (value < limit.min) {
                value += period * Math.ceil((limit.min - value) / period);
            }
            if (value > limit.max) {
                value = ((value - limit.min) % period) + limit.min;
            }
        }
        return value;
    };

    isNumericType(type: VariableType): type is PrimitiveType;
    isNumericType(type: Variable | DummyVariable): type is PrimitiveVariable;
    isNumericType(type: string): boolean;
    isNumericType(type: VariableType | Variable | DummyVariable | string) {
        if (typeof type === "string") {
            return this.isFloatType(type) || this.isIntegerType(type);
        }
        if ('t' in type) {
            return type.t !== "dummy" && this.isNumericType(type.t);
        }
        return this.isFloatType(type) || this.isIntegerType(type);
    };

    isUnsignedType(type: VariableType): type is PrimitiveType;
    isUnsignedType(type: string): boolean;
    isUnsignedType(type: VariableType | string): boolean {
        if (typeof type === "string") {
            switch (type) {
                case "unsigned char": case "unsigned short": case "unsigned short int": case "unsigned": case "unsigned int": case "unsigned long": case "unsigned long int": case "unsigned long long": case "unsigned long long int":
                    return true;
                default:
                    return false;
            }
        } else {
            return (type.type === "primitive") && this.isUnsignedType(type.name);
        }
    };

    isIntegerType(type: Variable): type is (IntVariable | BoolVariable);
    isIntegerType(type: VariableType): type is (IntType | BoolType);
    isIntegerType(type: string): boolean;
    isIntegerType(type: Variable | VariableType | string) {
        if (typeof type === "string") {
            return this.config.charTypes.includes(type as CCharType) || this.config.intTypes.includes(type as CIntType);
        } else if ('t' in type) {
            return this.isIntegerType(type.t);
        } else {
            return (type.type === "primitive") && this.isIntegerType(type.name);
        }
    };

    isFloatType(type: Variable): type is FloatVariable;
    isFloatType(type: VariableType): type is FloatType;
    isFloatType(type: string): boolean;
    isFloatType(type: Variable | VariableType | string): boolean {
        if (typeof type === "string") {
            switch (type) {
                case "float": case "double":
                    return true;
                default:
                    return false;
            }
        } else if ('t' in type) {
            return this.isFloatType(type.t);
        } else {
            return (type.type === "primitive") && this.isFloatType(type.name);
        }
    };

    getSignedType(type: VariableType): PrimitiveType {
        if (type.type === "primitive") {
            return this.primitiveType(type.name.replace("unsigned", "").trim() as CBasicType);
        } else {
            this.raiseException("Cannot get signed type from non-primitive type " + this.makeTypeString(type));
        }
    };

    castable(type1: VariableType | "dummy", type2: VariableType | "dummy") {
        if (type1 === "dummy" || type2 === "dummy") {
            this.raiseException("Unexpected dummy");
            return;
        }
        if (this.isTypeEqualTo(type1, type2)) {
            return true;
        }
        if (this.isIntegerType(type1 as any) && this.isPointerType(type2)) {
            // The literal 0 is a null pointer constant in C++, which is how
            // `head->next = 0` and `while (cur != 0)` are written in most
            // teaching material. Only integers convert this way — a pointer
            // never silently becomes a number.
            return true;
        }
        if (this.isPrimitiveType(type1) && this.isPrimitiveType(type2)) {
            return this.isNumericType(type2) && this.isNumericType(type1);
        } else if (this.isPointerType(type1) && this.isPointerType(type2)) {
            if (this.isFunctionType(type1)) {
                return this.isPointerType(type2);
            }
            return !this.isFunctionType(type2);
        } else if (this.isStringType(type1) && this.isStringType(type2)) {
            return true;
        } else if (this.isClassType(type1) && this.isClassType(type2)) {
            return true;
        } else if (this.isPrimitiveType(type1) && this.isReferenceType(type2)) {
            return true;
        } else if (this.isClassType(type1) || this.isClassType(type2)) {
            this.raiseException("not implemented");
        }
        return false;
    };

    cast(type: IntType, value: Variable | DummyVariable): IntVariable;
    cast(type: VariableType, value: Variable | DummyVariable): Variable;
    cast(type: VariableType, value: Variable | DummyVariable) {
        // TODO: looking for global overload
        let v;
        if (value.t !== "dummy") {
        } else {
            this.raiseException(this.makeValString(value) + " is dummy");
            return;
        }
        if (this.isTypeEqualTo(value.t, type)) {
            if (this.isStructType(type) && value.left && (value as any).array == null) {
                return this.cloneDeep(value);
            }
            return value;
        }
        if (this.isPointerType(type) && this.isIntegerType(value as any) && (value.v === 0)) {
            // Null pointer constant: see the matching case in castable().
            return this.val(type, this.makeNormalPointerValue(null));
        }
        if (this.isPointerType(type) && this.isPointerType(value.t)
            && this.isNormalPointerType(value.t) && (value.v as any).target === null) {
            // A null pointer of one type is a null pointer of any other, which
            // is what lets the single shared NULL be assigned to every pointer.
            return this.val(type, this.makeNormalPointerValue(null));
        }
        if (this.isPrimitiveType(type) && this.isPrimitiveType(value.t)) {
            if (type.name === "bool") {
                return this.val(type, value.v ? 1 : 0);
            } else if (["float", "double"].includes(type.name)) {
                if (!this.isNumericType(value)) {
                    this.raiseException("cannot cast " + this.makeValueString(value) + " to " + this.makeTypeString(type));
                } else if (this.inrange(type, value.v, "overflow when casting " + this.makeTypeString(value?.t) + " to " + this.makeTypeString(type))) {
                    value.v = this.ensureUnsigned(type, value.v);
                    return this.val(type, value.v);
                }
            } else {
                if (type.name.slice(0, 8) === "unsigned") {
                    if (!this.isNumericType(value)) {
                        this.raiseException("cannot cast " + this.makeValueString(value) + " to " + this.makeTypeString(type));
                    } else if (value.v < 0) {
                        const { bytes } = this.config.limits[type.name];
                        let newValue = this.booleanToNumber(value.v) & ((1 << (8 * bytes)) - 1); // truncates
                        if (this.inrange(type, newValue, `cannot cast negative value ${newValue} to ` + this.makeTypeString(type))) {
                            newValue = this.ensureUnsigned(type, newValue);
                            // unsafe! bitwise truncation is platform dependent
                            return this.val(type, newValue);
                        }
                    }
                }
                if (!this.isNumericType(value)) {
                    this.raiseException("cannot cast " + this.makeValueString(value) + " to " + this.makeTypeString(type));
                } else if (this.isFloatType(value)) {
                    v = value.v > 0 ? Math.floor(this.booleanToNumber(value.v)) : Math.ceil(this.booleanToNumber(value.v));
                    if (this.inrange(type, v, "overflow when casting " + this.makeValString(value) + " to " + this.makeTypeString(type))) {
                        v = this.ensureUnsigned(type, v);
                        return this.val(type, v);
                    }
                } else {
                    if (this.inrange(type, value.v, "overflow when casting " + this.makeValString(value) + " to " + this.makeTypeString(type))) {
                        value.v = this.ensureUnsigned(type, value.v);
                        return this.val(type, value.v);
                    }
                }
            }
        } else if (this.isPrimitiveType(type) && this.isArrayType(value)) {
            if (this.isTypeEqualTo(type, value.t.eleType)) {
                return value;
            }
        } else if (this.isStructType(type)) {
            return value;
        } else if (this.isReferenceType(type)) {
            return value;
        } else if (this.isPointerType(type)) {
            // A malloc block has no type of its own; in C the assignment gives
            // it one, which is the whole point of void*. The byte count travels
            // with the block so it can be cut into elements of whatever type it
            // lands in — the reason `int *p = malloc(3 * sizeof(int))` gives
            // three ints rather than twelve chars.
            if ((value as any).heapBytes != null) {
                const eleType = this.isArrayType(type) ? type.eleType
                    : this.isNormalPointerType(type) ? type.targetType : null;
                if (eleType != null) {
                    let width = 1;
                    try { width = this.getSizeByType(eleType) || 1; } catch (e) { width = 1; }
                    const count = Math.max(1, Math.floor((value as any).heapBytes / width));
                    return this.defaultValue(this.arrayPointerType(eleType, count), true);
                }
            }
            if (this.isArrayType(value)) {
                if (this.isNormalPointerType(type)) {
                    if (this.isTypeEqualTo(type.targetType, value.t.eleType)) {
                        return value;
                    } else {
                        this.raiseException(this.makeTypeString(type?.targetType) + " is not equal to array element type " + this.makeTypeString(value?.t.eleType));
                    }
                } else if (this.isArrayType(type)) {
                    if (this.isTypeEqualTo(type.eleType, value.t.eleType)) {
                        return value;
                    } else {
                        this.raiseException("array element type " + this.makeTypeString(type?.eleType) + " is not equal to array element type " + this.makeTypeString(value?.t.eleType));
                    }
                } else {
                    this.raiseException("cannot cast a function to a regular pointer");
                }
            } else {
                if (this.isNormalPointerType(type)) {
                    if (this.isNormalPointerType(value)) {
                        if (this.isTypeEqualTo(type.targetType, value.t.targetType)) {
                            return value;
                        } else {
                            this.raiseException(this.makeTypeString(type?.targetType) + " is not equal to " + this.makeTypeString(value?.t.targetType));
                        }
                    } else {
                        this.raiseException(this.makeValueString(value) + " is not a normal pointer");
                    }
                } else if (this.isArrayType(type)) {
                    if (this.isNormalPointerType(value)) {
                        if (this.isTypeEqualTo(type.eleType, value.t.targetType)) {
                            return value;
                        } else {
                            this.raiseException("array element type " + this.makeTypeString(type?.eleType) + " is not equal to " + this.makeTypeString(value?.t.targetType));
                        }
                    } else {
                        this.raiseException(this.makeValueString(value) + " is not a normal pointer");
                    }
                } else if (this.isFunctionPointerType(type)) {
                    if (this.isFunctionPointerType(value.t)) {
                        if (!this.isTypeEqualTo(type, value.t)) {
                            this.raiseException("Function pointers do not share the same signature");
                        }
                        return value;
                    } else {
                        this.raiseException("cannot cast a regular/array pointer to a function pointer");
                    }
                } else {
                    this.raiseException("cannot cast a function to a regular pointer");
                }
            }
        } else if (this.isFunctionType(type)) {
            if (this.isFunctionType(value.t)) {
                return this.val(value.t, value.v);
            } else {
                this.raiseException("cannot cast a regular pointer to a function");
            }
        } else if (this.isClassType(type)) {
            if (this.isStringClass(type)) {
                return this.val(type, value.v);
            } else if (this.isVectorClass(type)) {
                return this.val(type, value.v);
            } else {
                this.raiseException("not implemented");
            }
        } else if (this.isClassType(value.t)) {
            value = this.getCompatibleFunc(value.t, this.makeOperatorFuncName(type.name), [])(this, value);
            return value;
        } else {
            this.raiseException("cast failed from type " + this.makeTypeString(type) + " to " + this.makeTypeString(value?.t));
        }
    };

    cloneDeep(obj: any): Object {
        return Flatted.parse(Flatted.stringify(obj));
    };

    clone(v: Variable, isInitializing?: boolean) {
        return this.val(v.t, v.v, false, isInitializing);
    };

    addToNamespace(namespacePath: string, name: string, obj: any) {
        const namespaces = namespacePath.split('::');
        let currentNamespace: any = this.namespace;

        for (let i = 0; i < namespaces.length; i++) {
            const namespace = namespaces[i];
            if (!currentNamespace[namespace])
                currentNamespace[namespace] = {};
            currentNamespace = currentNamespace[namespace];
        }

        currentNamespace[name] = obj;
    };

    resolveNamespacePath(obj: any, path: string) {
        const keys = path.split('::');

        let current = obj;
        for (const key of keys) {
            if (current.hasOwnProperty(key)) {
                current = current[key];
            } else {
                return undefined;
            }
        }

        return current;
    };

    getFromNamespace(namespacePath: string) {
        const namespaces = namespacePath.split('::');
        if (namespaces.length <= 1)
            return null;

        let currentNamespaceObj: any = this.namespace;
        for (let i = 0; i < namespaces.length; i++) {
            const namespace = namespaces[i];
            if (!(namespace in currentNamespaceObj))
                return undefined;
            currentNamespaceObj = currentNamespaceObj[namespace];
        }

        return currentNamespaceObj;
    };

    enterScope(scopename: string) {
        this.scope.push({ "$name": scopename, variables: {} });
    };

    exitScope(scopename: string) {
        // logger.info("%j", this.scope);
        while (true) {
            const s = this.scope.pop();
            if (!scopename || !(this.scope.length > 1) || (s["$name"] === scopename)) {
                break;
            }
        }
    };

    val(t: IntType, v: BasicValue, left?: boolean, isInitializing?: boolean): IntVariable;
    val(t: PointerType, v: PointerValue, left?: boolean, isInitializing?: boolean): PointerVariable;
    val(t: VariableType, v: VariableValue, left?: boolean, isInitializing?: boolean): Variable;
    val(t: VariableType, v: VariableValue, left = false, isInitializing = false): Variable {
        if (this.isNumericType(t)) {
            let checkRange: boolean;
            if (isInitializing) {
                if (typeof (v) !== "number" || isNaN(v)) {
                    checkRange = false;
                } else {
                    checkRange = true;
                }
            } else {
                checkRange = true;
            }
            if (checkRange) {
                this.inrange(t, v as BasicValue, `overflow of ${this.makeValString({ t, v } as Variable)}`);
                v = this.ensureUnsigned(t, v as BasicValue);
            }
        }
        if (left === undefined) {
            left = false;
        }
        return {
            t,
            v,
            left
        } as Variable;
    };

    isTypeEqualTo(type1: (VariableType | "?"), type2: (VariableType | "?")): boolean {
        if (type1 === "?" || type2 === "?") {
            return type1 === type2;
        }
        if (type1.type === type2.type) {
            switch (type1.type) {
                case "primitive":
                    return type1.name === (type2 as any).name;
                    break;
                case "class":
                    return type1.name === (type2 as any).name;
                    break;
                case "struct":
                    return type1.name === (type2 as any).name;
                    break;
                case "pointer":
                    type2 = type2 as PointerType;
                    if ((type1.ptrType === type2.ptrType) || ((type1.ptrType !== "function") && (type2.ptrType !== "function"))) {
                        switch (type1.ptrType) {
                            case "array":
                                return this.isTypeEqualTo(type1.eleType, (type2 as ArrayType).eleType || (type2 as NormalPointerType).targetType);
                                break;
                            case "function":
                                return this.isTypeEqualTo((type1 as FunctionPointerType).targetType, (type2 as FunctionPointerType).targetType);
                                break;
                            case "normal":
                                return this.isTypeEqualTo(type1.targetType, (type2 as ArrayType).eleType || (type2 as NormalPointerType).targetType);
                                break;
                        }
                    }
                    break;
                case "function":
                    if (this.isTypeEqualTo(type1.retType, (type2 as FunctionType).retType) && (type1.signature.length === (type2 as FunctionType).signature.length)) {
                        return type1.signature.every((type, index, arr) => {
                            const x = this.isTypeEqualTo(type, (type2 as FunctionType).signature[index]);
                            return x;
                        });
                    }
                    break;
            }
        }
        return type1 === type2;
    };

    isBoolType(type: VariableType | string): boolean {
        if (typeof type === "string") {
            return type === "bool";
        } else {
            return (type.type === "primitive") && this.isBoolType(type.name);
        }
    };

    isVoidType(type: VariableType | string): boolean {
        if (typeof type === "string") {
            return type === "void";
        } else {
            return (type.type === "primitive") && this.isVoidType(type.name);
        }
    };
    isPrimitiveType(type: VariableType): type is PrimitiveType;
    isPrimitiveType(type: string): type is CBasicType;
    isPrimitiveType(type: Variable | DummyVariable): type is PrimitiveVariable;
    isPrimitiveType(type: VariableType | Variable | DummyVariable | string) {
        if (typeof type === "string") {
            return this.isNumericType(type) || this.isBoolType(type) || this.isVoidType(type);
        }
        if ('t' in type) {
            return type.t !== "dummy" && this.isPrimitiveType(type.t);
        }
        return this.isNumericType(type) || this.isBoolType(type) || this.isVoidType(type);
    };

    isArrayType(type: VariableType): type is ArrayType;
    isArrayType(type: Variable | DummyVariable): type is ArrayVariable;
    isArrayType(type: VariableType | Variable | DummyVariable) {
        if ('t' in type) {
            return type.t !== "dummy" && this.isArrayType(type.t);
        }
        return this.isPointerType(type) && (type.ptrType === "array");
    };

    isArrayElementType(type: Variable | DummyVariable): type is ArrayElementVariable;
    isArrayElementType(type: Variable | DummyVariable) {
        return type.t !== "dummy" && "array" in type.t;
    };

    isFunctionPointerType(type: VariableType): type is FunctionPointerType;
    isFunctionPointerType(type: Variable | DummyVariable): type is FunctionPointerVariable;
    isFunctionPointerType(type: VariableType | Variable | DummyVariable) {
        if ('t' in type) {
            return type.t !== "dummy" && this.isFunctionPointerType(type.t);
        }
        return this.isPointerType(type) && type.ptrType === "function";
    };

    isFunctionType(type: VariableType): type is FunctionType;
    isFunctionType(type: Variable | DummyVariable): type is FunctionVariable;
    isFunctionType(type: VariableType | Variable | DummyVariable) {
        if ('t' in type) {
            return type.t !== "dummy" && this.isFunctionType(type.t);
        }
        return type.type === "function";
    };

    isNormalPointerType(type: VariableType): type is NormalPointerType;
    isNormalPointerType(type: Variable | DummyVariable): type is NormalPointerVariable;
    isNormalPointerType(type: Variable | DummyVariable | VariableType): type is NormalPointerType {
        if ('t' in type) {
            return type.t !== "dummy" && this.isNormalPointerType(type.t);
        }
        return this.isPointerType(type) && (type.ptrType === "normal");
    };

    isPointerType(type: VariableType): type is PointerType;
    isPointerType(type: Variable | DummyVariable): type is PointerVariable;
    isPointerType(type: Variable | DummyVariable | VariableType) {
        if ('t' in type) {
            return type.t !== "dummy" && this.isPointerType(type.t);
        }
        return type.type === "pointer";
    };

    isReferenceType(type: VariableType): type is ReferenceType;
    isReferenceType(type: Variable | DummyVariable | VariableType) {
        if ('t' in type) {
            return type.t !== "dummy" && this.isReferenceType(type.t);
        }
        return type.type === "reference";
    };

    isStructType(type: VariableType | string): type is StructType;
    isStructType(type: Variable | DummyVariable): type is ObjectVariable;
    isStructType(type: any): type is StructType {
        if (typeof type === "string") {
            return this.getTypeSignature({ type: "struct", name: type }) in this.types;
        }

        if ('t' in type) {
            return type.t !== "dummy" && this.isStructType(type.t);
        }
        return type.type === "struct";
    };

    isClassType(type: VariableType): type is ClassType;
    isClassType(type: Variable | DummyVariable): type is ObjectVariable;
    isClassType(type: VariableType | DummyVariable | Variable): type is ClassType {
        if ('t' in type) {
            return type.t !== "dummy" && this.isClassType(type.t);
        } else if ('targetType' in type) {
            return this.isClassType(type.targetType);
        }
        return type.type === "class";
    };

    arrayPointerType(eleType: VariableType, size: number): ArrayType {
        return {
            type: "pointer",
            ptrType: "array",
            eleType,
            size
        };
    };

    makeArrayPointerValue(arr: Variable[], position: number): ArrayValue {
        return {
            target: arr,
            position
        }
    };

    functionPointerType(retType: VariableType, signature: (VariableType | "?")[]): FunctionPointerType {
        return {
            type: "pointer",
            ptrType: "function",
            targetType: this.functionType(retType, signature)
        };
    };

    functionType(retType: VariableType, signature: (VariableType | "?")[]): FunctionType {
        return {
            type: "function",
            retType,
            signature
        };
    };

    makeFunctionPointerValue(f: FunctionVariable, name: string, lt: VariableType | "global", args: (VariableType | "?")[], retType: VariableType): FunctionPointerValue {
        return {
            target: f,
            name,
            defineType: lt,
            args,
            retType
        };
    };

    normalPointerType(targetType: VariableType): PointerType {
        if (targetType.type === "function") {
            return {
                type: "pointer",
                ptrType: "function",
                targetType,
            }
        }
        return {
            type: "pointer",
            ptrType: "normal",
            targetType
        };
    };

    makeReferenceType(targetType: VariableType): ReferenceType {
        return {
            type: "reference",
            targetType
        };
    };

    makeNormalPointerValue(target: Variable): PointerValue {
        return {
            target
        };
    };

    simpleType(type: string | string[]): VariableType {
        if (Array.isArray(type)) {
            if (type.length > 1) {
                const typeStr = type.map((t) => (t as any).Identifier ?? t).filter(t => {
                    return !this.config.specifiers.includes(t as Specifier);
                }).join(" ");
                return this.simpleType(typeStr);
            } else {
                return this.typedefs[type[0]] || this.simpleType(type[0]);
            }
        } else {
            if (this.isPrimitiveType(type)) {
                return this.primitiveType(type);
            } else if (this.isStructType(type)) {
                return this.simpleStructType(type);
            } else if (this.isNamespaceType(type)) {
                return this.simpleType(resolveIdentifier(type).split("::").pop());
            } else {
                return this.simpleClassType(type);
            }
        }
    };

    simpleStructType(type: string) {
        const structType: StructType = {
            type: "struct",
            name: type
        };
        if (this.getTypeSignature(structType) in this.types) {
            return structType;
        } else {
            this.raiseException("type " + type + " is not defined");
        }
    };

    simpleClassType(type: string) {
        const clsType: ClassType = {
            type: "class",
            name: type
        };
        if (this.getTypeSignature(clsType) in this.types) {
            return clsType;
        } else {
            this.raiseException("type " + type + " is not defined");
        }
    };

    newStruct(structname: string, members: Member[]) {
        const clsType: StructType = {
            type: "struct",
            name: structname
        };

        const sig = this.getTypeSignature(clsType);
        if (sig in this.types) {
            this.raiseException(this.makeTypeString(clsType) + " is already defined");
        }

        this.types[sig] = {
            cConstructor(rt, _this) {
                const v = _this.v as ObjectValue;
                v.members = {};
                for (const member of members) {
                    v.members[member.name] = (member.initialize != null) ? rt.cloneDeep(member.initialize(rt, _this)) as Variable : rt.defaultValue(member.type, true);
                }
            },
            members,
            handlers: {
                // ...defaults.defaultOpHandler.handlers,
                "o(=)": {
                    default(rt: CRuntime, l: any, r: any) {
                        if (!l.left) {
                            rt.raiseException(rt.makeValString(l) + " is not a left value");
                        } else if (l.readonly) {
                            rt.raiseException(`assignment of read-only variable ${rt.makeValString(l)}`);
                        }

                        l.v = rt.cast(l.t, r).v;
                        return l;
                    },
                },
                "o(&)": {
                    default(rt: CRuntime, l: any, r: any) {
                        if (r === undefined) {
                            if (!l.left) {
                                rt.raiseException(rt.makeValString(l) + " is not a left value");
                            }
                            if ("array" in l) {
                                return rt.val(rt.arrayPointerType(l.t, l.array.length), rt.makeArrayPointerValue(l.array, l.arrayIndex));
                            } else {
                                const t = rt.normalPointerType(l.t);
                                return rt.val(t, rt.makeNormalPointerValue(l));
                            }
                            
                        } else {
                            rt.raiseException(`operator & between types '${rt.makeTypeString(l)}' and '${rt.makeTypeString(r)}' is undefined`)
                        }
                    },
                },
            },
        };
        return clsType;
    };

    newClass(classname: string, members: Member[]) {
        const clsType: ClassType = {
            type: "class",
            name: classname
        };
        const sig = this.getTypeSignature(clsType);
        if (sig in this.types) {
            this.raiseException(this.makeTypeString(clsType) + " is already defined");
        }

        this.types[sig] = {
            father: classname,
            cConstructor(rt, _this, args = []) {
                const v = _this.v as ObjectValue;
                v.members = {};
                let i = 0;
                while (i < members.length) {
                    const member = members[i];
                    v.members[member.name] = (member.initialize != null) ? member.initialize(rt, _this) : rt.defaultValue(member.type, true);
                    i++;
                }
                rt.types[sig].handlers["o(())"]?.default(rt, _this, ...args);
            },
            members,
            handlers: {},
        };

        return clsType;
    };

    primitiveType(type: CBasicType): PrimitiveType {
        return {
            type: "primitive",
            name: type,
        } as PrimitiveType;
    };

    isCharType(type: VariableType) {
        return "name" in type && this.config.charTypes.indexOf(type.name as CCharType) !== -1;
    };

    isStringType(type: Variable): type is ArrayVariable;
    isStringType(type: VariableType): type is ArrayType;
    isStringType(type: Variable | VariableType) {
        if ("t" in type) {
            return this.isStringType(type.t);
        } else if ('targetType' in type) {
            return this.isStringType(type.targetType);
        }
        return (this.isArrayType(type) && this.isCharType(type.eleType)) || this.isStringClass(type);
    };

    isStringClass(type: VariableType) {
        return (type.type === "class" && type.name === "string");
    };

    isVectorClass(type: VariableType) {
        return (type.type === "class" && type.name === "vector");
    };

    isNamespaceType(type: string | Variable | VariableType) {
        return resolveIdentifier(type).split('::').length > 1;
    };

    getStringFromCharArray(element: ArrayVariable) {
        if (this.isStringType(element.t)) {
            const {
                target
            } = element.v;
            let result = "";
            let i = 0;
            while (i < target.length) {
                const charVal = target[i];
                if (charVal.v === 0) {
                    break;
                }
                result += String.fromCharCode(charVal.v as number);
                i++;
            }
            return result;
        } else {
            this.raiseException("target is not a string");
        }
    };

    makeCharArrayFromString(str: string, typename?: CBasicType): ArrayVariable {
        // if (!typename) { typename = this.detectWideCharacters(str) ? "wchar_t" : "char"; }
        if (!typename) { typename = "char"; }
        const charType = this.primitiveType(typename);
        const type = this.arrayPointerType(charType, str.length + 1);
        const trailingZero = this.val(charType, 0);
        return {
            t: type,
            v: {
                target: str.split("").map(c => this.val(charType, c.charCodeAt(0))).concat([trailingZero]),
                position: 0,
            }
        };
    };

    detectWideCharacters(str: string): boolean {
        const wideCharacterRange = /[\u0100-\uffff]/;

        return wideCharacterRange.test(str);
    }

    getTypeSignature(type: VariableType | "global" | "?" | "dummy") {
        // (primitive), [class], <struct>, {pointer}
        if (typeof (type) === "string") {
            return type;
        }
        let ret: string;
        if (type.type === "primitive") {
            ret = "(" + type.name + ")";
        } else if (type.type === "class") {
            ret = "[" + type.name + "]";
        } else if (type.type === "struct") {
            ret = "<" + type.name + ">";
        } else if (type.type === "reference") {
            ret = this.getTypeSignature(type.targetType);
        } else if (type.type === "pointer") {
            // !targetType, @size!eleType, !#retType!param1,param2,...
            ret = "{";
            if (type.ptrType === "normal") {
                ret += "!" + this.getTypeSignature(type.targetType);
            } else if (type.ptrType === "array") {
                ret += "!" + this.getTypeSignature(type.eleType);
            } else if (type.ptrType === "function") {
                ret += "@" + this.getTypeSignature(type.targetType);
            }
            ret += "}";
        } else if (type.type === "function") {
            // #retType!param1,param2,...
            ret = "#" + this.getTypeSignature(type.retType) + "!" + type.signature.map(e => {
                return this.getTypeSignature(e);
            }).join(",");
        }
        return ret;
    };

    makeTypeString(type: VariableType | "global" | "dummy" | "?" | undefined) {
        // (primitive), [class], <struct>, {pointer}
        let ret;
        if (type === undefined) {
            ret = "<unknown>";
        }
        else if (typeof (type) === "string") {
            ret = "$" + type;
        } else if (type.type === "primitive") {
            ret = type.name;
        } else if (type.type === "class") {
            ret = type.name;
        } else if (type.type === "struct") {
            ret = `<${type.name}>`;
        } else if (type.type === "pointer") {
            // !targetType, @size!eleType, #retType!param1,param2,...
            ret = "";
            if (type.ptrType === "normal") {
                ret += this.makeTypeString(type?.targetType) + "*";
            } else if (type.ptrType === "array") {
                ret += this.makeTypeString(type?.eleType) + `[${type.size}]`;
            } else if (type.ptrType === "function") {
                ret += this.makeTypeString(type?.targetType.retType) + "(*f)" + "(" + type.targetType.signature.map(e => {
                    return this.makeTypeString(e);
                }).join(",") + ")";
            }
        }
        return ret;
    };

    makeValueString(l: Variable | DummyVariable, options?: MakeValueStringOptions): string {
        let display: string;
        if (!options) { options = {}; }
        if (this.isPrimitiveType(l)) {
            if (this.isTypeEqualTo(l.t, this.charTypeLiteral)) {
                display = "'" + String.fromCharCode(l.v as number) + "'";
            } else if (this.isBoolType(l.t)) {
                display = l.v !== 0 ? "true" : "false";
            } else {
                display = l.v.toString();
            }
        } else if (this.isPointerType(l)) {
            if (this.isFunctionType(l.t)) {
                display = "<function>";
            } else if (this.isArrayType(l)) {
                if (this.isTypeEqualTo(l.t.eleType, this.charTypeLiteral)) {
                    // string
                    display = "\"" + this.getStringFromCharArray(l) + "\"";
                } else if (options.noArray) {
                    display = "[...]";
                } else {
                    options.noArray = true;
                    const displayList = [];
                    for (let i = l.v.position, end = l.v.target.length, asc = l.v.position <= end; asc ? i < end : i > end; asc ? i++ : i--) {
                        displayList.push(this.makeValueString(l.v.target[i], options));
                    }
                    display = "[" + displayList.join(",") + "]";
                }
            } else if (this.isNormalPointerType(l)) {
                if (options.noPointer) {
                    display = "->?";
                } else {
                    options.noPointer = true;
                    display = "->" + this.makeValueString(l.v.target);
                }
            } else {
                this.raiseException("unknown pointer type");
            }
        } else if (this.isClassType(l)) {
            display = "<object>";
        } else if (this.isStructType(l)) {
            display = "<struct>";
        }
        return display;
    };

    makeValString(l: Variable | DummyVariable) {
        return this.makeValueString(l) + "(" + this.makeTypeString(l?.t) + ")";
    };

    makeConstructor(type: VariableType, args: Variable[], left = false): Variable {
        const ret = this.val(type, { members: {} }, left);
        this.types[this.getTypeSignature(type)].cConstructor(this, ret, args);
        return ret;
    };

    defaultValue(type: VariableType, left = false): Variable {
        if (type.type === "primitive") {
            return this.val(type, 0, left, true);
        } else if (type.type === "class" || type.type === "struct") {
            const ret = this.val(type, { members: {} }, left);
            this.types[this.getTypeSignature(type)].cConstructor(this, ret);
            return ret;
        } else if (type.type === "pointer") {
            if (type.ptrType === "normal") {
                return this.val(type, this.makeNormalPointerValue(null), left);
            } else if (type.ptrType === "array") {
                const init = [];
                for (let i = 0, end = type.size, asc = 0 <= end; asc ? i < end : i > end; asc ? i++ : i--) {
                    init[i] = this.defaultValue(type.eleType, true);
                }
                return this.val(type, this.makeArrayPointerValue(init, 0), left);
            } else if (type.ptrType === "function") {
                return this.val(this.functionPointerType(type.targetType.retType, type.targetType.signature), this.makeFunctionPointerValue(null, null, null, type.targetType.signature, type.targetType.retType));
            }
        }
    };

    raiseException(message: string, currentNode?: any) {
        if (this.interp) {
            if (currentNode == null) {
                ({
                    currentNode
                } = this.interp);
            }
            const posInfo =
                (() => {
                    if (currentNode != null) {
                        const ln = currentNode.sLine;
                        const col = currentNode.sColumn;
                        return ln + ":" + col;
                    } else {
                        return "<position unavailable>";
                    }
                })();
            throw new Error(posInfo + " " + message);
        } else {
            throw new Error(message);
        }
    };

    raiseSoftException(message: string, currentNode?: any) {
        if (this.interp) {
            if (currentNode == null) {
                ({
                    currentNode
                } = this.interp);
            }
            const posInfo =
                (() => {
                    if (currentNode != null) {
                        const ln = currentNode.sLine;
                        const col = currentNode.sColumn;
                        return ln + ":" + col;
                    } else {
                        return "<position unavailable>";
                    }
                })();
            console.error(posInfo + " " + message);
        } else {
            console.error(message);
        }
    };

}
