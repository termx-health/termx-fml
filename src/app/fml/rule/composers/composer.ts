import {FMLStructureObject, FMLStructureRule} from '../../fml-structure';
import {StructureMapGroupRuleTarget} from 'fhir/r5';

export abstract class FMLRuleComposer {
  abstract action: string;

  public abstract generate(rule: FMLStructureRule, ctx: FMLStructureObject, vars: {[value: string]: string}): StructureMapGroupRuleTarget;
}
