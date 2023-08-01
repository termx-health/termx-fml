import {FMLRuleParser, FMLRuleParserResult, FMLRuleParserVariables} from './parser';
import {StructureMapGroupRuleSource, StructureMapGroupRuleTarget} from 'fhir/r5';
import {isDefined} from '@kodality-web/core-util';
import {FMLStructure} from '../fml-structure';

export class FMLAppendRuleParser extends FMLRuleParser {
  public action = 'append';

  public override parse(
    fml: FMLStructure,
    ruleName: string,
    fhirRuleSource: StructureMapGroupRuleSource,
    fhirRuleTarget: StructureMapGroupRuleTarget,
    variables: FMLRuleParserVariables
  ): FMLRuleParserResult {
    const rule = this.create(fml, ruleName, fhirRuleSource, fhirRuleTarget);


    // fixme: multiple sources could be in the parameters
    const valueIdParam = fhirRuleTarget.parameter?.find(p => p.valueId);
    if (isDefined(valueIdParam)) {
      const variable = variables[valueIdParam.valueId];
      fhirRuleSource.context = variable.slice(0, variable.lastIndexOf("."))
      fhirRuleSource.element = variable.slice(variable.lastIndexOf(".") + 1)
    }


    const connections = this.connect(fml, rule, fhirRuleSource, fhirRuleTarget, variables)
    return {rule, connections}
  }
}
