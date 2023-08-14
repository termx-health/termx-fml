import {unique} from '@kodality-web/core-util';
import {StructureMap, StructureMapGroupInput, StructureMapGroupRule, StructureMapGroupRuleTarget, StructureMapStructure} from 'fhir/r5';
import {FMLStructure, FMLStructureConnection, FMLStructureObject, FMLStructureRule} from './fml-structure';
import {getAlphabet} from './fml.utils';
import {FMLGraph} from './fml-graph';
import {FMLRuleRenderer} from './rule-renderers/renderer';
import {FMLDefaultRuleRenderer} from './rule-renderers/default.renderer';
import {FMLAppendRuleRenderer} from './rule-renderers/append.renderer';
import {FMLCopyRenderer} from './rule-renderers/copy.renderer';


const alphabet = getAlphabet().map(el => el.toLowerCase());
let varCnt = -1;
const nextVar = (): string => {
  varCnt++;
  const times = Math.floor(varCnt / 26);
  return [...Array.from({length: times - 1}).fill(0), varCnt % 26].map(i => alphabet[i as number]).join('');
};

const toVariable = (variables, obj, f?): string => variables[[obj, f].filter(Boolean).join('.')] = nextVar();


export class FmlStructureGenerator {
  // rule renderer
  private static _getRuleRenderer = (action: string): FMLRuleRenderer => this.ruleRenderers.find(rr => rr.action === action) ?? new FMLDefaultRuleRenderer();
  private static ruleRenderers = [
    new FMLAppendRuleRenderer(),
    new FMLCopyRenderer()
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
    smGroup.input = [...sources, ...targets].map<StructureMapGroupInput>((o, i) => ({
      name: o.name,
      type: o.resource,
      mode: o.mode as StructureMapGroupInput['mode'],
    }));


    const targetFields = Object.values(fml.objects)
      .filter(o => o.mode === 'target')
      .flatMap(o => o.fields.filter(f => fml.getSources(o.name, f.name).length).map(f => [o.name, f.name]))

    console.log(targetFields)


    targetFields.forEach(([object, field]) => {
      const _fml = fml.subFML(object, field);
      const topology = FMLGraph.fromFML(_fml).dfsTopSort();
      const topologicalOrder = Object.keys(topology).sort(e => topology[e]).reverse();

      const inputs = (obj: FMLStructureObject) => {
        return _fml.connections
          .filter(c => c.targetObject === obj.name)
          .map(c => c.targetFieldIdx)
          .filter(unique)
          .map(idx => obj.fields[idx]);
      };

      const outputs = (obj: FMLStructureObject) => {
        return _fml.connections
          .filter(c => c.sourceObject === obj.name)
          .map(c => c.sourceFieldIdx)
          .filter(unique)
          .map(idx => obj.fields[idx]);
      };


      let smRule: StructureMapGroupRule;

      const paramVals = {};
      const res = [];

      let ctx;
      topologicalOrder.forEach(name => {
        const ctxName = ctx?.name ?? '_src';
        const obj = _fml.objects[name];
        const rule = _fml.rules.find(r => r.name === name);

        if (rule) {
          const {str, fml} = this._getRuleRenderer(rule.action).generate(rule, paramVals);
          res.push(str);
          smRule.target.push(fml);
        }

        if (obj) {
          ctx = obj;
          if (['source', 'element'].includes(obj.mode)) {
            if ('source' === obj.mode) {
              res.push(`${obj.name} -> `);
              smGroup.rule.push(smRule = {
                source: [{context: obj.name}],
                rule: [],
                target: []
              });
            }

            outputs(obj).forEach(n => {
              const base = obj.name.split("#")[0];
              const v = paramVals[`${obj.name}.${n.name}`] = nextVar();

              res.push(`, evaluate(${paramVals[base] ?? base}, ${n.name}) as ${v}`);
              smRule.target.push({
                variable: v,
                transform: 'evaluate',
                parameter: [
                  {valueId: paramVals[base] ?? base},
                  {valueString: n.name}
                ]
              });
            });
          }

          if (['target', 'object'].includes(obj.mode)) {
            inputs(obj).forEach(n => {
              if ('object' === obj.mode) {
                const v = paramVals[`${obj.name}`] = nextVar();

                res.push(`, create('${obj.resource}') as ${v}`);
                smRule.target.push({
                  variable: v,
                  transform: 'create',
                  parameter: [
                    {valueString: obj.resource}
                  ]
                });
              }

              const fieldSources = _fml.getSources(obj.name, n.name);
              if (fieldSources.length >= 2) {
                console.warn("Has multiple sources")
              }

              res.push(`, ${paramVals[obj.name] ?? obj.name}.${n.name} = ${paramVals[fieldSources[0].object] ?? fieldSources[0].object}`);
              smRule.target.push({
                context: paramVals[obj.name] ?? obj.name,
                element: n.name,
                transform: 'copy',
                parameter: [
                  {valueId: paramVals[fieldSources[0].object] ?? fieldSources[0].object}
                ]
              });
            });
          }
        }
      });

      console.log(res.join("\n").replaceAll("#", "_"));
      console.log(paramVals);
    })


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
