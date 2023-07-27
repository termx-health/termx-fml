import {FMLStructureRule} from '../fml-structure';

export abstract class FMLRuleRenderer {
  abstract action: string;

  public render(rule: FMLStructureRule): string {
    return `
      <div>
        <div style="position: absolute; bottom: 0; font-size: 0.7rem; right: 3px; color: var(--color-text-secondary)">
          x: ${rule.position?.x}; y: ${rule.position?.y}
        </div>
        <h5 style="margin: 0">${rule.name}</h5>
      </div>
    `
  }
}
