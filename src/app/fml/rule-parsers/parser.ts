import {StructureMapGroupRuleSource, StructureMapGroupRuleTarget} from 'fhir/r5';
import {FMLStructure, FMLStructureConnection, FMLStructureObject, FMLStructureRule} from '../fml-structure';
import {newFMLConnection} from '../fml.utils';
import {isDefined, isNil} from '@kodality-web/core-util';

export interface FMLRuleParserResult {
  rule: FMLStructureRule,
  object?: FMLStructureObject;
  connections: FMLStructureConnection[]
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
    fml: FMLStructure,
    ruleName: string,
    fhirRuleSource: StructureMapGroupRuleSource,
    fhirRuleTarget: StructureMapGroupRuleTarget,
    variables: FMLRuleParserVariables // variable name -> variable path
  ): FMLRuleParserResult

  public create(
    fml: FMLStructure,
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
    fml: FMLStructure,
    rule: FMLStructureRule,
    fhirRuleSource: StructureMapGroupRuleSource,
    fhirRuleTarget: StructureMapGroupRuleTarget,
    variables: FMLRuleParserVariables
  ): FMLStructureConnection[] {
    fhirRuleTarget.parameter ??= []
    const connections = [];

    const valueIdParams = fhirRuleTarget.parameter
      .filter(p => isDefined(p.valueId))
      .map(p => p.valueId);

    valueIdParams.forEach(valueId => {
      const variable = variables[valueId]
      const source = variable.includes(".") ? variable.substring(0, variable.lastIndexOf(".")) : variable
      if (isNil(fml.objects[source])) {
        const refRule = fml.rules.find(r => r.name.startsWith(source))
        connections.push(newFMLConnection(refRule.name, 0, rule.name, 0))
        return
      }
      const sourceField = variable.slice(source.length + (variable.includes(".") ? 1 : 0));
      const sourceFieldIdx = fml.objects[source].getFieldIndex(sourceField)
      connections.push(newFMLConnection(source, sourceFieldIdx, rule.name, 0))
    })


    const hasInputInParams = valueIdParams.some(valueId => valueId === fhirRuleSource.variable)
    if (!hasInputInParams) {
      connections.push(...this.connectSource(fml, rule, fhirRuleSource, variables));
    }

    connections.push(...this.connectTarget(fml, rule, fhirRuleTarget, variables));

    return connections;
    // return [
    //   ...this.connectSource(fml, rule, fhirRuleSource, variables),
    //   ...this.connectTarget(fml, rule, fhirRuleTarget, variables)
    // ]
  }

  public connectSource(
    fml: FMLStructure,
    rule: FMLStructureRule,
    fhirRuleSource: StructureMapGroupRuleSource,
    variables: FMLRuleParserVariables
  ): FMLStructureConnection[] {
    if (variables[fhirRuleSource.context]) {
      const [sourceObject, sourceField] = this.parseConnection(fhirRuleSource, variables)
      return [
        newFMLConnection(
          sourceObject, fml.objects[sourceObject].getFieldIndex(sourceField) ?? 0,
          rule.name, 0
        )
      ]
    }
    return [];
  }

  public connectTarget(
    fml: FMLStructure,
    rule: FMLStructureRule,
    fhirRuleTarget: StructureMapGroupRuleTarget,
    variables: FMLRuleParserVariables
  ): FMLStructureConnection[] {
    if (variables[fhirRuleTarget.context]) {
      const [targetObject, targetField] = this.parseConnection(fhirRuleTarget, variables)
      return [
        newFMLConnection(
          rule.name, 0,
          targetObject, fml.objects[targetObject].getFieldIndex(targetField) ?? 0,
        )
      ]
    }
    return [];
  }

  public parseConnection(
    st: StructureMapGroupRuleSource | StructureMapGroupRuleTarget,
    variables: FMLRuleParserVariables
  ): [string, string] {
    const ctx = variables[st.context];
    if (st.element) {
      return [ctx, st.element]
    } else if (ctx.includes('.')) {
      return [ctx.slice(0, ctx.lastIndexOf('.')), ctx.slice(ctx.lastIndexOf('.') + 1)]
    }
    return [undefined, undefined];
  }
}
