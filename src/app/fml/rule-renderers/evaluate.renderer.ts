import {FMLRuleRenderer} from './renderer';
import {FMLStructureRule} from '../fml-structure';
import {FMLEditor} from '../fml-editor';

export class FMLEvaluateRuleRenderer extends FMLRuleRenderer {
  public action = 'evaluate';

  public override render(editor: FMLEditor, rule: FMLStructureRule): string {
    return `
      ${super.render(editor, rule)}
      <div class="description">
        ${rule.parameters.map(p => `<div>${p.value}</div>`).join('\n')}
      </div>
    `;
  }

}
