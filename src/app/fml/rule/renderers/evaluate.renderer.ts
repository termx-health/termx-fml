import {FMLRuleRenderer} from './renderer';
import {FMLStructureRule} from '../../fml-structure';
import {FMLEditor} from '../../fml-editor';

export class FMLEvaluateRuleRenderer extends FMLRuleRenderer {
  protected override renderExpandToggle = true;

  public action = 'evaluate';

  public override template(editor: FMLEditor, rule: FMLStructureRule): string {
    return `<h5 class="m-justify-between">
      <span>evaluate${rule.parameters.length ? `<span class="hideable">(${rule.parameters.map(p => this._renderParam(p)).join(", ")})</span>` : ''}</span>
      ${this._renderExpand(editor, rule)}
    </h5>`;
  }
}
