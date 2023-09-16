import {FMLRuleRenderer} from './renderer';
import {FMLStructureRule} from '../../fml-structure';
import {FMLDrawflowObjectNode, FMLDrawflowRuleNode, FMLEditor} from '../../fml-editor';

export class FMLAppendRuleRenderer extends FMLRuleRenderer {
  protected override renderExpandToggle = true;

  public action = 'append';

  protected override template(editor: FMLEditor, rule: FMLStructureRule): string {
    const {el} = editor._getNodeElementByName(rule.name);
    if (rule.expanded) {
      el?.classList.add('node--rule--with-title');
    } else {
      el?.classList.remove('node--rule--with-title');
    }

    return `
      ${super._renderTitle(editor, rule)}

      <ul class="hideable description">
        ${rule.parameters.map(p => `<li>${this._renderParam(p)}</li>`).join('\n')}
      </ul>
    `;
  }

  /**
   * Creates connection only with free (no connections) port.
   * When new connection is created, the new port is created.
   */
  public override onInputConnectionCreate(
    editor: FMLEditor,
    node: FMLDrawflowRuleNode, nodePort: number,
    source: FMLDrawflowObjectNode, sourcePort: number
  ): void {
    if (editor._getNodeInputConnections(node.id, nodePort).length > 1) {
      console.warn("cannot connect to the port that already has a connection");
      editor.removeSingleConnection(source.id, node.id, `output_${sourcePort}`, `input_${nodePort}`);
    } else {
      super.onInputConnectionCreate(editor, node, nodePort, source, sourcePort);
      editor.addNodeInput(node.id);
    }
  }

  /**
   * Removes port when no connections left.
   */
  public override onInputConnectionRemove(
    editor: FMLEditor,
    node: FMLDrawflowRuleNode, nodePort: number,
    source: FMLDrawflowObjectNode, sourcePort: number
  ): void {
    if (editor._getNodeInputConnections(node.id, nodePort).length === 0) {
      super.onInputConnectionRemove(editor, node, nodePort, source, sourcePort);
      editor.removeNodeInput(node.id, `input_${nodePort}`);
    }
  }
}
