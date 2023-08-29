import {copyDeep, isDefined, isNil} from '@kodality-web/core-util';
import {StructureMap, StructureMapGroup, StructureMapGroupInput, StructureMapGroupRule, StructureMapGroupRuleTarget, StructureMapStructure} from 'fhir/r5';
import {$THIS, FMLStructure, FMLStructureGroup, FMLStructureObject} from './fml-structure';
import {getAlphabet, SEQUENCE, substringBeforeLast, VARIABLE_SEP} from './fml.utils';
import {FMLGraph} from './fml-graph';
import {getRuleComposer} from './rule/composers/_composers';
import {FMLStructureSimpleMapper} from './fml-structure-simple';


const alphabet = getAlphabet().map(el => el.toLowerCase());
let varCnt = -1;
const nextVar = (): string => {
  varCnt++;
  const times = Math.floor(varCnt / 26);
  return [...Array.from({length: times - 1}).fill(0), varCnt % 26].map(i => alphabet[i as number]).join('');
};


interface FmlStructureGeneratorOptions {
  mapName?: string
}

export class FmlStructureComposer {
  private static MAIN = 'main';

  public static generate(fml: FMLStructure, options?: FmlStructureGeneratorOptions): StructureMap {
    return this._generate(fml, options);
  }

  private static _generate(fml: FMLStructure, options?: FmlStructureGeneratorOptions): StructureMap {
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
      valueString: JSON.stringify(FMLStructureSimpleMapper.fromFML(fml))
    }];

    // structure container resources (ConceptMap)
    sm.contained = fml.maps
      .filter(m => m.mode === 'internal')
      .map(m => ({
        resourceType: 'ConceptMap',
        id: m.name,
        status: 'draft',
        group: m.mappings.map(mapping => ({
          source: m.source,
          target: m.target,
          element: [{
            code: mapping.source,
            target: [{
              code: mapping.target,
              relationship: 'related-to'
            }]
          }]
        }))
      }));

    // structure inputs
    sm.structure = Object.values(fml.groups[this.MAIN].objects)
      .filter(o => ['source', 'target'].includes(o.mode))
      .map(o => ({
        url: o.url,
        mode: o.mode as StructureMapStructure['mode'],
        alias: o.name
      }));

    // structure groups
    Object.keys(fml.groups).forEach(groupName => {
      const fmlGroup = fml.groups[groupName];
      const smGroup = this.generateGroup(fml, fmlGroup, groupName);
      sm.group.push(smGroup);
    });

    return sm;
  }

  private static generateGroup(fml: FMLStructure, fmlGroup: FMLStructureGroup, groupName: string): StructureMapGroup {
    const smGroup = {
      name: groupName,
      input: [],
      rule: []
    };

    // group inputs
    smGroup.input = Object.values(fmlGroup.objects)
      .filter(o => ['source', 'target'].includes(o.mode))
      .map(o => ({
        name: normalize(o.name),
        type: o.element.id.includes('.') ? 'Any' : o.element.id,
        mode: o.mode as StructureMapGroupInput['mode'],
      }));


    // group rules
    if (groupName !== this.MAIN) {
      this.generateRule(fml, fmlGroup, smGroup);
      return smGroup;
    }

    /*
       Magic below does following:

       before:
       # AModel (target)
         * x -> field-1
         *      field-2
         * y -> field-3

       after:
       [[AModel, field-1], [AModel, field-3]]

       If field has multiple source objects, only unique fields are returned.
     */
    Object.values(fmlGroup.objects)
      .filter(o => o.mode === 'target')
      .flatMap(o => o.fields.filter(f => fmlGroup.getSources(o.name, f.name).length).map(f => [o.name, f.name]))
      .filter((v, idx, self) => self.findIndex(el => el.join('_') === v.join('_')) === idx)
      .forEach(([target, field]) => {
        const subFml = fml.subFML(groupName, target, field);
        this.generateRule(subFml, subFml.groups[groupName], smGroup);
      });

    return smGroup;
  }

  private static generateRule(fml: FMLStructure, fmlGroup: FMLStructureGroup, smGroup: StructureMapGroup): void {
    const topology = FMLGraph.fromFML(fmlGroup).topologySort();
    const topologicalOrder = Object.keys(topology).sort(e => topology[e]).reverse();
    const vars = {};

    // creates objects in reverse order, starting from target
    const newObjects = copyDeep(topologicalOrder).reverse()
      .filter(name => 'object' === fmlGroup.objects[name]?.mode)
      .flatMap<StructureMapGroupRuleTarget>(name => {
        const obj = fmlGroup.objects[name];

        if (FMLStructureGroup.isBackboneElement(obj.resource)) {
          // sub element select, e.g. "objekti.v2li as field"
          return fmlGroup.getTargets(obj.name).map(n => ({
            context: vars[n.targetObject] ?? n.targetObject,
            element: n.field,
            variable: vars[`${obj.name}`] = nextVar(),
          }));
        }

        const target = fmlGroup.getTargets(obj.name).find(t => t.field);

        // full create, e.g. "create('Resource') as r"
        return [{
          context: normalize(vars[target.targetObject] ?? target.targetObject),
          element: target.field,
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
      const rule = fmlGroup.rules.find(r => r.name === name);
      if (rule) {
        const {target, dependent} = getRuleComposer(rule.action).generate(fml, fmlGroup, rule, ctx, vars);
        if (isDefined(target)) {
          smRule.target.push(target);
        }
        if (isDefined(dependent)) {
          smRule.dependent.push(dependent);
        }
      }


      const obj = fmlGroup.objects[name];
      if (obj) {
        ctx = obj;

        if (isNil(smRule)) {
          // in ideal world, it would be the first step (in reality it may not)
          smRule = {
            name: `rule_${SEQUENCE.next()}`,
            source: [{context: normalize(obj.name)}],
            target: [...newObjects],
            rule: [],
            dependent: []
          };

          // creates the new rule inside of group
          smGroup.rule.push(smRule);
        }


        /*
        * source - objects provided as input, the main entities on which the transformations should be performed
        * element - BackboneElements, source object's sub element
        */
        if (['source', 'element'].includes(obj.mode)) {
          // initialize (puts into vars) fields that are used as source in other objects/rules
          // e.g. "evaluate(srcObject, subfield) as a"
          fmlGroup.outputFields(obj).forEach(n => {
            // source object's name should remain the same
            const baseName = obj.mode === 'source'
              ? obj.name
              : substringBeforeLast(obj.name, VARIABLE_SEP);

            smRule.target.push({
              variable: vars[`${obj.name}.${n.name}`] = nextVar(),
              transform: 'evaluate',
              parameter: [
                {valueId: normalize(vars[baseName] ?? baseName)},
                {valueString: n.name}
              ]
            });
          });
        }


        if (['target', 'object'].includes(obj.mode)) {
          // variable assignment, e.g. "tgtObject.subfield = a"
          fmlGroup.inputFields(obj).forEach(n => {
            const fieldSources = fmlGroup.getSources(obj.name, n.name);
            if (fieldSources.length >= 2) {
              console.warn("Has multiple sources");
            }

            const {sourceObject, field} = fieldSources[0];
            if (field === $THIS) {
              // do not assign when connection comes from $this.
              // assumes this is object creation, the assignment is done above;
              return;
            }

            if (FMLStructureGroup.isBackboneElement(fmlGroup.objects[sourceObject]?.resource)) {
              // fixme: previously returned here, but seems like it is redundant now?
              console.warn("backbone element", fmlGroup.objects[sourceObject]);
            }

            if (smRule.dependent.length > 0) {
              // dependant rule must be the last one, variable assignments are forbidden after
              return;
            }


            smRule.target.push({
              context: normalize(vars[obj.name] ?? obj.name),
              element: n.name,
              transform: 'copy',
              parameter: [
                // create(Any) ?? field (type='var') ?? default fallback
                {valueId: vars[sourceObject] ?? vars[`${sourceObject}.${field}`] ?? sourceObject}
              ]
            });
          });
        }
      }
    });
  }
}


function normalize(txt: string): string {
  if (isNil(txt)) {
    return undefined;
  }
  // const baseName = substringBeforeLast(txt, VARIABLE_SEP);
  return txt.replaceAll('.', '_');
}
