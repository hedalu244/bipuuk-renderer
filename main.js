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
function ignore(parser) {
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
    const ws = ignore(reg(/\s*/));
    const tree = choice(map(seq(terminal("/"), pr => ws(pr), pr => tree(pr), pr => ws(pr), terminal("\\"), pr => ws(pr), pr => tree(pr)), done => cons(done[1].data, done[3].data)), map(seq(terminal("+"), pr => ws(pr), pr => tree(pr), pr => ws(pr), pr => tree(pr)), done => cons(done[1].data, done[2].data)), map(terminal("0"), _ => null), map(epsilon(), _ => null));
    const pr = tree(startParse(input));
    if (pr.success && pr.rest === "" && pr.done.length === 1 && pr.done[0].type === "dataNode")
        return pr.done[0].data;
    throw Error("parse failed");
}
function render(tree, context, canvas, lineWidth = 10, marginWidth = 10, cellSize = 20) {
    const size = (cellSize + marginWidth) * Math.pow(2, Math.ceil(height(tree) / 2)) - marginWidth;
    recursion(tree, (canvas.width - size) / 2, (canvas.height + size) / 2, (canvas.width - size) / 2, (canvas.height + size) / 2, 0);
    function height(tree) {
        if (tree === null)
            return 0;
        else
            return Math.max(height(tree.car), height(tree.cdr)) + 1;
    }
    function recursion(tree, x1, x2, y1, y2, direction) {
        if (tree === null) {
            //コの字
            if (direction === 0) {
                //context.fillRect(x1, y1, x2 - x1, lineWidth);//上辺
                context.fillRect(x1, y1, lineWidth, y2 - y1); //左辺
                context.fillRect(x1, y2 - lineWidth, x2 - x1, lineWidth); //下辺
                context.fillRect(x2 - lineWidth, y1, lineWidth, y2 - y1); //右編
            }
            if (direction === 1) {
                context.fillRect(x1, y1, x2 - x1, lineWidth); //上辺
                //context.fillRect(x1, y1, lineWidth, y2 - y1);//左辺
                context.fillRect(x1, y2 - lineWidth, x2 - x1, lineWidth); //下辺
                context.fillRect(x2 - lineWidth, y1, lineWidth, y2 - y1); //右編
            }
            if (direction === 2) {
                context.fillRect(x1, y1, x2 - x1, lineWidth); //上辺
                context.fillRect(x1, y1, lineWidth, y2 - y1); //左辺
                //context.fillRect(x1, y2 - lineWidth, x2 - x1, lineWidth);//下辺
                context.fillRect(x2 - lineWidth, y1, lineWidth, y2 - y1); //右編
            }
            if (direction === 3) {
                context.fillRect(x1, y1, x2 - x1, lineWidth); //上辺
                context.fillRect(x1, y1, lineWidth, y2 - y1); //左辺
                context.fillRect(x1, y2 - lineWidth, x2 - x1, lineWidth); //下辺
                //context.fillRect(x2 - lineWidth, y1, lineWidth, y2 - y1);//右編
            }
        }
        else if (tree.car === null && tree.cdr === null) {
            //塗りつぶし
            context.fillRect(x1, y1, x2 - x1, y2 - y1);
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
function stringify0(tree) {
    if (tree === null)
        return "0";
    else
        return "+" + stringify0(tree.car) + stringify0(tree.cdr);
}
onload = () => {
    const input = document.getElementById("input");
    const lineWidth = document.getElementById("lineWidth");
    const marginWidth = document.getElementById("marginWidth");
    const cellSize = document.getElementById("cellSize");
    const canvas = document.getElementById("canvas");
    const context = canvas.getContext('2d');
    lineWidth.onchange = marginWidth.onchange = cellSize.onchange = input.onkeyup = update;
    function update() {
        context.clearRect(0, 0, canvas.width, canvas.height);
        try {
            const tree = parse(input.value);
            console.log(stringify0(tree));
            render(tree, context, canvas, parseInt(lineWidth.value), parseInt(marginWidth.value), parseInt(cellSize.value));
        }
        catch (e) {
        }
    }
};
