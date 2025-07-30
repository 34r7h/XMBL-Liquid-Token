const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function compile() {
    const contractsDir = path.join(__dirname, '../contracts');
    const artifactsDir = path.join(__dirname, '../artifacts');
    const nodeModulesDir = path.join(__dirname, '../node_modules');

    if (!fs.existsSync(artifactsDir)) {
        fs.mkdirSync(artifactsDir, { recursive: true });
    }

    const files = fs.readdirSync(contractsDir);

    for (const file of files) {
        if (file.endsWith('.sol')) {
            const filePath = path.join(contractsDir, file);
            console.log(`Compiling ${file}...`);
            try {
                execSync(`npx solc --abi --bin -o "${artifactsDir}" --base-path . --include-path "${nodeModulesDir}" "${filePath}"`);
                console.log(`${file} compiled successfully.`);
            } catch (error) {
                console.error(`Error compiling ${file}:`, error.message);
            }
        }
    }
}

compile();
