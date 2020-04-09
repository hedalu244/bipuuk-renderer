interface Cons {
    car: Cons | null;
    cdr: Cons | null;
}

type node<T> = terminalNode /* | nonterminalNode*/ | dataNode<T>
interface terminalNode {
    type: "terminalNode";
    literal: string;
}
function terminalNode(literal: string): terminalNode{
  return {
    type: "terminalNode",
    literal
  };
}
/*
interface nonterminalNode {
    type: "nonterminalNode";
    label: string;
    children: node[];
}
function nonterminalNode(label: string, children: node[]): nonterminalNode{
  return {
    type: "nonterminalNode",
    label,
    children
  };
}*/
interface dataNode<T> {
    type: "dataNode";
    data: T;
}
function dataNode<T>(data: T): dataNode<T>{
  return {
      type: "dataNode",
      data
  }
}

interface parseSuccess<T> {success: true; rest: string; done: node<T>[]}
interface parseFailure {success: false}
type parseResult<T> = parseSuccess<T> | parseFailure
type parser<T> = (_: parseResult<T>) => parseResult<T>
function bind<T>(f : (_:parseSuccess<T>) => parseResult<T>) : parser<T> {
    return (pr: parseResult<T>) => pr.success ? f(pr) : {success: false};
}
function andThen<T>(f:parser<T>, g:parser<T>): parser<T> {
    return x => g(f(x));
}
function orElse<T>(f:parser<T>, g:parser<T>): parser<T> {
    return x => {
        let pr = f(x);
        return pr.success ? pr : g(x);
    };
}

function epsilon<T>(): parser<T> {
    return bind((result: parseSuccess<T>) => result);
}
function never<T>(): parser<T> {
    return bind((result: parseSuccess<T>) => ({success: false}));
}
function terminal<T>(literal: string): parser<T> {
    return bind((result: parseSuccess<T>) => {
        if (result.rest.startsWith(literal))
            return {success: true, rest: result.rest.substring(literal.length), done:[...result.done, terminalNode(literal)]};
        else
            return {success: false};
    });
}
function reg<T>(exp: RegExp): parser<T> {
  if (exp.source.substring(0, 1) !== '^')
    exp = new RegExp('^' + exp.source);

  return bind(function(result: parseSuccess<T>) {
    let regexResult = result.rest.match(exp);
    if (regexResult === null)
        return {success: false};

    return {success: true, rest: result.rest.substring(regexResult[0].length), done:[...result.done, terminalNode(regexResult[0])]};
  });
}
function seq<T>(...parsers: parser<T>[]): parser<T> {
    return parsers.reduce(andThen, epsilon());
}
function choice<T>(...parsers: parser<T>[]): parser<T> {
    return parsers.reduce(orElse, never());
}
function map<T>(parser: parser<T>, fn: (_:node<T>[]) => T): parser<T> {
    return bind((result: parseSuccess<T>) => {
        let parsed = parser(startParse(result.rest));
        if (!parsed.success)
            return {success: false};
        return {success:true, rest: parsed.rest, done: [...result.done, dataNode(fn(parsed.done))]};
    });
}
function ignore<T>(parser: parser<T>): parser<T> {
    return bind((result: parseSuccess<T>) => {
        let parsed = parser(startParse(result.rest));
        if (!parsed.success)
            return {success: false};
        return {success:true, rest: parsed.rest, done: [...result.done]};
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
function startParse<T>(input: string): parseResult<T> {
    return {success: true, rest: input, done:[]};
}

interface cons {
    car: cons | null;
    cdr: cons | null;
}
function cons(car: cons | null, cdr: cons | null): cons {
    return {
        car,
        cdr
    }
}

function parse(input: string) : cons | null {
    const ws: parser<cons | null> = ignore(reg(/\s*/));
    const tree: parser<cons | null> = choice(
        map(seq(terminal("/"), pr=>ws(pr), pr=>tree(pr), pr=>ws(pr), terminal("\\"), pr=>ws(pr), pr=>tree(pr)), done => cons(done[1].data, done[3].data)),
        map(seq(terminal("+"), pr=>ws(pr), pr=>tree(pr), pr=>ws(pr), pr=>tree(pr)), done => cons(done[1].data, done[2].data)),
        map(terminal("0"), _=>null),
        map(epsilon(), _=>null)
    );

    const pr = tree(startParse(input));
    if (pr.success && pr.rest === "" && pr.done.length === 1 && pr.done[0].type === "dataNode")
        return pr.done[0].data;

    throw Error("parse failed");
}
