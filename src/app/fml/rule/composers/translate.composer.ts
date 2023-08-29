import {FMLStructure, FMLStructureGroup, FMLStructureObject, FMLStructureRule} from '../../fml-structure';
import {FMLRuleComposer, FMLRuleComposerReturnType} from './composer';
import {isDefined} from '@kodality-web/core-util';

export class FMLTranslateRuleComposer extends FMLRuleComposer {
  public action = 'translate';

  public generate(
    fml: FMLStructure,
    fmlGroup: FMLStructureGroup,
    rule: FMLStructureRule,
    ctx: FMLStructureObject,
    vars: {[p: string]: string}
  ): FMLRuleComposerReturnType {
    return {
      target: {
        transform: 'translate',
        variable: rule.name,
        parameter: rule.parameters.map(p => {
          const conceptMap = fml.maps.find(m => m.name === p.value);
          let val = p.value;
          if (isDefined(conceptMap) && conceptMap.mode === 'internal') {
            val = `#${val}`;
          }
          return p.type === 'var' ? ({valueId: vars[val] ?? val}) : ({valueString: val});
        })
      }
    };
  }
}
