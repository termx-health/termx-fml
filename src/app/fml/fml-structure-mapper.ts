import {group, isDefined, isNil} from '@kodality-web/core-util';
import {StructureMap, StructureMapGroupRule} from 'fhir/r5';
import {FMLRuleParser, FMLRuleParserVariables} from './rule-parsers/parser';
import {FMLCopyParser} from './rule-parsers/copy.parser';
import {FMLCreateParser} from './rule-parsers/create.parser';
import {FMLUuidParser} from './rule-parsers/uuid.parser';
import {FMLAppendParser} from './rule-parsers/append.parser';
import {FMLStructure, FMLStructureObject} from './fml-structure';

export class FMLStructureMapper {
  public static map(fhir: StructureMap): FMLStructure {
    const ruleParsers: FMLRuleParser[] = [
      new FMLCopyParser(),
      new FMLCreateParser(),
      new FMLUuidParser(),
      new FMLAppendParser(),
    ]


    const struc = new FMLStructure();
    struc.objects = group(fhir.structure ?? [], s => s.url.substring(s.url.lastIndexOf('/') + 1), s => {
      const obj = new FMLStructureObject()
      const resource = s.url.substring(s.url.lastIndexOf('/') + 1);
      obj.resource = resource
      obj.path = resource;
      obj.mode = s.mode
      return obj
    })


    // group
    fhir.group.forEach(fhirGroup => {
      const _parseRule = (fhirRule: StructureMapGroupRule, variables: FMLRuleParserVariables) => {
        [...fhirRule.source, ...fhirRule.target]
          .filter(r => isDefined(r.variable))
          .forEach(r => variables[r.variable] = `${variables[r.context]}.${r.element}`)


        // NB: currently only one source
        const fhirRuleSource = fhirRule.source[0]


        fhirRule.target.forEach(fhirRuleTarget => {
          const parser = ruleParsers.find(p => p.action === fhirRuleTarget.transform)
          if (isNil(parser)) {
            console.warn(`Parser for the "${fhirRuleTarget.transform}" transformation not found!`)
            return
          }

          const {rule, object} = parser.parse(fhirRule.name, fhirRuleSource, fhirRuleTarget, variables)
          if (isDefined(rule)) {
            struc.rules.push(rule)
          }
          if (isDefined(object)) {
            struc.objects[object.path] = object;
          }
        })

        fhirRule.rule?.forEach(subRule => {
          _parseRule(subRule, variables)
        })
      }


      fhirGroup.rule.forEach(fhirRule => {
        // init variables
        const variables = group(fhirGroup.input, i => i.name, i => i.type);
        _parseRule(fhirRule, variables)
      })
    })

    console.log(struc)
    return struc
  }
}
