import {FMLStructureRule} from '../fml-structure';
import {FMLDrawflowNode, FMLDrawflowRuleNode, FMLEditor} from '../fml-editor';

export abstract class FMLRuleRenderer {
  abstract action: string;

  public render(rule: FMLStructureRule): string {
    return `
        <div class="node-meta" style="position: absolute; top: -1.2rem; left: 0; font-size: 0.7rem">
          ${rule.name}
        </div>

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

    editor._updateRule(node.id, node.name, rule => {
      if (editor._initialized) {
        const paramName = editor._isObj(source) ? `${source.name}.${source.data.obj.fields[sourcePort - 1]?.name}` : source.name;
        rule.parameters.push({type: 'var', value: paramName});
      }
    });

    editor._rerenderNodes();
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


    // removes parameter if exists
    const paramName = editor._isObj(source) ? `${source.name}.${source.data.obj.fields[sourcePort - 1]?.name}` : source.name;
    const paramIdx = node.data.rule.parameters.findIndex(p => p.value === paramName);
    if (paramIdx !== -1) {
      editor._updateRule(node.id, node.name, rule => {
        rule.parameters.splice(paramIdx, 1);
      });
      editor._rerenderNodes();
    }
  }

  public onOutputConnectionRemove(
    editor: FMLEditor,
    node: FMLDrawflowRuleNode,
    nodePort: number,
    target: FMLDrawflowNode,
    targetPort: number
  ): void {
    editor._fml.removeConnection(node.name, nodePort - 1, target.name, targetPort - 1);
  }
}
