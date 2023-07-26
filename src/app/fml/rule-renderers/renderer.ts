import {FMLStructureRule} from '../fml-structure';

export abstract class FMLRuleRenderer {
  abstract action: string;

  public render(rule: FMLStructureRule): string {
    return `
      <div >
         <h5 style="margin: 0">${rule.name}</h5>
      </div>
    `
  }
}
