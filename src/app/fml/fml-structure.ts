import {ElementDefinition} from 'fhir/r5';

export interface FMLStructureObjectField {
  name: string;
  types: string[];
  multiple: boolean;
}

export interface FMLPosition {
  x: number,
  y: number
}


export class FMLStructureObject {
  element: ElementDefinition;
  /** @example CodeableConcept */
  resource: string;
  /** Object's unique name @example Observation.code */
  name: string;
  /** @example code, category, status etc. */
  fields: FMLStructureObjectField[] = [];

  mode: 'source' | 'target' | 'object' | string;
  position?: FMLPosition;

  // _fhirDefinition?: ElementDefinition;

  /** @deprecated */
  html(): string {
    return `
      <div>
        <h5 class="node-title">${this.mode === 'object' ? 'new' : this.mode} <b>${this.resource}</b></div>
        ${this.fields.map(f => `<div style="height: 1.5rem; border-bottom: 1px solid var(--color-borders)">${f.name}</div>`).join('\n')}

        <div style="position: absolute; top: -1.5rem; left: 0; font-size: 0.7rem; color: var(--color-text-secondary)">
          ${this.name}
        </div>
      </div>
    `
  };

  getFieldIndex(field: string): number {
    return this.fields.findIndex(f => f.name === field);
  }
}

export class FMLStructureRule {
  /** Rule's unique name within FML structure */
  name: string;
  /** Variable name */
  alias?: string;
  /** @example copy, create, append etc. */
  action: string;
  /** Action parameters */
  parameters?: any[];

  // todo: multiple sources
  /** FMLStructureObject.path */
  sourceObject: string;
  sourceField: string;
  /** FMLStructureObject.path */
  targetObject: string;
  targetField: string;

  position?: FMLPosition;
}


export class FMLStructure {
  objects: {[name: string]: FMLStructureObject} = {};
  rules: FMLStructureRule[] = []
}
