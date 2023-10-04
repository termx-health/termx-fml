import {FMLStructure, FMLStructureGroup, FMLStructureObject, FMLStructureRule} from '../../fml-structure';
import {FMLRuleComposer, FMLRuleComposerEvaluateReturnType, FMLRuleComposerFmlReturnType} from './composer';
import {join, requireSingle, SEQUENCE, VariableHolder} from '../../fml.utils';

export class FMLCopyRuleComposer extends FMLRuleComposer {
  public action = 'copy';

  public override generateEvaluate(
    fml: FMLStructure,
    fmlGroup: FMLStructureGroup,
    rule: FMLStructureRule,
    ctx: FMLStructureObject,
    {asVar}: VariableHolder
  ): FMLRuleComposerEvaluateReturnType {
    const src = requireSingle(rule.parameters, `"${rule.name}" MUST have one source`).value;
    return {
      target: {
        transform: 'evaluate',
        variable: rule.name,
        parameter: [
          {valueId: asVar(src, true)},
          {valueString: asVar(src, true)}
        ]
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
    const {asVar, toVar} = vh;

    const src = requireSingle(fmlGroup.getSources(rule.name), `"${rule.name}" MUST have one source`);
    const tgt = requireSingle(fmlGroup.getTargets(rule.name), `"${rule.name}" MUST have one target`);

    const srcAsVar = toVar(join(src.sourceObject, src.field));

    return {
      name: `copy_${SEQUENCE.next()}`,
      source: [{
        context: asVar(src.sourceObject),
        element: src.field,
        variable: srcAsVar
      }],
      target: [{
        transform: 'copy',
        context: asVar(tgt.targetObject),
        element: tgt.field,
        parameter: [{valueId: srcAsVar}]
      }],
      rule: [],
      dependent: []
    };
  }
}
