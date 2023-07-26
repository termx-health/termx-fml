import {FMLRuleParser, FMLRuleParserResult, FMLRuleParserVariables} from './parser';
import {StructureMapGroupRuleSource, StructureMapGroupRuleTarget} from 'fhir/r5';
import {FMLStructureObject} from '../fml-structure';
import {isDefined} from '@kodality-web/core-util';

export class FMLCreateRuleParser extends FMLRuleParser {
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
    object.resource = fhirRuleTarget.parameter?.find(p => isDefined(p.valueString))?.valueString ?? variables[fhirRuleTarget.variable]
    object.path = variables[fhirRuleTarget.variable]
    object.mode = 'object'

    rule.sourceObject = object.path;
    rule.sourceField = 'id'

    return {rule, object}
  }
}
