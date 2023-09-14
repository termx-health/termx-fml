import {FMLStructure, FMLStructureGroup, FMLStructureObject, FMLStructureRule} from '../../fml-structure';
import {FMLRuleComposer, FMLRuleComposerReturnType} from './composer';

export class FMLWhereRuleComposer extends FMLRuleComposer {
  public action = 'where';

  public generate(
    fml: FMLStructure,
    fmlGroup: FMLStructureGroup,
    rule: FMLStructureRule,
    ctx: FMLStructureObject,
    vars: {[p: string]: string}
  ): FMLRuleComposerReturnType {
    console.log({
        transform: 'evaluate',
        variable: rule.name,
        parameter: [
          ...fmlGroup.getSources(rule.name).map(s => ({valueId: vars[s.sourceObject] ?? s.sourceObject})),
          ...fmlGroup.getSources(rule.name).map(s => ({valueId: vars[s.sourceObject] ?? s.sourceObject})),
        ]
      }
    )
    return {
      target: {
        transform: 'evaluate',
        variable: rule.name,
        parameter: [
          ...fmlGroup.getSources(rule.name).map(s => ({valueId: vars[s.sourceObject] ?? s.sourceObject})),
          ...fmlGroup.getSources(rule.name).map(s => ({valueId: vars[s.sourceObject] ?? s.sourceObject})),
        ]
      }
    };
  }
}
