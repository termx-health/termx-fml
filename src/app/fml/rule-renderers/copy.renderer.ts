import {FMLRuleRenderer} from './renderer';
import {FMLStructureRule} from '../fml-structure';
import {FMLDrawflowObjectNode, FMLDrawflowRuleNode, FMLEditor} from '../fml-editor';
import {StructureMapGroupRuleTarget} from 'fhir/r5';

export class FMLCopyRenderer extends FMLRuleRenderer {
  public action = 'copy';

  public override generate(rule: FMLStructureRule, paramVals: {[p: string]: string}): StructureMapGroupRuleTarget {
    return {
      transform: 'evaluate',
      variable: rule.name,
      parameter: [
        {valueId: paramVals[rule.parameters[0].value]},
        {valueId: paramVals[rule.parameters[0].value]}
      ]
    };
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
