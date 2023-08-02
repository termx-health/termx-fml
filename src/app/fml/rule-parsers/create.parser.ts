import {FMLRuleParser, FMLRuleParserResult, FMLRuleParserVariables} from './parser';
import {StructureMapGroupRuleSource, StructureMapGroupRuleTarget} from 'fhir/r5';
import {FMLStructure} from '../fml-structure';
import {isDefined} from '@kodality-web/core-util';

export class FMLCreateRuleParser extends FMLRuleParser {
  public action = 'create';

  public override parse(
    fml: FMLStructure,
    ruleName: string,
    fhirRuleSource: StructureMapGroupRuleSource,
    fhirRuleTarget: StructureMapGroupRuleTarget,
    variables: FMLRuleParserVariables
  ): FMLRuleParserResult {
    const rule = this.create(fml, ruleName, fhirRuleSource, fhirRuleTarget);

    const objectName = variables[fhirRuleTarget.variable];
    const objectResource = fhirRuleTarget.parameter?.find(p => isDefined(p.valueString))?.valueString ?? objectName;
    const object = fml.newFMLObject(
      objectResource, objectName,
      'object'
    );

    const sourceConnection = fml.newFMLConnection(
      object.name, object.getFieldIndex('id'),
      rule.name, 0
    );

    return {
      rule,
      object,
      connections: [
        sourceConnection,
        ...this.connectTarget(fml, rule, fhirRuleTarget, variables)
      ]
    };
  }
}
