import {FMLRuleRenderer} from './renderer';
import {FMLStructureRule} from '../fml-structure';
import {FMLDrawflowObjectNode, FMLDrawflowRuleNode, FMLEditor} from '../fml-editor';

export class FMLCopyRenderer extends FMLRuleRenderer {
  public action = 'copy';

  public override generate(rule: FMLStructureRule, paramVals: {[p: string]: string}): string {
    // return `, ${rule.action}(${rule.parameters.map(p => paramVals[p.value]).join(", ")}) as ${rule.name}`;


    return `, evaluate(${rule.parameters[0].value}, ${rule.parameters[0].value}) as ${rule.name}`;

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
    }
  }
}
