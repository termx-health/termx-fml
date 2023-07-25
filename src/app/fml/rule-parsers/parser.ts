import {StructureMapGroupRuleSource, StructureMapGroupRuleTarget} from 'fhir/r5';
import {FMLStructureObject, FMLStructureRule} from '../fml-structure';

export interface FMLRuleParserResult {
  rule: FMLStructureRule,
  object?: FMLStructureObject
}

export type FMLRuleParserVariables = {[name: string]: string}

export abstract class FMLRuleParser {
  abstract action: string;

  public abstract parse(
    ruleName: string,
    fhirRuleSource: StructureMapGroupRuleSource,
    fhirRuleTarget: StructureMapGroupRuleTarget,
    variables: FMLRuleParserVariables // variable name -> variable path
  ): FMLRuleParserResult

  public create(
    ruleName: string,
    fhirRuleSource: StructureMapGroupRuleSource,
    fhirRuleTarget: StructureMapGroupRuleTarget,
  ): FMLStructureRule {
    const rule = new FMLStructureRule()
    rule.name = `${ruleName}.${fhirRuleTarget.transform}`;
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

    rule.html = () => `
      <div>
         ${rule.name}
      </div>
    `
    return rule
  }

  public connect(
    rule: FMLStructureRule,
    fhirRuleSource: StructureMapGroupRuleSource,
    fhirRuleTarget: StructureMapGroupRuleTarget,
    variables: FMLRuleParserVariables
  ): void {
    if (variables[fhirRuleSource.context] && fhirRuleSource.element) {
      rule.sourceObject = variables[fhirRuleSource.context];
      rule.sourceField = fhirRuleSource.element
    }
    if (variables[fhirRuleTarget.context] && fhirRuleTarget.element) {
      rule.targetObject = variables[fhirRuleTarget.context];
      rule.targetField = fhirRuleTarget.element
    }
  }
}
