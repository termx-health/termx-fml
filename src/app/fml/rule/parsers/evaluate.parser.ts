import {FMLRuleParser, FMLRuleParserResult, FMLRuleParserVariables} from './parser';
import {StructureMapGroupRuleSource, StructureMapGroupRuleTarget} from 'fhir/r5';
import {FMLStructureGroup} from '../../fml-structure';
import {join} from '../../fml.utils';

export class FMLEvaluateRuleParser extends FMLRuleParser {
  public action = 'evaluate';

  public override parse(
    fmlGroup: FMLStructureGroup,
    ruleName: string,
    fhirRuleSource: StructureMapGroupRuleSource,
    fhirRuleTarget: StructureMapGroupRuleTarget,
    variables: FMLRuleParserVariables
  ): FMLRuleParserResult {
    const rule = this.create(fmlGroup, ruleName, fhirRuleSource, fhirRuleTarget, variables);
    const connections = this.connect(fmlGroup, rule, fhirRuleSource, fhirRuleTarget, variables);

    // transforms '%src.*' to 'var' parameter
    const evalParams = fhirRuleTarget.parameter.filter(p => p.valueString?.startsWith('%'));
    if (evalParams.length > 1) {
      throw Error(`Too many params that start with '%' in the '${rule.name}' transformation`);
    } else if (evalParams.length === 1) {
      const [val, ...rest] = evalParams[0].valueString.split('.');
      rule.parameters = [
        {type: 'var', value: variables[val.slice(1)]},
        {type: 'const', value: join(...rest)}
      ];
    }

    return {rule, connections};
  }
}
