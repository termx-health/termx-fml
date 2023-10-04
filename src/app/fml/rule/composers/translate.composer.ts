import {FMLStructure, FMLStructureGroup, FMLStructureObject, FMLStructureRule} from '../../fml-structure';
import {FMLRuleComposer, FMLRuleComposerEvaluateReturnType, FMLRuleComposerFmlReturnType} from './composer';
import {isDefined} from '@kodality-web/core-util';
import {SEQUENCE, VariableHolder} from '../../fml.utils';

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
    vh: VariableHolder
  ): FMLRuleComposerFmlReturnType {
    const {asVar, toVar} = vh;

    const s = fmlGroup.getSources(rule.name)[0];
    const t = fmlGroup.getTargets(rule.name)[0];

    return {
      name: `translate_rule_${SEQUENCE.next()}`,
      source: [{
        context: asVar(s.sourceObject),
        element: s.field,
        variable: toVar(`${s.sourceObject}.${s.field}`)
      }],
      target: [{
        context: asVar(t.targetObject),
        element: t.field,
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
