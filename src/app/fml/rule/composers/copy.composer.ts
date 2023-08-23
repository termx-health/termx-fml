import {FMLStructureObject, FMLStructureRule} from '../../fml-structure';
import {StructureMapGroupRuleTarget} from 'fhir/r5';
import {FMLRuleComposer} from './composer';

export class FMLCopyRuleComposer extends FMLRuleComposer {
  public action = 'copy';

  public override generate(rule: FMLStructureRule, ctx: FMLStructureObject, vars: {[p: string]: string}): StructureMapGroupRuleTarget {
    return {
      transform: 'evaluate',
      variable: rule.name,
      parameter: [
        {valueId: vars[rule.parameters[0].value]},
        {valueString: vars[rule.parameters[0].value]}
      ]
    };
  }
}
