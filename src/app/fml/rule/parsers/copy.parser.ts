import {FMLRuleParser, FMLRuleParserResult, FMLRuleParserVariables} from './parser';
import {StructureMapGroupRuleSource, StructureMapGroupRuleTarget} from 'fhir/r5';
import {FMLStructureGroup} from '../../fml-structure';
import {isDefined, isNil, remove} from '@kodality-web/core-util';

export class FMLCopyRuleParser extends FMLRuleParser {
  public action = 'copy';

  public override parse(
    fmlGroup: FMLStructureGroup,
    ruleName: string,
    fhirRuleSource: StructureMapGroupRuleSource,
    fhirRuleTarget: StructureMapGroupRuleTarget,
    variables: FMLRuleParserVariables
  ): FMLRuleParserResult {
    const rule = this.create(fmlGroup, ruleName, fhirRuleSource, fhirRuleTarget, variables);
    const connections = this.connect(fmlGroup, rule, fhirRuleSource, fhirRuleTarget, variables);

    // remove 'var' parameters
    fhirRuleTarget.parameter
      .filter(p => isDefined(p.valueId))
      .forEach(p => {
        rule.parameters = remove(rule.parameters, rule.parameters.find(r => r.value === p.valueId));
      });

    // fixme: remove?
    if (rule.condition) {
      return {rule, connections};
    }


    if (connections.length > 2) {
      throw Error(`Too many connections for the ${this.action}:${rule.name} transformation!`);
    } else if (connections.length === 1) {
      console.warn(`${rule.name} has a single connection!`);
    }


    let _rule;
    if (fhirRuleTarget.parameter.every(p => isNil(p.valueId))) {
      _rule = rule;
      _rule.action = 'constant';
      return {rule: _rule, connections};
    }

    // creates direct link from source to target
    const [src, tgt] = connections;
    return {
      connections: [{
        sourceObject: src.sourceObject,
        sourceFieldIdx: src.sourceFieldIdx,
        targetObject: tgt.targetObject,
        targetFieldIdx: tgt.targetFieldIdx
      }]
    };
  }
}
