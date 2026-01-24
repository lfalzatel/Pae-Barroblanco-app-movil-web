const fs = require('fs');
const content = fs.readFileSync('app/dashboard/registro/page.tsx', 'utf8');

const stack = [];
let line = 1;

for (let i = 0; i < content.length; i++) {
    const char = content[i];
    if (char === '\n') line++;

    if (char === '(' || char === '{' || char === '[') {
        stack.push({ char, line });
    } else if (char === ')' || char === '}' || char === ']') {
        if (stack.length === 0) {
            console.log(`Extra '${char}' at line ${line}`);
            continue;
        }
        const last = stack.pop();
        if ((char === ')' && last.char !== '(') ||
            (char === '}' && last.char !== '{') ||
            (char === ']' && last.char !== '[')) {
            console.log(`Mismatched closure: '${char}' at line ${line} closing '${last.char}' from line ${last.line}`);
        }
    }
}

if (stack.length > 0) {
    console.log("Unclosed items:");
    stack.forEach(item => console.log(`'${item.char}' from line ${item.line}`));
} else {
    console.log("Everything balanced.");
}
