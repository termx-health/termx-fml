import {FMLStructure, FMLStructureGroup, FMLStructureObject, FMLStructureRule} from '../../fml-structure';
import {FMLRuleComposer, FMLRuleComposerEvaluateReturnType, FMLRuleComposerFmlReturnType} from './composer';
import {SEQUENCE, VariableHolder} from '../../fml.utils';

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
        parameter: rule.parameters.filter(p => p.type === 'var').map(p => ({valueId: asVar(p.value, true)}))
      }
    };
  }


  public override generateFml(
    fml: FMLStructure,
    fmlGroup: FMLStructureGroup,
    rule: FMLStructureRule,
    srcCtx: FMLStructureObject,
    tgtCtx: FMLStructureObject,
    vh: VariableHolder
  ): FMLRuleComposerFmlReturnType {
    const {asVar} = vh;


    if (!rule.parameters.filter(p => p.type === 'var').every(n => n.value in vh.vars)) {
      // don't create rule if any of objects is not yet initialized
      return;
    }

    return {
      name: `rule_group_${SEQUENCE.next()}`,
      source: [{
        context: asVar(srcCtx.name),
      }],
      target: [],
      rule: [],
      dependent: [{
        name: rule.parameters.find(p => p.type === 'const')?.value,
        parameter: rule.parameters.filter(p => p.type === 'var').map(p => ({valueId: asVar(p.value, true)}))
      }]
    };
  }
}
