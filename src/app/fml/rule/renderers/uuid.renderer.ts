import {FMLRuleRenderer} from './renderer';
import {FMLDrawflowNode, FMLDrawflowRuleNode, FMLEditor} from '../../fml-editor';

export class FMLUuidRuleRenderer extends FMLRuleRenderer {
  public action = 'uuid';


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
