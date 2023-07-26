import {ElementDefinition} from 'fhir/r5';

export interface FMLStructureObjectField {
  name: string;
  types: string[];
}

export interface FMLPosition {
  x: number,
  y: number
}


export class FMLStructureObject {
  /** @example CodeableConcept */
  resource: string;
  /** @example Observation.code */
  path: string;
  /** @example code, category, status etc. */
  fields: FMLStructureObjectField[] = [];

  mode: 'source' | 'target' | 'object' | string;
  position?: FMLPosition;

  // fixme: not sure what for is this
  _fhirDefinition?: ElementDefinition;

  /** @deprecated */
  html(): string {
    return `
      <div>
         <h5 class="node-title">${this.mode} | <b>${this.path}</b> ${this.path !== this.resource ? `| ${this.resource}` : ''}</div>
         ${this.fields.map(f => `<div style="height: 1.5rem; border-bottom: 1px solid var(--color-borders)">${f.name}</div>`).join('')}
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

  /** FMLStructureObject.path */
  sourceObject: string;
  sourceField: string;
  /** FMLStructureObject.path */
  targetObject: string;
  targetField: string;

  position?: FMLPosition;
  /** @deprecated */
  html: () => string
}


export class FMLStructure {
  objects: {[path: string]: FMLStructureObject} = {};
  rules: FMLStructureRule[] = []
}
