import {FMLRuleRenderer} from './renderer';
import {FMLEditor} from '../../fml-editor';
import {FMLStructureRule} from '../../fml-structure';

export class FMLTruncateRuleRenderer extends FMLRuleRenderer {
  public action = 'truncate';

  public override template(editor: FMLEditor, rule: FMLStructureRule): string {
    return `<h5>truncate${rule.parameters.length ? '(' + rule.parameters.map(p => this._renderParam(p)).join(", ") + ')' : ''}</h5>`;
  }
}
