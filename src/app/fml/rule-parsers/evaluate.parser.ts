import {FMLRuleParser, FMLRuleParserResult, FMLRuleParserVariables} from './parser';
import {StructureMapGroupRuleSource, StructureMapGroupRuleTarget} from 'fhir/r5';
import {FMLStructure} from '../fml-structure';

export class FMLEvaluateRuleParser extends FMLRuleParser {
  public action = 'evaluate';

  public override parse(
    fml: FMLStructure,
    ruleName: string,
    fhirRuleSource: StructureMapGroupRuleSource,
    fhirRuleTarget: StructureMapGroupRuleTarget,
    variables: FMLRuleParserVariables
  ): FMLRuleParserResult {
    const rule = this.create(fml,ruleName, fhirRuleSource, fhirRuleTarget);
    const connections = this.connect(fml, rule, fhirRuleSource, fhirRuleTarget, variables);
    return {rule, connections};
  }
}
