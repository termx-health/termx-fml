import {duplicate, group, isDefined, isNil, unique} from '@kodality-web/core-util';
import {Bundle, StructureDefinition, StructureMap, StructureMapGroup, StructureMapGroupRule} from 'fhir/r5';
import {FMLRuleParserVariables} from './rule/parsers/parser';
import {FMLStructure, FMLStructureGroup, FMLStructureObject} from './fml-structure';
import {getRuleParser} from './rule/parsers/_parsers';
import {FMLStructureExportSimple, FMLStructureSimpleMapper} from './fml-structure-simple';


export class FmlStructureParser {
  public static map(bundle: Bundle<StructureDefinition>, fhir: StructureMap): FMLStructure {
    const exported = fhir.extension?.find(ext => ext.url === 'fml-export')?.valueString;

    if (exported) {
      let parsed = JSON.parse(exported);

      if (isNil(parsed['version']) && isNil(parsed['main'])) {
        console.warn("v0: from flat to nested");
        parsed = {['main']: parsed};
      }

      if (isNil(parsed['version'])) {
        console.warn("v1: from simple nested to complex");
        parsed = {
          groups: parsed,
          maps: Object.values(parsed).flatMap(o => o['maps'] || [])
        };
        parsed['version'] = '1';
      }

      if (parsed['version'] === '1') {
        console.warn("v1.1: adding shareContext param");
        Object.values(parsed['groups']).forEach(g => g['shareContext'] = true);
        parsed['version'] = '1.1';
      }

      if (parsed['version'] === '1.1') {
        console.warn("v1.2: change object fields' 'part' param to 'backbonePart'");
        Object.values(parsed['groups']).forEach(g => {
          Object.values(g['objects']).forEach(obj => {
            obj['fields'].forEach(f => f.backbonePart = f['part']);
          });
        });
        parsed['version'] = '1.2';
      }

      if (parsed['version'] === '1.2') {
        console.warn("v1.3: rename 'maps' to 'conceptMaps'");
        (parsed as FMLStructureExportSimple).conceptMaps = parsed['maps'];
        parsed['version'] = '1.3';
      }

      return FMLStructureSimpleMapper.toFML(bundle, parsed);
    }

    const fml = new FMLStructure();
    fml.bundle = bundle;
    fml.mainGroupName = fhir.group[0]?.name;
    // todo: map local concept maps

    fhir.group.forEach(fhirGroup => {
      const fmlGroup = this.mapGroup(bundle, fhir, fhirGroup);
      this.validate(fmlGroup, fhir);
      fml.setGroup(fmlGroup);
    });

    return fml;
  }

  public static mapGroup(bundle: Bundle<StructureDefinition>, fhirMap: StructureMap, fhirGroup: StructureMapGroup): FMLStructureGroup {
    const fmlGroup = new FMLStructureGroup(fhirGroup.name, () => bundle);
    fmlGroup.objects = {};

    // fixme: group can have multiple objects with same type, currently they get merged
    // groups
    // [type] -> FMLStructureObject
    fmlGroup.objects = group(
      fhirGroup.input ?? [],
      s => FmlStructureParser.findResourceId(s.type, {bundle, fhirMap}) ?? s.name,
      (s, k) => fmlGroup.newFMLObject(k, k, s.mode)
    );

    fhirGroup.rule ??= [];

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
          } = getRuleParser(fhirRuleTarget.transform).parse(fmlGroup, fhirRule.name, fhirRuleSource, fhirRuleTarget, variables);

          if (isDefined(object)) {
            fmlGroup.objects[object.name] = object;
          }
          if (isDefined(rule)) {
            fmlGroup.putRule(rule);
          }
          if (isDefined(connections)) {
            connections.forEach(c => fmlGroup.putConnection(c));
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

    return fmlGroup;
  }

  public static findResourceId = (k: string /* url, alias, type */, sources: {bundle: Bundle<StructureDefinition>, fhirMap?: StructureMap}): string => {
    const {bundle, fhirMap} = sources;
    if (k === 'Any') {
      return 'Element';
    }

    // [url] -> Resource
    const map = group(bundle.entry, e => e.resource.url, e => e.resource);
    if (map[k]) {
      return map[k]?.id;
    }
    const aliasSearch = fhirMap?.structure.find(s => s.alias === k)?.url;
    if (aliasSearch) {
      return map[aliasSearch]?.id;
    }
    const typeSearch = bundle.entry.find(e => e.resource.type === k);
    if (typeSearch) {
      return typeSearch.resource?.id;
    }
    throw new Error(`Couldn't find resource by "${k}"`);
  };

  private static validate(struc: FMLStructureGroup, fhir: StructureMap): void {
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
}