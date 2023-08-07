import {FMLRuleRenderer} from './renderer';
import {FMLStructureRule} from '../fml-structure';
import {FMLDrawflowObjectNode, FMLDrawflowRuleNode, FMLEditor} from '../fml-editor';

export class FMLAppendRuleRenderer extends FMLRuleRenderer {
  public action = 'append';

  public override render(rule: FMLStructureRule): string {
    return `
      ${super.render(rule)}
      <ul class="description">
        ${rule.parameters.map(p => `<li>${p.value}</li>`).join('\n')}
      </ul>
    `;
  }

  public override onInputConnectionCreate(
    editor: FMLEditor,
    node: FMLDrawflowRuleNode, nodePort: number,
    source: FMLDrawflowObjectNode, sourcePort: number
  ): void {
    if (editor._getNodeInputConnections(node.id, nodePort).length > 1) {
      editor.removeSingleConnection(source.id, node.id, `output_${sourcePort}`, `input_${nodePort}`);
    } else {
      super.onInputConnectionCreate(editor, node, nodePort, source, sourcePort);
      editor.addNodeInput(node.id);
    }
  }

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
