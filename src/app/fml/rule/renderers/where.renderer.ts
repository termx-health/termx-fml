import {FMLRuleRenderer} from './renderer';
import {FMLDrawflowNode, FMLDrawflowRuleNode, FMLEditor} from '../../fml-editor';

export class FMLWhereRuleRenderer extends FMLRuleRenderer {
  public action = 'where';

  /**
   * Removes all non 'const' type parameters.
   */
  public override onInputConnectionCreate(editor: FMLEditor, node: FMLDrawflowRuleNode, nodePort: number, source: FMLDrawflowNode, sourcePort: number): void {
    if (
      editor._isRule(source) ||
      editor._isObj(source) && source.data.obj.mode !== 'source' ||
      editor._getNodeInputConnections(node.id, nodePort).length > 1
    ) {
      console.warn("'where' rule is allowed from 'source' object; cannot have more than 1 connections");
      editor.removeSingleConnection(source.id, node.id, `output_${sourcePort}`, `input_${nodePort}`);
      return;
    }

    super.onInputConnectionCreate(editor, node, nodePort, source, sourcePort);
    editor._updateRule(node.id, node.name, rule => {
      if (editor._initialized) {
        rule.parameters = rule.parameters.filter(p => p.type === 'const');
      }
    });
  }
}
