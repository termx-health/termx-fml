import {FMLStructure, FMLStructureGroup, FMLStructureObject, FMLStructureRule} from '../../fml-structure';
import {StructureMapGroupRuleDependent, StructureMapGroupRuleTarget} from 'fhir/r5';


export abstract class FMLRuleComposer {
  abstract action: string;

  public generateEvaluate(
    fml: FMLStructure,
    fmlGroup: FMLStructureGroup,
    rule: FMLStructureRule,
    ctx: FMLStructureObject,
    vars: {[p: string]: string}
  ): FMLRuleComposerReturnType {
    return {
      target: {
        transform: rule.action as any,
        variable: rule.name,
        parameter: rule.parameters.map(p => {
          return p.type === 'var' ? ({valueId: vars[p.value] ?? p.value}) : ({valueString: p.value});
        })
      }
    };
  }

  public  generateFml(
    fml: FMLStructure,
    fmlGroup: FMLStructureGroup,
    rule: FMLStructureRule,
    ctx: FMLStructureObject,
    vars: {[p: string]: string}
  ): FMLRuleComposerReturnType {
    return undefined;
  };
}

export type FMLRuleComposerReturnType = Partial<{
  target: StructureMapGroupRuleTarget,
  dependent: StructureMapGroupRuleDependent
}>
