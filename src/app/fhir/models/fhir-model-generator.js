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

const elements = ['BackboneElement', 'Element']
const isBackbone = (el) => el.type?.some(t => elements.includes(t.code))
const getFieldName = (id) => id.substring(id.lastIndexOf(".") + 1)

const visited = {}
const models = {}

async function run() {
  const getClassDefinition = async (url) => {
    if (visited[url]) {
      return
    }
    visited[url] = '-'


    const _def = await fetch(url).then(r => r.json()).catch(e => console.error(url, e))
    if (!_def?.differential) {
      return
    }

    const resourceName = _def.differential.element[0].id;
    const resourceFields = _def.differential.element;


    resourceFields[0].path = resourceFields[0].path + '._self'

    const flatStruc = group(
      resourceFields,
      el => isBackbone(el) ? el.path + '._self' : el.path,
      el => {
        let fieldName = getFieldName(el.id);
        const fieldTypes = el.type?.map(t => t.code) || [];
        const isRequired = el.min === 1;
        const isArray = el.max !== '1';
        const isPlaceholder = el.id.endsWith('[x]');

        if (isPlaceholder) {
          fieldName = fieldName.split("[x]")[0]
        }

        return ({
          _definition: true,
          field: fieldName,
          types: fieldTypes,
          required: isRequired,
          array: isArray,
          placeholder: isPlaceholder
        });
      });

    const struc = unflattenObject(flatStruc);
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

    await compose(struc[resourceName], 0)
    models[resourceName] = res.join("\n");
  }


  // await getClassDefinition("http://build.fhir.org/practitioner.profile.json")
  // await getClassDefinition("http://build.fhir.org/organization.profile.json")
  await getClassDefinition("http://build.fhir.org/structuremap.profile.json")
  await getClassDefinition("http://build.fhir.org/structuredefinition.profile.json")


  Object.values(models).forEach(obj => console.log(obj))
}

run()
