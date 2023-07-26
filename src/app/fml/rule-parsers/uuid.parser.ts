import {FMLRuleParser, FMLRuleParserResult, FMLRuleParserVariables} from './parser';
import {StructureMapGroupRuleSource, StructureMapGroupRuleTarget} from 'fhir/r5';

export class FMLUuidRuleParser extends FMLRuleParser {
  public action = 'uuid';

  public override parse(
    ruleName: string,
    fhirRuleSource: StructureMapGroupRuleSource,
    fhirRuleTarget: StructureMapGroupRuleTarget,
    variables: FMLRuleParserVariables
  ): FMLRuleParserResult {
    const rule = this.create(ruleName, fhirRuleSource, fhirRuleTarget);
    if (variables[fhirRuleTarget.context]) {
      rule.targetObject = variables[fhirRuleTarget.context];
      rule.targetField = fhirRuleTarget.element
    }
    return {rule}
  }
}
