import {FMLRuleParser, FMLRuleParserResult} from './parser';
import {StructureMapGroupRuleSource, StructureMapGroupRuleTarget} from 'fhir/r5';

export class FMLCopyParser extends FMLRuleParser {
  public action = 'copy';

  public override parse(
    fhirRuleSource: StructureMapGroupRuleSource,
    fhirRuleTarget: StructureMapGroupRuleTarget,
    variables: {[p: string]: string}
  ): FMLRuleParserResult {
    const {rule} = super.parse(fhirRuleSource, fhirRuleTarget, variables);
    this.connect(rule, fhirRuleSource, fhirRuleTarget, variables)
    return {rule}
  }
}
