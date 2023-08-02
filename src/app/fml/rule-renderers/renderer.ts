import {FMLStructureRule} from '../fml-structure';
import {FMLDrawflowNode, FMLDrawflowObjectNode, FMLDrawflowRuleNode, FMLEditor} from '../fml-editor';
import {remove} from '@kodality-web/core-util';

export abstract class FMLRuleRenderer {
  abstract action: string;

  public render(rule: FMLStructureRule): string {
    return `
        <div style="position: absolute; top: -1.2rem; left: 0; font-size: 0.7rem">
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
    source: FMLDrawflowObjectNode,
    sourcePort: number
  ): void {
    const rule = node.data.rule;
    // target.inputs[e.input_class].connections.forEach(c => {
    //   if (`${c['node']}|${c['input']}` !== `${e.output_id}|${e.output_class}`) {
    //     this.removeSingleConnection(c['node'], e.input_id, c['input'], e.input_class);
    //   }
    // })
    editor._updateRule(node.id, rule.name, rule => {
      // rule.sourceObject = source.data.obj.name
      // rule.sourceField = source.data.obj.fields[sourcePort - 1].name
    });
  }

  public onOutputConnectionCreate(
    editor: FMLEditor,
    node: FMLDrawflowRuleNode,
    nodePort: number,
    target: FMLDrawflowObjectNode,
    targetPort: number
  ): void {
    const rule = node.data.rule;
    // source.outputs[e.output_class].connections.forEach(c => {
    //   if (`${c['node']}|${c['output']}` !== `${e.input_id}|${e.input_class}`) {
    //     this.removeSingleConnection(e.output_id, c['node'], e.output_class, c['output']);
    //   }
    // })
    editor._updateRule(node.id, rule.name, rule => {
      // rule.targetObject = target.data.obj.name
      // rule.targetField = target.data.obj.fields[targetPort - 1].name
    });
  }


  public onInputConnectionRemove(
    editor: FMLEditor,
    node: FMLDrawflowRuleNode,
    nodePort: number,
    source: FMLDrawflowNode,
    sourcePort: number
  ): void {
    const rule = node.data.rule;
    // if (`${rule.sourceObject}|${rule.sourceField}` !== `${source.name}|${source.data.obj.fields[sourcePort - 1].name}`) {
    //   console.warn(`Current: "${rule.sourceObject}|${rule.sourceField}". Deleted: "${source.name}|${source.data.obj.fields[sourcePort - 1].name}"`)
    //   return
    // }

    editor._updateRule(node.id, rule.name, rule => {
      const {node: nodeId, input} = node.inputs[`input_${nodePort}`]?.connections?.[0] ?? {};
      if (nodeId && editor.isObj(editor.getNodeFromId(nodeId))) {
        // after deletion the rule node has other source connections, restore first
        const objNode = editor.getNodeFromId(nodeId);
        // rule.sourceObject = objNode.name
        // rule.sourceField = objNode.data.obj.fields[getPortIdx(input) - 1].name
      } else {
        // rule.sourceObject = undefined
        // rule.sourceField = undefined
      }
    });


    const _fml = editor._fml;
    remove(_fml.connections, _fml.connections.find(c =>
      c.sourceObject === source.name && c.sourceFieldIdx === sourcePort - 1 &&
      c.targetObject === node.name && c.targetFieldIdx === nodePort - 1
    ));
  }

  public onOutputConnectionRemove(
    editor: FMLEditor,
    node: FMLDrawflowRuleNode,
    nodePort: number,
    target: FMLDrawflowNode,
    targetPort: number
  ): void {
    const rule = node.data.rule;
    // if (`${rule.targetObject}|${rule.targetField}` !== `${target.name}|${target.data.obj.fields[targetPort - 1].name}`) {
    //   console.warn(`Current: "${rule.targetObject}|${rule.targetField}". Deleted "${target.name}|${target.data.obj.fields[targetPort - 1].name}"`)
    //   return
    // }

    editor._updateRule(node.id, rule.name, rule => {
      const {node: nodeId, output} = node.outputs[`output_${nodePort}`]?.connections?.[0] ?? {} as any;
      if (nodeId && editor.isObj(editor.getNodeFromId(nodeId))) {
        // after deletion the rule node has other target connections, restore first
        const objNode = editor.getNodeFromId(nodeId);
        // rule.targetObject = objNode.name
        // rule.targetObject = objNode.data.obj.fields[getPortIdx(output) - 1].name
      } else {
        // rule.targetObject = undefined
        // rule.targetObject = undefined
      }
    });



    const _fml = editor._fml;
    remove(_fml.connections, _fml.connections.find(c =>
      c.sourceObject === node.name && c.sourceFieldIdx === nodePort - 1 &&
      c.targetObject === target.name && c.targetFieldIdx === targetPort - 1
    ));
  }
}
