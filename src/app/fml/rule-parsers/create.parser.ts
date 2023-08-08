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
    const rule = this.create(fml, ruleName, fhirRuleSource, fhirRuleTarget, variables);

    const objectName = variables[fhirRuleTarget.variable];
    const objectResource = fhirRuleTarget.parameter?.find(p => isDefined(p.valueString))?.valueString ?? objectName;
    const object = fml.newFMLObject(
      objectResource, objectName,
      'object'
    );

    const tgt = this.connectTarget(fml, rule, fhirRuleTarget, variables)?.[0];
    const connection = fml.newFMLConnection(
      object.name, 0,
      tgt.targetObject, tgt.targetFieldIdx
    );

    return {
      object,
      connections: [connection]
    };
  }
}
