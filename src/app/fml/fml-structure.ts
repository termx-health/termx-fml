import {group, isDefined} from '@kodality-web/core-util';
import {ElementDefinition, StructureMap} from 'fhir/r5';

export interface FMLStructureObjectField {
  name: string;
  types: string[];
}

let ID = 42

/**
 * Represents the ElementDefinition with the externally set fields.
 */
export class FMLStructureObject {
  resource: string;
  name: string;
  fields: FMLStructureObjectField[] = [];
  mode: 'source' | 'target' | string;

  _fhirDefinition?: ElementDefinition;

  constructor() {
    // this.id = ID++;
  }

  public getFieldIndex(field: string): number {
    return this.fields.findIndex(f => f.name === field);
  }
}

export class FMLStructureRule {
  name: string;
  alias?: string; // aka. variable
  action: string;
  parameters?: any[];

  sourceObject: string;
  sourceField: string;
  targetObject: string;
  targetField: string;
}

export class FMLStructure {
  objects: {[name: string]: FMLStructureObject} = {};
  rules: FMLStructureRule[] = []


  public static map(fhir: StructureMap): FMLStructure {
    const struc = new FMLStructure();
    struc.objects = group(fhir.structure ?? [], s => s.url.substring(s.url.lastIndexOf('/') + 1), s => {
      const obj = new FMLStructureObject()
      const resource = s.url.substring(s.url.lastIndexOf('/') + 1);
      obj.resource = resource
      obj.name = resource;
      obj.mode = s.mode
      return obj
    })


    // group
    fhir.group.forEach(fhirGroup => {
      const inputs = group(fhirGroup.input, i => i.name);

      fhirGroup.rule.forEach(fhirRule => {
        // init variables
        const variables = group(fhirGroup.input, i => i.name, i => i.type);
        fhirRule.source.forEach(fhirRuleSource => {
          variables[fhirRuleSource.variable] = `${inputs[fhirRuleSource.context].type}.${fhirRuleSource.element}`;
        })
        fhirRule.target.filter(frt => isDefined(frt.variable)).forEach(fhirRuleTarget => {
          console.log(fhirRuleTarget)
          variables[fhirRuleTarget.variable] = `${variables[fhirRuleTarget.context]}.${fhirRuleTarget.element}`;
        })


        // NB: currently only one source
        const fhirRuleSource = fhirRule.source[0]

        fhirRule.target.forEach(fhirRuleTarget => {
          const rule = new FMLStructureRule()
          rule.name = fhirRule.name + '.' + fhirRuleTarget.transform;
          rule.alias = fhirRuleTarget.variable
          rule.action = fhirRuleTarget.transform;
          rule.parameters = fhirRuleTarget.parameter?.map(p =>
            p.valueId ??
            p.valueString ??
            p.valueBoolean ??
            p.valueInteger ??
            p.valueDecimal ??
            p.valueDate ??
            p.valueTime ??
            p.valueDateTime
          )

          rule.sourceObject = variables[fhirRuleSource.context];
          rule.sourceField = fhirRuleSource.element
          rule.targetObject = variables[fhirRuleTarget.context];
          rule.targetField = fhirRuleTarget.element
          rule['_variables'] = variables;
          struc.rules.push(rule)


          if (rule.action === 'create') {
            const obj = new FMLStructureObject()
            obj.resource = variables[fhirRuleTarget.variable]
            obj.name = variables[fhirRuleTarget.variable]
            obj.mode = 'target'
            struc.objects[obj.resource] = obj;


            rule.sourceObject = obj.name;
            rule.sourceField = 'id'
          }
        })
      })
    })


    console.log(struc);
    return struc
  }
}
