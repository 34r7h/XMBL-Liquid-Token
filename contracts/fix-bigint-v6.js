const fs = require('fs');
const path = require('path');

// Read the YieldManager test file
const filePath = path.join(__dirname, 'test/unit/YieldManager.test.js');
let content = fs.readFileSync(filePath, 'utf8');

// Fix all remaining BigInt conversion issues
content = content.replace(/\(DEPLOY_AMOUNT \* 2\)/g, 'DEPLOY_AMOUNT * 2n');
content = content.replace(/\(DEPLOY_AMOUNT \* 3\)/g, 'DEPLOY_AMOUNT * 3n');
content = content.replace(/\(YIELD_AMOUNT \/ 2\)/g, 'YIELD_AMOUNT / 2n');
content = content.replace(/\(YIELD_AMOUNT \* 2\)/g, 'YIELD_AMOUNT * 2n');
content = content.replace(/\(YIELD_AMOUNT \* 3\)/g, 'YIELD_AMOUNT * 3n');
content = content.replace(/\(DEPLOY_AMOUNT \/ 2\)/g, 'DEPLOY_AMOUNT / 2n');

// Fix the complex expression
content = content.replace(/\(YIELD_AMOUNT \+ YIELD_AMOUNT \/ 2\)/g, 'YIELD_AMOUNT + YIELD_AMOUNT / 2n');

// Fix subtraction
content = content.replace(/\(finalBalance - initialBalance\)/g, 'finalBalance - initialBalance');
content = content.replace(/\(vaultBalanceAfter - vaultBalanceBefore\)/g, 'vaultBalanceAfter - vaultBalanceBefore');

// Write the file back
fs.writeFileSync(filePath, content);
console.log('Fixed remaining BigInt issues in YieldManager.test.js');
