import {FMLStructure, FMLStructureGroup, FMLStructureObject, FMLStructureRule} from '../../fml-structure';
import {FMLRuleComposer, FMLRuleComposerFmlReturnType} from './composer';
import {requireSingle, SEQUENCE, VariableHolder} from '../../fml.utils';

export class FMLAppendRuleComposer extends FMLRuleComposer {
  public action = 'append';

  public override generateFml(
    fml: FMLStructure,
    fmlGroup: FMLStructureGroup,
    rule: FMLStructureRule,
    srcCtx: FMLStructureObject,
    tgtCtx: FMLStructureObject,
    vh: VariableHolder
  ): FMLRuleComposerFmlReturnType {
    const {asVar} = vh;

    const sources = fmlGroup.getSources(rule.name);
    const target = requireSingle(fmlGroup.getTargets(rule.name), `"${rule.name}" MUST have one target`);

    const {last, main} = this.fmlMultipleSources(`append_${SEQUENCE.next()}`, sources, vh);
    last.target = [{
      transform: 'append',
      context: asVar(target.targetObject),
      element: target.field,
      variable: rule.name,
      parameter: rule.parameters.map(p => p.type === 'var' ? ({valueId: asVar(p.value, true)}) : ({valueString: p.value}))
    }];

    return main;
  }
}
