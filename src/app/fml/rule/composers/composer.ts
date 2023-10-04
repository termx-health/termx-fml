import {FMLStructure, FMLStructureGroup, FMLStructureObject, FMLStructureRule} from '../../fml-structure';
import {StructureMapGroupRule, StructureMapGroupRuleDependent, StructureMapGroupRuleTarget} from 'fhir/r5';
import {SEQUENCE, VariableHolder} from '../../fml.utils';
import {isDefined} from '@kodality-web/core-util';


export type FMLRuleComposerEvaluateReturnType = Partial<{
  target: StructureMapGroupRuleTarget,
  dependent: StructureMapGroupRuleDependent
}>


export type FMLRuleComposerFmlReturnType = StructureMapGroupRule;

export abstract class FMLRuleComposer {
  abstract action: string;

  public generateEvaluate(
    fml: FMLStructure,
    fmlGroup: FMLStructureGroup,
    rule: FMLStructureRule,
    ctx: FMLStructureObject,
    vh: VariableHolder
  ): FMLRuleComposerEvaluateReturnType {
    return {
      target: {
        transform: rule.action as any,
        variable: rule.name,
        parameter: rule.parameters.map(p => {
          return p.type === 'var' ? ({valueId: vh.vars[p.value] ?? p.value}) : ({valueString: p.value});
        })
      }
    };
  }

  public generateFml(
    fml: FMLStructure,
    fmlGroup: FMLStructureGroup,
    rule: FMLStructureRule,
    vh: VariableHolder
  ): FMLRuleComposerFmlReturnType {
    const {asVar} = vh;

    const s = fmlGroup.getSources(rule.name)[0];
    const t = fmlGroup.getTargets(rule.name)[0];

    return {
      name: `rule_${SEQUENCE.next()}`,
      source: [{
        context: asVar(s.sourceObject),
        element: s.field
      }],
      target: [{
        context: asVar(t.targetObject),
        element: t.field,
        transform: rule.action as StructureMapGroupRuleTarget['transform'],
        variable: rule.name,
        parameter: rule.parameters.map(p => p.type === 'var' ? ({valueId: p.value}) : ({valueString: p.value}))
      }],
      rule: [],
      dependent: []
    };
  }

  public fmlCombineSources(prefix: string, sources: {sourceObject: string, field?: string}[], {toVar, asVar}: VariableHolder): {
    rule: StructureMapGroupRule,
    last: StructureMapGroupRule
  } {
    const smRules: StructureMapGroupRule[] = sources.map((s, idx) => {
      const sAsVar = toVar(`${s.sourceObject}.${s.field}`);
      return {
        name: `${prefix}_src_${idx}`,
        source: [{
          context: asVar(s.sourceObject),
          element: s.field,
          variable: sAsVar
        }],
        target: [{
          transform: 'copy',
          parameter: [{valueId: sAsVar}]
        }],
        rule: []
      };
    });

    let _smRule: StructureMapGroupRule;

    smRules.forEach(r => {
      if (isDefined(_smRule)) {
        _smRule.rule.push(r);
      }
      _smRule = r;
    });

    return {rule: smRules[0], last: _smRule};
  }
}

