import {FMLRuleParser, FMLRuleParserResult, FMLRuleParserVariables} from './parser';
import {StructureMapGroupRuleSource, StructureMapGroupRuleTarget} from 'fhir/r5';
import {FMLStructureObject} from '../fml-structure';
import {isDefined} from '@kodality-web/core-util';

export class FMLCreateParser extends FMLRuleParser {
  public action = 'create';

  public override parse(
    ruleName: string,
    fhirRuleSource: StructureMapGroupRuleSource,
    fhirRuleTarget: StructureMapGroupRuleTarget,
    variables: FMLRuleParserVariables
  ): FMLRuleParserResult {
    const rule = this.create(ruleName, fhirRuleSource, fhirRuleTarget);
    this.connect(rule, fhirRuleSource, fhirRuleTarget, variables)


    // object.resource = variables[fhirRuleTarget.variable]

    const object = new FMLStructureObject()
    object.resource = fhirRuleTarget.parameter.find(p => isDefined(p.valueString))?.valueString ?? variables[fhirRuleTarget.variable]
    object.name = variables[fhirRuleTarget.variable]
    object.mode = 'object'

    console.log(object.resource)

    rule.sourceObject = object.name;
    rule.sourceField = 'id'

    return {rule, object}
  }
}
