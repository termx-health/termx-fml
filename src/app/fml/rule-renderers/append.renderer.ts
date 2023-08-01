import {FMLRuleRenderer} from './renderer';
import {FMLStructureRule} from '../fml-structure';
import {FMLDrawflowObjectNode, FMLDrawflowRuleNode, FMLEditor} from '../fml-editor';

export class FMLAppendRuleRenderer extends FMLRuleRenderer {
  public action = 'append';

  public override render(rule: FMLStructureRule): string {
    return `
      ${super.render(rule)}
      <ul class="description">
        ${rule.parameters.map(p => `<li>${p}</li>`).join('\n')}
      </ul>
    `;
  }

  public override onInputConnectionCreate(
    editor: FMLEditor,
    node: FMLDrawflowRuleNode, nodePort: number,
    source: FMLDrawflowObjectNode, sourcePort: number
  ): void {
    // new connection is pushed
    editor.addNodeInput(node.id)
  }

  public override onInputConnectionRemove(
    editor: FMLEditor,
    node: FMLDrawflowRuleNode, nodePort: number,
    source: FMLDrawflowObjectNode, sourcePort: number
  ): void {
    super.onInputConnectionRemove(editor, node, nodePort, source, sourcePort);

    editor.removeNodeInput(node.id, `input_${nodePort}`)
  }
}
