function unflattenObject(data) {
  let result = {};
  for (let i in data) {
    let keys = i.split(".");
    keys.reduce((acc, value, index) => {
      return (
        acc[value] ||
        (acc[value] = isNaN(Number(keys[index + 1]))
          ? keys.length - 1 === index
            ? data[i]
            : {}
          : [])
      );
    }, result);
  }
  return result;
}

function group(
  array,
  groupBy,
  transform = val => val
) {
  return array.reduce((acc, val) => ({...acc, [groupBy(val)]: transform(val)}), {})
}


const primitives = ['any', 'base64Binary', 'boolean', 'canonical', 'code', 'date', 'dateTime', 'decimal', 'id', 'instant', 'integer', 'integer64', 'markdown', 'oid', 'string', 'positiveInt', 'time', 'unsignedInt', 'uri', 'url', 'uuid']


const visited = {}
const models = {}

async function run() {
  const getClassDefinition = async (url) => {
    if (visited[url]) {
      return
    }
    visited[url] = '-'


    const definition = await fetch(url).then(r => r.json()).catch(e => console.error(url, e))
    if (!definition?.differential) {
      return
    }

    const className = definition.differential.element[0].id;
    const fields = definition.differential.element;
    fields[0].path = fields[0].path + '._self'


    const groupElements = ['BackboneElement', 'Element']
    const grouped = group(
      fields,
      el => el.type?.some(t => groupElements.includes(t.code)) ? el.path + '._self' : el.path,
      el => {
        let fieldName = el.id.substring(el.id.lastIndexOf(".") + 1)
        if (fieldName.endsWith("[x]")) {
          fieldName = fieldName.split("[x]")[0]
        }
        const fieldTypes = el.type?.map(t => t.code) || [];
        const isRequired = el.min === 1;
        const isArray = el.max !== '1';


        return ({
          _definition: true,
          field: fieldName,
          types: fieldTypes,
          required: isRequired,
          array: isArray,
          placeholder: el.id.endsWith('[x]')
        });
      });

    const struc = unflattenObject(grouped);
    const res = []

    const compose = async (obj, level) => {
      const toFhirType = c => primitives.includes(c) ? c : `FHIR${c}`

      if (obj._definition) {
        const {field, array, required, types, placeholder} = obj;
        if (!types.length) {
          types.push('any')
        }

        for (const t of types) {
          if (!primitives.includes(t)) {
            await getClassDefinition(`http://build.fhir.org/${t.toLowerCase()}.profile.json`)
          }
        }

        if (placeholder) {
          types.forEach(t => res.push(`${'  '.repeat(level)}${field}${t.charAt(0).toUpperCase() + t.substring(1)}${(!required ? '?' : '')}: ${toFhirType(t)}${array ? '[]' : ''};`))
          return;
        }

        res.push(`${'  '.repeat(level)}${field}${(!required ? '?' : '')}: ${types.map(c => toFhirType(c)).join(' | ')}${array ? '[]' : ''};`)
        return
      }


      const {field, array, required} = obj._self;
      if (level === 0) {
        res.push(`export class FHIR${field} {`);
        res.push(`  id?: string;`);
        res.push(`  resourceType?: string;`);
        for (const k of Object.keys(obj).filter(k => k !== '_self')) {
          await compose(obj[k], level + 1)
        }
        res.push(`${'  '.repeat(level)}}`);
        return
      }

      res.push(`${'  '.repeat(level)}${field}${required ? ':' : '?:'} {`);
      for (const k of Object.keys(obj).filter(k => k !== '_self')) {
        await compose(obj[k], level + 1)
      }
      res.push(`${'  '.repeat(level)}}${array ? '[]' : ''};`);
    }

    await compose(struc[className], 0)
    models[className] = res.join("\n");
  }


  await getClassDefinition("http://build.fhir.org/structuremap.profile.json")
  await getClassDefinition("http://build.fhir.org/structuredefinition.profile.json")


  Object.values(models).forEach(obj => console.log(obj))
}

run()
