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
    const tree = choice(map(seq(terminal("/"), pr => ws(pr), pr => tree(pr), pr => ws(pr), terminal("\\"), pr => ws(pr), pr => tree(pr)), done => cons(done[1].data, done[3].data)), map(seq(terminal("+"), pr => ws(pr), pr => tree(pr), pr => ws(pr), pr => tree(pr)), done => cons(done[1].data, done[2].data)), map(reg(/[0-9]+/), done => NumToTree(BigInt(done[0].literal))), map(terminal("-"), _ => null), map(epsilon(), _ => null));
    const pr = tree(startParse(input));
    if (pr.success && pr.rest === "" && pr.done.length === 1 && pr.done[0].type === "dataNode")
        return pr.done[0].data;
    throw Error("parse failed");
}
function TreeToNum(tree) {
    if (tree === null)
        return 0n;
    else {
        const x = TreeToNum(tree.car);
        const y = TreeToNum(tree.cdr);
        const [min, max] = [x, y].sort((a, b) => a < b ? -1 : b < a ? 1 : 0);
        return max * max - min + 2n * x + 1n;
    }
}
function NumToTree(num) {
    if (num === 0n)
        return null;
    else {
        const a = sqrt(num - 1n);
        const b = num - a * a - 1n;
        const [min, max] = [a, b].sort((a, b) => a < b ? -1 : b < a ? 1 : 0);
        const x = min;
        const y = 2n * a - max;
        return cons(NumToTree(x), NumToTree(y));
    }
    function sqrt(value) {
        if (value < 0n)
            throw Error("negative");
        if (value < 2n)
            return value;
        return r(value, value);
        function r(n, x0) {
            const x1 = ((n / x0) + x0) / 2n;
            if (x0 === x1 || x0 === (x1 - 1n))
                return x0;
            return r(n, x1);
        }
    }
}
function render(tree, context, canvas, lineWidth, marginWidth, cellSize, extraHeight, fillMode) {
    const size = (cellSize + 2 * lineWidth + marginWidth) * Math.pow(2, Math.ceil((height(tree) + extraHeight) / 2)) - marginWidth;
    recursion(tree, (canvas.width - size) / 2, (canvas.height + size) / 2, (canvas.width - size) / 2, (canvas.height + size) / 2, 0, 3, true);
    function height(tree) {
        if (tree === null)
            return 0;
        else if (tree.car === null && tree.cdr === null)
            return 0;
        else
            return Math.max(height(tree.car), height(tree.cdr)) + 1;
    }
    function recursion(tree, x1, x2, y1, y2, direction1, direction2, fill) {
        if (tree === null) {
            //L字
            if (direction1 === 0)
                context.fillRect(x1, y1, x2 - x1, lineWidth); //上辺
            if (direction1 === 1)
                context.fillRect(x1, y1, lineWidth, y2 - y1); //左辺
            if (direction1 === 2)
                context.fillRect(x1, y2 - lineWidth, x2 - x1, lineWidth); //下辺
            if (direction1 === 3)
                context.fillRect(x2 - lineWidth, y1, lineWidth, y2 - y1); //右編
            if (direction2 === 0)
                context.fillRect(x1, y2 - lineWidth, x2 - x1, lineWidth); //下辺
            if (direction2 === 1)
                context.fillRect(x2 - lineWidth, y1, lineWidth, y2 - y1); //右編
            if (direction2 === 2)
                context.fillRect(x1, y1, x2 - x1, lineWidth); //上辺
            if (direction2 === 3)
                context.fillRect(x1, y1, lineWidth, y2 - y1); //左辺
            //塗りつぶし
            if (fill)
                context.fillRect(x1, y1, x2 - x1, y2 - y1);
        }
        else {
            const nextFill = fillMode === "all" || fillMode === "selective" && (tree.car !== null || tree.cdr !== null);
            const bridgeLength = (tree.car == null && tree.cdr == null) ? cellSize : marginWidth;
            if (direction1 === 0 || direction1 === 2) {
                const x3 = (x1 + x2 - bridgeLength) / 2;
                const x4 = (x1 + x2 + bridgeLength) / 2;
                //上に開くとき
                if (direction1 === 0) {
                    //下端に繋ぎの線
                    context.fillRect(x3, y2 - lineWidth, bridgeLength, lineWidth);
                    //左半分
                    recursion(tree.car, x1, x3, y1, y2, 1, 0, nextFill);
                    //右半分
                    recursion(tree.cdr, x4, x2, y1, y2, 3, 0, nextFill);
                }
                //下に開くとき
                else {
                    //上端に繋ぎの線
                    context.fillRect(x3, y1, bridgeLength, lineWidth);
                    //右半分
                    recursion(tree.car, x4, x2, y1, y2, 3, 2, nextFill);
                    //左半分
                    recursion(tree.cdr, x1, x3, y1, y2, 1, 2, nextFill);
                }
            }
            else {
                const y3 = (y1 + y2 - bridgeLength) / 2;
                const y4 = (y1 + y2 + bridgeLength) / 2;
                //左に開くとき
                if (direction1 === 1) {
                    //右に繋ぎの線
                    context.fillRect(x2 - lineWidth, y3, lineWidth, bridgeLength);
                    //下半分
                    recursion(tree.car, x1, x2, y4, y2, 2, 1, nextFill);
                    //上半分
                    recursion(tree.cdr, x1, x2, y1, y3, 0, 1, nextFill);
                }
                //右に開くとき
                else {
                    //左に繋ぎの線
                    context.fillRect(x1, y3, lineWidth, bridgeLength);
                    //上半分
                    recursion(tree.car, x1, x2, y1, y3, 0, 3, nextFill);
                    //下半分
                    recursion(tree.cdr, x1, x2, y4, y2, 2, 3, nextFill);
                }
            }
        }
    }
}
function stringify0(tree) {
    if (tree === null)
        return "-";
    else
        return "+" + stringify0(tree.car) + stringify0(tree.cdr);
}
function stringify1(tree) {
    if (tree === null)
        return "";
    else
        return "/" + stringify1(tree.car) + "\\" + stringify1(tree.cdr);
}
function stringify2(tree) {
    return TreeToNum(tree).toString();
}
onload = () => {
    const input = document.getElementById("input");
    const lineWidth = document.getElementById("lineWidth");
    const marginWidth = document.getElementById("marginWidth");
    const cellSize = document.getElementById("cellSize");
    const extraHeight = document.getElementById("extraHeight");
    const fillMode = document.getElementById("fillMode");
    const canvas = document.getElementById("canvas");
    const context = canvas.getContext('2d');
    const str0 = document.getElementById("str0");
    const str1 = document.getElementById("str1");
    const str2 = document.getElementById("str2");
    lineWidth.onchange = marginWidth.onchange = cellSize.onchange = extraHeight.onchange = fillMode.onchange = input.onkeyup = update;
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
            render(tree, context, canvas, parseInt(lineWidth.value), parseInt(marginWidth.value), parseInt(cellSize.value), parseInt(extraHeight.value), fillMode.value);
        }
        catch (e) {
        }
    }
};
