import {FMLRuleRenderer} from './renderer';
import {FMLStructureRule} from '../../fml-structure';
import {FMLEditor} from '../../fml-editor';

export class FMLEvaluateRuleRenderer extends FMLRuleRenderer {
  protected override renderExpandToggle = true;

  public action = 'evaluate';

  public override template(editor: FMLEditor, rule: FMLStructureRule): string {
    return `
      ${super._renderTitle(editor, rule)}

      <div class="hideable description">
        ${rule.parameters.map(p => `<div>${this._renderParam(p)}</div>`).join('\n')}
      </div>
    `;
  }

}
