import {FMLRuleParser, FMLRuleParserResult} from './parser';
import {StructureMapGroupRuleSource, StructureMapGroupRuleTarget} from 'fhir/r5';
import {FMLStructureObject} from '../fml-structure';

export class FMLCreateParser extends FMLRuleParser {
  public action = 'create';

  public override parse(
    fhirRuleSource: StructureMapGroupRuleSource,
    fhirRuleTarget: StructureMapGroupRuleTarget,
    variables: {[p: string]: string}
  ): FMLRuleParserResult {
    const {rule} = super.parse(fhirRuleSource, fhirRuleTarget, variables);
    this.connect(rule, fhirRuleSource, fhirRuleTarget, variables)

    const object = new FMLStructureObject()
    object.resource = variables[fhirRuleTarget.variable]
    object.name = variables[fhirRuleTarget.variable]
    object.mode = 'object'

    rule.sourceObject = object.name;
    rule.sourceField = 'id'

    return {rule, object}
  }
}
