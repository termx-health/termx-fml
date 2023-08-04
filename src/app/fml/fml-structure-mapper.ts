import {duplicate, group, isDefined, isNil, unique} from '@kodality-web/core-util';
import {
  Bundle,
  StructureDefinition,
  StructureMap,
  StructureMapGroup,
  StructureMapGroupInput,
  StructureMapGroupRule,
  StructureMapGroupRuleTarget,
  StructureMapStructure
} from 'fhir/r5';
import {FMLRuleParser, FMLRuleParserVariables} from './rule-parsers/parser';
import {FMLCopyRuleParser} from './rule-parsers/copy.parser';
import {FMLStructure, FMLStructureConnection, FMLStructureObject, FMLStructureRule} from './fml-structure';
import {FMLAppendRuleParser} from './rule-parsers/append.parser';
import {FMLCreateRuleParser} from './rule-parsers/create.parser';
import {FMLUuidRuleParser} from './rule-parsers/uuid.parser';
import {FMLDefaultRuleParser} from './rule-parsers/default.parser';


export class FMLStructureMapper {
  public static compose(fml: FMLStructure): StructureMap {
    const ruleNames = fml.rules.map(r => r.name).filter(unique);


    const fieldName = (name, idx): string => {
      if (fml.objects[name]) {
        return fml.objects[name].fields[idx]?.name;
      }
    };


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
    const sources = Object.values(fml.objects).filter(o => o.mode === 'source');
    const targets = Object.values(fml.objects).filter(o => o.mode === 'target');
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


    const ruleHandler = (con: FMLStructureConnection, group: StructureMapGroup, rule: FMLStructureRule): {rule: StructureMapGroupRule, next: string}[] => {
      const res: StructureMapGroupRule[] = [];

      // x -> rule (con.source) -> target object, find all x

      const ruleSources = fml.getSources(con.sourceObject);
      if (ruleSources.length === 0) {
        // constant or unconnected rule
        ruleSources.push({
          object: group.input.find(i => i.mode === 'source')?.name
        });
      }


      ruleSources.forEach(src => {
        res.push({
          name: rule.name.slice(0, rule.name.lastIndexOf("#")),
          source: [{
            context: src.object,
            element: src.field
          }],
          target: [{
            context: con.targetObject,
            element: fieldName(con.targetObject, con.targetFieldIdx),
            transform: rule.action as StructureMapGroupRuleTarget['transform'],
            parameter: (rule.parameters ?? []).map(p => ({
              valueString: p
            }))
          }],
          rule: []
        });
      });


      return res.map(rule => ({
        rule,
        next: con.sourceObject
      }));
    };

    const objectHandler = (con: FMLStructureConnection, group: StructureMapGroup, obj: FMLStructureObject): {rule: StructureMapGroupRule, next: string}[] => {
      const res: StructureMapGroupRule[] = []

      if (obj.mode === 'object') {
        console.group('RULE create');
        console.log(
          `${con.sourceObject} -> ${con.targetObject}:${fieldName(con.targetObject, con.targetFieldIdx)}`
        );

        res.push({
          name: `create-${con.sourceObject}:${fieldName(con.sourceObject, con.sourceFieldIdx)}`,
          source: [{
            context: con.sourceObject,
            element: fieldName(con.sourceObject, con.sourceFieldIdx)
          }],
          target: [{
            context: con.targetObject,
            element: fieldName(con.targetObject, con.targetFieldIdx),
            transform: 'create',
            parameter: [{
              valueString: obj.resource
            }]
          }],
          rule: []
        });
      } else {

        console.group('OBJECT', obj.mode);
        console.log(
          `${con.sourceObject}:${fieldName(con.sourceObject, con.sourceFieldIdx)} -> ${con.targetObject}:${fieldName(con.targetObject, con.targetFieldIdx)}`
        );
      }

      console.groupEnd();

      return res.map(rule => ({
        rule,
        next: con.sourceObject
      }));
    };

    const x = (_targetObject: string, out: StructureMapGroupRule[]) => {
      // find connections where target is provided object
      const ruleConnections = fml.connections.filter(con => con.targetObject === _targetObject);


      ruleConnections.forEach(con => {
        const isRule = ruleNames.includes(con.sourceObject);

        let smRules: {rule: StructureMapGroupRule, next: string}[];
        if (isRule) {
          smRules = ruleHandler(con, smGroup, fml.rules.find(r => r.name === con.sourceObject));
        } else {
          smRules = objectHandler(con, smGroup, fml.objects[con.sourceObject]);
        }

        smRules.forEach(r => {
          out.push(r.rule);
          // x(r.next, out); // x(r.next, r.rule.rule);
          x(r.next, r.rule.rule);
        });
      });

      // todo: recursion
      //  find objects where $obj.target = $rule.source, for each $obj execute x($obj.name)

      // });
    };

    targets.forEach(({name}) => x(name, smGroup.rule));
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
        fhirRule.source ??= [];
        fhirRule.target ??= [];

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
