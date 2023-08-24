import {FMLStructure, FMLStructureObject, FMLStructureRule} from '../../fml-structure';
import {FMLRuleComposer, FMLRuleComposerReturnType} from './composer';

export class FMLRulegroupRuleComposer extends FMLRuleComposer {
  public action = 'rulegroup';

  public override generate(fml: FMLStructure, rule: FMLStructureRule, ctx: FMLStructureObject, vars: {[p: string]: string}): FMLRuleComposerReturnType {
    return {
      dependent: {
        name: rule.parameters.find(p => p.type === 'const')?.value,
        parameter: [
          ...fml.getSources(rule.name).map(s => ({valueId: vars[s.sourceObject] ?? s.sourceObject})),
          ...fml.getTargets(rule.name).map(s => ({valueId: vars[s.targetObject] ?? s.targetObject}))
        ]
      }
    };
  }
}
