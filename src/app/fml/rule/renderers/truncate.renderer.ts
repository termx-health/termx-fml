import {FMLRuleRenderer} from './renderer';
import {FMLEditor} from '../../fml-editor';
import {FMLStructureRule} from '../../fml-structure';

export class FMLTruncateRuleRenderer extends FMLRuleRenderer {
  public action = 'truncate';

  public override render(editor: FMLEditor, rule: FMLStructureRule): string {
    return `
      ${this.renderMeta(editor, rule)}

      <h5>truncate${rule.parameters.length ? '(' + rule.parameters.map(p => this.renderParam(p)).join(", ") + ')' : ''}</h5>
    `;
  }
}
