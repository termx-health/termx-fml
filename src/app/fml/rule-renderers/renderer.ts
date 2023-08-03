import {FMLStructureRule} from '../fml-structure';
import {FMLDrawflowNode, FMLDrawflowRuleNode, FMLEditor} from '../fml-editor';

export abstract class FMLRuleRenderer {
  abstract action: string;

  public render(rule: FMLStructureRule): string {
    return `

        <h5 >
          <div>${rule.action}</div>
          ${rule.condition ? `<div>where <code>${rule.condition}</code></div>` : ''}
        </h5>
    `;
  }


  public onInputConnectionCreate(
    editor: FMLEditor,
    node: FMLDrawflowRuleNode,
    nodePort: number,
    source: FMLDrawflowNode,
    sourcePort: number
  ): void {
    editor._fml.putConnection(editor._fml.newFMLConnection(
      source.name, sourcePort - 1,
      node.name, nodePort - 1,
    ));
  }

  public onOutputConnectionCreate(
    editor: FMLEditor,
    node: FMLDrawflowRuleNode,
    nodePort: number,
    target: FMLDrawflowNode,
    targetPort: number
  ): void {
    editor._fml.putConnection(editor._fml.newFMLConnection(
      node.name, nodePort - 1,
      target.name, targetPort - 1
    ));
  }


  public onInputConnectionRemove(
    editor: FMLEditor,
    node: FMLDrawflowRuleNode,
    nodePort: number,
    source: FMLDrawflowNode,
    sourcePort: number
  ): void {
    editor._fml.removeConnection(source.name, sourcePort - 1, node.name, nodePort - 1);
  }

  public onOutputConnectionRemove(
    editor: FMLEditor,
    node: FMLDrawflowRuleNode,
    nodePort: number,
    target: FMLDrawflowNode,
    targetPort: number
  ): void {
    editor._fml.removeConnection(node.name, nodePort - 1, target.name, targetPort - 1)
  }
}
