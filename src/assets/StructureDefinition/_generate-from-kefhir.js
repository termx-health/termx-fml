const path = require("path")
const fs = require("fs")

const location = path.join(__dirname);
const files = fs.readdirSync(location);
const resources = files.map(r => r.split(".json")[0])



const run = async () => {
  const bundle = await fetch('https://kefhir.kodality.dev/fhir/StructureDefinition?kind=resource&_format=json&_count=10000').then(r => r.json());
  const entries = bundle.entry.map(e => e.resource);

  entries.forEach(r => {
    if (resources.includes(r.type)){
      return
    }

    fs.writeFileSync(r.type + '.json', JSON.stringify(r, null, 2), 'utf-8');
  })
};


run()
