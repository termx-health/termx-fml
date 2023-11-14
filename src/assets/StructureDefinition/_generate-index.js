const path = require("path")
const fs = require("fs")

const location = path.join(__dirname);
const files = fs.readFileSync(location);
const jsonFiles = files
  .filter(f => ![path.basename(__filename), 'index.json', '_generate-from-kefhir.js'].includes(f))
  .map(f => f.replace('.json', ''))
  .sort((a, b) => a.localeCompare(b, undefined, {numeric: true, sensitivity: 'base'}));
fs.write('index.json', JSON.stringify(jsonFiles, null, 2), 'utf-8');
