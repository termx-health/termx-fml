import {copyDeep, isDefined, isNil, unique} from '@kodality-web/core-util';
import {
  StructureMap,
  StructureMapGroup,
  StructureMapGroupInput,
  StructureMapGroupRule,
  StructureMapGroupRuleSource,
  StructureMapGroupRuleTarget,
  StructureMapStructure
} from 'fhir/r5';
import {$THIS, FMLStructure, FMLStructureGroup, FMLStructureObject, FMLStructureRule} from './fml-structure';
import {getSingle, nestRules, normalize, SEQUENCE, substringBeforeLast, VARIABLE_SEP, variableHolder} from './fml.utils';
import {FMLGraph} from './fml-graph';
import {getRuleComposer} from './rule/composers/_composers';
import {FMLStructureSimpleMapper} from './fml-structure-simple';


interface FmlStructureComposeOptions {
  mapName?: string
}

export class FmlStructureComposer {
  public static generate(fml: FMLStructure, options?: FmlStructureComposeOptions): StructureMap {
    return this._generate(fml, options);
  }

  private static _generate(fml: FMLStructure, options?: FmlStructureComposeOptions): StructureMap {
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

    // structure contained resources (ConceptMap)
    sm.contained = fml.conceptMaps
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
    sm.structure = Object.values(fml.getGroup(fml.mainGroupName).objects)
      .filter(o => ['source', 'target'].includes(o.mode))
      .map(o => ({
        url: o.url,
        mode: o.mode as StructureMapStructure['mode'],
        alias: o.name
      }));

    // structure imports
    sm.import = fml.groups
      .filter(g => g.external)
      .map(g => g.externalMapUrl)
      .filter(unique);

    // structure groups
    fml.groups.filter(g => !g.external).forEach(fmlGroup => {
      const smGroup = this.generateGroup(fml, fmlGroup);
      sm.group.push(smGroup);
    });


    // optimize
    this.optimize(sm);

    return sm;
  }

  private static generateGroup(fml: FMLStructure, fmlGroup: FMLStructureGroup): StructureMapGroup {
    const smGroup: StructureMapGroup = {
      name: fmlGroup.name,
      input: [],
      rule: []
    };

    // group inputs
    smGroup.input = Object.values(fmlGroup.objects)
      .filter(o => ['source', 'target'].includes(o.mode))
      .map(o => ({
        name: normalize(o.name),
        type: o.element.id.includes('.') ? 'Any' : o.name,
        mode: o.mode as StructureMapGroupInput['mode'],
      }));


    // group rules
    if (fmlGroup.shareContext) {
      this.generateRule(fml, fmlGroup, smGroup);
      return smGroup;
    }

    /*
       Magic below does following:

       before:
       # AModel (target)
         Rule.x -> field-1
                   field-2
         Rule.y -> field-3

       after:
       [[AModel, field-1], [AModel, field-3]]

       If field has multiple source objects, only unique fields are returned.
     */
    Object.values(fmlGroup.objects)
      // find target objects
      .filter(o => o.mode === 'target')
      // map to [obj, field] of fields that have connections
      .flatMap(o =>
        o.fields
          .filter(f => fmlGroup.getSources(o.name, f.name).length)
          .map(f => [o.name, f.name]))
      // unique
      .filter((v, idx, self) => self.findIndex(el => el.join('_') === v.join('_')) === idx)
      .forEach(([target, field]) => {
        fml.subFML(fmlGroup.name, target, field).forEach(subFml => {
          this.generateRule(subFml, subFml.getGroup(fmlGroup.name), smGroup);
        });
      });

    return smGroup;
  }


  private static generateRule(fml: FMLStructure, fmlGroup: FMLStructureGroup, smGroup: StructureMapGroup): void {
    if (fmlGroup.notation === 'fml') {
      this.generateRuleFmlNotation(fml, fmlGroup, smGroup);
    } else {
      this.generateRuleEvaluateNotation(fml, fmlGroup, smGroup);
    }
  }

  private static generateRuleFmlNotation(fml: FMLStructure, fmlGroup: FMLStructureGroup, smGroup: StructureMapGroup): void {
    const topology = FMLGraph.fromFML(fmlGroup).topologySort();
    const topologicalOrder = Object.keys(topology).sort(e => topology[e]).reverse().filter(n => fmlGroup.objects[n]);

    // order of "source" objects from "left" (-->)
    const sourceTopology = topologicalOrder
      .map(n => fmlGroup.objects[n])
      .filter(o => ['source', 'element'].includes(o.mode));

    // order of "target" objects from "right" (<--)
    const targetTopology = topologicalOrder
      .map(n => fmlGroup.objects[n])
      .filter(o => ['target', 'object'].includes(o.mode))
      .reverse();


    const vh = variableHolder(Object.values(fmlGroup.objects).filter(o => ['source', 'target'].includes(o.mode)));
    const {vars, asVar, toVar} = vh;

    let frontOffset = -1, backOffset = -1;
    let smRule: StructureMapGroupRule;

    for (let i = 0; i < 1001; i++) {
      if (frontOffset >= sourceTopology.length - 1 && backOffset >= targetTopology.length - 1) {
        break;
      }

      const srcCtx = sourceTopology[++frontOffset] ?? sourceTopology[--frontOffset];
      const tgtCtx = targetTopology[++backOffset] ?? targetTopology[--backOffset];

      // todo: what would happen if multiple sources and targets were returned?
      //  current implementation relies on a single source and target, bad?
      const srcObj = getSingle(fmlGroup.getSources(srcCtx.name), "Has multiple sources");
      const tgtObj = getSingle(fmlGroup.getTargets(tgtCtx.name), "Has multiple targets");

      const srcName = srcObj ? `${asVar(srcObj.sourceObject)}|$|${srcObj.field}` : srcCtx.name;
      const tgtName = tgtObj ? `${asVar(tgtObj.targetObject)}|$|${tgtObj.field}` : tgtCtx.name;
      //                                                           ^^^ MAGIC STRING


      // create sub-rule
      const _rule: StructureMapGroupRule = {
        name: `rule_${SEQUENCE.next()}`,
        source: [
          srcName in vars ? {
            context: asVar(srcName),
          } : {
            context: srcName.split('|$|')[0],
            element: srcName.split('|$|')[1],
            variable: vars[srcName] = toVar(srcCtx.name)
          }
        ],
        target: [
          tgtName in vars ? {
            transform: 'copy',
            parameter: [{valueId: asVar(tgtName)}],
          } : {
            context: tgtName.split('|$|')[0],
            element: tgtName.split('|$|')[1],
            variable: vars[tgtName] = toVar(tgtCtx.name)
          }
        ],
        rule: [],
        dependent: []
      };


      if (smRule) {
        // append _rule to "previous" SM rule
        smRule.rule.push(_rule);
        smRule = _rule;
      } else {
        // set _rule as the group's main SM rule
        smGroup.rule.push(_rule);
        smRule = _rule;
      }


      fmlGroup.inputFields(tgtCtx).forEach(tgtField => {
        const _inputRules = (obj: string, name?: string): FMLStructureRule[] => {
          const cons = fmlGroup.getSources(obj, name).map(c => c.sourceObject);
          const rules = fmlGroup.rules.filter(r => cons.includes(r.name));
          return [
            ...rules,
            ...rules.flatMap(r => _inputRules(r.name))
          ].filter(isDefined);
        };

        // find rules that lead to this "target.field"
        const ruleSmRules = _inputRules(tgtCtx.name, tgtField.name)
          .reverse()
          .map(fmlRule => {
            return getRuleComposer(fmlRule.action).generateFml(
              fml, fmlGroup, fmlRule,
              srcCtx, tgtCtx, vh
            );
          })
          .filter(isDefined);

        if (ruleSmRules.length) {
          smRule.rule.push(nestRules(ruleSmRules).main);
        }


        // direct connections between "srcCtx.*" and "tgtCtx.tgtField"
        fmlGroup.getSources(tgtCtx.name, tgtField.name)
          .filter(src => src.sourceObject === srcCtx.name)
          .filter(src => isDefined(src.field))
          .forEach(src /* srcCtx */ => {
            if (src.field === $THIS) {
              console.warn(`Ignoring "${$THIS}" variable assignment "${src.sourceObject}.${src.field}" -> "${tgtCtx.name}.${tgtField.name}"`);
              return;
            }

            smRule.rule.push({
              name: `DSET_${SEQUENCE.next()}`,
              source: [{
                context: asVar(src.sourceObject),
                element: src.field,
                variable: toVar(`${src.sourceObject}.${src.field}`)
              }],
              target: [{
                context: asVar(tgtCtx.name),
                element: tgtField.name,
                transform: 'copy',
                parameter: [
                  {valueId: asVar(`${src.sourceObject}.${src.field}`)}
                ]
              }],
              rule: [],
              dependent: []
            });
          });
      });
    }
  }

  private static generateRuleEvaluateNotation(fml: FMLStructure, fmlGroup: FMLStructureGroup, smGroup: StructureMapGroup): void {
    const topology = FMLGraph.fromFML(fmlGroup).topologySort();
    const topologicalOrder = Object.keys(topology).sort(e => topology[e]).reverse();

    const inputObjects = Object.values(fmlGroup.objects).filter(o => ['source', 'target'].includes(o.mode));
    const vh = variableHolder(inputObjects);
    const {vars, asVar, toVar} = vh;

    // creates objects in reverse order, starting from target
    const newObjects = copyDeep(topologicalOrder).reverse()
      .filter(name => ['object', 'produced'].includes(fmlGroup.objects[name]?.mode))
      .flatMap<StructureMapGroupRuleTarget>(name => {
        const obj = fmlGroup.objects[name];
        const objResourceType = obj.url.startsWith('http://hl7.org/fhir/StructureDefinition/') ? obj.resource : obj.url; // todo: configurable URL

        if (FMLStructureGroup.isBackboneElement(obj.resource)) {
          // sub element select, e.g. "objekti.v2li as field"
          return fmlGroup.getTargets(obj.name).map(n => ({
            context: asVar(n.targetObject),
            element: n.field,
            variable: toVar(obj.name),
          }));
        }

        const target = fmlGroup.getTargets(obj.name).find(t => t.field);
        if (isNil(target)) {
          return [{
            variable: toVar(obj.name),
            transform: 'create',
            parameter: [{valueString: objResourceType}]
          }];
        }

        // full create, e.g. "create('Resource') as r"
        return [{
          context: asVar(target.targetObject),
          element: target.field,
          variable: toVar(obj.name),
          transform: 'create',
          parameter: [{valueString: objResourceType}]
        }];
      })
      .filter(isDefined);


    let ctx: FMLStructureObject;
    let smRule: StructureMapGroupRule;

    topologicalOrder.forEach(name => {
      const obj = fmlGroup.objects[name];
      if (obj) {
        ctx = obj;

        /*
        * source - objects provided as input, the main entities on which the transformations should be performed
        * element - BackboneElements, source object's sub element
        */
        if (['source', 'element'].includes(obj.mode)) {
          /*
          * Create a new rule. In ideal world, it would be the first step (in reality it may not).
          * Sources are appended later.
          */
          if (isNil(smRule)) {
            smRule = {
              name: `rule_${SEQUENCE.next()}`,
              source: [],
              target: [...newObjects],
              rule: [],
              dependent: []
            };

            // creates the new rule inside of group
            smGroup.rule.push(smRule);
          }


          /*
          * Initialize (puts into vars) fields that are used as source in other objects/rules
          * e.g. "evaluate(srcObject, subfield) as a"
          */
          fmlGroup.outputFields(obj).forEach(n => {
            // source object's name should remain the same
            const baseName = obj.mode === 'source'
              ? obj.name
              : substringBeforeLast(obj.name, VARIABLE_SEP);


            // copy variable reference for 'element' type object
            if (obj.mode === 'element' && n.name === $THIS) {
              const fieldSources = fmlGroup.getSources(obj.name, n.name);
              if (fieldSources.length >= 2) {
                console.warn(`"${obj.name}" has multiple sources`);
              }
              const {sourceObject, field} = fieldSources[0];
              vars[obj.name] ??= vars[`${sourceObject}.${field}`];
            }


            /*
            * "Array" transformation.
            * Transformation is possible if in current (sub)FML is only one connection from the field
            */
            const targets = fmlGroup.getTargets(obj.name, n.name);
            if (targets.length === 1 && fmlGroup.objects[targets[0].targetObject]) {
              const tgtObj = fmlGroup.objects[targets[0].targetObject];
              const tgtObjBaseName = substringBeforeLast(tgtObj.name, VARIABLE_SEP);

              if (isDefined(tgtObj.listOption)) {
                // rule CANNOT have multiple sources, we MUST nest them
                if (smRule.source.length) {
                  const _newSmRule = {
                    name: `rule_${SEQUENCE.next()}`,
                    source: [],
                    target: [],
                    rule: [],
                    dependent: []
                  };
                  smRule.rule.push(_newSmRule);
                  smRule = _newSmRule;
                }

                // mapping between our types and FHIR ones
                const listMapping: {
                  [k in FMLStructureObject['listOption']]?: StructureMapGroupRuleSource['listMode']
                } = {
                  first: 'first',
                  last: 'last'
                };

                const transformConditionParam = (c: string): string => {
                  if (isNil(c)) {
                    return;
                  }
                  Object.keys(fmlGroup.objects).sort(n => n.length).reverse().forEach(n => {
                    const _n = substringBeforeLast(n, VARIABLE_SEP);
                    if (c.includes(n) && vars[_n]) {
                      c = c.replaceAll(n, vars[_n]);
                    }
                  });
                  return c;
                };

                smRule.source.push({
                  context: asVar(baseName),
                  element: n.name,
                  variable:
                    vars[tgtObjBaseName] =
                      toVar(`${asVar(baseName, true)}.${n.name}`), // todo: document what it does?
                  condition: transformConditionParam(tgtObj.condition),
                  listMode: listMapping[tgtObj.listOption]
                });
                return;
              }
            }

            if (n.name !== $THIS) {
              // default: extract object's field via. evaluate
              smRule.target.push({
                transform: 'evaluate',
                variable:
                  vars[`${obj.name}.${n.name}`] =
                    toVar(`${asVar(obj.name, true)}.${n.name}`), // todo: document what it does?

                parameter: [
                  {valueString: `%${asVar(baseName)}.${n.name}`},
                ]
              });
            }
          });


          // if no sources were added, add root one
          if (smRule.source.length === 0) {
            smRule.source.push({
              context: normalize(obj.name)
            });
          }
        }


        if (isNil(smRule)) {
          throw new Error("Rule is not initialized.");
        }

        /*
         * target - objects provided as outputs, places where data should be mapped to
         * object - target object's sub element
         */
        if (['target', 'object'].includes(obj.mode)) {
          // variable assignment, e.g. "tgtObject.subfield = a"
          fmlGroup.inputFields(obj).forEach(n => {
            const fieldSources = fmlGroup.getSources(obj.name, n.name);
            if (fieldSources.length >= 2) {
              console.warn(`"${obj.name}" has multiple sources`);
            }

            const {sourceObject, field} = fieldSources[0];
            if (field === $THIS) {
              // do not assign when connection comes from $this.
              // assumes this is object creation, the assignment is done above;
              console.warn(`Ignoring "${$THIS}" variable assignment`);
              return;
            }

            if (smRule.dependent.length > 0) {
              // dependant rule must be the last one, variable assignments are forbidden after
              console.warn("Ignoring variable assigment, because dependant rule is already set");
              return;
            }


            smRule.target.push({
              context: asVar(obj.name),
              element: n.name,
              transform: 'copy',
              parameter: [
                // create(Any) ?? field (type='var') ?? default fallback
                {valueId: vars[`${asVar(sourceObject, true)}.${field}`] ?? sourceObject}
              ]
            });
          });
        }
      }


      const rule = fmlGroup.rules.find(r => r.name === name);
      if (isDefined(rule)) {
        const {target, dependent} = getRuleComposer(rule.action).generateEvaluate(fml, fmlGroup, rule, ctx, vh);
        if (isDefined(target)) {
          smRule.target.push(target);
        }
        if (isDefined(dependent)) {
          smRule.dependent.push(dependent);
        }
      }
    });
  }

  private static optimize(sm: StructureMap): void {
    sm.group?.forEach(g => {
      const varMap = {};
      const traverseRules = (rules: StructureMapGroupRule[]): void => {
        for (const r of rules) {
          r.target?.forEach(t => {
            varMap[t.variable] = normalize(t.variable);
          });

          traverseRules(r.rule);
        }
      };

      const optimizeRules = (rules: StructureMapGroupRule[]): void => {
        for (const r of rules) {
          r.target?.forEach(t => {
            // normalize variable names
            // 1. declared in target
            // 2. used by other targets
            t.variable = varMap[t.variable] ?? t.variable;
            t.parameter?.forEach(p => p.valueId = varMap[p.valueId] ?? p.valueId);
          });

          optimizeRules(r.rule);
        }
      };

      traverseRules(g.rule);
      optimizeRules(g.rule);
    });
  }
}
