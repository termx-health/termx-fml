import {FMLStructureRule} from '../fml-structure';
import {FMLDrawflowObjectNode, FMLDrawflowRuleNode, FMLEditor} from '../fml-editor';

export abstract class FMLRuleRenderer {
  abstract action: string;

  public render(rule: FMLStructureRule): string {
    return `
      <div>
        <div style="position: absolute; top: -1.2rem; left: 0; font-size: 0.7rem">
          ${rule.action}
        </div>

        <h5 style="margin: 0">${rule.name}</h5>
      </div>
    `
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
    })
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
      // console.log(target)
      // rule.targetObject = target.data.obj.name
      // rule.targetField = target.data.obj.fields[targetPort - 1].name
    })
  }
}
