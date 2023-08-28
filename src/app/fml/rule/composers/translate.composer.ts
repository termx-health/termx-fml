import {FMLStructure, FMLStructureObject, FMLStructureRule} from '../../fml-structure';
import {FMLRuleComposer, FMLRuleComposerReturnType} from './composer';
import {isDefined} from '@kodality-web/core-util';

export class FMLTranslateRuleComposer extends FMLRuleComposer {
  public action = 'translate';

  public generate(fml: FMLStructure, rule: FMLStructureRule, ctx: FMLStructureObject, vars: {[value: string]: string}): FMLRuleComposerReturnType {
    return {
      target: {
        transform: 'translate',
        variable: rule.name,
        parameter: rule.parameters.map(p => {
          const conceptMap = fml.maps.find(m => m.name === p.value)
          if (isDefined(conceptMap) && conceptMap.mode === 'internal') {
            p.value = `#${p.value}`;
          }

          return p.type === 'var' ? ({valueId: vars[p.value] ?? p.value}) : ({valueString: p.value});
        })
      }
    };
  }
}
