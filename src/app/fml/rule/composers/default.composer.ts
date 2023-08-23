import {FMLStructureObject, FMLStructureRule} from '../../fml-structure';
import {StructureMapGroupRuleTarget} from 'fhir/r5';
import {FMLRuleComposer} from './composer';

export class FMLDefaultRuleComposer extends FMLRuleComposer {
  public action = 'default';

  public generate(rule: FMLStructureRule, ctx: FMLStructureObject, vars: {[value: string]: string}): StructureMapGroupRuleTarget {
    return {
      transform: rule.action as any,
      variable: rule.name,
      parameter: rule.parameters.map(p => {
        return p.type === 'var' ? ({valueId: vars[p.value] ?? p.value}) : ({valueString: p.value});
      })
    };
  }
}
