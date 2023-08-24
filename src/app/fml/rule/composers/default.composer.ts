import {FMLStructure, FMLStructureObject, FMLStructureRule} from '../../fml-structure';
import {FMLRuleComposer, FMLRuleComposerReturnType} from './composer';

export class FMLDefaultRuleComposer extends FMLRuleComposer {
  public action = 'default';

  public generate(fml: FMLStructure, rule: FMLStructureRule, ctx: FMLStructureObject, vars: {[value: string]: string}): FMLRuleComposerReturnType {
    return {
      target: {
        transform: rule.action as any,
        variable: rule.name,
        parameter: rule.parameters.map(p => {
          return p.type === 'var' ? ({valueId: vars[p.value] ?? p.value}) : ({valueString: p.value});
        })
      }
    };
  }
}
