import {ElementDefinition} from 'fhir/r5';

export interface FMLStructureObjectField {
  name: string;
  types: string[];
  multiple: boolean;
  required: boolean;
}

export interface FMLPosition {
  x: number,
  y: number
}


export class FMLStructureConnection {
  sourceObject: string;
  sourceFieldIdx: number;
  targetObject: string;
  targetFieldIdx: number;
}

export class FMLStructureEntity {
  /** Unique name within FML structure */
  name: string;
  mode: 'source' | 'target' | 'object' | 'rule' | string;
  position?: FMLPosition;
}

export class FMLStructureObject extends FMLStructureEntity {
  element: ElementDefinition;
  /** @example CodeableConcept */
  resource: string;
  /** Object's unique name @example Observation.code */
  /** @example code, category, status etc. */
  fields: FMLStructureObjectField[] = [];

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

export class FMLStructureRule extends FMLStructureEntity {
  /** Variable name */
  alias?: string;
  /** @example copy, create, append etc. */
  action: string;
  /** Action parameters */
  parameters?: any[];
  condition?: string;
}


export class FMLStructure {
  objects: {[name: string]: FMLStructureObject} = {};
  rules: FMLStructureRule[] = [];
  connections: FMLStructureConnection[] = []
}
