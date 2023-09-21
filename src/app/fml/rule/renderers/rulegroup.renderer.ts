import {FMLRuleRenderer} from './renderer';
import {FMLStructureEntityMode, FMLStructureRule} from '../../fml-structure';
import {FMLEditor} from '../../fml-editor';
import {collect, isDefined} from '@kodality-web/core-util';
import {DrawflowNode} from 'drawflow';

export class FMLRulegroupRuleRenderer extends FMLRuleRenderer {
  protected override renderExpandToggle = true;

  public action = 'rulegroup';

  public override init(editor: FMLEditor, rule: FMLStructureRule): void {
    super.init(editor, rule);

    const fmlKey = rule.parameters
      .filter(p => p.type === 'const')
      .map(p => p.value)
      .find(v => editor._fml.groups.map(g => g.name).includes(v));

    const fml = editor._fml.getGroup(fmlKey);
    if (isDefined(fml)) {
      const node = (): DrawflowNode => editor._getNodeByName(rule.name);
      const objects = collect(Object.values(fml.objects), o => o.mode as FMLStructureEntityMode);

      while (Object.keys(node().inputs).length < objects.source.length) {
        editor.addNodeInput(node().id);
      }

      while (Object.keys(node().outputs).length < objects.target.length) {
        editor.addNodeOutput(node().id);
      }
    }
  }

  public override template(editor: FMLEditor, rule: FMLStructureRule): string {
    const {el} = editor._getNodeElementByName(rule.name);
    el.style.alignItems = 'center';

    const keys = editor._fml.groups.map(g => g.name);
    const fmlKey = rule.parameters.filter(p => p.type === 'const').map(p => p.value).find(v => keys.includes(v));
    const objects = collect(
      Object.values(editor._fml.getGroup(fmlKey)?.objects),
      o => o.mode as FMLStructureEntityMode,
      o => o.element.id
    );

    return `
      <div class="m-items-middle">
        <ce-icon m-code="block" style="display: inline-flex; width: 1rem; height: 1rem;"></ce-icon>

        <div>
          <h5>${fmlKey ?? 'unknown'}</h5>
          <h5 class="hideable">${[objects.source.map(n => `src: ${n}`), objects.target.map(n => `tgt: ${n}`)].flat().join(", ")}</h5>
        </div>

        ${this._renderExpand(editor, rule)}
      </div>
    `;
  }
}
