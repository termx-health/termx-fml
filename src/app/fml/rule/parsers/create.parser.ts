import {FMLRuleParser, FMLRuleParserResult, FMLRuleParserVariables} from './parser';
import {StructureMapGroupRuleSource, StructureMapGroupRuleTarget} from 'fhir/r5';
import {FMLStructureGroup} from '../../fml-structure';
import {isDefined} from '@kodality-web/core-util';

export class FMLCreateRuleParser extends FMLRuleParser {
  public action = 'create';

  public override parse(
    fmlGroup: FMLStructureGroup,
    ruleName: string,
    fhirRuleSource: StructureMapGroupRuleSource,
    fhirRuleTarget: StructureMapGroupRuleTarget,
    variables: FMLRuleParserVariables
  ): FMLRuleParserResult {
    const rule = this.create(fmlGroup, ruleName, fhirRuleSource, fhirRuleTarget, variables);

    const objectName = variables[fhirRuleTarget.variable];
    const objectResource = fhirRuleTarget.parameter?.find(p => isDefined(p.valueString))?.valueString ?? objectName;
    const object = fmlGroup.newFMLObject(
      objectResource, objectName,
      'object'
    );

    const tgt = this.connectTarget(fmlGroup, rule, fhirRuleTarget, variables)?.[0];
    const connection = fmlGroup.newFMLConnection(
      object.name, 0,
      tgt.targetObject, tgt.targetFieldIdx
    );

    return {
      object,
      connections: [connection]
    };
  }
}
