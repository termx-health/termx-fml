import {FMLRuleRenderer} from './renderer';
import {FMLStructureRule} from '../../fml-structure';
import {FMLEditor} from '../../fml-editor';

export class FMLCcRuleRenderer extends FMLRuleRenderer {
  protected override renderExpandToggle = true;

  public action = 'cc';

  public override template(editor: FMLEditor, rule: FMLStructureRule): string {
    return `
      ${super._renderTitle(editor,rule)}

      <div class="hideable description">
        ${rule.parameters.map(p => `<div>${this._renderParam(p)}</div>`).join('\n')}
      </div>
    `;
  }
}
