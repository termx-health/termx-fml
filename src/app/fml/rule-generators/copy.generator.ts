import {FMLStructureObject, FMLStructureRule} from '../fml-structure';
import {StructureMapGroupRuleTarget} from 'fhir/r5';
import {FMLRuleGenerator} from './generator';

export class FMLCopyRuleGenerator extends FMLRuleGenerator {
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
