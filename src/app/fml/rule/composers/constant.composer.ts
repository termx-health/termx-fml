import {FMLStructure, FMLStructureGroup, FMLStructureObject, FMLStructureRule} from '../../fml-structure';
import {FMLRuleComposer, FMLRuleComposerEvaluateReturnType} from './composer';
import {VariableHolder} from '../../fml.utils';

export class FMLConstantRuleComposer extends FMLRuleComposer {
  public action = 'constant';

  public override generateEvaluate(
    fml: FMLStructure,
    fmlGroup: FMLStructureGroup,
    rule: FMLStructureRule,
    ctx: FMLStructureObject,
    vh: VariableHolder
  ): FMLRuleComposerEvaluateReturnType {
    return {
      target: {
        transform: 'evaluate',
        variable: rule.name,
        parameter: rule.parameters.map(p => ({valueString: `'${p.value}'`}))
      }
    };
  }
}
