import {FMLStructure, FMLStructureGroup, FMLStructureObject, FMLStructureRule} from '../../fml-structure';
import {FMLRuleComposer, FMLRuleComposerReturnType} from './composer';

export class FMLRulegroupRuleComposer extends FMLRuleComposer {
  public action = 'rulegroup';

  public override generateEvaluate(
    fml: FMLStructure,
    fmlGroup: FMLStructureGroup,
    rule: FMLStructureRule,
    ctx: FMLStructureObject,
    vars: {[p: string]: string}
  ): FMLRuleComposerReturnType {
    return {
      dependent: {
        name: rule.parameters.find(p => p.type === 'const')?.value,
        parameter: [
          ...fmlGroup.getSources(rule.name).map(s => ({valueId: vars[s.sourceObject] ?? s.sourceObject})),
          ...fmlGroup.getTargets(rule.name).map(s => ({valueId: vars[s.targetObject] ?? s.targetObject}))
        ]
      }
    };
  }
}
