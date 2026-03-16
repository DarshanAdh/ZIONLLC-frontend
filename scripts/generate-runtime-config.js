const fs = require('fs');
const path = require('path');

const defaultUrl = 'http://127.0.0.1:5050/api';
const apiBaseUrl = process.env.API_BASE_URL || defaultUrl;

const output = `window.RUNTIME_CONFIG = {\n  API_BASE_URL: ${JSON.stringify(apiBaseUrl)}\n};\n`;
const targetFile = path.join(__dirname, '..', 'runtime-config.js');

fs.writeFileSync(targetFile, output, 'utf8');
console.log(`Generated runtime-config.js with API_BASE_URL=${apiBaseUrl}`);
