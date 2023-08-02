import {duplicate, group, isDefined, isNil, unique} from '@kodality-web/core-util';
import {Bundle, StructureDefinition, StructureMap, StructureMapGroupInput, StructureMapGroupRule, StructureMapStructure} from 'fhir/r5';
import {FMLRuleParser, FMLRuleParserVariables} from './rule-parsers/parser';
import {FMLCopyRuleParser} from './rule-parsers/copy.parser';
import {FMLStructure, FMLStructureObject} from './fml-structure';
import {FMLAppendRuleParser} from './rule-parsers/append.parser';
import {FMLCreateRuleParser} from './rule-parsers/create.parser';
import {FMLUuidRuleParser} from './rule-parsers/uuid.parser';
import {FMLDefaultRuleParser} from './rule-parsers/default.parser';


export class FMLStructureMapper {
  public static compose(fml: FMLStructure): StructureMap {
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


    const sources = Object.values(fml.objects).filter(o => o.mode === 'source');
    const targets = Object.values(fml.objects).filter(o => o.mode === 'target');
    sm.structure = [...sources, ...targets].map<StructureMapStructure>(o => ({
      url: `http://termx.health/fhir/StructureDefinition/${o.resource}`,
      mode: o.mode as StructureMapStructure['mode'],
      alias: o.resource
    }));

    const smGroup = sm.group[0];
    smGroup.input = [...sources, ...targets].map<StructureMapGroupInput>(o => ({
      name: o.name,
      type: o.resource,
      mode: o.mode as StructureMapGroupInput['mode'],
    }));


    /*
        const x = (targetObject: string) => {
          const targetRules = fml.rules.filter(r => r.targetObject === targetObject)

          targetRules.forEach(r => {
            const fhirRule: StructureMapGroupRule = {
              name: r.name.slice(0, r.name.lastIndexOf("#")),
              source: [{
                context: r.sourceObject,
                element: r.sourceField
              }],
              target: [{
                context: r.targetObject,
                element: r.targetField,
                transform: r.action as StructureMapGroupRuleTarget['transform'],
                parameter: (r.parameters ?? []).map(p => ({
                  valueString: p
                }))
              }]
            }

            // todo: recursion
            //  find objects where $obj.target = $rule.source, for each $obj execute x($obj.name)

            smGroup.rule.push(fhirRule);
          })
        }
    */

    // targets.forEach(({name}) => x(name))
    return sm;
  }

  public static map(bundle: Bundle<StructureDefinition>, fhir: StructureMap): FMLStructure {
    const ruleParsers: FMLRuleParser[] = [
      new FMLCopyRuleParser(),
      new FMLCreateRuleParser(),
      new FMLUuidRuleParser(),
      new FMLAppendRuleParser(),
    ];


    const getRuleParser = (transform) => {
      const parser = ruleParsers.find(p => p.action === transform);
      if (isNil(parser)) {
        console.warn(`Parser for the "${transform}" transformation not found, fallback to default`);
        return new FMLDefaultRuleParser();
      }
      return parser;
    };


    // finds the correct resource type based on URL
    const getKey = ({url}: StructureMapStructure) => bundle.entry.find(c => c.resource.url === url)?.resource?.id;

    const struc = new FMLStructure();
    struc.bundle = bundle;

    // [alias | resource] -> FMLStructureObject
    struc.objects = group(fhir.structure ?? [], s => s.alias ?? getKey(s), s => {
      const resource = getKey(s);
      return struc.newFMLObject(resource, s.alias ?? getKey(s), s.mode);
    });


    // groups
    fhir.group.forEach(fhirGroup => {
      // rules
      fhirGroup.rule.forEach(fhirRule => {
        const variables = group(fhirGroup.input, i => i.name, i => i.type);
        _parseRule(fhirRule, variables);
      });


      // hoisting
      function _parseRule(fhirRule: StructureMapGroupRule, variables: FMLRuleParserVariables) {
        [...fhirRule.source, ...fhirRule.target]
          .filter(r => isDefined(r.variable))
          .forEach(r => {
            if (isNil(r.context)) {
              // if rule is missing target element, then rule itself is used as input somewhere
              // NB: FHIR rule name is used here!
              variables[r.variable] = `${fhirRule.name}`;
            } else {
              variables[r.variable] = `${variables[r.context]}.${r.element}`;
            }
          });


        // NB: currently only one source
        const fhirRuleSource = fhirRule.source[0];

        fhirRule.target.forEach(fhirRuleTarget => {
          try {
            const {
              rule,
              object,
              connections
            } = getRuleParser(fhirRuleTarget.transform).parse(struc, fhirRule.name, fhirRuleSource, fhirRuleTarget, variables);

            if (isDefined(object)) {
              struc.objects[object.name] = object;
            }
            if (isDefined(rule)) {
              struc.rules.push(rule);
            }
            if (isDefined(connections)) {
              connections.forEach(c => struc.putConnection(c));
            }
          } catch (e) {
            console.error(e);
          }
        });


        fhirRule.rule?.forEach(subRule => _parseRule(subRule, variables));
      }
    });


    // validate
    const merged = {
      ...struc.objects,
      ...group(struc.rules, r => r.name)
    };

    struc.connections.forEach(c => {
      if (isNil(merged[c.sourceObject])) {
        console.warn(`Unknown SOURCE object "${c.sourceObject}"`);
      } else if (
        merged[c.sourceObject] instanceof FMLStructureObject &&
        merged[c.sourceObject]['fields'].length < c.sourceFieldIdx
      ) {
        console.warn(`Unknown SOURCE FIELD of object "${c.sourceObject}"`);
      }

      if (isNil(merged[c.targetObject])) {
        console.warn(`Unknown TARGET object "${c.targetObject}"`);
      } else if (
        merged[c.targetObject] instanceof FMLStructureObject &&
        merged[c.targetObject]['fields'].length < c.targetFieldIdx
      ) {
        console.warn(`Unknown TARGET FIELD of object "${c.targetObject}"`);
      }
    });


    fhir.group.forEach(fhirGroup => {
      const _collectNames = (r: StructureMapGroupRule): string[] => {
        return [r.name, ...(r.rule?.flatMap(sr => _collectNames(sr)) ?? [])];
      };

      const rules = fhirGroup.rule.flatMap(fhirRule => _collectNames(fhirRule));
      const duplicates = rules.filter(duplicate);
      if (duplicates.length) {
        console.warn(`Structure Map's group ${fhirGroup.name} has duplicate rules`, duplicates.filter(unique));
      }
    });

    return struc;
  }
}
