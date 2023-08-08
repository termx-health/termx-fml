import {group, isNil, unique} from '@kodality-web/core-util';
import {StructureMap, StructureMapGroup, StructureMapGroupInput, StructureMapGroupRule, StructureMapGroupRuleTarget, StructureMapStructure} from 'fhir/r5';
import {FMLStructure, FMLStructureConnection, FMLStructureObject, FMLStructureRule} from './fml-structure';

const alpha = Array.from(Array(26)).map((e, i) => i + 65);
const alphabet = alpha.map((x) => String.fromCharCode(x));

let v = -1;
const nextVal = () => {
  v++;
  const times = Math.floor(v / 26);
  return [...Array.from({length: times - 1}).fill(0), v % 26].map(i => alphabet[i as number]).join('');
};
const nextVar = (variables, obj, f?): string => variables[[obj, f].filter(Boolean).join('.')] = nextVal();


export class FmlStructureGenerator {
  public static generate(fml: FMLStructure): StructureMap {
    console.log({
      objects: group(Object.values(fml.objects), o => o.name, o => ({...o, element: undefined})),
      rules: fml.rules,
      connections: fml.connections
    });
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


    const findPath = (object: string, field: string, res: any[]) => {
      res.unshift({object, field});
      const fieldSources = fml.getSources(object, field);
      if (fieldSources.length > 1) {
        throw new Error(`Хуйня какая-то, с хуя ли у него несколько сорсов!`);
      }

      if (!fieldSources.length) {
        return;
      }

      findPath(fieldSources[0].object, fieldSources[0].field, res);
    };


    targets.forEach(({name, fields}) => {
      fml.connections
        .filter(c => c.targetObject === name)
        .map(c => fields[c.targetFieldIdx].name)
        .filter(unique)
        .forEach(f => {
          // find the path of objects/rules from source field to target
          const path: {object: string, field: string}[] = [];
          findPath(name, f, path);

          // determine endpoints
          const source = path.at(0);
          const target = path.at(-1);


          let latestRule: StructureMapGroupRule;
          const variables = group(smGroup.input, i => i.type, i => i.type);

          // for each element in the path
          // find what type is it and what has to be done with it
          path.forEach((d, level) => {
            const con = fml.connections.find(c => {
              const fieldName = this.fieldName(fml, c.sourceObject, c.sourceFieldIdx);
              return c.sourceObject === d.object && fieldName === d.field;
            });
            if (isNil(con)) {
              // fixme: should not exit like that
              return;
            }

            const object = fml.objects[con.targetObject];
            const rule = fml.rules.find(({name}) => name === con.targetObject);

            if (rule) {
              const {data} = this.ruleHandler(fml, con, smGroup, variables);
              if (latestRule) {
                latestRule.rule = data;
                latestRule = data[0];
              } else {
                latestRule = data[0];
                smGroup.rule.push(latestRule);
              }
            } else if (object && level > 0) {
              console.log(object)
              // console.log(variables, this.objectHandler(fml, con, smGroup, variables).data[0]);
            }

          });
        });

      console.log(sm);
      // traverse(name, smGroup.rule);
    });


    return sm;
  }

  private static ruleHandler = (
    fml: FMLStructure,
    con: FMLStructureConnection,
    group: StructureMapGroup,
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
      const sourceField = this.fieldName(fml, con.sourceObject, con.sourceFieldIdx);
      const source = {
        context: variables[con.sourceObject],
        element: sourceField,
        variable: sourceField ? nextVar(variables, con.sourceObject, sourceField) : undefined,
        condition: rule.condition
      };

      const isTargetRule = !tgt.field;
      const target = {
        // if target is rule, then do not add context and element
        context: isTargetRule ? undefined : variables[tgt.object],
        element: isTargetRule ? undefined : tgt.field,
        variable: isTargetRule ? nextVar(variables, ruleName) : nextVar(variables, tgt.object, tgt.field),
        transform: rule.action as StructureMapGroupRuleTarget['transform'],
        parameter: (rule.parameters ?? []).map(p => {
          if (p.type === 'var') {
            if (Object.keys(variables).includes(p.value)) {
              return {valueId: variables[p.value]}
            }
            return {valueId: p.value};
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
    _group: StructureMapGroup,
    variables: {[name: string]: string}
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
        parameter: action === 'create' ?? obj.resource ? [{valueString: obj.resource}] : []
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


  /*
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
  */
}
