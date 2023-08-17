import {copyDeep, group, isNil, unique} from '@kodality-web/core-util';
import {StructureMap, StructureMapGroup, StructureMapGroupInput, StructureMapGroupRule, StructureMapGroupRuleTarget, StructureMapStructure} from 'fhir/r5';
import {FMLStructure, FMLStructureObject, FMLStructureObjectField} from './fml-structure';
import {getAlphabet, SEQUENCE} from './fml.utils';
import {FMLGraph} from './fml-graph';
import {getRuleGenerator} from './rule-generators/_generators';


const alphabet = getAlphabet().map(el => el.toLowerCase());
let varCnt = -1;
const nextVar = (): string => {
  varCnt++;
  const times = Math.floor(varCnt / 26);
  return [...Array.from({length: times - 1}).fill(0), varCnt % 26].map(i => alphabet[i as number]).join('');
};

interface FMLStructureGroup {
  [groupName: string]: FMLStructure
}

interface FmlStructureGeneratorOptions {
  mapName?: string
}

export class FmlStructureGenerator {
  private static MAIN = 'main';

  public static generate(fmls: FMLStructure, options?: FmlStructureGeneratorOptions): StructureMap;
  public static generate(fmls: FMLStructureGroup, options?: FmlStructureGeneratorOptions): StructureMap;
  public static generate(fmls: FMLStructure | FMLStructureGroup, options?: FmlStructureGeneratorOptions): StructureMap {
    if (fmls instanceof FMLStructure) {
      fmls = {[this.MAIN]: fmls};
    }
    return this._generate(fmls, options);
  }

  public static _generate(fmls: FMLStructureGroup, options?: FmlStructureGeneratorOptions): StructureMap {
    varCnt = -1;
    const mapName = options?.mapName ?? 'fml-compose';

    // structure map base
    const sm: StructureMap = {
      resourceType: 'StructureMap',
      url: `http://termx.health/fhir/StructureMap/${mapName}`,
      name: `${mapName}`,
      status: 'draft',
      group: []
    };

    // fml as extension
    sm.extension = [{
      url: 'fml-export',
      valueString: JSON.stringify(
        group(Object.keys(fmls), k => k, k => {
          const fml = fmls[k];
          return {
            objects: group(Object.values(fml.objects).map(o => ({...o, fields: o.rawFields, rawFields: undefined})), o => o.name),
            rules: fml.rules,
            connections: fml.connections
          };
        })
      )
    }];

    // structure inputs
    sm.structure = Object.values(fmls[this.MAIN].objects)
      .filter(o => ['source', 'target'].includes(o.mode))
      .map(o => ({
        url: o.url,
        mode: o.mode as StructureMapStructure['mode'],
        alias: o.name
      }));


    // strucuture groups
    Object.keys(fmls).forEach(groupName => {
      const group = this.generateGroup(groupName, fmls[groupName]);
      sm.group.push(group);
    });


    console.log("#### STRUCTURE MAP ####");
    console.log(sm);
    return sm;
  }


  private static generateGroup(groupName: string, fml: FMLStructure,): StructureMapGroup {
    const smGroup = {
      name: groupName,
      input: [],
      rule: []
    };


    // group inputs
    smGroup.input = Object.values(fml.objects)
      .filter(o => ['source', 'target'].includes(o.mode))
      .map(o => ({
        name: o.name,
        type: o.resource,
        mode: o.mode as StructureMapGroupInput['mode'],
      }));

    /*
      Magic below does following:

      before:
      # AModel (target)
        * field-1 -> x
        * field-2
        * field-3 -> x

      after:
      [[AModel, field-1], [AModel, field-3]]
    */
    // group rules
    Object.values(fml.objects)
      .filter(o => o.mode === 'target')
      .flatMap(o => o.fields.filter(f => fml.getSources(o.name, f.name).length).map(f => [o.name, f.name]))
      .forEach(([target, field]) => {
        const subFml = fml.subFML(target, field);
        const vars = {};

        const topology = FMLGraph.fromFML(subFml).topologySort();
        const topologicalOrder = Object.keys(topology).sort(e => topology[e]).reverse();

        const newObjects = copyDeep(topologicalOrder)
          .reverse()
          .filter(name => 'object' === subFml.objects[name]?.mode)
          .flatMap(name => {
            const obj = subFml.objects[name];

            if (FMLStructure.isBackboneElement(obj.resource)) {
              // create sub element
              return subFml.getTargets(obj.name).map(n => (<StructureMapGroupRuleTarget>{
                context: vars[n.object] ?? n.object,
                element: n.field,
                variable: vars[`${obj.name}`] = nextVar(),
              }));
            }

            return [<StructureMapGroupRuleTarget>{
              variable: vars[`${obj.name}`] = nextVar(),
              transform: 'create',
              parameter: [{
                valueString: obj.resource
              }]
            }];
          });


        let smRule: StructureMapGroupRule;
        let ctx: FMLStructureObject;

        topologicalOrder.forEach(name => {
          const rule = subFml.rules.find(r => r.name === name);
          if (rule) {
            smRule.target.push(getRuleGenerator(rule.action).generate(rule, ctx, vars));
          }

          const obj = subFml.objects[name];
          if (obj) {
            ctx = obj;
            if (isNil(smRule)) {
              // create new rule inside of group
              smGroup.rule.push(smRule = {
                name: `rule_${SEQUENCE.next()}`,
                source: [{context: obj.name}],
                target: [...newObjects],
                rule: [],
              });
            }


            if (['source', 'element'].includes(obj.mode)) {
              const objOutputs = this.outputs(subFml, obj);

              // initialize (put into vars) fields that are used as source in other objects/rules
              objOutputs.forEach(n => {
                const baseName = obj.name.includes('#') ? obj.name.slice(0, obj.name.lastIndexOf("#")) : obj.name;

                smRule.target.push({
                  variable: vars[`${obj.name}.${n.name}`] = nextVar(),
                  transform: 'evaluate',
                  parameter: [
                    {valueId: vars[baseName] ?? baseName},
                    {valueString: n.name}
                  ]
                });
              });
            }

            if (['target', 'object'].includes(obj.mode)) {
              const objInputs = this.inputs(subFml, obj);
              objInputs.forEach(n => {
                const fieldSources = subFml.getSources(obj.name, n.name);
                if (fieldSources.length >= 2) {
                  console.warn("Has multiple sources");
                }

                const {object, field} = fieldSources[0];
                if (FMLStructure.isBackboneElement(subFml.objects[object]?.resource)) {
                  // just because
                  return;
                }

                smRule.target.push({
                  context: vars[obj.name] ?? obj.name,
                  element: n.name,
                  transform: 'copy',
                  parameter: [
                    // create(Any) ?? field (type='var') ?? default fallback
                    {valueId: vars[object] ?? vars[`${object}.${field}`] ?? object}
                  ]
                });
              });
            }
          }
        });
      });


    return smGroup;
  }

  protected static inputs = (fml: FMLStructure, obj: FMLStructureObject): FMLStructureObjectField[] => {
    return fml.connections
      .filter(c => c.targetObject === obj.name)
      .map(c => obj.fields[c.targetFieldIdx])
      .filter(unique);
  };

  protected static outputs = (fml: FMLStructure, obj: FMLStructureObject): FMLStructureObjectField[] => {
    return fml.connections
      .filter(c => c.sourceObject === obj.name)
      .map(c => obj.fields[c.sourceFieldIdx])
      .filter(unique);
  };
}
