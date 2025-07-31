const fs = require('fs');
const path = require('path');

// Read the YieldManager test file
const filePath = path.join(__dirname, 'test/unit/YieldManager.test.js');
let content = fs.readFileSync(filePath, 'utf8');

// Replace BigNumber methods with ethers v6 syntax
content = content.replace(/(\w+)\.mul\((\w+)\)/g, '($1 * $2)');
content = content.replace(/(\w+)\.div\((\w+)\)/g, '($1 / $2)');
content = content.replace(/(\w+)\.sub\((\w+)\)/g, '($1 - $2)');
content = content.replace(/(\w+)\.add\((\w+)\)/g, '($1 + $2)');

// Handle more complex expressions
content = content.replace(/DEPLOY_AMOUNT\.mul\(2\)/g, '(DEPLOY_AMOUNT * 2n)');
content = content.replace(/DEPLOY_AMOUNT\.mul\(3\)/g, '(DEPLOY_AMOUNT * 3n)');
content = content.replace(/YIELD_AMOUNT\.div\(2\)/g, '(YIELD_AMOUNT / 2n)');
content = content.replace(/YIELD_AMOUNT\.mul\(2\)/g, '(YIELD_AMOUNT * 2n)');
content = content.replace(/YIELD_AMOUNT\.mul\(3\)/g, '(YIELD_AMOUNT * 3n)');
content = content.replace(/DEPLOY_AMOUNT\.div\(2\)/g, '(DEPLOY_AMOUNT / 2n)');

// Handle the add operation for expectedTotal
content = content.replace(/YIELD_AMOUNT\.add\(YIELD_AMOUNT\.div\(2\)\)/g, '(YIELD_AMOUNT + YIELD_AMOUNT / 2n)');

// Write the file back
fs.writeFileSync(filePath, content);
console.log('Fixed YieldManager.test.js for ethers v6');
