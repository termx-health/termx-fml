import {FMLStructure, FMLStructureGroup, FMLStructureObject, FMLStructureRule} from '../../fml-structure';
import {StructureMapGroupRuleDependent, StructureMapGroupRuleTarget} from 'fhir/r5';


export abstract class FMLRuleComposer {
  abstract action: string;

  public abstract generate(
    fml: FMLStructure,
    fmlGroup: FMLStructureGroup,
    rule: FMLStructureRule,
    ctx: FMLStructureObject,
    vars: {[p: string]: string}
  ): FMLRuleComposerReturnType;
}

export type FMLRuleComposerReturnType = Partial<{
  target: StructureMapGroupRuleTarget,
  dependent: StructureMapGroupRuleDependent
}>
