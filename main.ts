interface Cons {
    car: tree;
    cdr: tree;
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
    car: tree;
    cdr: tree;
}
type tree = cons | null;
function cons(car: tree, cdr: tree): cons {
    return {
        car,
        cdr
    }
}

function parse(input: string) : tree {
    const ws: parser<tree> = ignore(reg(/\s*/));
    const tree: parser<tree> = choice(
        map(seq(terminal("/"), pr=>ws(pr), pr=>tree(pr), pr=>ws(pr), terminal("\\"), pr=>ws(pr), pr=>tree(pr)), done => cons(done[1].data, done[3].data)),
        map(seq(terminal("+"), pr=>ws(pr), pr=>tree(pr), pr=>ws(pr), pr=>tree(pr)), done => cons(done[1].data, done[2].data)),
        map(reg(/[0-9]+/), done=>NumToTree(BigInt(done[0].literal))),
        map(terminal("-"), _=>null),
        map(epsilon(), _=>null)
    );

    const pr = tree(startParse(input));
    if (pr.success && pr.rest === "" && pr.done.length === 1 && pr.done[0].type === "dataNode")
        return pr.done[0].data;

    throw Error("parse failed");
}

function TreeToNum(tree: tree): bigint {
    if(tree === null) return 0n;
    else {
        const x = TreeToNum(tree.car);
        const y = TreeToNum(tree.cdr);
        const [min, max] = [x, y].sort((a,b) => a<b ? -1 : b<a ? 1 : 0);
        return max * max - min + 2n * x + 1n;
    }
}
function NumToTree(num: bigint): tree{
    if(num === 0n) return null;
    else {
        const a = sqrt(num - 1n);
        const b = num - a * a - 1n;
        const [min, max] = [a, b].sort((a,b) => a<b ? -1 : b<a ? 1 : 0);
        const x = min;
        const y = 2n * a - max;
        return cons(NumToTree(x), NumToTree(y));
    }
    function sqrt(value: bigint): bigint {
        if (value < 0n)
            throw Error("negative");
        if (value < 2n)
            return value;
        return r(value, value);
        function r(n:bigint, x0:bigint):bigint {
            const x1 = ((n / x0) + x0) / 2n;
            if (x0 === x1 || x0 === (x1 - 1n))
                return x0;
            return r(n, x1);
        }
    }
}

type direction = 0 | 1 | 2 | 3 // ↑、←、↓、→
function render(tree: tree, context: CanvasRenderingContext2D, canvas, lineWidth:number, marginWidth:number, cellSize:number, extraHeight :number) {
    const size = (cellSize + 2 * lineWidth + marginWidth) * Math.pow(2, Math.ceil((height(tree) + extraHeight) / 2)) - marginWidth;
    recursion(tree, (canvas.width - size) / 2, (canvas.height + size) / 2, (canvas.width - size) / 2, (canvas.height + size) / 2, 0);

    function height(tree: tree): number {
        if(tree === null) return 0;
        else if(tree.car === null && tree.cdr === null) return 0;
        else return Math.max(height(tree.car), height(tree.cdr)) + 1;
    }
    function recursion(tree: tree, x1: number, x2: number, y1: number, y2: number, direction: direction): void {
        if(tree === null) {
            //塗りつぶし
            context.fillRect(x1, y1, x2-x1, y2-y1);
        }
        else if(tree.car === null && tree.cdr === null) {
            //コの字
            if (direction === 0) {
                //context.fillRect(x1, y1, x2 - x1, lineWidth);//上辺
                context.fillRect(x1, y1, lineWidth, y2 - y1);//左辺
                context.fillRect(x1, y2 - lineWidth, x2 - x1, lineWidth);//下辺
                context.fillRect(x2 - lineWidth, y1, lineWidth, y2 - y1);//右編
            }
            if (direction === 1) {
                context.fillRect(x1, y1, x2 - x1, lineWidth);//上辺
                //context.fillRect(x1, y1, lineWidth, y2 - y1);//左辺
                context.fillRect(x1, y2 - lineWidth, x2 - x1, lineWidth);//下辺
                context.fillRect(x2 - lineWidth, y1, lineWidth, y2 - y1);//右編
            }
            if (direction === 2) {
                context.fillRect(x1, y1, x2 - x1, lineWidth);//上辺
                context.fillRect(x1, y1, lineWidth, y2 - y1);//左辺
                //context.fillRect(x1, y2 - lineWidth, x2 - x1, lineWidth);//下辺
                context.fillRect(x2 - lineWidth, y1, lineWidth, y2 - y1);//右編
            }
            if (direction === 3) {
                context.fillRect(x1, y1, x2 - x1, lineWidth);//上辺
                context.fillRect(x1, y1, lineWidth, y2 - y1);//左辺
                context.fillRect(x1, y2 - lineWidth, x2 - x1, lineWidth);//下辺
                //context.fillRect(x2 - lineWidth, y1, lineWidth, y2 - y1);//右編
            }
        }
        else {
            if (direction === 0 || direction === 2) {
                const x3 = (x1 + x2 - marginWidth) / 2;
                const x4 = (x1 + x2 + marginWidth) / 2;
                //上に開くとき
                if (direction === 0) {
                    //下端に繋ぎの線
                    context.fillRect(x3, y2 - lineWidth, marginWidth, lineWidth);
                    //左半分
                    recursion(tree.car, x1, x3, y1, y2, 1);
                    //右半分
                    recursion(tree.cdr, x4, x2, y1, y2, 3);
                }
                //下に開くとき
                else {
                    //上端に繋ぎの線
                    context.fillRect(x3, y1, marginWidth, lineWidth);
                    //右半分
                    recursion(tree.car, x4, x2, y1, y2, 3);
                    //左半分
                    recursion(tree.cdr, x1, x3, y1, y2, 1);
                }
            }
            else {
                const y3 = (y1 + y2 - marginWidth) / 2;
                const y4 = (y1 + y2 + marginWidth) / 2;
                //左に開くとき
                if (direction === 1) {
                    //右に繋ぎの線
                    context.fillRect(x2 - lineWidth, y3, lineWidth, marginWidth);
                    //下半分
                    recursion(tree.car, x1, x2, y4, y2, 2);
                    //上半分
                    recursion(tree.cdr, x1, x2, y1, y3, 0);
                }
                //右に開くとき
                else {
                    //左に繋ぎの線
                    context.fillRect(x1, y3, lineWidth, marginWidth);
                    //上半分
                    recursion(tree.car, x1, x2, y1, y3, 0);
                    //下半分
                    recursion(tree.cdr, x1, x2, y4, y2, 2);
                }
            }
        }
    }
}
function stringify0(tree: tree): string {
    if (tree === null) return "-";
    else return "+" + stringify0(tree.car) + stringify0(tree.cdr);
}
function stringify1(tree: tree): string {
    if (tree === null) return "";
    else return "/" + stringify1(tree.car) + "\\" + stringify1(tree.cdr);
}
function stringify2(tree: tree): string {
    return TreeToNum(tree).toString();
}

onload = () => {
    const input = document.getElementById("input");
    const lineWidth = document.getElementById("lineWidth");
    const marginWidth = document.getElementById("marginWidth");
    const cellSize = document.getElementById("cellSize");
    const extraHeight = document.getElementById("extraHeight");
    const canvas = document.getElementById("canvas");
    const context = canvas.getContext('2d');

    const str0 = document.getElementById("str0");
    const str1 = document.getElementById("str1");
    const str2 = document.getElementById("str2");
    lineWidth.onchange = marginWidth.onchange = cellSize.onchange = extraHeight.onchange = input.onkeyup = update;
    function update() {
        context.clearRect(0, 0, canvas.width, canvas.height);
        str0.textContent = "";
        str1.textContent = "";
        str2.textContent = "";
        try {
            const tree = parse(input.value);
            str0.textContent = stringify0(tree);
            str1.textContent = stringify1(tree);
            str2.textContent = stringify2(tree);
            render(tree, context, canvas, parseInt(lineWidth.value), parseInt(marginWidth.value),  parseInt(cellSize.value), parseInt(extraHeight.value),);
        }
        catch (e) {
        }
    }
};
