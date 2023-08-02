import {FMLRuleParser, FMLRuleParserResult, FMLRuleParserVariables} from './parser';
import {StructureMapGroupRuleSource, StructureMapGroupRuleTarget} from 'fhir/r5';
import {FMLStructure} from '../fml-structure';
import {isDefined, remove} from '@kodality-web/core-util';

export class FMLCopyRuleParser extends FMLRuleParser {
  public action = 'copy';

  public override parse(
    fml: FMLStructure,
    ruleName: string,
    fhirRuleSource: StructureMapGroupRuleSource,
    fhirRuleTarget: StructureMapGroupRuleTarget,
    variables: FMLRuleParserVariables
  ): FMLRuleParserResult {
    const rule = this.create(fml, ruleName, fhirRuleSource, fhirRuleTarget);
    const connections = this.connect(fml, rule, fhirRuleSource, fhirRuleTarget, variables);

    fhirRuleTarget.parameter.filter(p => isDefined(p.valueId)).forEach(p => {
      rule.parameters = remove(rule.parameters, p.valueId);
    });

    return {rule, connections};
  }
}
