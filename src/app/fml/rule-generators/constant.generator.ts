import {FMLStructureObject, FMLStructureRule} from '../fml-structure';
import {StructureMapGroupRuleTarget} from 'fhir/r5';
import {FMLRuleGenerator} from './generator';

export class FMLConstantRuleGenerator extends FMLRuleGenerator {
  public action = 'constant';

  public override generate(rule: FMLStructureRule, ctx: FMLStructureObject, vars: {[p: string]: string}): StructureMapGroupRuleTarget {
    return {
      transform: 'evaluate',
      variable: rule.name,
      parameter: rule.parameters.map(p => ({valueString: `'${p.value}'`}))
    };
  }
}
