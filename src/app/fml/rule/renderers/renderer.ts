import {FMLStructureRule, FMLStructureRuleParameter} from '../../fml-structure';
import {FMLDrawflowNode, FMLDrawflowRuleNode, FMLEditor} from '../../fml-editor';

export abstract class FMLRuleRenderer {
  protected renderExpandToggle = false;

  abstract action: string;

  public render(
    editor: FMLEditor,
    rule: FMLStructureRule
  ): string {
    return `
      ${this.renderMeta(editor, rule)}

      <h5 class="node-header">
        <div class="m-justify-between">${rule.action} ${this.renderExpandToggle ? this.renderExpand(editor, rule) : ''}</div>
        ${rule.condition ? `<div>where <code>${rule.condition}</code></div>` : ''}
      </h5>
    `;
  }

  public renderMeta(
    editor: FMLEditor,
    rule: FMLStructureRule
  ): string {
    return `
      <div class="node-meta" style="position: absolute; top: -1.2rem; left: 0; font-size: 0.7rem; color: var(--color-text-secondary)">
        ${rule.name}
      </div>
    `;
  }

  public renderExpand(
    editor: FMLEditor,
    rule: FMLStructureRule
  ): string {
    window['_ruleExpand'] = (name: string): void => {
      const node = editor._getNodeByName(name);
      const expanded = !node.data.rule.expanded;

      editor._updateRule(node.id, node.name, rule => rule.expanded = expanded);
      editor._rerenderNodes();
    };


    return `
      <span class="m-clickable"  style="padding-inline: 0.5rem 4px; margin-left: 7px;" onclick="_ruleExpand('${rule.name}')">
        <span style="display: flex; align-items: center; justify-content: center; width: 14px; height: 14px; transform: rotate(${rule.expanded ? '-90deg' : '90deg'}); color: var(--color-text-secondary)">
          <svg xmlns="http://www.w3.org/2000/svg" height="12px" width="12px" viewBox="0 0 185.343 185.343" style="fill: currentColor">
            <path d="M51.707,185.343c-2.741,0-5.493-1.044-7.593-3.149c-4.194-4.194-4.194-10.981,0-15.175 l74.352-74.347L44.114,18.32c-4.194-4.194-4.194-10.987,0-15.175c4.194-4.194,10.987-4.194,15.18,0l81.934,81.934 c4.194,4.194,4.194,10.987,0,15.175l-81.934,81.939C57.201,184.293,54.454,185.343,51.707,185.343z"/>
          </svg>
        </span>
      </span>
    `;
  }

  public renderParam(p: FMLStructureRuleParameter): string {
    return p.type === 'const' ? `'${p.value}'` : `<kbd>${p.value}</kbd>`;
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
        rule.parameters ??= [];
        rule.parameters.push({type: 'var', value: paramName});
      }
    });
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
