import {FMLRuleParser, FMLRuleParserResult, FMLRuleParserVariables} from './parser';
import {StructureMapGroupRuleSource, StructureMapGroupRuleTarget} from 'fhir/r5';

export class FMLCopyRuleParser extends FMLRuleParser {
  public action = 'copy';

  public override parse(
    ruleName: string,
    fhirRuleSource: StructureMapGroupRuleSource,
    fhirRuleTarget: StructureMapGroupRuleTarget,
    variables: FMLRuleParserVariables
  ): FMLRuleParserResult {
    const rule = this.create(ruleName, fhirRuleSource, fhirRuleTarget);
    this.connect(rule, fhirRuleSource, fhirRuleTarget, variables)
    return {rule}
  }
}
