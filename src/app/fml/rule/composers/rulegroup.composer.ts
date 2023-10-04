import {FMLStructure, FMLStructureGroup, FMLStructureObject, FMLStructureRule} from '../../fml-structure';
import {FMLRuleComposer, FMLRuleComposerEvaluateReturnType} from './composer';
import {VariableHolder} from '../../fml.utils';

export class FMLRulegroupRuleComposer extends FMLRuleComposer {
  public action = 'rulegroup';

  public override generateEvaluate(
    fml: FMLStructure,
    fmlGroup: FMLStructureGroup,
    rule: FMLStructureRule,
    ctx: FMLStructureObject,
    vh: VariableHolder
  ): FMLRuleComposerEvaluateReturnType {
    const {asVar} = vh;
    return {
      dependent: {
        name: rule.parameters.find(p => p.type === 'const')?.value,
        parameter: [
          ...fmlGroup.getSources(rule.name).map(s => ({valueId: asVar(s.sourceObject, true)})),
          ...fmlGroup.getTargets(rule.name).map(s => ({valueId: asVar(s.targetObject, true)}))
        ]
      }
    };
  }
}
