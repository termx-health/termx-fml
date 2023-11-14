import {FMLRuleRenderer} from './renderer';
import {FMLStructureEntityMode, FMLStructureGroup, FMLStructureObject, FMLStructureRule} from '../../fml-structure';
import {FMLDrawflowNode, FMLDrawflowRuleNode, FMLEditor} from '../../fml-editor';
import {collect, isNil} from '@kodality-web/core-util';
import {DrawflowNode} from 'drawflow';

export class FMLRulegroupRuleRenderer extends FMLRuleRenderer {
  protected override renderExpandToggle = true;

  public action = 'rulegroup';

  public override init(editor: FMLEditor, rule: FMLStructureRule): void {
    super.init(editor, rule);

    const fml = this.getGroup(rule, editor);
    if (isNil(fml)) {
      return;
    }

    const objects = collect<FMLStructureEntityMode, FMLStructureObject>(Object.values(fml.objects), o => o.mode);

    const BOUND = 2023;
    let inptCnt = 0, outCnt = 0;

    const node = (): DrawflowNode => editor._getNodeByName(rule.name);
    while (Object.keys(node().inputs).length < objects.source?.length && inptCnt++ < BOUND) {
      editor.addNodeInput(node().id);
    }
    while (Object.keys(node().outputs).length < objects.target?.length && outCnt++ < BOUND) {
      editor.addNodeOutput(node().id);
    }
  }

  public override template(editor: FMLEditor, rule: FMLStructureRule): string {
    const {el} = editor._getNodeElementByName(rule.name);
    el.style.alignItems = 'center';

    const names = editor._fml.groups.map(g => g.name);
    const groupName = rule.parameters.filter(p => p.type === 'const').map(p => p.value).find(v => names.includes(v));
    const groupInputs = editor._fml.getGroup(groupName)?.inputs();
    const actualInputs = rule.parameters.filter(p => p.type === 'var').map(v=> editor._fmlGroup.objects[v.value]?.element.id ?? v.value);

    return `
      <div class="m-items-middle">
        <ce-icon m-code="block" style="display: inline-flex; width: 1rem; height: 1rem;"></ce-icon>

        <div>
          <h5>${groupName ?? 'unknown'}</h5>
          <h5 class="hideable">
            ${groupInputs.map((o, idx) =>
              `<span>${o.mode === 'source' ? 'src' : 'tgt'}: ${o.element.id}${actualInputs[idx] && actualInputs[idx] !== o.element.id ? `<span class="description"> (${actualInputs[idx]})</span></span>`: ''}</span></span>`
            ).join(', ')}
          </h5>
        </div>

        ${this._renderExpand(editor, rule)}
      </div>
    `;
  }


  private getGroup(rule: FMLStructureRule, editor: FMLEditor): FMLStructureGroup {
    const fmlKey = rule.parameters
      .filter(p => p.type === 'const')
      .map(p => p.value)
      .find(v => editor._fml.groups.map(g => g.name).includes(v));

    return editor._fml.getGroup(fmlKey);
  }


  public override onOutputConnectionCreate(editor: FMLEditor, node: FMLDrawflowRuleNode, nodePort: number, target: FMLDrawflowNode, targetPort: number): void {
    super.onOutputConnectionCreate(editor, node, nodePort, target, targetPort);

    // @see this.onInputConnectionCreate()
    editor._updateRule(node.id, node.name, rule => {
      if (editor._initialized) {
        const paramName = this.getParamName(editor, target, targetPort);
        rule.parameters ??= [];
        rule.parameters.push({type: 'var', value: paramName});
      }
    });
  }

  public override onOutputConnectionRemove(editor: FMLEditor, node: FMLDrawflowRuleNode, nodePort: number, target: FMLDrawflowNode, targetPort: number): void {
    super.onOutputConnectionRemove(editor, node, nodePort, target, targetPort);


    // @see this.onInputConnectionRemove()
    const paramName = this.getParamName(editor, target, targetPort);
    const paramIdx = node.data.rule.parameters.findIndex(p => p.value === paramName);
    if (paramIdx !== -1) {
      editor._updateRule(node.id, node.name, rule => {
        rule.parameters.splice(paramIdx, 1);
      });
    }
  }
}
