import {FMLRuleParser, FMLRuleParserResult, FMLRuleParserVariables} from './parser';
import {StructureMapGroupRuleSource, StructureMapGroupRuleTarget} from 'fhir/r5';
import {isDefined} from '@kodality-web/core-util';
import {FMLStructureGroup} from '../../fml-structure';
import {substringAfterLast, substringBeforeLast} from '../../fml.utils';

export class FMLAppendRuleParser extends FMLRuleParser {
  public action = 'append';

  public override parse(
    fmlGroup: FMLStructureGroup,
    ruleName: string,
    fhirRuleSource: StructureMapGroupRuleSource,
    fhirRuleTarget: StructureMapGroupRuleTarget,
    variables: FMLRuleParserVariables
  ): FMLRuleParserResult {
    const rule = this.create(fmlGroup, ruleName, fhirRuleSource, fhirRuleTarget, variables);

    // fixme: multiple sources could be in the parameters
    const valueIdParam = fhirRuleTarget.parameter?.find(p => p.valueId);
    if (isDefined(valueIdParam)) {
      const variable = variables[valueIdParam.valueId];
      fhirRuleSource.context = substringBeforeLast(variable, '.');
      fhirRuleSource.element = substringAfterLast(variable, '.');
    }

    // all connections
    const connections = this.connect(fmlGroup, rule, fhirRuleSource, fhirRuleTarget, variables);

    // input connections -> set incremental field index
    connections
      .filter(c => c.targetObject === rule.name)
      .forEach((c, idx) => c.targetFieldIdx = idx);

    return {rule, connections};
  }
}
