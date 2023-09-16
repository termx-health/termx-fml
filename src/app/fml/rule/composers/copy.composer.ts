import {FMLStructure, FMLStructureGroup, FMLStructureObject, FMLStructureRule} from '../../fml-structure';
import {FMLRuleComposer, FMLRuleComposerReturnType} from './composer';

export class FMLCopyRuleComposer extends FMLRuleComposer {
  public action = 'copy';

  public override generate(
    fml: FMLStructure,
    fmlGroup: FMLStructureGroup,
    rule: FMLStructureRule,
    ctx: FMLStructureObject,
    vars: {[p: string]: string}
  ): FMLRuleComposerReturnType {
    return {
      target: {
        transform: 'evaluate',
        variable: rule.name,
        parameter: [
          {valueId: vars[rule.parameters[0].value]},
          {valueString: vars[rule.parameters[0].value]}
        ]
      }
    };
  }
}
