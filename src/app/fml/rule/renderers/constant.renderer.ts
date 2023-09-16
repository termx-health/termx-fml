import {FMLRuleRenderer} from './renderer';
import {FMLStructureRule} from '../../fml-structure';
import {FMLDrawflowNode, FMLDrawflowRuleNode, FMLEditor} from '../../fml-editor';

export class FMLConstantRuleRenderer extends FMLRuleRenderer {
  public action = 'constant';

  public override template(editor: FMLEditor, rule: FMLStructureRule): string {
    return `<h5>const ${rule.parameters.map(p => this._renderParam(p)).join(',')}</h5>`;
  }

  /**
   * Removes all non 'const' type parameters.
   */
  public override onInputConnectionCreate(editor: FMLEditor, node: FMLDrawflowRuleNode, nodePort: number, source: FMLDrawflowNode, sourcePort: number): void {
    super.onInputConnectionCreate(editor, node, nodePort, source, sourcePort);
    editor._updateRule(node.id, node.name, rule => {
      if (editor._initialized) {
        rule.parameters = rule.parameters.filter(p => p.type === 'const');
      }
    });
  }
}
