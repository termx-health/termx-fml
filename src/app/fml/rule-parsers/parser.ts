import {StructureMapGroupRuleSource, StructureMapGroupRuleTarget} from 'fhir/r5';
import {FMLStructureObject, FMLStructureRule} from '../fml-structure';

export interface FMLRuleParserResult {
  rule: FMLStructureRule,
  object?: FMLStructureObject
}

export type FMLRuleParserVariables = {[name: string]: string}

export const RULE_ID = {
  v: 420,
  next: function () {
    return this.v++
  }
};

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
    rule.name = `${ruleName}#${RULE_ID.next()}`;
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
    );
    rule.condition = fhirRuleSource.condition;
    return rule
  }

  public connect(
    rule: FMLStructureRule,
    fhirRuleSource: StructureMapGroupRuleSource,
    fhirRuleTarget: StructureMapGroupRuleTarget,
    variables: FMLRuleParserVariables
  ): void {
    // todo: better method name
    const x = (
      st: StructureMapGroupRuleSource | StructureMapGroupRuleTarget,
      setObject: (v) => void,
      setField: (v) => void,
    ) => {
      const ctx = variables[st.context];
      if (st.element) {
        setObject(ctx)
        setField(st.element)
      } else if (ctx.includes('.')) {
        setObject(ctx.slice(0, ctx.lastIndexOf('.')))
        setField(ctx.slice(ctx.lastIndexOf('.') + 1))
      }
    }

    if (variables[fhirRuleSource.context]) {
      x(fhirRuleSource, v => rule.sourceObject = v, v => rule.sourceField = v);
    }
    if (variables[fhirRuleTarget.context]) {
      x(fhirRuleTarget, v => rule.targetObject = v, v => rule.targetField = v);
    }
  }
}
