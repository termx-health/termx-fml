import {group} from '@kodality-web/core-util';
import {FHIRStructureDefinition, FHIRStructureMap} from '../fhir/models/fhir';

export class StructureRule {
  name: string;
  sources: {
    name: string;
    element?: string;
    variable?: string;
  }[];
  target: {
    name: string;
    element?: string;
    variable?: string;
    action?: string;
    parameters?: any[];
  }[];
}

export class StructureRuleGroup {
  name: string;
  inputs: { [type in ('source' | 'target')]: {[varName: string]: string} }
  rules: StructureRule[]

  public get sources(): {[varName: string]: string} {
    return this.inputs.source
  }

  public get targets(): {[varName: string]: string} {
    return this.inputs.target
  }
}


export class FMLStructureObject {
  _fhir?: FHIRStructureDefinition;
  resource: string;
  path: string;
  fields: string[] = [];
  mode: 'source' | 'target' | string;


  public getFieldIndex(field: string): number {
    return this.fields.indexOf(field);
  }
}

export class FMLStructureRule {
  name: string;
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


  public static map(fhir: FHIRStructureMap): FMLStructure {
    const struc = new FMLStructure();
    struc.objects = group(fhir.structure ?? [], s => s.url.substring(s.url.lastIndexOf('/') + 1), s => {
      const obj = new FMLStructureObject()
      obj.resource = s.url.substring(s.url.lastIndexOf('/') + 1)
      obj.path = s.url.substring(s.url.lastIndexOf('/') + 1)
      obj.mode = s.mode
      return obj
    })


    fhir.group.forEach(fhirGroup => {
      const inputs = group(fhirGroup.input, i => i.name);

      fhirGroup.rule.forEach(fhirRule => {
        if (fhirRule.target.length > 1) {
          console.warn(`FHIR Rule "${fhirRule.name}" has multiple targets, skipping it`)
          return
        }

        // NB: currently only one target
        const fhirRuleTarget = fhirRule.target[0]

        fhirRule.source.forEach(fhirRuleSource => {
          const rule = new FMLStructureRule()
          rule.name = fhirRule.name
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

          rule.sourceObject = inputs[fhirRuleSource.context].type;
          rule.sourceField = fhirRuleSource.element
          rule.targetObject = inputs[fhirRuleTarget.context].type;
          rule.targetField = fhirRuleTarget.element
          struc.rules.push(rule)
        })
      })
    })


    console.log(struc);
    return struc
  }
}
