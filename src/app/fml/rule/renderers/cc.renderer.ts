import {FMLRuleRenderer} from './renderer';
import {FMLStructureRule} from '../../fml-structure';
import {FMLEditor} from '../../fml-editor';

export class FMLCcRuleRenderer extends FMLRuleRenderer {
  protected override renderExpandToggle = true;

  public action = 'cc';

  public override render(editor: FMLEditor, rule: FMLStructureRule): string {
    return `
      ${super.render(editor,rule)}

      <div class="description">
        ${rule.parameters.map(p => `<div>${this.renderParam(p)}</div>`).join('\n')}
      </div>
    `;
  }
}
