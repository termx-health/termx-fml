import {FMLRuleParser, FMLRuleParserResult, FMLRuleParserVariables} from './parser';
import {StructureMapGroupRuleSource, StructureMapGroupRuleTarget} from 'fhir/r5';
import {FMLStructureGroup} from '../../fml-structure';

export class FMLUuidRuleParser extends FMLRuleParser {
  public action = 'uuid';

  public override parse(
    fmlGroup: FMLStructureGroup,
    ruleName: string,
    fhirRuleSource: StructureMapGroupRuleSource,
    fhirRuleTarget: StructureMapGroupRuleTarget,
    variables: FMLRuleParserVariables
  ): FMLRuleParserResult {
    const rule = this.create(fmlGroup, ruleName, fhirRuleSource, fhirRuleTarget, variables);
    const conn = this.connectTarget(fmlGroup, rule, fhirRuleTarget, variables);
    return {rule, connections: conn};
  }
}
