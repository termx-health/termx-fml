import {FMLRuleRenderer} from './renderer';
import {FMLStructureRule} from '../fml-structure';

export class FMLDefaultRuleRenderer extends FMLRuleRenderer {
  public action = 'default';

  public override render(rule: FMLStructureRule): string {
    return super.render(rule);
  }
}
