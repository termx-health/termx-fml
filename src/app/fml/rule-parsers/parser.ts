import {StructureMapGroupRuleSource, StructureMapGroupRuleTarget} from 'fhir/r5';
import {FMLStructure, FMLStructureConnection, FMLStructureObject, FMLStructureRule} from '../fml-structure';
import {isDefined, isNil} from '@kodality-web/core-util';
import {asResourceVariable, substringAfterLast, substringBeforeLast} from '../fml.utils';


export interface FMLRuleParserResult {
  rule?: FMLStructureRule,
  object?: FMLStructureObject;
  connections?: FMLStructureConnection[]
}

export type FMLRuleParserVariables = {[name: string]: string}

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
    variables: FMLRuleParserVariables
  ): FMLStructureRule {
    const rule = new FMLStructureRule();
    rule.name = asResourceVariable(ruleName);
    // rule.alias = fhirRuleTarget.variable;
    rule.action = fhirRuleTarget.transform;
    rule.parameters = fhirRuleTarget.parameter?.map(p =>
      p.valueId
        ? {type: 'var', value: variables[p.valueId] ?? p.valueId}
        : {type: 'const', value: p.valueString ?? p.valueBoolean ?? p.valueInteger ?? p.valueDecimal ?? p.valueDate ?? p.valueTime ?? p.valueDateTime}
    );
    rule.condition = fhirRuleSource.condition;
    return rule;
  }

  public connect(
    fml: FMLStructure,
    rule: FMLStructureRule,
    fhirRuleSource: StructureMapGroupRuleSource,
    fhirRuleTarget: StructureMapGroupRuleTarget,
    variables: FMLRuleParserVariables
  ): FMLStructureConnection[] {
    const conns = [];

    fhirRuleTarget.parameter ??= [];
    // find valueId parameters
    const valueIdParams = fhirRuleTarget.parameter
      .filter(p => isDefined(p.valueId))
      .map(p => p.valueId);

    valueIdParams.forEach(valueId => {
      const variable = variables[valueId];
      const source = substringBeforeLast(variable, '.');

      if (isDefined(fml.objects[source])) {
        // fml object
        const sourceField = variable.slice(source.length + (variable.includes(".") ? 1 : 0));
        const sourceFieldIdx = fml.objects[source].fieldIndex(sourceField);
        conns.push(fml.newFMLConnection(source, sourceFieldIdx, rule.name, 0));
      } else {
        // fml rule, using startsWith because variable has the StructureMap rule's raw name
        // fixme: use real rule name?
        const fmlRule = fml.rules.find(r => r.name.startsWith(source));
        conns.push(fml.newFMLConnection(fmlRule.name, 0, rule.name, 0));
      }
    });

    const sourceInParams = valueIdParams.some(valueId => valueId === fhirRuleSource.variable);
    if (!sourceInParams) {
      // connect to source
      conns.push(...this.connectSource(fml, rule, fhirRuleSource, variables));
    }

    // connect to target
    conns.push(...this.connectTarget(fml, rule, fhirRuleTarget, variables));
    return conns.filter((v, idx, self) => {
      const hash = (el: FMLStructureConnection): string => [el.sourceObject, el.sourceFieldIdx, el.targetObject, el.targetFieldIdx].join('%|');
      return self.findIndex(el => hash(el) === hash(v)) === idx;
    });
  }

  public connectSource(
    fml: FMLStructure,
    rule: FMLStructureRule,
    fhirRuleSource: StructureMapGroupRuleSource,
    variables: FMLRuleParserVariables
  ): FMLStructureConnection[] {
    if (isNil(variables[fhirRuleSource.context])) {
      return [];
    }
    const [sourceObject, sourceField] = this.parseConnection(fhirRuleSource, variables);
    if (isNil(sourceObject)) {
      return [];
    }
    return [
      fml.newFMLConnection(
        sourceObject, fml.objects[sourceObject].fieldIndex(sourceField) ?? 0,
        rule.name, 0
      )
    ];
  }

  public connectTarget(
    fml: FMLStructure,
    rule: FMLStructureRule,
    fhirRuleTarget: StructureMapGroupRuleTarget,
    variables: FMLRuleParserVariables
  ): FMLStructureConnection[] {
    if (isNil(variables[fhirRuleTarget.context])) {
      return [];
    }
    const [targetObject, targetField] = this.parseConnection(fhirRuleTarget, variables);
    if (isNil(targetObject)) {
      return [];
    }
    return [
      fml.newFMLConnection(
        rule.name, 0,
        targetObject, fml.objects[targetObject].fieldIndex(targetField) ?? 0,
      )
    ];
  }

  public parseConnection(
    st: StructureMapGroupRuleSource | StructureMapGroupRuleTarget,
    variables: FMLRuleParserVariables
  ): [string, string] {
    const ctx = variables[st.context];
    if (st.element) {
      return [ctx, st.element];
    } else if (ctx.includes('.')) {
      return [substringBeforeLast(ctx, '.'), substringAfterLast(ctx, '.')];
    }
    return [undefined, undefined];
  }
}
