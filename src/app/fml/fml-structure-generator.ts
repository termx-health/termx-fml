import {unique} from '@kodality-web/core-util';
import {StructureMap, StructureMapGroup, StructureMapGroupInput, StructureMapGroupRule, StructureMapGroupRuleTarget, StructureMapStructure} from 'fhir/r5';
import {FMLStructure, FMLStructureConnection, FMLStructureObject, FMLStructureRule} from './fml-structure';


export class FmlStructureGenerator {
  public static generate(fml: FMLStructure): StructureMap {
    const ruleNames = fml.rules.map(r => r.name).filter(unique);

    // structure map base
    const sm: StructureMap = {
      resourceType: 'StructureMap',
      url: 'http://termx.health/fhir/StructureMap/fml-compose',
      name: 'fml-compose',
      status: 'draft',
      group: [
        {
          name: 'main',
          input: [],
          rule: []
        }
      ]
    };

    // structure inputs
    const objects = Object.values(fml.objects);
    const sources = objects.filter(o => o.mode === 'source');
    const targets = objects.filter(o => o.mode === 'target');
    sm.structure = [...sources, ...targets].map<StructureMapStructure>(o => ({
      url: `http://termx.health/fhir/StructureDefinition/${o.resource}`,
      mode: o.mode as StructureMapStructure['mode'],
      alias: o.resource
    }));

    // group inputs
    const smGroup = sm.group[0];
    smGroup.input = [...sources, ...targets].map<StructureMapGroupInput>(o => ({
      name: o.name,
      type: o.resource,
      mode: o.mode as StructureMapGroupInput['mode'],
    }));


    const traverse = (_targetObject: string, acc: StructureMapGroupRule[]): void => {
      // find connections where target is provided object
      const ruleConnections = fml.connections.filter(con => con.targetObject === _targetObject);


      ruleConnections.forEach(con => {
        let smRules: {smRule: StructureMapGroupRule, key: string}[];

        const isRule = ruleNames.includes(con.sourceObject);
        if (isRule) {
          const {data, rule} = this.ruleHandler(fml, con, smGroup);
          smRules = data.map(r => ({smRule: r, key: rule.name}));
        } else {
          const {data, obj} = this.objectHandler(fml, con, smGroup);
          smRules = data.map(r => ({smRule: r, key: obj.name}));
        }

        smRules.forEach(({key, smRule}) => {
          acc.push(smRule);
          // traverse(key, acc);
          traverse(key, smRule.rule);
        });
      });
    };

    targets.forEach(({name}) => traverse(name, smGroup.rule));
    return sm;
  }

  private static ruleHandler = (
    fml: FMLStructure,
    con: FMLStructureConnection,
    group: StructureMapGroup
  ): {
    data: StructureMapGroupRule[],
    rule: FMLStructureRule
  } => {
    const rule = fml.rules.find(({name}) => name === con.sourceObject);
    const isTargetRule = fml.rules.find(({name}) => name === con.targetObject);

    // [x] -> rule (con.source) -> target object
    // ^^^ have to find that

    const ruleSources = fml.getSources(con.sourceObject);
    if (ruleSources.length === 0) {
      // constant, unconnected rule
      ruleSources.push({
        object: group.input.find(i => i.mode === 'source')?.name
      });
    }


    const data: StructureMapGroupRule[] = ruleSources.map(src => {
      return ({
        name: rule.name.slice(0, rule.name.lastIndexOf("#")),
        source: [{
          context: src.object,
          element: src.field,
          condition: rule.condition
        }],
        // if target is rule, then do not add context and element
        target: [{
          context: isTargetRule ? undefined : con.targetObject,
          element: isTargetRule ? undefined : this.fieldName(fml, con.targetObject, con.targetFieldIdx),
          variable: rule.alias,
          transform: rule.action as StructureMapGroupRuleTarget['transform'],
          parameter: (rule.parameters ?? []).map(p => ({
            valueString: p
          }))
        }],
        rule: []
      });
    });

    return {data, rule};
  };

  private static objectHandler = (
    fml: FMLStructure,
    con: FMLStructureConnection,
    _group: StructureMapGroup
  ): {
    data: StructureMapGroupRule[],
    obj: FMLStructureObject
  } => {
    const obj = fml.objects[con.sourceObject];
    const action = obj.mode === 'object' ? 'create' : 'copy';

    const data: StructureMapGroupRule[] = [{
      name: `${action}-${con.sourceObject}:${this.fieldName(fml, con.sourceObject, con.sourceFieldIdx)}`,
      source: [{
        context: con.sourceObject,
        element: this.fieldName(fml, con.sourceObject, con.sourceFieldIdx)
      }],
      target: [{
        context: con.targetObject,
        element: this.fieldName(fml, con.targetObject, con.targetFieldIdx),
        transform: `${action}`,
        parameter: [
          action === 'create' ? {valueString: obj.resource} : undefined
        ]
      }],
      rule: []
    }];

    return {data, obj};
  };

  private static fieldName = (fml: FMLStructure, name: string, idx: number): string => {
    if (fml.objects[name]) {
      return fml.objects[name].fields[idx]?.name;
    }
  };

}
