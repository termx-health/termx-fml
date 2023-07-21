import {collect, group} from '@kodality-web/core-util';
import {FHIRStructureMap} from './fhir/models/fhir';

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
  sourceObject: string;
  sourceField: string;
  targetObject: string;
  targetField: string;
}

export class FMLStructure {
  objects: {
    [name: string]: FMLStructureObject
  } = {};


  rules: FMLStructureRule[] = []


  sources: string[];
  targets: string[];
  groups: StructureRuleGroup[]

  public static map(fhir: FHIRStructureMap): FMLStructure {
    console.log(fhir)
    const struc = new FMLStructure();
    struc.objects = group(fhir.structure, s => s.url.substring(s.url.lastIndexOf('/') + 1), s => {
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
          rule.sourceObject = inputs[fhirRuleSource.context].type;
          rule.sourceField = fhirRuleSource.element
          rule.targetObject = inputs[fhirRuleTarget.context].type;
          rule.targetField = fhirRuleTarget.element
          struc.rules.push(rule)
        })
      })
    })


    const refs = collect(fhir.structure ?? [], s => s.mode, s => s.url);
    struc.sources = refs['source']
    struc.targets = refs['target']


    // groups
    struc.groups = fhir.group.map(g => {
      const _group = new StructureRuleGroup()
      _group.name = g.name;

      // sources & targets
      const inputs = collect(g.input, s => s.mode);
      _group.inputs = {
        source: group(inputs['source'], i => i.name, i => i.type),
        target: group(inputs['target'], i => i.name, i => i.type)
      };

      // rules
      _group.rules = g.rule.map(r => {
        const _rule = new StructureRule()
        _rule.name = r.name;
        _rule.sources = r.source.map(rs => ({
          name: rs.context,
          element: rs.element,
          variable: rs.variable
        }))
        _rule.target = r.target.map(rt => ({
          name: rt.context,
          element: rt.element,
          variable: rt.variable,
          action: rt.transform,
          parameter: rt.parameter?.map(p =>
            p.valueId ??
            p.valueString ??
            p.valueBoolean ??
            p.valueInteger ??
            p.valueDecimal ??
            p.valueDate ??
            p.valueTime ??
            p.valueDateTime
          )
        }));

        return _rule
      })
      return _group;
    })


    console.log(struc);
    return struc
  }
}
