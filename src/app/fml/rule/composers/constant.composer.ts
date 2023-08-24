import {FMLStructure, FMLStructureObject, FMLStructureRule} from '../../fml-structure';
import {FMLRuleComposer, FMLRuleComposerReturnType} from './composer';

export class FMLConstantRuleComposer extends FMLRuleComposer {
  public action = 'constant';

  public override generate(fml: FMLStructure, rule: FMLStructureRule, ctx: FMLStructureObject, vars: {[p: string]: string}): FMLRuleComposerReturnType {
    return {
      target: {
        transform: 'evaluate',
        variable: rule.name,
        parameter: rule.parameters.map(p => ({valueString: `'${p.value}'`}))
      }
    };
  }
}
