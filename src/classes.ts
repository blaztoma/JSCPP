/**
 * C++ class support: classes, member functions, constructors and inheritance.
 *
 * WHY THIS IS SMALL
 * -----------------
 * The runtime already dispatches methods. `<vector>` registers `push_back` and
 * `<string>` registers `length` through `rt.regFunc(fn, type, name, ...)`, which
 * binds a function to a type and passes the receiver as `_this`. Overload
 * matching, member lookup and `_this` binding were therefore all present and
 * proven before any of this existed — the only thing missing was a way for user
 * code to reach them, which was a grammar gap rather than an architectural one.
 *
 * So a user-defined method is registered exactly the way a library method is,
 * and everything downstream is shared machinery.
 *
 * HOW A CLASS IS BUILT
 * --------------------
 *   1. `splitClassBody`     sorts the parsed body into data, methods and ctors.
 *   2. `resolveBaseClass`   looks up the base type, if the class derives.
 *   3. the type is registered EARLY, before member declarators are visited, so
 *      a member may refer to the class being declared (`Node* next`).
 *   4. `buildMemberDescriptors` fills the descriptor list in place.
 *   5. `inheritHandlers`    copies the base's methods onto the derived type.
 *   6. `installConstructors` wraps the type's constructor.
 *   7. `defineMethod`       registers each method on the type.
 *
 * DELIBERATE LIMITS
 * -----------------
 * `public` / `private` / `protected` and `const` are parsed but not enforced.
 * Accepting the syntax is what lets real class bodies through; enforcing
 * visibility incorrectly would be worse than not enforcing it at all.
 *
 * Inheritance is single and non-virtual: calls bind statically, so a base
 * pointer does not dispatch to a derived override. Base constructors are
 * chained without arguments (see `installConstructors`).
 */

/** One entry of a parsed class body, already sorted by kind. */
export interface ClassBody {
    /** `int n;` — declarations that become fields. */
    dataMembers: any[];
    /** `void f() { ... }` — member functions. */
    methods: any[];
    /** `C(int x) : n(x) { ... }` — constructors. */
    constructors: any[];
}

/** What a derived class needs to know about the class it extends. */
export interface BaseClassInfo {
    /** Member descriptors, prepended to the derived list so layout is inherited. */
    members: any[];
    /** The base's handler table, source for the inherited methods. */
    handlers: any;
    /** Method names only — used so a derived method can call an inherited one. */
    methodNames: string[];
    /** Runs the base's own constructor body, or null when it declares none. */
    runConstructor: ((rt: any, self: any, args: any[]) => void) | null;
}

/**
 * Where a type's constructor runner is stashed on its runtime type entry.
 *
 * A derived class has to run its base's constructor BODY without re-running the
 * base's member initialisation, because `newStruct`'s constructor resets
 * `v.members` and would wipe the derived fields. Keeping the body separately
 * addressable is what makes chaining possible.
 */
const CONSTRUCTOR_RUNNER = "__userConstructorRunner";

/** Guards the synchronous generator drives below against a non-terminating body. */
const MAX_CONSTRUCTOR_STEPS = 1000000;

// ─── Reading the class body ──────────────────────────────────────────────────

/** Sorts a parsed class body into data members, methods and constructors. */
export function splitClassBody(structMemberList: any[]): ClassBody {
    const body: ClassBody = { dataMembers: [], methods: [], constructors: [] };
    for (const entry of structMemberList) {
        switch (entry.type) {
            case "AccessSpecifier":
                // Parsed so that real class bodies are accepted; not enforced.
                break;
            case "StructMemberFunction":
                body.methods.push(entry);
                break;
            case "StructConstructor":
                body.constructors.push(entry);
                break;
            default:
                body.dataMembers.push(entry);
        }
    }
    return body;
}

/** Looks up the base class named in `class Derived : public Base`. */
export function resolveBaseClass(rt: any, baseName: string | null): BaseClassInfo | null {
    if (baseName == null) { return null; }

    const signature = rt.getTypeSignature({ type: "struct", name: baseName });
    if (!(signature in rt.types)) {
        rt.raiseException("base class '" + baseName + "' is not defined");
    }

    const entry = rt.types[signature];
    return {
        members: entry.members ?? [],
        handlers: entry.handlers,
        // Operator handlers are named "o(...)"; everything else is a method.
        methodNames: Object.keys(entry.handlers).filter((name: string) => !name.startsWith("o(")),
        runConstructor: entry[CONSTRUCTOR_RUNNER] ?? null,
    };
}

// ─── Fields ──────────────────────────────────────────────────────────────────

/**
 * Visits each data-member declarator and appends its descriptor to `into`.
 *
 * Appends rather than returns because the caller has already handed this same
 * array to `newStruct`, whose constructor closes over it by reference. That is
 * what lets a class refer to itself: the type exists before its members are
 * resolved, so `Node* next;` inside `struct Node` finds `Node` defined.
 */
export function* buildMemberDescriptors(interp: any, rt: any, dataMembers: any[], into: any[], param: any) {
    for (const member of dataMembers) {
        for (const declarator of member.Declarators) {
            param.basetype = rt.simpleType(member.MemberType);
            const { name, type } = yield* interp.visit(interp, declarator.Declarator, param);

            const initialValue = (declarator.Initializers == null)
                ? rt.defaultValue(type, true)
                : yield* interp.visit(interp, declarator.Initializers.Expression);

            into.push({
                name,
                type,
                initialize() {
                    initialValue.left = true;
                    return initialValue;
                },
            });
        }
    }
}

/**
 * Declares the instance's fields as ordinary variables in a method scope.
 *
 * The variable object is SHARED rather than passed through `rt.defVar`, which
 * deep-clones anything that is not a reference type. With a clone, `n = n + 1`
 * inside a method updates a copy and the instance never changes. Sharing the
 * l-value is precisely what the runtime's borrowed-variable design is for.
 */
function bindMembers(rt: any, scope: any, self: any, memberNames: string[]): void {
    for (const name of memberNames) {
        const member = rt.getMember(self, name);
        member.left = true;
        scope[name] = member;
    }
}

// ─── Inheritance ─────────────────────────────────────────────────────────────

/**
 * Copies the base class's methods onto the derived type.
 *
 * Each inherited name gets a FRESH handler object holding shallow copies of the
 * signature maps. An override registers the same name and signature, and
 * `regFunc` rejects a redefinition — so `defineMethod` deletes the inherited
 * entry first. Copying per derived type is what keeps that deletion local
 * instead of mutating the base class for every other subclass.
 *
 * Handlers the derived type already owns (`o(=)` and friends, installed by
 * `newStruct`) are left alone.
 */
export function inheritHandlers(rt: any, derivedType: any, base: BaseClassInfo): void {
    const derivedHandlers = rt.types[rt.getTypeSignature(derivedType)].handlers;

    for (const name of Object.keys(base.handlers)) {
        if (name in derivedHandlers) { continue; }

        const inherited = base.handlers[name];
        derivedHandlers[name] = (inherited && inherited.functions && inherited.reg)
            ? { ...inherited, functions: { ...inherited.functions }, reg: { ...inherited.reg } }
            : inherited;
    }
}

// ─── Constructors ────────────────────────────────────────────────────────────

/** A constructor, reduced to what invoking it needs. */
interface ConstructorDefinition {
    parameterNames: string[];
    parameterTypes: any[];
    /** `: n(x), m(y)` — assignments performed before the body. */
    initializerList: any[];
    body: any;
}

/**
 * Drives a generator to completion synchronously.
 *
 * Constructors run inside `cConstructor`, which the runtime calls as a plain
 * function, while interpreter bodies are generators. That suits the assignment
 * work constructors actually do; a constructor that blocks on input cannot
 * finish this way and is reported rather than left to hang.
 */
function runToCompletion(rt: any, generator: any, describe: () => string): any {
    let step = generator.next();
    let steps = 0;

    while (!step.done) {
        if (++steps > MAX_CONSTRUCTOR_STEPS) {
            rt.raiseException(describe() + " did not finish");
        }
        step = generator.next();
    }
    return step.value;
}

/** Chooses the constructor whose parameters best match the supplied arguments. */
function selectConstructor(
    rt: any,
    candidates: ConstructorDefinition[],
    args: any[],
    className: string,
): ConstructorDefinition | null {
    const viable: ConstructorDefinition[] = [];
    const costs: number[] = [];

    for (const candidate of candidates) {
        if (candidate.parameterNames.length !== args.length) { continue; }

        let cost = 0;
        let convertible = true;
        for (let i = 0; convertible && (i < args.length); i++) {
            const argumentType = args[i].t;
            const parameterType = candidate.parameterTypes[i];

            if (rt.isTypeEqualTo(argumentType, parameterType)) { continue; }
            if (!rt.castable(argumentType, parameterType)) { convertible = false; break; }
            cost += rt.rankConversion(argumentType, parameterType);
        }

        if (convertible) { viable.push(candidate); costs.push(cost); }
    }

    if (viable.length === 0) { return null; }
    if (viable.length === 1) { return viable[0]; }

    const best = Math.min(...costs);
    const winners = viable.filter((_, index) => costs[index] === best);
    if (winners.length > 1) {
        rt.raiseException(
            "ambiguous constructor call for '" + className + "': "
            + winners.length + " candidates match equally well");
    }
    return winners[0];
}

/**
 * Installs the class's constructors, chaining the base class's first.
 *
 * The wrapper runs three things in order:
 *
 *   1. the type's own member initialisation, which `newStruct` built from the
 *      descriptor list — this includes inherited fields and their default
 *      initialisers, and it resets `v.members`, so it must come first;
 *   2. the BASE class's constructor body, with no arguments, so a derived
 *      instance is properly initialised. Only the body runs: re-entering the
 *      base's full constructor would reset `v.members` and wipe the derived
 *      fields. Base constructors are not yet passed arguments, so
 *      `Derived() : Base(x)` is not supported;
 *   3. this class's own matching constructor body.
 *
 * A class that declares no constructor still installs the wrapper when it
 * derives from one that does, otherwise the base body would never run.
 */
export function* installConstructors(
    interp: any,
    rt: any,
    structType: any,
    className: string,
    constructors: any[],
    memberNames: string[],
    base: BaseClassInfo | null,
    param: any,
) {
    const inheritsConstructor = (base != null) && (base.runConstructor != null);
    if ((constructors.length === 0) && !inheritsConstructor) { return; }

    // Parameter names come from the interpreter's own visitor — the same call
    // `FunctionDefinition` makes — so the two cannot drift apart. It happens
    // here, in generator context, because `cConstructor` itself is synchronous.
    const definitions: ConstructorDefinition[] = [];
    for (const constructor of constructors) {
        const parameterList = (constructor.Declarator.right.type === "DirectDeclarator_modifier_ParameterTypeList")
            ? constructor.Declarator.right.ParameterTypeList
            : { ParameterList: [] };
        const resolved = yield* interp.visit(interp, parameterList, param);

        definitions.push({
            parameterNames: resolved.argNames ?? [],
            parameterTypes: resolved.argTypes ?? [],
            initializerList: constructor.InitList ?? [],
            body: constructor.CompoundStatement,
        });
    }

    /** Runs one constructor body over an already-initialised instance. */
    const runConstructorBody = (rtArg: any, self: any, args: any[]): void => {
        const argumentCount = args ? args.length : 0;
        const chosen = selectConstructor(rtArg, definitions, args ?? [], className);

        if (chosen == null) {
            // No declared constructor matches. With no arguments that is simply
            // the implicit default constructor, and member initialisation has
            // already happened.
            if (argumentCount === 0) { return; }
            rtArg.raiseException(
                "no constructor of '" + className + "' accepts these "
                + argumentCount + " argument(s)");
        }

        rtArg.enterScope("constructor " + className);
        const scope = rtArg.scope[rtArg.scope.length - 1].variables;

        scope["this"] = rtArg.val(rtArg.normalPointerType(structType), rtArg.makeNormalPointerValue(self));
        bindMembers(rtArg, scope, self, memberNames);

        chosen.parameterNames.forEach((name: string, index: number) => {
            if ((name != null) && (args[index] != null)) {
                scope[name] = rtArg.cast(chosen.parameterTypes[index], args[index]);
            }
        });

        // `: n(x)` behaves as `n = x`, in declaration order, before the body.
        for (const initializer of chosen.initializerList) {
            const member = scope[initializer.Member];
            if (member == null) {
                rtArg.raiseException(
                    "'" + initializer.Member + "' in the initializer list of '"
                    + className + "' is not a member");
            }
            if (initializer.Expression != null) {
                const value = runToCompletion(
                    rtArg,
                    interp.visit(interp, initializer.Expression),
                    () => "initializer of '" + initializer.Member + "'");
                member.v = rtArg.cast(member.t, value).v;
            }
        }

        runToCompletion(
            rtArg,
            interp.run(chosen.body, interp.source, { scope: "function" }),
            () => "constructor of '" + className + "'");

        rtArg.exitScope("constructor " + className);
    };

    /**
     * The body chain for this class: every ancestor's body, then its own.
     *
     * The chain is baked into the stored runner rather than into
     * `cConstructor`, because a grandchild reaches its grandparent only through
     * its parent's runner. A runner that covered just its own body would leave
     * the grandparent's out — three-level hierarchies silently lost the topmost
     * initialisation.
     */
    const runConstructorChain = (rtArg: any, self: any, args: any[]): void => {
        if (inheritsConstructor) { base!.runConstructor!(rtArg, self, []); }
        runConstructorBody(rtArg, self, args);
    };

    const typeEntry = rt.types[rt.getTypeSignature(structType)];
    const initialiseMembers = typeEntry.cConstructor;

    typeEntry[CONSTRUCTOR_RUNNER] = runConstructorChain;
    typeEntry.cConstructor = function (rtArg: any, self: any, args: any[] = []) {
        initialiseMembers(rtArg, self, []);
        runConstructorChain(rtArg, self, args);
    };
}

// ─── Methods ─────────────────────────────────────────────────────────────────

/**
 * Registers one member function on the class type.
 *
 * The body sees, in this order: `this`; the instance's fields; sibling methods,
 * so `inc()` resolves without writing `this->inc()`; and finally the parameters,
 * bound last so that a parameter shadows a field of the same name, as C++
 * requires and as `this->n = n` depends on.
 */
export function* defineMethod(
    interp: any,
    rt: any,
    structType: any,
    definition: any,
    memberNames: string[],
    methodNames: string[],
    param: any,
) {
    const name = definition.Declarator.left.Identifier;

    let returnType = rt.simpleType(definition.DeclarationSpecifiers);
    returnType = interp.buildRecursivePointerType(definition.Declarator.Pointer, returnType, 0);

    const parameterList = (definition.Declarator.right.type === "DirectDeclarator_modifier_ParameterTypeList")
        ? definition.Declarator.right.ParameterTypeList
        : { ParameterList: [] };
    const { argTypes, argNames, optionalArgs, readonlyArgs } = yield* interp.visit(interp, parameterList, param);
    const body = definition.CompoundStatement;

    const method = function* (rtArg: any, self: any, ...args: any[]) {
        rtArg.enterScope("method " + name);
        const scope = rtArg.scope[rtArg.scope.length - 1].variables;

        scope["this"] = rtArg.val(rtArg.normalPointerType(structType), rtArg.makeNormalPointerValue(self));
        bindMembers(rtArg, scope, self, memberNames);

        for (const sibling of methodNames) {
            if (sibling === name) { continue; }
            try {
                scope[sibling] = rtArg.getMember(self, sibling);
            } catch {
                // Declared later in the body, so not registered yet.
            }
        }

        argNames.forEach((argumentName: string, index: number) => {
            if (args[index] != null) {
                args[index].readonly = readonlyArgs[index];
                rtArg.defVar(argumentName, argTypes[index], args[index]);
            }
        });

        for (let i = 0; i < optionalArgs.length; i++) {
            const optional = optionalArgs[i];
            const supplied = args[argNames.length + i];
            if (supplied != null) {
                rtArg.defVar(optional.name, optional.type, supplied);
            } else {
                const fallback = yield* interp.visit(interp, optional.expression);
                rtArg.defVar(optional.name, optional.type, rtArg.cast(optional.type, fallback));
            }
        }

        let result = yield* interp.run(body, interp.source, { scope: "function" });

        if (!rtArg.isTypeEqualTo(returnType, rtArg.voidTypeLiteral)) {
            if ((result instanceof Array) && (result[0] === "return")) {
                result = rtArg.cast(returnType, result[1]);
            } else {
                rtArg.raiseException("method '" + name + "' must return a value");
            }
        } else {
            result = undefined;
        }

        rtArg.exitScope("method " + name);
        return result;
    };

    // An override carries the name and signature of the method it replaces, and
    // `regFunc` treats that as a redefinition. The inherited entry is this
    // type's own copy (see `inheritHandlers`), so removing it is local.
    const handlers = rt.types[rt.getTypeSignature(structType)].handlers;
    const signature = rt.makeParametersSignature(argTypes);
    if (handlers[name]?.functions?.[signature] != null) {
        delete handlers[name].functions[signature];
        delete handlers[name].reg[signature];
    }

    rt.regFunc(method, structType, name, argTypes, returnType, optionalArgs);
}
