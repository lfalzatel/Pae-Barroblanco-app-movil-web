const fs = require('fs');
const content = fs.readFileSync('app/dashboard/registro/page.tsx', 'utf8');

let paren = 0;
let brace = 0;
let lineNum = 1;
let colNum = 1;

for (let i = 0; i < content.length; i++) {
    const char = content[i];
    if (char === '(') paren++;
    if (char === ')') paren--;
    if (char === '{') brace++;
    if (char === '}') brace--;

    if (paren < 0) {
        console.log(`Extra ')' at line ${lineNum}, col ${colNum}`);
        paren = 0;
    }
    if (brace < 0) {
        console.log(`Extra '}' at line ${lineNum}, col ${colNum}`);
        brace = 0;
    }

    if (char === '\n') {
        lineNum++;
        colNum = 1;
    } else {
        colNum++;
    }
}

console.log(`Final Balance - Parens: ${paren}, Braces: ${brace}`);
