const path = require("path")
const fs = require("fs")

const location = path.join(__dirname);
const files = fs.readdirSync(location);
const jsonFiles = files.filter(f => ![path.basename(__filename), 'index.json'].includes(f)).map(f => f.replace('.json', ''));
fs.writeFileSync('index.json', JSON.stringify(jsonFiles), 'utf-8');
