import {FMLStructureObject, FMLStructureRule} from '../../fml-structure';
import {StructureMapGroupRuleTarget} from 'fhir/r5';
import {FMLRuleComposer} from './composer';

export class FMLConstantRuleComposer extends FMLRuleComposer {
  public action = 'constant';

  public override generate(rule: FMLStructureRule, ctx: FMLStructureObject, vars: {[p: string]: string}): StructureMapGroupRuleTarget {
    return {
      transform: 'evaluate',
      variable: rule.name,
      parameter: rule.parameters.map(p => ({valueString: `'${p.value}'`}))
    };
  }
}
