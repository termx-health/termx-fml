import {FMLStructure, FMLStructureGroup, FMLStructureObject, FMLStructureRule} from '../../fml-structure';
import {FMLRuleComposer, FMLRuleComposerEvaluateReturnType} from './composer';
import {VariableHolder} from '../../fml.utils';

export class FMLCopyRuleComposer extends FMLRuleComposer {
  public action = 'copy';

  public override generateEvaluate(
    fml: FMLStructure,
    fmlGroup: FMLStructureGroup,
    rule: FMLStructureRule,
    ctx: FMLStructureObject,
    vh: VariableHolder
  ): FMLRuleComposerEvaluateReturnType {
    const {asVar} = vh;
    return {
      target: {
        transform: 'evaluate',
        variable: rule.name,
        parameter: [
          {valueId: asVar(rule.parameters[0].value, true)},
          {valueString: asVar(rule.parameters[0].value, true)}
        ]
      }
    };
  }
}
