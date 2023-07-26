import {FMLStructureRule} from '../fml-structure';

export abstract class FMLRuleRenderer {
  abstract action: string;

  public render(rule: FMLStructureRule): string {
    return `
      <div>
         ${rule.name}
      </div>
    `
  }
}
