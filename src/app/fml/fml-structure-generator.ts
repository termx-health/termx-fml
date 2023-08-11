import {group, isNil, unique} from '@kodality-web/core-util';
import {StructureMap, StructureMapGroupInput, StructureMapGroupRule, StructureMapGroupRuleTarget, StructureMapStructure} from 'fhir/r5';
import {FMLStructure, FMLStructureConnection, FMLStructureObject, FMLStructureRule} from './fml-structure';
import {getAlphabet} from './fml.utils';


const alphabet = getAlphabet();
let varCnt = -1;
const nextVar = (): string => {
  varCnt++;
  const times = Math.floor(varCnt / 26);
  return [...Array.from({length: times - 1}).fill(0), varCnt % 26].map(i => alphabet[i as number]).join('');
};

const toVariable = (variables, obj, f?): string => variables[[obj, f].filter(Boolean).join('.')] = nextVar();


export class FmlStructureGenerator {
  public static generate(fml: FMLStructure, options?: {name?: string}): StructureMap {
    varCnt = -1;

    const name = options?.name ?? 'fml-compose';

    // structure map base
    const sm: StructureMap = {
      resourceType: 'StructureMap',
      url: `http://termx.health/fhir/StructureMap/${name}`,
      name: `${name}`,
      status: 'draft',
      group: [
        {
          name: 'main',
          input: [],
          rule: []
        }
      ]
    };

    // fml as extension
    sm.extension = [{
      url: 'fml-export',
      valueString: JSON.stringify({
        objects: fml.objects,
        rules: fml.rules,
        connections: fml.connections
      })
    }];

    // structure inputs
    const sources = Object.values(fml.objects).filter(o => o.mode === 'source');
    const targets = Object.values(fml.objects).filter(o => o.mode === 'target');
    sm.structure = [...sources, ...targets].map<StructureMapStructure>(o => ({
      url: o.url,
      mode: o.mode as StructureMapStructure['mode'],
      alias: o.name
    }));

    // group inputs
    const smGroup = sm.group[0];
    smGroup.input = [...sources, ...targets].map<StructureMapGroupInput>((o, i) => ({
      name: o.name,
      type: o.resource,
      mode: o.mode as StructureMapGroupInput['mode'],
    }));


    const findPath = (targetObject: string, targetField: string): {object: string, field: string}[] => {
      const fieldSources = fml.getSources(targetObject, targetField);
      if (fieldSources.length > 1) {
        throw new Error(`${targetObject}:${targetField} has multiple sources, aborting!`);
      }

      if (fieldSources.length) {
        const first = fieldSources[0];
        if (fml.objects[first.object]?.mode === 'object') {
          const subSources = fml.getSources(first.object);
          return [
            ...findPath(subSources[0].object, subSources[0].field),
            {object: first.object, field: first.field},
            {object: targetObject, field: targetField},
          ];
        }

        return [
          ...findPath(first.object, first.field),
          {object: targetObject, field: targetField},
        ];
      } else {
        return [{object: targetObject, field: targetField}];
      }
    };

    try {
      targets.forEach(({name, fields}) => {
        fml.connections
          .filter(c => c.targetObject === name)
          .map(c => fields[c.targetFieldIdx].name)
          .filter(unique)
          .forEach(field => {
            // find the path of objects/rules from source field to target
            const path = findPath(name, field);

            let latestRule: StructureMapGroupRule;
            const variables = group(smGroup.input, i => i.name, i => i.name);

            path.forEach((el, level) => {
              const con = fml.connections.find(c => {
                const fieldName = this.fieldName(fml, c.sourceObject, c.sourceFieldIdx);
                return c.sourceObject === el.object && fieldName === el.field;
              });

              if (isNil(con)) {
                // fixme: should not exit like that
                return;
              }

              const object = fml.objects[con.targetObject];
              const rule = fml.rules.find(({name}) => name === con.targetObject);

              let data;

              if (rule) {
                data = this.ruleHandler(fml, con, path[0].object, variables)?.data;
              } else if (object.mode === 'object' || object.mode === 'target') {
                data = this.objectHandler(fml, con, variables)?.data;
              } else {
                throw Error("Unknown type encountered when traversing the rule path");
              }


              if (data) {
                if (latestRule) {
                  latestRule.rule = data;
                  latestRule = data[0];
                } else {
                  latestRule = data[0];
                  smGroup.rule.push(latestRule);
                }
              }
            });
          });
      });
    } catch (e) {
      console.error(e);
    }


    console.log("#### STRUCTURE MAP ####");
    console.log(sm);
    return sm;
  }

  private static ruleHandler = (
    fml: FMLStructure,
    con: FMLStructureConnection,
    sourceName: string,
    variables: {[name: string]: string}
  ): {
    data: StructureMapGroupRule[],
    rule: FMLStructureRule
  } => {
    const ruleName = con.targetObject;
    const rule = fml.rules.find(({name}) => name === ruleName);

    // any (con.source) -> rule (con.target) -> [x] rule/object (tgt)
    //                                          ^^^ have to find that

    const data = fml.getTargets(ruleName).map(tgt => {
      const sourceContext = variables[con.sourceObject];
      const sourceElement = this.fieldName(fml, con.sourceObject, con.sourceFieldIdx);

      const source = {
        context: sourceElement ? sourceContext : sourceName, // set group source if current source is rule
        element: sourceElement, // undefined if source is rule
        variable: sourceElement ? toVariable(variables, con.sourceObject, sourceElement) : undefined,
        condition: rule.condition
      };

      const isTargetRule = !tgt.field;
      const target = {
        // if target is rule, then do not add context and element
        context: isTargetRule ? undefined : variables[tgt.object],
        element: isTargetRule ? undefined : tgt.field,
        variable: isTargetRule ? toVariable(variables, ruleName) : toVariable(variables, tgt.object, tgt.field),
        transform: rule.action as StructureMapGroupRuleTarget['transform'],
        parameter: (rule.parameters ?? []).map(p => {
          if (p.type === 'var') {
            return {valueId: variables[p.value] ?? p.value};
          } else {
            return {valueString: p.value};
          }
        })
      };


      return {
        name: rule.name.slice(0, rule.name.lastIndexOf("#")),
        source: [source],
        target: [target],
        rule: []
      };
    });


    return {data, rule};
  };

  private static objectHandler = (
    fml: FMLStructure,
    con: FMLStructureConnection,
    variables: {[name: string]: string}
  ): {
    data: StructureMapGroupRule[],
    obj: FMLStructureObject
  } => {
    const obj = fml.objects[con.targetObject];
    const action = obj.mode === 'object' ? 'create' : 'copy';

    const source = {
      context: con.sourceObject,
      element: this.fieldName(fml, con.sourceObject, con.sourceFieldIdx),
      variable: toVariable(variables, con.sourceObject, this.fieldName(fml, con.sourceObject, con.sourceFieldIdx))
    };

    const targets = [];
    const isSourceRule = !(con.sourceObject in fml.objects);
    if (isSourceRule) {
      return undefined;
    }

    if (action === 'create') {
      const target = fml.getTargets(con.targetObject) [0];

      const sourceVar = toVariable(variables, target.object, target.field);
      targets.push({
        context: target.object,
        element: target.field,
        transform: `${action}` as StructureMapGroupRuleTarget['transform'],
        variable: sourceVar,
        parameter: action === 'create' ?? obj.resource ? [{valueString: obj.resource}] : []
      });

      targets.push({
        context: sourceVar,
        element: this.fieldName(fml, con.targetObject, con.targetFieldIdx),
        transform: 'copy',
        parameter: [{
          valueId: source.variable
        }]
      });
    } else if (action === 'copy') {
      targets.push({
        context: variables[con.targetObject],
        element: this.fieldName(fml, con.targetObject, con.targetFieldIdx),
        transform: 'copy',
        parameter: [{
          valueId: source.variable
        }]
      });
    }

    const data: StructureMapGroupRule[] = [{
      name: `${action}-${con.sourceObject}:${this.fieldName(fml, con.sourceObject, con.sourceFieldIdx)}`,
      source: [source],
      target: targets,
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
