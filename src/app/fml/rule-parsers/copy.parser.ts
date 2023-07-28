import {FMLRuleParser, FMLRuleParserResult, FMLRuleParserVariables} from './parser';
import {StructureMapGroupRuleSource, StructureMapGroupRuleTarget} from 'fhir/r5';
import {isDefined, remove} from '@kodality-web/core-util';

export class FMLCopyRuleParser extends FMLRuleParser {
  public action = 'copy';

  public override parse(
    ruleName: string,
    fhirRuleSource: StructureMapGroupRuleSource,
    fhirRuleTarget: StructureMapGroupRuleTarget,
    variables: FMLRuleParserVariables
  ): FMLRuleParserResult {
    const rule = this.create(ruleName, fhirRuleSource, fhirRuleTarget);

    const valueIdParam = fhirRuleTarget.parameter?.find(p => p.valueId);
    if (isDefined(valueIdParam)) {
      const variable = variables[valueIdParam.valueId];
      rule.sourceObject = variable.slice(0, variable.lastIndexOf("."));
      rule.sourceField = variable.slice(variable.lastIndexOf(".") + 1);
      rule.parameters = remove(rule.parameters, valueIdParam.valueId);
    }

    this.connect(rule, fhirRuleSource, fhirRuleTarget, variables)
    return {rule}
  }
}
