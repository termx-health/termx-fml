import {FMLRuleRenderer} from './renderer';
import {FMLStructureRule} from '../../fml-structure';
import {FMLEditor} from '../../fml-editor';

export class FMLRulegroupRuleRenderer extends FMLRuleRenderer {
  public action = 'rulegroup';

  public override render(editor: FMLEditor, rule: FMLStructureRule): string {
    const keys = Object.keys(editor._fmls);
    const fmlKey = rule.parameters.filter(p => p.type === 'const').map(p => p.value).find(v => keys.includes(v));

    return `
      ${super.renderMeta(editor, rule)}

      <div class="m-items-middle">
        <ce-icon m-code="folder" style="display: inline-flex; width: 1rem; height: 1rem;"></ce-icon>
        <h5>
          ${fmlKey ?? 'unknown'}
        </h5>
      </div>
    `;
  }
}
