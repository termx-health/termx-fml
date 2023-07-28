import {group, isDefined, isNil} from '@kodality-web/core-util';
import {StructureMap, StructureMapGroupInput, StructureMapGroupRule, StructureMapGroupRuleTarget, StructureMapStructure} from 'fhir/r5';
import {FMLRuleParser, FMLRuleParserVariables} from './rule-parsers/parser';
import {FMLCopyRuleParser} from './rule-parsers/copy.parser';
import {FMLCreateRuleParser} from './rule-parsers/create.parser';
import {FMLUuidRuleParser} from './rule-parsers/uuid.parser';
import {FMLAppendRuleParser} from './rule-parsers/append.parser';
import {FMLStructure, FMLStructureObject} from './fml-structure';
import {FMLCcRuleParser} from './rule-parsers/cc.parser';

export class FMLStructureMapper {
  public static compose(fml: FMLStructure): StructureMap {
    console.log(fml);
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
    }


    const sources = Object.values(fml.objects).filter(o => o.mode === 'source');
    const targets = Object.values(fml.objects).filter(o => o.mode === 'target');
    sm.structure = [...sources, ...targets].map<StructureMapStructure>(o => ({
      url: `http://termx.health/fhir/StructureDefinition/${o.resource}`,
      mode: o.mode as StructureMapStructure['mode'],
      alias: o.resource
    }))

    const smGroup = sm.group[0]
    smGroup.input = [...sources, ...targets].map<StructureMapGroupInput>(o => ({
      name: o.name,
      type: o.resource,
      mode: o.mode as StructureMapGroupInput['mode'],
    }))


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

    targets.forEach(({name}) => x(name))
    return sm
  }

  public static map(fhir: StructureMap): FMLStructure {
    const ruleParsers: FMLRuleParser[] = [
      new FMLCopyRuleParser(),
      new FMLCreateRuleParser(),
      new FMLUuidRuleParser(),
      new FMLAppendRuleParser(),
      new FMLCcRuleParser()
    ]


    const struc = new FMLStructure();
    struc.objects = group(fhir.structure ?? [], s => s.url.substring(s.url.lastIndexOf('/') + 1), s => {
      const obj = new FMLStructureObject()
      const resource = s.url.substring(s.url.lastIndexOf('/') + 1);
      obj.resource = resource
      obj.name = resource;
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
            struc.objects[object.name] = object;
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

    return struc
  }
}
