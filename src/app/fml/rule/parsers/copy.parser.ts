import {FMLRuleParser, FMLRuleParserResult, FMLRuleParserVariables} from './parser';
import {StructureMapGroupRuleSource, StructureMapGroupRuleTarget} from 'fhir/r5';
import {FMLStructure} from '../../fml-structure';
import {isDefined, remove} from '@kodality-web/core-util';

export class FMLCopyRuleParser extends FMLRuleParser {
  public action = 'copy';

  public override parse(
    fml: FMLStructure,
    ruleName: string,
    fhirRuleSource: StructureMapGroupRuleSource,
    fhirRuleTarget: StructureMapGroupRuleTarget,
    variables: FMLRuleParserVariables
  ): FMLRuleParserResult {
    const rule = this.create(fml, ruleName, fhirRuleSource, fhirRuleTarget, variables);
    const connections = this.connect(fml, rule, fhirRuleSource, fhirRuleTarget, variables);

    fhirRuleTarget.parameter.filter(p => isDefined(p.valueId)).forEach(p => {
      rule.parameters = remove(rule.parameters, rule.parameters.find(r => r.value === p.valueId));
    });

    if (rule.condition) {
      return {rule, connections};
    }


    if (connections.length > 2) {
      throw Error(`Too many connections for the ${this.action} transformation!`);
    }

    let _rule;
    if (connections.length === 1) {
      connections.push(connections[0]);
      _rule = rule;
      _rule.action = 'constant';
    }

    // creates direct link from source to target
    const [src, tgt] = connections;
    return {
      rule: _rule,
      connections: [{
        sourceObject: src.sourceObject,
        sourceFieldIdx: src.sourceFieldIdx,
        targetObject: tgt.targetObject,
        targetFieldIdx: tgt.targetFieldIdx
      }]
    };
  }
}
