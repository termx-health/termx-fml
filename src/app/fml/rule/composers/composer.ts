import {$THIS, FMLStructure, FMLStructureGroup, FMLStructureObject, FMLStructureRule} from '../../fml-structure';
import {StructureMapGroupRule, StructureMapGroupRuleDependent, StructureMapGroupRuleTarget} from 'fhir/r5';
import {nestRules, SEQUENCE, VariableHolder} from '../../fml.utils';


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
    srcCtx: FMLStructureObject,
    tgtCtx: FMLStructureObject,
    vh: VariableHolder
  ): FMLRuleComposerFmlReturnType {
    const {asVar} = vh;

    const s = fmlGroup.getSources(rule.name)[0];
    const t = fmlGroup.getTargets(rule.name)[0];

    return {
      name: `rule_${SEQUENCE.next()}`,
      source: [{
        context: asVar(s.sourceObject),
        element: s.field !== $THIS ? s.field : undefined
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

  public fmlCombineSources(prefix: string, sources: {sourceObject: string, field?: string}[], vh: VariableHolder): {
    main: StructureMapGroupRule,
    last: StructureMapGroupRule
  } {
    const {toVar, asVar} = vh;

    const smRules: StructureMapGroupRule[] = sources.map((s, idx) => {
      const sAsVar = toVar(`${s.sourceObject}.${s.field}`);
      return {
        name: `${prefix}_${idx + 1}`,
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

    const res = nestRules(smRules);
    return {
      main: res.main,
      last: res.last
    };
  }
}

