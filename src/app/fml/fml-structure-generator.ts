import {isNil, unique} from '@kodality-web/core-util';
import {StructureMap, StructureMapGroupInput, StructureMapGroupRule, StructureMapStructure} from 'fhir/r5';
import {FMLStructure, FMLStructureObject, FMLStructureObjectField} from './fml-structure';
import {getAlphabet} from './fml.utils';
import {FMLGraph} from './fml-graph';
import {FMLCopyRuleGenerator} from './rule-generators/copy.generator';
import {FMLRuleGenerator} from './rule-generators/generator';
import {FMLDefaultRuleGenerator} from './rule-generators/default.generator';


const alphabet = getAlphabet().map(el => el.toLowerCase());
let varCnt = -1;
const nextVar = (): string => {
  varCnt++;
  const times = Math.floor(varCnt / 26);
  return [...Array.from({length: times - 1}).fill(0), varCnt % 26].map(i => alphabet[i as number]).join('');
};


export class FmlStructureGenerator {
  // rule renderer
  private static _getRuleGenerator = (action: string): FMLRuleGenerator => this.ruleGenerators.find(rr => rr.action === action) ??
    new FMLDefaultRuleGenerator();
  private static ruleGenerators = [
    new FMLCopyRuleGenerator()
  ];


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
    smGroup.input = [...sources, ...targets].map<StructureMapGroupInput>(o => ({
      name: o.name,
      type: o.resource,
      mode: o.mode as StructureMapGroupInput['mode'],
    }));


    // group rules
    Object.values(fml.objects)
      .filter(o => o.mode === 'target')
      .flatMap(o => o.fields.filter(f => fml.getSources(o.name, f.name).length).map(f => [o.name, f.name]))
      .forEach(([target, field]) => {
        const _fml = fml.subFML(target, field);

        const topology = FMLGraph.fromFML(_fml).topologySort();
        const topologicalOrder = Object.keys(topology).sort(e => topology[e]).reverse();

        let smRule: StructureMapGroupRule;
        let ctx: FMLStructureObject;
        const vars = {};

        topologicalOrder.forEach(name => {
          const obj = _fml.objects[name];
          const rule = _fml.rules.find(r => r.name === name);

          if (rule) {
            smRule.target.push(
              this._getRuleGenerator(rule.action).generate(rule, ctx, vars)
            );
          }

          if (obj) {
            ctx = obj;
            if (isNil(smRule)) {
              // create new rule inside of group
              smGroup.rule.push(smRule = {
                name: new Date().getTime().toString(),
                source: [{context: obj.name}],
                rule: [],
                target: []
              });
            }

            if ('object' === obj.mode) {
              // create sub element
              if (FMLStructure.isBackboneElement(obj.resource)) {
                  // "context" : "bundle",
                  // "element" : "entry",
                  // "variable" : "entry"
              }

              smRule.target.push({
                variable: vars[`${obj.name}`] = nextVar(),
                transform: 'create',
                parameter: [
                  {valueString: obj.resource}
                ]
              });
            }


            if (['source', 'element'].includes(obj.mode)) {
              // initialize object's fields into variables
              this.outputs(_fml, obj).forEach(n => {
                const base = obj.name.split("#")[0];
                const v = vars[`${obj.name}.${n.name}`] = nextVar();

                smRule.target.push({
                  variable: v,
                  transform: 'evaluate',
                  parameter: [
                    {valueId: vars[base] ?? base},
                    {valueString: n.name}
                  ]
                });
              });
            }

            if (['target', 'object'].includes(obj.mode)) {
              this.inputs(_fml, obj).forEach(n => {
                const fieldSources = _fml.getSources(obj.name, n.name);
                if (fieldSources.length >= 2) {
                  console.warn("Has multiple sources");
                }

                const {object, field} = fieldSources[0];
                smRule.target.push({
                  context: vars[obj.name] ?? obj.name,
                  element: n.name,
                  transform: 'copy',
                  parameter: [
                    {valueId: vars[object] ?? vars[`${object}.${field}`] ?? object}
                  ]
                });
              });
            }
          }
        });

        console.log(vars);
      });


    console.log("#### STRUCTURE MAP ####");
    console.log(sm);
    return sm;
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
