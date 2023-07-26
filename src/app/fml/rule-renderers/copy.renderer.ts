import {FMLRuleRenderer} from './renderer';
import {FMLStructureRule} from '../fml-structure';

export class FMLCopyRenderer extends FMLRuleRenderer {
  public action = 'copy';

  public override render(rule: FMLStructureRule): string {
    return super.render(rule) + `<div>copy</div>`;
  }
}
