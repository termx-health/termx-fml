import {duplicate, group, isDefined, isNil, unique} from '@kodality-web/core-util';
import {Bundle, StructureDefinition, StructureMap, StructureMapGroupRule, StructureMapStructure} from 'fhir/r5';
import {FMLRuleParserVariables} from './rule-parsers/parser';
import {FMLStructure, FMLStructureConnection, FMLStructureEntityMode, FMLStructureObject, FMLStructureRule} from './fml-structure';
import {plainToInstance} from 'class-transformer';
import {getRuleParser} from './rule-parsers/_parsers';


export class FMLStructureMapper {
  private static MAIN = 'main';

  public static map(bundle: Bundle<StructureDefinition>, fhir: StructureMap): {[groupName: string]: FMLStructure} {
    const exported = fhir.extension?.find(ext => ext.url === 'fml-export')?.valueString;
    if (exported) {
      let parsed = JSON.parse(exported);
      if (isNil(parsed[this.MAIN])) {
        parsed = {[this.MAIN]: parsed};
      }
      return group(Object.keys(parsed), k => k, k => this.fromObj(bundle, parsed[k]));
    }


    // finds the correct resource type based on URL
    const getKey = ({url}: StructureMapStructure) => bundle.entry.find(c => c.resource.url === url)?.resource?.id;

    const struc = new FMLStructure();
    struc.bundle = bundle;

    // [alias | resource] -> FMLStructureObject
    struc.objects = group(fhir.structure ?? [], s => s.alias ?? getKey(s), s => {
      const resource = getKey(s);
      return struc.newFMLObject(resource, s.alias ?? getKey(s), s.mode as FMLStructureEntityMode);
    });


    // groups
    fhir.group.forEach(fhirGroup => {
      // rules
      fhirGroup.rule.forEach(fhirRule => {
        const variables = group(fhirGroup.input, i => i.name, i => i.type);
        _parseRule(fhirRule, variables);
      });


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

            if (isNil(fhirRuleTarget.context)) {
              variables[fhirRuleTarget.variable] = `${rule.name}`;
            }
          } catch (e) {
            console.error(e);
          }
        });


        fhirRule.rule?.forEach(subRule => _parseRule(subRule, variables));
      }
    });


    // validate
    this.validate(struc, fhir);

    return {[this.MAIN]: struc};
  }

  private static validate(struc: FMLStructure, fhir: StructureMap): void {
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
  }

  private static fromObj(bundle: Bundle<StructureDefinition>, d: {
    objects: {[name: string]: Omit<FMLStructureObject, 'rawFields'>},
    rules: FMLStructureRule[],
    connections: FMLStructureConnection[]
  }): FMLStructure {
    const fml = new FMLStructure();
    fml.bundle = bundle;
    Object.keys(d.objects).forEach(k => fml.objects[k] = plainToInstance(FMLStructureObject, {
      ...d.objects[k],
      rawFields: d.objects[k].fields
    }));
    fml.rules = plainToInstance(FMLStructureRule, d.rules);
    fml._connections = plainToInstance(FMLStructureConnection, d.connections);
    return fml;
  }
}
