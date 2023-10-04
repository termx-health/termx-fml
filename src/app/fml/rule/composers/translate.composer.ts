import {FMLStructure, FMLStructureGroup, FMLStructureObject, FMLStructureRule} from '../../fml-structure';
import {FMLRuleComposer, FMLRuleComposerEvaluateReturnType, FMLRuleComposerFmlReturnType} from './composer';
import {isDefined} from '@kodality-web/core-util';
import {requireSingle, SEQUENCE, VariableHolder} from '../../fml.utils';

export class FMLTranslateRuleComposer extends FMLRuleComposer {
  public action = 'translate';

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
        transform: 'translate',
        variable: rule.name,
        parameter: rule.parameters.map(this.transformParameter(fml, asVar))
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

    return {
      name: `${this.action}_rule_${SEQUENCE.next()}`,
      source: [{
        context: asVar(src.sourceObject),
        element: src.field,
        variable: toVar(`${src.sourceObject}.${src.field}`)
      }],
      target: [{
        context: asVar(tgt.targetObject),
        element: tgt.field,
        transform: 'translate',
        variable: rule.name,
        parameter: rule.parameters.map(this.transformParameter(fml, asVar))
      }],
      rule: [],
      dependent: []
    };
  }


  private transformParameter(fml: FMLStructure, asVar: (name: string, raw?: boolean) => string): (p) => {valueId: string} | {valueString: any} {
    return p => {
      const conceptMap = fml.conceptMaps.find(m => m.name === p.value);
      let val = p.value;
      if (isDefined(conceptMap) && conceptMap.mode === 'internal') {
        val = `#${val}`;
      }
      return p.type === 'var' ? ({valueId: asVar(val, true)}) : ({valueString: val});
    };
  }
}
