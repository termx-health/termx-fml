import {FMLRuleParser, FMLRuleParserResult} from './parser';
import {StructureMapGroupRuleSource, StructureMapGroupRuleTarget} from 'fhir/r5';

export class FMLUuidParser extends FMLRuleParser {
  public action = 'uuid';

  public override parse(
    fhirRuleSource: StructureMapGroupRuleSource,
    fhirRuleTarget: StructureMapGroupRuleTarget,
    variables: {[p: string]: string}
  ): FMLRuleParserResult {
    const {rule} = super.parse(fhirRuleSource, fhirRuleTarget, variables);
    if (variables[fhirRuleTarget.context]) {
      rule.targetObject = variables[fhirRuleTarget.context];
      rule.targetField = fhirRuleTarget.element
    }
    return {rule}
  }
}
