import {FMLRuleParser, FMLRuleParserResult, FMLRuleParserVariables} from './parser';
import {StructureMapGroupRuleSource, StructureMapGroupRuleTarget} from 'fhir/r5';
import {FMLStructureGroup} from '../../fml-structure';

export class FMLDefaultRuleParser extends FMLRuleParser {
  public action = 'default';

  public override parse(
    fmlGroup: FMLStructureGroup,
    ruleName: string,
    fhirRuleSource: StructureMapGroupRuleSource,
    fhirRuleTarget: StructureMapGroupRuleTarget,
    variables: FMLRuleParserVariables
  ): FMLRuleParserResult {
    const rule = this.create(fmlGroup, ruleName, fhirRuleSource, fhirRuleTarget, variables);
    const connections = this.connect(fmlGroup, rule, fhirRuleSource, fhirRuleTarget, variables);
    return {rule, connections};
  }
}
