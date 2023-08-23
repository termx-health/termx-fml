import {FMLRuleParser, FMLRuleParserResult, FMLRuleParserVariables} from './parser';
import {StructureMapGroupRuleSource, StructureMapGroupRuleTarget} from 'fhir/r5';
import {isDefined} from '@kodality-web/core-util';
import {FMLStructure} from '../../fml-structure';
import {substringAfterLast, substringBeforeLast} from '../../fml.utils';

export class FMLAppendRuleParser extends FMLRuleParser {
  public action = 'append';

  public override parse(
    fml: FMLStructure,
    ruleName: string,
    fhirRuleSource: StructureMapGroupRuleSource,
    fhirRuleTarget: StructureMapGroupRuleTarget,
    variables: FMLRuleParserVariables
  ): FMLRuleParserResult {
    const rule = this.create(fml, ruleName, fhirRuleSource, fhirRuleTarget, variables);

    // fixme: multiple sources could be in the parameters
    const valueIdParam = fhirRuleTarget.parameter?.find(p => p.valueId);
    if (isDefined(valueIdParam)) {
      const variable = variables[valueIdParam.valueId];
      fhirRuleSource.context = substringBeforeLast(variable, '.');
      fhirRuleSource.element = substringAfterLast(variable, '.');
    }

    const connections = this.connect(fml, rule, fhirRuleSource, fhirRuleTarget, variables);
    return {rule, connections};
  }
}