import {FMLStructure, FMLStructureGroup, FMLStructureRule} from '../../fml-structure';
import {FMLRuleComposer, FMLRuleComposerFmlReturnType} from './composer';
import {SEQUENCE, VariableHolder} from '../../fml.utils';

export class FMLAppendRuleComposer extends FMLRuleComposer {
  public action = 'append';


  public override generateFml(
    fml: FMLStructure,
    fmlGroup: FMLStructureGroup,
    rule: FMLStructureRule,
    vh: VariableHolder
  ): FMLRuleComposerFmlReturnType {
    const ruleSeq = SEQUENCE.next();
    const {asVar} = vh;

    const sources = fmlGroup.getSources(rule.name);
    const combineSources = this.fmlCombineSources(`append_rule_${ruleSeq}`, sources, vh);
    const target = fmlGroup.getTargets(rule.name)[0];


    combineSources.last.target = [{
      context: asVar(target.targetObject),
      element: target.field,
      transform: 'append',
      variable: rule.name,
      parameter: rule.parameters.map(p => p.type === 'var' ? ({valueId: asVar(p.value, true)}) : ({valueString: p.value}))
    }];

    return combineSources.rule;
  }
}
