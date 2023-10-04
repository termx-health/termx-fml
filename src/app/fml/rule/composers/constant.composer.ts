import {FMLStructure, FMLStructureGroup, FMLStructureObject, FMLStructureRule} from '../../fml-structure';
import {FMLRuleComposer, FMLRuleComposerEvaluateReturnType, FMLRuleComposerFmlReturnType} from './composer';
import {requireSingle, SEQUENCE, VariableHolder} from '../../fml.utils';


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


  public override generateFml(
    fml: FMLStructure,
    fmlGroup: FMLStructureGroup,
    rule: FMLStructureRule,
    srcCtx: FMLStructureObject,
    tgtCtx: FMLStructureObject,
    vh: VariableHolder
  ): FMLRuleComposerFmlReturnType {
    const {asVar} = vh;

    const src = requireSingle(fmlGroup.getSources(rule.name), `"${rule.name}" MUST have one source`);
    const tgt = requireSingle(fmlGroup.getTargets(rule.name), `"${rule.name}" MUST have one target`);

    return {
      name: `const_${SEQUENCE.next()}`,
      source: [{
        context: asVar(src.sourceObject)
      }],
      target: [{
        transform: 'evaluate',
        context: asVar(tgt.targetObject),
        element: tgt.field,
        variable: rule.name,
        parameter: rule.parameters.map(p => ({valueString: `'${p.value}'`}))
      }],
      rule: [],
      dependent: []
    };
  }
}
