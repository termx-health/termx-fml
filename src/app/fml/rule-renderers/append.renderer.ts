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
    const rule = node.data.rule;

    editor._updateRule(node.id, rule.name, rule => {
      rule.sourceObject = source.data.obj.name
      rule.sourceField = source.data.obj.fields[sourcePort - 1].name
    })

    // todo: delete when connection is removed
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
