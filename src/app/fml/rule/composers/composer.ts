import {$THIS, FMLStructure, FMLStructureGroup, FMLStructureObject, FMLStructureRule} from '../../fml-structure';
import {StructureMapGroupRule, StructureMapGroupRuleDependent, StructureMapGroupRuleTarget} from 'fhir/r5';
import {join, nestRules, SEQUENCE, VariableHolder} from '../../fml.utils';


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
    const {asVar} = vh;

    return {
      target: {
        transform: rule.action as any,
        variable: rule.name,
        parameter: rule.parameters.map(p => {
          return p.type === 'var' ? ({valueId: asVar(p.value, true)}) : ({valueString: p.value});
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
    const {asVar, toVar} = vh;

    const src = fmlGroup.getSources(rule.name)[0];
    const tgt = fmlGroup.getTargets(rule.name)[0];

    const srcName = join(src.sourceObject, src.field);

    return {
      name: `rule_${SEQUENCE.next()}`,
      source: [{
        context: asVar(src.sourceObject),
        element: src.field !== $THIS ? src.field : undefined,
        variable: rule.parameters?.some(p => p.value === srcName) ? toVar(srcName) : undefined
      }],
      target: [{
        transform: rule.action as StructureMapGroupRuleTarget['transform'],
        context: asVar(tgt.targetObject),
        element: tgt.field,
        variable: rule.name,
        parameter: rule.parameters?.map(p => p.type === 'var' ? ({valueId: asVar(p.value, true)}) : ({valueString: p.value}))
      }],
      rule: [],
      dependent: []
    };
  }

  /**
   * Multiple source implementation.
   * https://build.fhir.org/mapping-language.html#7.8.0.8.1
   *
   * P.S. current org.hl7.fhir.validation.ValidationEngine implementation does not support multiple sources, improvising.
   */
  public fmlMultipleSources(prefix: string, sources: {sourceObject: string, field?: string}[], vh: VariableHolder): {
    main: StructureMapGroupRule,
    last: StructureMapGroupRule
  } {
    const {toVar, asVar} = vh;

    const smRules: StructureMapGroupRule[] = sources.map((s, idx) => {
      const sAsVar = toVar(join(s.sourceObject, s.field));
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

