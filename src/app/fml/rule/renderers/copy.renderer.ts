import {FMLRuleRenderer} from './renderer';
import {FMLDrawflowObjectNode, FMLDrawflowRuleNode, FMLEditor} from '../../fml-editor';

export class FMLCopyRuleRenderer extends FMLRuleRenderer {
  public action = 'copy';

  /**
   * Copy's port CAN have only one connection.
   */
  public override onInputConnectionCreate(
    editor: FMLEditor,
    node: FMLDrawflowRuleNode, nodePort: number,
    source: FMLDrawflowObjectNode, sourcePort: number
  ): void {
    if (editor._getNodeInputConnections(node.id, nodePort).length > 1) {
      console.warn("'copy' rule can have only 1 source");
      editor.removeSingleConnection(source.id, node.id, `output_${sourcePort}`, `input_${nodePort}`);
    } else {
      super.onInputConnectionCreate(editor, node, nodePort, source, sourcePort);
    }
  }
}
