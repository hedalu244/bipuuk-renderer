"use strict";
function terminalNode(literal) {
    return {
        type: "terminalNode",
        literal
    };
}
function dataNode(data) {
    return {
        type: "dataNode",
        data
    };
}
function bind(f) {
    return (pr) => pr.success ? f(pr) : { success: false };
}
function andThen(f, g) {
    return x => g(f(x));
}
function orElse(f, g) {
    return x => {
        let pr = f(x);
        return pr.success ? pr : g(x);
    };
}
function epsilon() {
    return bind((result) => result);
}
function never() {
    return bind((result) => ({ success: false }));
}
function terminal(literal) {
    return bind((result) => {
        if (result.rest.startsWith(literal))
            return { success: true, rest: result.rest.substring(literal.length), done: [...result.done, terminalNode(literal)] };
        else
            return { success: false };
    });
}
function reg(exp) {
    if (exp.source.substring(0, 1) !== '^')
        exp = new RegExp('^' + exp.source);
    return bind(function (result) {
        let regexResult = result.rest.match(exp);
        if (regexResult === null)
            return { success: false };
        return { success: true, rest: result.rest.substring(regexResult[0].length), done: [...result.done, terminalNode(regexResult[0])] };
    });
}
function seq(...parsers) {
    return parsers.reduce(andThen, epsilon());
}
function choice(...parsers) {
    return parsers.reduce(orElse, never());
}
function map(parser, fn) {
    return bind((result) => {
        let parsed = parser(startParse(result.rest));
        if (!parsed.success)
            return { success: false };
        return { success: true, rest: parsed.rest, done: [...result.done, dataNode(fn(parsed.done))] };
    });
}
function ignode(parser) {
    return bind((result) => {
        let parsed = parser(startParse(result.rest));
        if (!parsed.success)
            return { success: false };
        return { success: true, rest: parsed.rest, done: [...result.done] };
    });
}
/*
function nonterminal(label: string, parser: parser<T>): parser<T> {
    return bind((result: parseSuccess) => {
        let parsed = parser()(startParse(result.rest));

        if (!parsed.success)
            return {success: false};

        return {success:true, rest: parsed.rest, done: [...result.done, nonterminalNode(label, parsed.done)]};
    });
}*/
function startParse(input) {
    return { success: true, rest: input, done: [] };
}
function cons(car, cdr) {
    return {
        car,
        cdr
    };
}
function parse(input) {
    const tree = choice(map(seq(terminal("/"), (pr) => tree(pr), terminal("\\"), pr => tree(pr)), done => cons(done[1].data, done[3].data)), map(epsilon(), _ => null));
    const pr = tree(startParse(input));
    if (pr.success && pr.rest === "" && pr.done.length === 1 && pr.done[0].type === "dataNode")
        return pr.done[0].data;
    throw Error("parse failed");
}
