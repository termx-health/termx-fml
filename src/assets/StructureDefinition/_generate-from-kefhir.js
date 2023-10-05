const fs = require("fs")

const run = async () => {
  const bundle = await fetch('https://kefhir.kodality.dev/fhir/StructureDefinition?kind=resource,complex-type&_format=json&_count=10000').then(r => r.json());
  bundle.entry
    .map(e => e.resource)
    .filter(r => r.id === r.type)
    .forEach(r => {
      fs.writeFileSync(r.id + '.json', JSON.stringify(r, null, 2), 'utf-8');
    })
};

run()
