import {FMLRuleParser, FMLRuleParserResult, FMLRuleParserVariables} from './parser';
import {StructureMapGroupRuleSource, StructureMapGroupRuleTarget} from 'fhir/r5';
import {isDefined} from '@kodality-web/core-util';

export class FMLTruncateRuleParser extends FMLRuleParser {
  public action = 'truncate';

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
      const idx = rule.parameters.indexOf(valueIdParam.valueId)
      if (idx !== -1){
        rule.parameters[idx] = variable
      }
    }


    this.connect(rule, fhirRuleSource, fhirRuleTarget, variables)
    return {rule}
  }
}
