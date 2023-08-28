import {FMLRuleRenderer} from './renderer';
import {FMLStructureRule, FMLStructureRuleParameter} from '../../fml-structure';
import {FMLDrawflowNode, FMLDrawflowRuleNode, FMLEditor} from '../../fml-editor';

export class FMLTranslateRuleRenderer extends FMLRuleRenderer {
  protected override renderExpandToggle = true;

  public action = 'translate';

  protected override template(editor: FMLEditor, rule: FMLStructureRule): string {

    return `
      ${super._renderTitle(editor, rule)}

      <ul class="hideable description">
        ${rule.parameters.map(p => `<li>${this._renderParam(p)}</li>`).join('\n')}
      </ul>
    `;
  }

  public override onInputConnectionCreate(editor: FMLEditor, node: FMLDrawflowRuleNode, nodePort: number, source: FMLDrawflowNode, sourcePort: number): void {
    if (editor._getNodeInputConnections(node.id, nodePort).length > 1) {
      console.warn("cannot connect to the port that already has a connection");
      editor.removeSingleConnection(source.id, node.id, `output_${sourcePort}`, `input_${nodePort}`);
      return;
    }

    super.onInputConnectionCreate(editor, node, nodePort, source, sourcePort);


    editor._updateRule(node.id, node.name, rule => {
      if (editor._initialized) {
        rule.parameters = rule.parameters.sort((a, b) => {
          const val = (p: FMLStructureRuleParameter): number => {
            if (p.type === 'var') {
              return 1;
            }
            if (editor._fml.maps.some(m => m.name === p.value)) {
              return 2;
            }
            return 3;
          };
          return val(a) - val(b);
        });
      }
    });
  }
}
