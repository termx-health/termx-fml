import {Bundle, ElementDefinition, StructureDefinition} from 'fhir/r5';
import {isNil, remove} from '@kodality-web/core-util';


export interface FMLPosition {
  x: number,
  y: number
}

export type FMLStructureEntityMode = 'source' | 'target' | 'element' | 'object' | 'rule';

export class FMLStructureEntity {
  /** Unique name within FML structure */
  name: string;
  mode: FMLStructureEntityMode | string;
  position?: FMLPosition;
}


/* Object */

export interface FMLStructureObjectField {
  name: string;
  types: string[];

  // meta-data
  multiple: boolean;
  required: boolean;
  part: boolean; // BackboneElement sub element
}

export class FMLStructureObject extends FMLStructureEntity {
  element: ElementDefinition;
  /** @example CodeableConcept */
  resource: string;
  url: string;
  /** @example code, category, status etc. */
  rawFields: FMLStructureObjectField[] = [];

  public get fields(): FMLStructureObjectField[] {
    return this.rawFields.filter(f => !f.part);
  }

  public getFieldIndex(field: string): number {
    return this.fields.findIndex(f => f.name === field);
  }


  /** @deprecated */
  public html(): string {
    return `
      <div>
        <h5 class="node-title">${this.mode === 'object' ? 'new' : this.mode} <b>${this.resource}</b></div>
        ${this.fields.map(f => `<div style="height: 1.5rem; border-bottom: 1px solid var(--color-borders)">${f.name}</div>`).join('\n')}

        <div style="position: absolute; top: -1.5rem; left: 0; font-size: 0.7rem; color: var(--color-text-secondary)">
          ${this.name}
        </div>
      </div>
    `;
  }

  /** DO NOT REMOVE! Used in JSON.stringify(), because getters are not serialized automatically */
  toJSON(): any {
    return {
      ...this,
      fields: this.fields
    };
  }
}


/* Rule */

export type FMLStructureRuleParameter = {type: 'const' | 'var', value: string | any};

export class FMLStructureRule extends FMLStructureEntity {
  /** @example copy, create, append etc. */
  action: string;
  /** Action parameters */
  parameters?: FMLStructureRuleParameter[];
  condition?: string;
}


/* Connection */
export class FMLStructureConnection {
  sourceObject: string;
  sourceFieldIdx: number;
  targetObject: string;
  targetFieldIdx: number;
}


/* Structure */
export class FMLStructure {
  bundle: Bundle<StructureDefinition>;
  objects: {[name: string]: FMLStructureObject} = {};
  rules: FMLStructureRule[] = [];
  _connections: FMLStructureConnection[] = [];


  /* Connections */

  public get connections(): readonly FMLStructureConnection[] {
    return this._connections;
  }

  public getSources = (target: string, field?: string): {object: string, field?: string}[] => {
    return this.connections
      .filter(c => c.targetObject === target)
      .filter(c => isNil(field) || field === this.objects[c.targetObject].fields[c.targetFieldIdx]?.name)
      .map(c => ({
        object: c.sourceObject,
        field: this.objects[c.sourceObject]?.fields[c.sourceFieldIdx]?.name
      }));
  };

  public getTargets = (source: string, field?: string): {object: string, field?: string}[] => {
    return this.connections
      .filter(c => c.sourceObject === source)
      .filter(c => isNil(field) || field === this.objects[c.targetObject].fields[c.sourceFieldIdx]?.name)
      .map(c => ({
        object: c.targetObject,
        field: this.objects[c.targetObject]?.fields[c.targetFieldIdx]?.name
      }));
  };

  public putConnection(conn: FMLStructureConnection): void {
    const exists = this.connections.some(c =>
      c.sourceObject === conn.sourceObject && c.sourceFieldIdx === conn.sourceFieldIdx &&
      c.targetObject === conn.targetObject && c.targetFieldIdx === conn.targetFieldIdx
    );
    if (!exists) {
      this._connections.push(conn);
    }
  }

  public removeConnection(source: string, sourceFieldIdx: number, target: string, targetFieldIdx: number): void {
    remove(this._connections, this._connections.find(c =>
      c.sourceObject === source && c.sourceFieldIdx === sourceFieldIdx &&
      c.targetObject === target && c.targetFieldIdx === targetFieldIdx
    ));
  }


  /* Builders */

  public newFMLObject(resource: string, path: string, mode: string): FMLStructureObject {
    if (isNil(resource)) {
      throw Error(`Resource name is missing for the "${path}"`);
    }

    // true => assume resource's definition is described within the structure definition
    const inlineDefinition = mode === 'object' && path === resource;

    // try to find resource's structure definition
    const structureDefinition = this.findStructureDefinition(this.bundle, resource);
    if (isNil(structureDefinition)) {
      throw Error(`StructureDefinition for the "${resource}" not found!`);
    } else if (isNil(structureDefinition.snapshot)) {
      throw Error(`Snapshot is missing in the StructureDefinition "${resource}"!`);
    }

    let elements = structureDefinition.snapshot.element;
    if (inlineDefinition) {
      elements = elements.filter(el => el.path.startsWith(path));
    }

    const selfDefinition = elements[0];
    // fixme: provide type as an argument? currently take the first one
    const selfResourceType = selfDefinition.type?.[0].code ?? selfDefinition.id;
    const selfFields = elements.slice(1);

    // double check whether inline definition assumption was correct
    if (inlineDefinition && !FMLStructure.isBackboneElement(selfResourceType)) {
      // self definition's element MUST be the BackboneElement, but if you got here, it is not!
      return this.newFMLObject(selfResourceType, path, mode);
    }

    if (selfDefinition.type?.length > 1) {
      // fixme: as for now, warn about multiple types, see fixme above
      console.warn(`Self definition "${selfDefinition.id}" has multiple types, using first`);
    }

    const backboneElementPaths = selfFields
      .filter(f => f.type?.some(t => FMLStructure.isBackboneElement(t.code)))
      .map(f => f.path);

    const o = new FMLStructureObject();
    o.element = selfDefinition;
    o.resource = selfResourceType;
    o.url = structureDefinition.url;
    o.name = path;
    o.mode = mode;
    o.rawFields = selfFields.map(e => ({
      name: e.path.substring(selfDefinition.id.length + 1).split("[x]")[0],  // fixme: wtf [x] part? could be done differently?
      types: e.type?.map(t => t.code) ?? [],
      multiple: e.max !== '1',
      required: e.min === 1,
      part: backboneElementPaths.some(p => e.path.startsWith(p) && e.path !== p)
    }));

    return o;
  }

  public newFMLConnection(source: string, sourceIdx: number, target: string, targetIdx: number): FMLStructureConnection {
    const c = new FMLStructureConnection();
    c.sourceObject = source;
    c.sourceFieldIdx = sourceIdx;
    c.targetObject = target;
    c.targetFieldIdx = targetIdx;
    return c;
  }


  /* Utils */

  public findStructureDefinition(bundle: Bundle<StructureDefinition>, anyPath: string): StructureDefinition {
    // Resource.whatever.element (anyPath) => Resource (base)
    const base = anyPath.includes('.')
      ? anyPath.slice(0, anyPath.indexOf('.'))
      : anyPath;

    return bundle.entry
      .map(e => e.resource)
      .find(e => e.id === base);
  }

  public static isBackboneElement(resource: string): boolean {
    return ['BackboneElement', 'Element'].includes(resource);
  }
}
