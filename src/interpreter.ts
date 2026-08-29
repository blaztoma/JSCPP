import { resolveIdentifier } from "./includes/shared/string_utils";
import * as classes from "./classes";
import { ArrayType, CRuntime, RuntimeScope, Variable, VariableType } from "./rt";

/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const sampleGeneratorFunction = function* (): Generator<null, void, void> {
    return yield null;
};

const sampleGenerator = sampleGeneratorFunction();

const isGenerator = (g: any) => {
    return (g != null ? g.constructor : undefined) === sampleGenerator.constructor;
};

const isGeneratorFunction = (f: any) => {
    return (f != null ? f.constructor : undefined) === sampleGeneratorFunction.constructor;
};

export class BaseInterpreter {
    rt: CRuntime;
    currentNode: any;
    source: string;
    constructor(rt: CRuntime) {
        this.rt = rt;
    }
}

function isIterable(obj: any) {
    // checks for null and undefined
    if (obj == null) {
        return false;
    }
    return typeof obj[Symbol.iterator] === 'function';
}

export class Interpreter extends BaseInterpreter {
    visitors: { [name: string]: (interp: Interpreter, s: any, param?: any) => any };
    constructor(rt: CRuntime) {
        super(rt);
        this.visitors = {
            *TranslationUnit(interp, s, param) {
                ({ rt } = interp);
                let i = 0;
                while (i < s.ExternalDeclarations.length) {
                    const dec = s.ExternalDeclarations[i];
                    yield* interp.visit(interp, dec);
                    i++;
                }
            },
            *DirectDeclarator(interp, s, param) {
                ({ rt } = interp);
                let { basetype } = param;
                basetype = interp.buildRecursivePointerType(s.Pointer, basetype, 0);
                if (s.right.length === 1) {
                    let varargs;
                    const right = s.right[0];
                    let ptl = null;
                    if (right.type === "DirectDeclarator_modifier_ParameterTypeList") {
                        ptl = right.ParameterTypeList;
                        ({ varargs } = ptl);
                    } else if ((right.type === "DirectDeclarator_modifier_IdentifierList") && (right.IdentifierList === null)) {
                        ptl = right.ParameterTypeList;
                        varargs = false;
                    }
                    if (ptl != null) {
                        const argTypes = [];
                        for (const _param of ptl.ParameterList) {
                            const _basetype = rt.simpleType(_param.DeclarationSpecifiers);
                            let _type;
                            if (_param.Declarator != null) {
                                const _pointer = _param.Declarator.Pointer;
                                _type = interp.buildRecursivePointerType(_pointer, _basetype, 0);
                                if ((_param.Declarator.right != null) && (_param.Declarator.right.length > 0)) {
                                    const dimensions = [];
                                    for (let j = 0; j < _param.Declarator.right.length; j++) {
                                        let dim = _param.Declarator.right[j];
                                        if (dim.type !== "DirectDeclarator_modifier_array") {
                                            rt.raiseException("unacceptable array initialization", dim);
                                        }
                                        if (dim.Expression !== null) {
                                            dim = rt.cast(rt.intTypeLiteral, (yield* interp.visit(interp, dim.Expression, param))).v;
                                        } else if (j > 0) {
                                            rt.raiseException("multidimensional array must have bounds for all dimensions except the first", dim);
                                        } else {
                                            dim = -1;
                                        }
                                        dimensions.push(dim);
                                    }
                                    _type = interp.arrayType(dimensions, _type);
                                }
                            } else {
                                _type = _basetype;
                            }
                            argTypes.push(_type);
                        }
                        basetype = rt.functionType(basetype, argTypes);
                    }
                }
                if ((s.right.length > 0) && (s.right[0].type === "DirectDeclarator_modifier_array")) {
                    const dimensions = [];
                    for (let j = 0; j < s.right.length; j++) {
                        let dim = s.right[j];
                        if (dim.type !== "DirectDeclarator_modifier_array") {
                            rt.raiseException("unacceptable array initialization", dim);
                        }
                        if (dim.Expression !== null) {
                            dim = rt.cast(rt.intTypeLiteral, (yield* interp.visit(interp, dim.Expression, param))).v;
                        } else if (j > 0) {
                            rt.raiseException("multidimensional array must have bounds for all dimensions except the first", dim);
                        } else {
                            dim = -1;
                        }
                        dimensions.push(dim);
                    }
                    basetype = interp.arrayType(dimensions, basetype);
                }

                if (s.left.type === "Identifier") {
                    return { type: basetype, name: s.left.Identifier };
                } else {
                    const _basetype = param.basetype;
                    param.basetype = basetype;
                    const ret = yield* interp.visit(interp, s.left, param);
                    param.basetype = _basetype;
                    return ret;
                }
            },
            *TypedefDeclaration(interp, s, param) {
                ({
                    rt
                } = interp);
                const basetype = rt.simpleType(s.DeclarationSpecifiers);
                const _basetype = param.basetype;
                param.basetype = basetype;
                for (const declarator of s.Declarators) {
                    const { type, name } = yield* interp.visit(interp, declarator, param);
                    rt.registerTypedef(type, name);
                }
                param.basetype = _basetype;
            },
            *ParameterTypeList(interp, s, param) {
                const argTypes = [];
                const argNames = [];
                const readonlyArgs: boolean[] = [];
                const optionalArgs = [];

                let i = 0;
                while (i < s.ParameterList.length) {
                    const _param = s.ParameterList[i];

                    let _type;
                    let _init = null;
                    let _name = null;
                    let _readonly = false;
                    if (param.insideDirectDeclarator_modifier_ParameterTypeList) {
                        const _basetype = rt.simpleType(_param.DeclarationSpecifiers);
                        _type = _basetype;
                    } else {
                        if (_param.Declarator == null) {
                            rt.raiseException("missing declarator for argument", _param);
                        }
                        _init = _param.Declarator.Initializers;

                        const _declarationSpecifiers = _param.DeclarationSpecifiers.flatMap((specifier: any) => specifier?.DeclarationSpecifiers || specifier);
                        const _basetype = rt.simpleType(_declarationSpecifiers);
                        const _reference = _param.Declarator.Declarator.Reference;
                        _readonly = _declarationSpecifiers.some((specifier: any) => ["const", "static"].includes(specifier));

                        if (_reference) {
                            _type = rt.makeReferenceType(_basetype);
                        } else {
                            const _pointer = _param.Declarator.Declarator.Pointer;
                            _type = interp.buildRecursivePointerType(_pointer, _basetype, 0);
                        }

                        if (_param.Declarator.Declarator.left.type === "DirectDeclarator") {
                            const __basetype = param.basetype;
                            param.basetype = _basetype;
                            const { name, type } = yield* interp.visit(interp, _param.Declarator.Declarator.left, param);
                            param.basetype = __basetype;
                            _name = name;
                        } else {
                            _name = _param.Declarator.Declarator.left.Identifier;
                        }
                        if (_param.Declarator.Declarator.right.length > 0) {
                            if (_param.Declarator.Declarator.right[0].type === "DirectDeclarator_modifier_ParameterTypeList") {
                                const dim = _param.Declarator.Declarator.right[0];
                                param.insideDirectDeclarator_modifier_ParameterTypeList = true;
                                const {argTypes: _argTypes , argNames: _argNames, optionalArgs: _optionalArgs} = yield* interp.visit(interp, dim.ParameterTypeList, param);
                                param.insideDirectDeclarator_modifier_ParameterTypeList = false;
                                _type = rt.functionPointerType(_type, _argTypes);
                            } else {
                                const dimensions = [];
                                let j = 0;
                                while (j < _param.Declarator.Declarator.right.length) {
                                    let dim = _param.Declarator.Declarator.right[j];
                                    if (dim.type !== "DirectDeclarator_modifier_array") {
                                        rt.raiseException("unacceptable array initialization", dim);
                                    }
                                    if (dim.Expression !== null) {
                                        dim = rt.cast(rt.intTypeLiteral, (yield* interp.visit(interp, dim.Expression, param))).v;
                                    } else if (j > 0) {
                                        rt.raiseException("multidimensional array must have bounds for all dimensions except the first", dim);
                                    } else {
                                        dim = -1;
                                    }
                                    dimensions.push(dim);
                                    j++;
                                }
                                _type = interp.arrayType(dimensions, _type);
                            }
                        }
                    }
                    if (_init != null) {
                        optionalArgs.push({
                            type: _type,
                            name: _name,
                            expression: _init.Expression
                        });
                    } else {
                        if (optionalArgs.length > 0) {
                            rt.raiseException("all default arguments must be at the end of arguments list", _param);
                        }
                        argTypes.push(_type);
                        argNames.push(_name);
                        readonlyArgs.push(_readonly);
                    }
                    i++;
                }
                return { argTypes, argNames, optionalArgs, readonlyArgs };
            },
            *FunctionDefinition(interp, s, param) {
                ({
                    rt
                } = interp);
                const {
                    scope
                } = param;
                const name = s.Declarator.left.Identifier;
                let basetype = rt.simpleType(s.DeclarationSpecifiers);
                const pointer = s.Declarator.Pointer;
                basetype = interp.buildRecursivePointerType(pointer, basetype, 0);
                let ptl;
                let varargs;
                if (s.Declarator.right.type === "DirectDeclarator_modifier_ParameterTypeList") {
                    ptl = s.Declarator.right.ParameterTypeList;
                    ({
                        varargs
                    } = ptl);
                } else if ((s.Declarator.right.type === "DirectDeclarator_modifier_IdentifierList") && (s.Declarator.right.IdentifierList === null)) {
                    ptl = { ParameterList: [] };
                    varargs = false;
                } else {
                    rt.raiseException("unacceptable argument list", s.Declarator.right);
                }
                const { argTypes , argNames, optionalArgs, readonlyArgs } = yield* interp.visit(interp, ptl, param);
                const stat = s.CompoundStatement;
                rt.defFunc(scope, name, basetype, argTypes, argNames, stat, interp, optionalArgs, readonlyArgs);
            },
            *Declaration(interp, s, param) {
                const { rt } = interp;
                const deducedType = s.DeclarationSpecifiers.includes("auto");
                const readonly = s.DeclarationSpecifiers.some((specifier: any) => ["const", "static"].includes(specifier));
                const basetype = deducedType ? (param.deducedType ?? (yield* interp.visit(interp, s.InitDeclaratorList[0].Initializers, param)).t) : rt.simpleType(s.DeclarationSpecifiers);

                for (const dec of s.InitDeclaratorList) {
                    let visitResult;
                    {
                        const _basetype = param.basetype;
                        param.basetype = basetype;
                        visitResult = yield* interp.visit(interp, dec.Declarator, param);
                        param.basetype = _basetype;
                    }
                    const { name, type } = visitResult;
                    let init = dec.Initializers;

                    if (dec.Declarator.right.length > 0) {
                        if (dec.Declarator.right[0].type === "DirectDeclarator_modifier_array") {
                            const dimensions = [];
                            for (let j = 0; j < dec.Declarator.right.length; j++) {
                                let dim = dec.Declarator.right[j];
                                if (dim.Expression !== null) {
                                    dim = rt.cast(rt.intTypeLiteral, (yield* interp.visit(interp, dim.Expression, param))).v;
                                } else if (j > 0) {
                                    rt.raiseException("multidimensional array must have bounds for all dimensions except the first", dim);
                                } else {
                                    if (init.type === "Initializer_expr") {
                                        const initializer: Variable = yield* interp.visit(interp, init, param);
                                        if (rt.isCharType(basetype) && rt.isArrayType(initializer) && rt.isCharType(initializer.t.eleType)) {
                                            // string init
                                            dim = initializer.v.target.length;
                                            init = {
                                                type: "Initializer_array",
                                                Initializers: initializer.v.target.map(e => ({
                                                    type: "Initializer_expr",
                                                    shorthand: e
                                                }))
                                            };
                                        } else {
                                            rt.raiseException("cannot initialize an array to " + rt.makeValString(initializer), init);
                                        }
                                    } else {
                                        dim = init.Initializers.length;
                                    }
                                }
                                dimensions.push(dim);
                            }

                            param.node = init;
                            init = yield* interp.arrayInit(dimensions, init, basetype, param);
                            delete param.node;

                            init.dataType = dec.Declarator.left.DataType;
                            init.readonly = readonly;
                            rt.defVar(name, init.t, init);
                        } else if (dec.Declarator.right[0].type === "DirectDeclarator_modifier_Constructor") {
                            const constructorArgs = [];
                            for (const dim of dec.Declarator.right) {
                                if (dim.Expressions !== null) {
                                    for (const argumentExpression of dim.Expressions) {
                                        const resolvedArgument = yield* interp.visit(interp, argumentExpression, param);
                                        constructorArgs.push(resolvedArgument);
                                    }
                                }
                            }
                            init = rt.makeConstructor(type, constructorArgs, true);

                            init.dataType = dec.Declarator.left.DataType;
                            init.readonly = readonly;
                            rt.defVar(name, type, init);
                        }
                    } else {
                        if (init == null) {
                            init = rt.defaultValue(type, true);
                        } else {
                            init = yield* interp.visit(interp, init.Expression);
                        }

                        init.dataType = dec.Declarator.left.DataType;
                        init.readonly = readonly;
                        rt.defVar(name, type, init);
                    }
                }
            },
            *STLDeclaration(interp, s, param) {
                ({ rt } = interp);

                const basetype = rt.simpleType(s.DeclarationSpecifiers);
                if (!rt.isVectorClass(basetype))
                    rt.raiseException("Only vectors are currently supported for STL Declaration!");

                const vectorClass: any = rt.defaultValue(basetype, true);

                const STLType = rt.simpleType(s.Type);
                if (s.Initializer != null) {
                    const initializer: any = yield* interp.arrayInit([s.Initializer.Initializers.length], s.Initializer, STLType, param);
                    vectorClass.v.members.element_container.elements = initializer.v.target;
                }

                vectorClass.dataType = vectorClass.v.members.element_container.dataType = STLType;
                vectorClass.readonly = false;
                rt.defVar(s.Identifier, basetype, vectorClass);
            },
            /**
             * `struct` / `class` declaration.
             *
             * The heavy lifting lives in ./classes, which documents how a class
             * is assembled and why it costs so little. The order here is load
             * bearing: the type is registered BEFORE its member declarators are
             * visited, so a member may refer to the class being declared —
             * `Node* next;` inside `struct Node`. `newStruct` closes over the
             * descriptor array by reference, so filling it afterwards is what
             * makes that work.
             */
            *StructDeclaration(interp, s, param) {
                ({ rt } = interp);

                const body = classes.splitClassBody(s.StructMemberList);
                const base = classes.resolveBaseClass(rt, s.Base ?? null);

                for (const identifier of s.DeclarationIdentifiers) {
                    // Inherited fields come first so the derived layout extends
                    // the base's, and their initialisers ride along unchanged.
                    const members: any[] = base ? [...base.members] : [];

                    let structType;
                    if (s.InitVariables) {
                        structType = rt.newStruct(`initialized_struct_${identifier}`, members);
                    } else {
                        structType = rt.newStruct(identifier, members);
                    }

                    yield* classes.buildMemberDescriptors(interp, rt, body.dataMembers, members, param);

                    if (s.InitVariables) {
                        rt.defVar(identifier, structType, rt.defaultValue(structType));
                    }

                    if (base != null) {
                        classes.inheritHandlers(rt, structType, base);
                    }

                    const memberNames = members.map((member: any) => member.name);
                    const methodNames = body.methods
                        .map((method: any) => method.Declarator.left.Identifier)
                        .concat(base ? base.methodNames : []);

                    yield* classes.installConstructors(
                        interp, rt, structType, identifier, body.constructors, memberNames, base, param);

                    for (const method of body.methods) {
                        yield* classes.defineMethod(
                            interp, rt, structType, method, memberNames, methodNames, param);
                    }
                }
            },
            /**
             * `new T` and `new T[n]`.
             *
             * Both allocate through the same array machinery a stack array uses,
             * so the result is an ordinary array pointer and indexing,
             * dereference and pointer arithmetic all keep working with no new
             * code paths. A scalar `new T` is an array of one, which makes `*p`
             * and `p[0]` both correct without a second representation.
             */
            *NewExpression(interp, s, param) {
                ({ rt } = interp);

                const elementType = rt.simpleType(s.TypeSpecifiers);
                let count = 1;

                if (s.Size != null) {
                    const size = yield* interp.visit(interp, s.Size, param);
                    count = rt.cast(rt.intTypeLiteral, size).v;
                    if (!(count >= 0)) {
                        rt.raiseException("cannot allocate an array of negative size");
                    }
                }

                return rt.defaultValue(rt.arrayPointerType(elementType, count), true);
            },
            /**
             * `delete` and `delete[]`.
             *
             * The operand is evaluated for its side effects, then nothing is
             * freed: allocations live on the JavaScript heap and are reclaimed
             * by its collector. It is accepted rather than rejected because
             * students are taught to write it, and refusing to parse correct C++
             * would be the worse failure.
             */
            *DeleteExpression(interp, s, param) {
                ({ rt } = interp);
                yield* interp.visit(interp, s.Expression, param);
                return undefined;
            },
            *Initializer_expr(interp, s, param) {
                ({
                    rt
                } = interp);
                return yield* interp.visit(interp, s.Expression, param);
            },
            *Label_case(interp, s, param) {
                ({
                    rt
                } = interp);
                const ce = yield* interp.visit(interp, s.ConstantExpression);
                if (param["switch"] === undefined) {
                    rt.raiseException("you cannot use case outside switch block");
                }
                if (param.scope === "SelectionStatement_switch_cs") {
                    return [
                        "switch",
                        rt.cast(ce.t, param["switch"]).v === ce.v
                    ];
                } else {
                    rt.raiseException("you can only use case directly in a switch block");
                }
            },
            Label_default(interp, s, param) {
                ({
                    rt
                } = interp);
                if (param["switch"] === undefined) {
                    rt.raiseException("you cannot use default outside switch block");
                }
                if (param.scope === "SelectionStatement_switch_cs") {
                    return [
                        "switch",
                        true
                    ];
                } else {
                    rt.raiseException("you can only use default directly in a switch block");
                }
            },
            *CompoundStatement(interp, s, param) {
                let stmt;
                ({
                    rt
                } = interp);
                const stmts = s.Statements;
                let r;
                let i;
                const _scope = param.scope;
                if (param.scope === "SelectionStatement_switch") {
                    param.scope = "SelectionStatement_switch_cs";
                    rt.enterScope(param.scope);
                    let switchon = false;
                    i = 0;
                    while (i < stmts.length) {
                        stmt = stmts[i];
                        if ((stmt.type === "Label_case") || (stmt.type === "Label_default")) {
                            r = yield* interp.visit(interp, stmt, param);
                            if (r[1]) {
                                switchon = true;
                            }
                        } else if (switchon) {
                            r = yield* interp.visit(interp, stmt, param);
                            if (r instanceof Array) {
                                return r;
                            }
                        }
                        i++;
                    }
                    rt.exitScope(param.scope);
                    param.scope = _scope;
                } else {
                    param.scope = "CompoundStatement";
                    rt.enterScope(param.scope);
                    for (stmt of stmts) {
                        r = yield* interp.visit(interp, stmt, param);
                        if (r instanceof Array) {
                            break;
                        }
                    }
                    rt.exitScope(param.scope);
                    param.scope = _scope;
                    return r;
                }
            },
            *ExpressionStatement(interp, s, param) {
                ({
                    rt
                } = interp);
                if (s.Expression != null) {
                    yield* interp.visit(interp, s.Expression, param);
                }
            },
            *SelectionStatement_if(interp, s, param) {
                ({
                    rt
                } = interp);
                const scope_bak = param.scope;
                param.scope = "SelectionStatement_if";
                rt.enterScope(param.scope);
                const e = yield* interp.visit(interp, s.Expression, param);
                let ret;
                if (rt.cast(rt.boolTypeLiteral, rt.captureValue(e)).v) {
                    ret = yield* interp.visit(interp, s.Statement, param);
                } else if (s.ElseStatement) {
                    ret = yield* interp.visit(interp, s.ElseStatement, param);
                }
                rt.exitScope(param.scope);
                param.scope = scope_bak;
                return ret;
            },
            *SelectionStatement_switch(interp, s, param) {
                ({
                    rt
                } = interp);
                const scope_bak = param.scope;
                param.scope = "SelectionStatement_switch";
                rt.enterScope(param.scope);
                const e = yield* interp.visit(interp, s.Expression, param);
                const switch_bak = param["switch"];
                param["switch"] = e;
                const r = yield* interp.visit(interp, s.Statement, param);
                param["switch"] = switch_bak;
                let ret;
                if (r instanceof Array) {
                    if (r[0] !== "break") {
                        ret = r;
                    }
                }
                rt.exitScope(param.scope);
                param.scope = scope_bak;
                return ret;
            },
            *IterationStatement_while(interp, s, param) {
                let return_val;
                ({
                    rt
                } = interp);
                const scope_bak = param.scope;
                param.scope = "IterationStatement_while";
                rt.enterScope(param.scope);
                while (true) {
                    if (s.Expression != null) {
                        let cond = yield* interp.visit(interp, s.Expression, param);
                        cond = rt.cast(rt.boolTypeLiteral, rt.captureValue(cond)).v;
                        if (!cond) { break; }
                    }
                    const r = yield* interp.visit(interp, s.Statement, param);
                    if (r instanceof Array) {
                        let end_loop;
                        switch (r[0]) {
                            case "continue":
                                break;
                            case "break":
                                end_loop = true;
                                break;
                            case "return":
                                return_val = r;
                                end_loop = true;
                                break;
                        }
                        if (end_loop) { break; }
                    }
                }
                rt.exitScope(param.scope);
                param.scope = scope_bak;
                return return_val;
            },
            *IterationStatement_do(interp, s, param) {
                let return_val;
                ({
                    rt
                } = interp);
                const scope_bak = param.scope;
                param.scope = "IterationStatement_do";
                rt.enterScope(param.scope);
                while (true) {
                    const r = yield* interp.visit(interp, s.Statement, param);
                    if (r instanceof Array) {
                        let end_loop;
                        switch (r[0]) {
                            case "continue":
                                break;
                            case "break":
                                end_loop = true;
                                break;
                            case "return":
                                return_val = r;
                                end_loop = true;
                                break;
                        }
                        if (end_loop) { break; }
                    }
                    if (s.Expression != null) {
                        let cond = yield* interp.visit(interp, s.Expression, param);
                        cond = rt.cast(rt.boolTypeLiteral, rt.captureValue(cond)).v;
                        if (!cond) { break; }
                    }
                }
                rt.exitScope(param.scope);
                param.scope = scope_bak;
                return return_val;
            },
            *IterationStatement_foreach(interp, s, param) {
                let return_val;
                ({ rt } = interp);
                const scope_bak = param.scope;
                param.scope = "IterationStatement_foreach";
                rt.enterScope(param.scope);

                const iterable = yield* interp.visit(interp, s.Expression, param);

                if (s.Initializer) {
                    param.deducedType = iterable.dataType ?? iterable.t;

                    yield* interp.visit(interp, s.Initializer, param);
                }

                const variable = rt.readVar(s.Initializer.InitDeclaratorList[0].Declarator.left.Identifier);
                let iterator = null;
                try {
                    iterator = rt.getFunc(iterable.t, "__iterator", [])(rt, iterable);
                } catch(ex) {
                    if (rt.isArrayType(iterable.t) || rt.isStringType(iterable.t)) {
                        iterator = iterable.v.target[Symbol.iterator]();
                    }
                }

                if (!iterator) {
                    rt.raiseException(`Variable '${s.Expression.Identifier}' is not iterator type.`);
                }

                for (const element of iterator) {
                    variable.v = element.v;

                    const r = yield* interp.visit(interp, s.Statement, param);
                    if (r instanceof Array) {
                        let end_loop;
                        switch (r[0]) {
                            case "continue":
                                break;
                            case "break":
                                end_loop = true;
                                break;
                            case "return":
                                return_val = r;
                                end_loop = true;
                                break;
                        }
                        if (end_loop) { break; }
                    }
                }

                rt.exitScope(param.scope);
                param.scope = scope_bak;
                return return_val;
            },
            *IterationStatement_for(interp, s, param) {
                let return_val;
                ({
                    rt
                } = interp);
                const scope_bak = param.scope;
                param.scope = "IterationStatement_for";
                rt.enterScope(param.scope);
                if (s.Initializer) {
                    if (s.Initializer.type === "Declaration") {
                        yield* interp.visit(interp, s.Initializer, param);
                    } else {
                        yield* interp.visit(interp, s.Initializer, param);
                    }
                }
                while (true) {
                    if (s.Expression != null) {
                        let cond = yield* interp.visit(interp, s.Expression, param);
                        cond = rt.cast(rt.boolTypeLiteral, rt.captureValue(cond)).v;
                        if (!cond) { break; }
                    }
                    const r = yield* interp.visit(interp, s.Statement, param);
                    if (r instanceof Array) {
                        let end_loop;
                        switch (r[0]) {
                            case "continue":
                                break;
                            case "break":
                                end_loop = true;
                                break;
                            case "return":
                                return_val = r;
                                end_loop = true;
                                break;
                        }
                        if (end_loop) { break; }
                    }
                    if (s.Loop) {
                        yield* interp.visit(interp, s.Loop, param);
                    }
                }
                rt.exitScope(param.scope);
                param.scope = scope_bak;
                return return_val;
            },
            JumpStatement_goto(interp, s, param) {
                ({
                    rt
                } = interp);
                rt.raiseException("not implemented");
            },
            JumpStatement_continue(interp, s, param) {
                ({
                    rt
                } = interp);
                return ["continue"];
            },
            JumpStatement_break(interp, s, param) {
                ({
                    rt
                } = interp);
                return ["break"];
            },
            *JumpStatement_return(interp, s, param) {
                ({
                    rt
                } = interp);
                if (s.Expression) {
                    let ret = yield* interp.visit(interp, s.Expression, param);
                    ret = interp.rt.captureValue(ret);

                    return [
                        "return",
                        ret
                    ];
                }
                return ["return"];
            },
            IdentifierExpression(interp, s, param) {
                ({ rt } = interp);

                const globalScope = rt.scope.find((scope) => scope.$name === "global");
                const currentScope = rt.scope[rt.scope.length - 1];
                const declarationScope = rt.scope.slice().reverse().find((scope, idx) => scope.$name.includes("function") && rt.scope[idx + 1].$name === "CompoundStatement") || ({ variables: {} }) as RuntimeScope;

                const varname = resolveIdentifier(s.Identifier);
                return rt.readScopedVar(currentScope, varname) || rt.readScopedVar(declarationScope, varname) || rt.readScopedVar(globalScope, varname) || rt.getFromNamespace(varname) || rt.readVar(varname);
            },
            *ParenthesesExpression(interp, s, param) {
                ({
                    rt
                } = interp);
                return yield* interp.visit(interp, s.Expression, param);
            },
            *PostfixExpression_ArrayAccess(interp, s, param) {
                ({
                    rt
                } = interp);
                const ret = yield* interp.visit(interp, s.Expression, param);
                const index = yield* interp.visit(interp, s.index, param);

                param.structType = ret.t.eleType;
                const r = rt.getFunc(ret.t, rt.makeOperatorFuncName("[]"), [index.t])(rt, ret, index);
                if (isGenerator(r)) {
                    return yield* r;
                } else {
                    return r;
                }
            },
            *PostfixExpression_MethodInvocation(interp, s, param) {
                let bindThis;
                ({
                    rt
                } = interp);

                // `Student("Ada", 88)` — a type name in call position constructs
                // a temporary rather than calling a function. This is checked
                // before the callee is evaluated, because evaluating a type name
                // as a variable is exactly what fails ("variable Student does
                // not exist"). Only a bare identifier that names a struct or
                // class is treated this way, so ordinary calls are untouched.
                if (s.Expression.type === "IdentifierExpression") {
                    const typeName = s.Expression.Identifier;
                    const candidate = { type: "struct", name: typeName };
                    if (!rt.varAlreadyDefined(typeName)
                        && (rt.getTypeSignature(candidate) in rt.types)) {
                        const constructorArgs: Variable[] = [];
                        for (const argument of s.args) {
                            constructorArgs.push(rt.captureValue(yield* interp.visit(interp, argument, param)));
                        }
                        return rt.makeConstructor(candidate as any, constructorArgs, false);
                    }
                }

                const ret = yield* interp.visit(interp, s.Expression, param);
                // console.log "==================="
                // console.log "s: " + JSON.stringify(s)
                // console.log "==================="
                const args: Variable[] = yield* (function* () {
                    const result = [];
                    for (const e of s.args) {
                        let thisArg = yield* interp.visit(interp, e, param);
                        thisArg = interp.rt.captureValue(thisArg);
                        // console.log "-------------------"
                        // console.log "e: " + JSON.stringify(e)
                        // console.log "-------------------"
                        result.push(thisArg);
                    }
                    return result;
                }).call(this);

                // console.log "==================="
                // console.log "ret: " + JSON.stringify(ret)
                // console.log "args: " + JSON.stringify(args)
                // console.log "==================="
                if (ret.v.bindThis != null) {
                    ({
                        bindThis
                    } = ret.v);
                } else {
                    bindThis = ret;
                }
                const r = rt.getFunc(ret.t, rt.makeOperatorFuncName("()"), args.map(e => e.t))(rt, ret, bindThis, ...args);
                if (isGenerator(r)) {
                    return yield* r;
                } else {
                    return r;
                }
            },
            *PostfixExpression_MemberAccess(interp, s, param) {
                ({
                    rt
                } = interp);
                const ret = yield* interp.visit(interp, s.Expression, param);
                return rt.getMember(ret, s.member);
            },
            *PostfixExpression_MemberPointerAccess(interp, s, param) {
                let r;
                ({
                    rt
                } = interp);
                let ret = yield* interp.visit(interp, s.Expression, param);
                if (rt.isPointerType(ret.t) && !rt.isFunctionType(ret.t)) {
                    const {
                        member
                    } = s;
                    // The default -> handlers are plain functions, but this call
                    // site assumed generators — `yield*` over a plain return is
                    // "not iterable", which broke p->x on every plain pointer.
                    // Accept both shapes.
                    const arrowResult = rt.getFunc(ret.t, rt.makeOperatorFuncName("->"), [])(rt, ret);
                    ret = (arrowResult != null && typeof arrowResult.next === "function")
                        ? yield* arrowResult
                        : arrowResult;
                    return rt.getMember(ret, member);
                } else {
                    const member = yield* interp.visit(interp, {
                        type: "IdentifierExpression",
                        Identifier: s.member
                    }, param);
                    ret = yield* rt.getFunc(ret.t, rt.makeOperatorFuncName("->"), [member.t])(rt, ret);
                    return rt.getMember(ret, member);
                }
            },
            *PostfixExpression_PostIncrement(interp, s, param) {
                ({
                    rt
                } = interp);
                const ret = yield* interp.visit(interp, s.Expression, param);
                const r = rt.getFunc(ret.t, rt.makeOperatorFuncName("++"), ["dummy"])(rt, ret, {
                    t: "dummy",
                    v: null
                }
                );
                if (isGenerator(r)) {
                    return yield* r;
                } else {
                    return r;
                }
            },
            *PostfixExpression_PostDecrement(interp, s, param) {
                ({
                    rt
                } = interp);
                const ret = yield* interp.visit(interp, s.Expression, param);
                const r = rt.getFunc(ret.t, rt.makeOperatorFuncName("--"), ["dummy"])(rt, ret, {
                    t: "dummy",
                    v: null
                }
                );
                if (isGenerator(r)) {
                    return yield* r;
                } else {
                    return r;
                }
            },
            *UnaryExpression_PreIncrement(interp, s, param) {
                ({
                    rt
                } = interp);
                const ret = yield* interp.visit(interp, s.Expression, param);
                const r = rt.getFunc(ret.t, rt.makeOperatorFuncName("++"), [])(rt, ret);
                if (isGenerator(r)) {
                    return yield* r;
                } else {
                    return r;
                }
            },
            *UnaryExpression_PreDecrement(interp, s, param) {
                ({
                    rt
                } = interp);
                const ret = yield* interp.visit(interp, s.Expression, param);
                const r = rt.getFunc(ret.t, rt.makeOperatorFuncName("--"), [])(rt, ret);
                if (isGenerator(r)) {
                    return yield* r;
                } else {
                    return r;
                }
            },
            *UnaryExpression(interp, s, param) {
                ({
                    rt
                } = interp);
                let ret = yield* interp.visit(interp, s.Expression, param);
                // An array element is a reference until it is captured, so `!a[i]`
                // asked the wrong type for its operator and came out always true —
                // which quietly breaks every `if (!visited[i])` in a graph walk.
                // & and * must keep the reference, so they are left alone.
                if (["!", "~", "-", "+"].includes(s.op)) ret = rt.captureValue(ret);
                const r = rt.getFunc(ret.t, rt.makeOperatorFuncName(s.op), [])(rt, ret);
                if (isGenerator(r)) {
                    return yield* r;
                } else {
                    return r;
                }
            },
            *UnaryExpression_Sizeof_Expr(interp, s, param) {
                ({
                    rt
                } = interp);
                let ret = yield* interp.visit(interp, s.Expression, param);
                ret = rt.captureValue(ret);
                return rt.val(rt.intTypeLiteral, rt.getSize(ret));
            },
            *UnaryExpression_Sizeof_Type(interp, s, param) {
                ({
                    rt
                } = interp);
                const type = yield* interp.visit(interp, s.TypeName, param);
                return rt.val(rt.intTypeLiteral, rt.getSizeByType(type));
            },
            *CastExpression(interp, s, param) {
                ({
                    rt
                } = interp);
                let ret = yield* interp.visit(interp, s.Expression, param);
                ret = rt.clone(rt.captureValue(ret));
                const type = yield* interp.visit(interp, s.TypeName, param);
                return rt.cast(type, ret);
            },
            TypeName(interp, s, param) {
                ({
                    rt
                } = interp);
                const typename = [];
                for (const baseType of s.base) {
                    if (baseType !== "const") {
                        typename.push(baseType);
                    }
                }
                return rt.simpleType(typename);
            },
            *BinOpExpression(interp, s, param) {
                ({
                    rt
                } = interp);
                const {
                    op
                } = s;
                if (op === "&&") {
                    s.type = "LogicalANDExpression";
                    return yield* interp.visit(interp, s, param);
                } else if (op === "||") {
                    s.type = "LogicalORExpression";
                    return yield* interp.visit(interp, s, param);
                } else {
                    let left = yield* interp.visit(interp, s.left, param);
                    let right = yield* interp.visit(interp, s.right, param);
                    left = rt.captureValue(left);
                    right = rt.captureValue(right);
                    const r = rt.getFunc(left.t, rt.makeOperatorFuncName(op), [right.t])(rt, left, right);
                    if (isGenerator(r)) {
                        return yield* r;
                    } else {
                        return r;
                    }
                }
            },
            *LogicalANDExpression(interp, s, param) {
                let right;
                ({
                    rt
                } = interp);
                const left = yield* interp.visit(interp, s.left, param);
                const lt = rt.types[rt.getTypeSignature(left.t)];
                if ("&&" in lt) {
                    right = yield* interp.visit(interp, s.right, param);
                    const r = rt.getFunc(left.t, rt.makeOperatorFuncName("&&"), [right.t])(rt, left, right);
                    if (isGenerator(r)) {
                        return yield* r;
                    } else {
                        return r;
                    }
                } else {
                    if (rt.cast(rt.boolTypeLiteral, rt.captureValue(left)).v) {
                        return yield* interp.visit(interp, s.right, param);
                    } else {
                        return left;
                    }
                }
            },
            *LogicalORExpression(interp, s, param) {
                let right;
                ({
                    rt
                } = interp);
                const left = yield* interp.visit(interp, s.left, param);
                const lt = rt.types[rt.getTypeSignature(left.t)];
                if ("||" in lt) {
                    right = yield* interp.visit(interp, s.right, param);
                    const r = rt.getFunc(left.t, rt.makeOperatorFuncName("||"), [right.t])(rt, left, right);
                    if (isGenerator(r)) {
                        return yield* r;
                    } else {
                        return r;
                    }
                } else {
                    if (rt.cast(rt.boolTypeLiteral, rt.captureValue(left)).v) {
                        return left;
                    } else {
                        return yield* interp.visit(interp, s.right, param);
                    }
                }
            },
            *ConditionalExpression(interp, s, param) {
                ({
                    rt
                } = interp);
                const cond = rt.cast(rt.boolTypeLiteral, rt.captureValue(yield* interp.visit(interp, s.cond, param))).v;
                if (cond) { return yield* interp.visit(interp, s.t, param); } else { return yield* interp.visit(interp, s.f, param); }
            },
            *ConstantExpression(interp, s, param) {
                ({
                    rt
                } = interp);
                return yield* interp.visit(interp, s.Expression, param);
            },
            *StringLiteralExpression(interp, s, param) {
                return yield* interp.visit(interp, s.value, param);
            },
            *StructExpression(interp, s, param) {
                ({ rt } = interp);

                const convertToObjectArray = function*(expr: any) {
                    if (expr.type === 'StructExpression') {
                        return expr.values.map((value: any) => convertToObjectArray(value.Expression).next().value);
                    } else {
                        return yield* interp.visit(interp, expr, param);
                    }
                };

                const valuesToStruct = function(arrayValues: any) {
                    const fillerStruct: any = rt.defaultValue(param.structType);
                    const orderedKeys = Object.keys(fillerStruct.v.members);

                    for (let k = 0; k < arrayValues.length; k++) {
                        const memberName = orderedKeys[k];
                        const memberValue = arrayValues[k];
                        fillerStruct.v.members[memberName].v = memberValue.v;
                    }

                    return fillerStruct;
                };

                const arrayValues = yield* convertToObjectArray(s);

                if (Array.isArray(arrayValues[0])) {
                    const structArray = [];
                    for (const valueArray of arrayValues) {
                        structArray.push(valuesToStruct(valueArray));
                    }
                    return rt.val(rt.arrayPointerType(param.structType, structArray.length), rt.makeArrayPointerValue(structArray, 0));
                }

                return valuesToStruct(arrayValues);
            },
            StringLiteral(interp, s, param) {
                ({
                    rt
                } = interp);
                switch (s.prefix) {
                    case null:
                        let maxCode = -1;
                        let minCode = 1;
                        for (const i of s.value) {
                            const code = i.charCodeAt(0);
                            if (maxCode < code) { maxCode = code; }
                            if (minCode > code) { minCode = code; }
                        }
                        const {
                            limits
                        } = rt.config;
                        const typeName = (maxCode <= limits["char"].max) && (minCode >= limits["char"].min) ? "char" : "wchar_t";
                        return rt.makeCharArrayFromString(s.value, typeName);
                    case "L":
                        return rt.makeCharArrayFromString(s.value, "wchar_t");
                    case "u8":
                        return rt.makeCharArrayFromString(s.value, "char");
                    case "u":
                        return rt.makeCharArrayFromString(s.value, "char16_t");
                    case "U":
                        return rt.makeCharArrayFromString(s.value, "char32_t");
                }
            },
            BooleanConstant(interp, s, param) {
                ({
                    rt
                } = interp);
                return rt.val(rt.boolTypeLiteral, s.value === "true" ? 1 : 0);
            },
            CharacterConstant(interp, s, param) {
                ({
                    rt
                } = interp);
                const a = s.Char;
                if (a.length !== 1) {
                    rt.raiseException("a character constant must have and only have one character.");
                }
                return rt.val(rt.charTypeLiteral, a[0].charCodeAt(0));
            },
            *FloatConstant(interp, s, param) {
                ({
                    rt
                } = interp);
                const val = yield* interp.visit(interp, s.Expression, param);
                return rt.val(rt.floatTypeLiteral, val.v);
            },
            DecimalConstant(interp, s, param) {
                ({
                    rt
                } = interp);
                return rt.val(rt.unsignedintTypeLiteral, parseInt(s.value, 10));
            },
            HexConstant(interp, s, param) {
                ({
                    rt
                } = interp);
                return rt.val(rt.unsignedintTypeLiteral, parseInt(s.value, 16));
            },
            BinaryConstant(interp, s, param) {
                ({
                    rt
                } = interp);
                return rt.val(rt.unsignedintTypeLiteral, parseInt(s.value, 2));
            },
            DecimalFloatConstant(interp, s, param) {
                ({
                    rt
                } = interp);
                return rt.val(rt.doubleTypeLiteral, parseFloat(s.value));
            },
            HexFloatConstant(interp, s, param) {
                ({
                    rt
                } = interp);
                return rt.val(rt.doubleTypeLiteral, parseInt(s.value, 16));
            },
            OctalConstant(interp, s, param) {
                ({
                    rt
                } = interp);
                return rt.val(rt.unsignedintTypeLiteral, parseInt(s.value, 8));
            },
            NamespaceDefinition(interp, s, param) {
                ({
                    rt
                } = interp);
                rt.raiseException("not implemented");
            },
            UsingDirective(interp, s, param) {
                ({ rt } = interp);

                const id = s.Identifier;
                const currentScope = rt.scope[rt.scope.length - 1];

                Object.assign(currentScope.variables, { ...rt.namespace[id], [id]: rt.namespace[id] });
            },
            UsingDeclaration(interp, s, param) {
                ({
                    rt
                } = interp);
                rt.raiseException("not implemented");
            },
            NamespaceAliasDefinition(interp, s, param) {
                ({
                    rt
                } = interp);
                rt.raiseException("not implemented");
            },
            unknown(interp, s, param) {
                ({
                    rt
                } = interp);
                rt.raiseException("unhandled syntax " + s.type);
            }
        };
    }

    *visit(interp: Interpreter, s: any, param?: any) {
        let ret;
        const {
            rt
        } = interp;
        // console.log(`${s.sLine}: visiting ${s.type}`);
        if ("type" in s) {
            if (param === undefined) {
                param = { scope: "global" };
            }
            const _node = this.currentNode;
            this.currentNode = s;
            if (s.type in this.visitors) {
                const f = this.visitors[s.type];
                if (isGeneratorFunction(f)) {
                    const x = f(interp, s, param);
                    if (x != null) {
                        if (isIterable(x)) {
                            ret = yield* x;
                        } else {
                            ret = yield x;
                        }
                    } else {
                        ret = yield null;
                    }
                } else {
                    yield (ret = f(interp, s, param));
                }
            } else {
                ret = this.visitors["unknown"](interp, s, param);
            }
            this.currentNode = _node;
        } else {
            this.currentNode = s;
            this.rt.raiseException("untyped syntax structure");
        }
        return ret;
    };

    *run(tree: any, source: string, param?: any) {
        if (tree.type === "TranslationUnit")
            this.processIncludes();

        this.rt.interp = this;
        this.source = source;
        return yield* this.visit(this, tree, param);
    };

    processIncludes() {
        const lastToLoad = ["iomanip"];
        const { includes, loadedLibraries } = this.rt.config;

        for (const lib of loadedLibraries) {
            if (lastToLoad.includes(lib))
                continue;

            includes[lib].load(this.rt);
        }

        for (const lib of lastToLoad) {
            if (!loadedLibraries.includes(lib))
                continue;

            includes[lib].load(this.rt);
        }
    };

    *arrayInit(dimensions: number[], init: any, type: VariableType, param: any): Generator<void, Variable, any> {
        if (dimensions.length > 0) {
            let val;
            const curDim = dimensions[0];
            if (init) {
                if ((init.type === "Initializer_array") && (init.Initializers != null && curDim >= init.Initializers.length)) {
                    // last level, short hand init
                    if (init.Initializers.length === 0) {
                        const arr = new Array(curDim);
                        let i = 0;
                        while (i < curDim) {
                            arr[i] = {
                                type: "Initializer_expr",
                                shorthand: this.rt.defaultValue(type)
                            };
                            i++;
                        }
                        init.Initializers = arr;
                    } else if ((init.Initializers.length === 1) && this.rt.isIntegerType(type)) {
                        val = this.rt.cast(type, (yield* this.visit(this, init.Initializers[0].Expression, param)));
                        if ((val.v === -1) || (val.v === 0)) {
                            const arr = new Array(curDim);
                            let i = 0;
                            while (i < curDim) {
                                arr[i] = {
                                    type: "Initializer_expr",
                                    shorthand: this.rt.val(type, val.v)
                                };
                                i++;
                            }
                            init.Initializers = arr;
                        } else {
                            const arr = new Array(curDim);
                            arr[0] = this.rt.val(type, -1);
                            let i = 1;
                            while (i < curDim) {
                                arr[i] = {
                                    type: "Initializer_expr",
                                    shorthand: this.rt.defaultValue(type)
                                };
                                i++;
                            }
                            init.Initializers = arr;
                        }
                    } else {
                        const arr = new Array(curDim);
                        let i = 0;
                        while (i < init.Initializers.length) {
                            const _init = init.Initializers[i];
                            let initval;
                            if ("shorthand" in _init) {
                                initval = _init;
                            } else {
                                if (_init.type === "Initializer_expr") {
                                    initval = {
                                        type: "Initializer_expr",
                                        shorthand: (yield* this.visit(this, _init.Expression, param))
                                    };
                                } else if (_init.type === "Initializer_array") {
                                    initval = {
                                        type: "Initializer_expr",
                                        shorthand: (yield* this.arrayInit(dimensions.slice(1), _init, type, param))
                                    };
                                } else {
                                    this.rt.raiseException("Not implemented initializer type: " + _init.type);
                                }
                            }
                            arr[i] = initval;
                            i++;
                        }
                        i = init.Initializers.length;
                        while (i < curDim) {
                            arr[i] = {
                                type: "Initializer_expr",
                                shorthand: this.rt.defaultValue(this.arrayType(dimensions.slice(1), type))
                            };
                            i++;
                        }
                        init.Initializers = arr;
                    }
                } else if (init.type === "Initializer_expr") {
                    let initializer: Variable;
                    if ("shorthand" in init) {
                        initializer = init.shorthand;
                    } else {
                        param.structType = type;
                        initializer = yield* this.visit(this, init, param);
                    }
                    if (this.rt.isArrayType(initializer) && this.rt.isTypeEqualTo(type, initializer.t.eleType)) {
                        init = {
                            type: "Initializer_array",
                            Initializers: initializer.v.target.map(e => ({
                                type: "Initializer_expr",
                                shorthand: e
                            }))
                        };
                    } else {
                        this.rt.raiseException("cannot initialize an array to " + this.rt.makeValString(initializer), param.node);
                    }
                } else {
                    this.rt.raiseException("dimensions do not agree, " + curDim + " != " + init.Initializers.length, param.node);
                }
            }
            {
                const arr: Variable[] = [];
                const ret = this.rt.val(this.arrayType(dimensions, type), this.rt.makeArrayPointerValue(arr, 0), true);
                let i = 0;
                while (i < curDim) {
                    if (init && (i < init.Initializers.length)) {
                        arr[i] = yield* this.arrayInit(dimensions.slice(1), init.Initializers[i], type, param);
                    } else {
                        arr[i] = yield* this.arrayInit(dimensions.slice(1), null, type, param);
                    }
                    i++;
                }
                return ret;
            }
        } else {
            if (init && (init.type !== "Initializer_expr")) {
                this.rt.raiseException("dimensions do not agree, too few initializers", param.node);
            }
            let initval;
            if (init) {
                if ("shorthand" in init) {
                    initval = init.shorthand;
                } else {
                    initval = yield* this.visit(this, init.Expression, param);
                }
            } else {
                initval = this.rt.defaultValue(type);
            }
            const ret = this.rt.cast(this.arrayType(dimensions, type), initval);
            ret.left = true;
            return ret;
        }
    };

    arrayType(dimensions: number[], type: any): ArrayType {
        if (dimensions.length > 0) {
            return this.rt.arrayPointerType(this.arrayType(dimensions.slice(1), type), dimensions[0]);
        } else {
            return type;
        }
    };

    buildRecursivePointerType(pointer: any, basetype: VariableType, level: number): VariableType {
        if (pointer && (pointer.length > level)) {
            const type = this.rt.normalPointerType(basetype);
            return this.buildRecursivePointerType(pointer, type, level + 1);
        } else {
            return basetype;
        }
    };
}
