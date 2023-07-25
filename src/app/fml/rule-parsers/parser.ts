import {StructureMapGroupRuleSource, StructureMapGroupRuleTarget} from 'fhir/r5';
import {FMLStructureObject, FMLStructureRule} from '../fml-structure';

export interface FMLRuleParserResult {
  rule: FMLStructureRule,
  object?: FMLStructureObject
}

export abstract class FMLRuleParser {
  abstract action: string;

  public parse(
    fhirRuleSource: StructureMapGroupRuleSource,
    fhirRuleTarget: StructureMapGroupRuleTarget,
    variables: {[name: string]: string} // variable name -> variable path
  ): FMLRuleParserResult {
    const rule = new FMLStructureRule()
    rule.name = `_${fhirRuleTarget.transform}`;
    rule.alias = fhirRuleTarget.variable
    rule.action = fhirRuleTarget.transform;
    rule.parameters = fhirRuleTarget.parameter?.map(p =>
      p.valueId ??
      p.valueString ??
      p.valueBoolean ??
      p.valueInteger ??
      p.valueDecimal ??
      p.valueDate ??
      p.valueTime ??
      p.valueDateTime
    )
    return {rule}
  }

  public connect(
    rule: FMLStructureRule,
    fhirRuleSource: StructureMapGroupRuleSource,
    fhirRuleTarget: StructureMapGroupRuleTarget,
    variables: {[p: string]: string}
  ): void {
    if (variables[fhirRuleSource.context]) {
      rule.sourceObject = variables[fhirRuleSource.context];
      rule.sourceField = fhirRuleSource.element
    }
    if (variables[fhirRuleTarget.context]) {
      rule.targetObject = variables[fhirRuleTarget.context];
      rule.targetField = fhirRuleTarget.element
    }
  }
}
