import {Bundle, ElementDefinition, StructureDefinition} from 'fhir/r5';
import {group, isNil, remove, unique} from '@kodality-web/core-util';

export const $THIS = "$this";

export interface FMLPosition {
  x: number,
  y: number
}


export class FMLStructureEntity {
  /** Unique name within FML structure */
  name: string;
  mode: FMLStructureEntityMode | string;
  position?: FMLPosition;
  expanded?: boolean = true;
}

export type FMLStructureEntityMode = 'source' | 'target' | 'element' | 'object' | 'rule' | 'group';


/* Object */

export class FMLStructureObject extends FMLStructureEntity {
  element: ElementDefinition;
  /** @example CodeableConcept */
  resource: string;
  url: string;
  /** @example code, category, status etc. */
  rawFields: FMLStructureObjectField[] = [];

  condition?: string;
  listOption?: 'every' | 'first' | 'last';

  public get fields(): FMLStructureObjectField[] {
    return this.rawFields.filter(f => !f.part);
  }

  public fieldIndex(field: string): number {
    return this.fields.findIndex(f => f.name === field);
  }

  /**
   * DO NOT REMOVE!
   * Used by JSON.stringify(), because getters are not serialized automatically
   */
  toJSON(): any {
    return {
      ...this,
      fields: this.fields
    };
  }
}

export interface FMLStructureObjectField {
  name: string;
  types: string[];

  // meta-data
  multiple: boolean;
  required: boolean;
  part: boolean; // BackboneElement sub element
}


/* Rule */

export class FMLStructureRule extends FMLStructureEntity {
  /** @example copy, create, append etc. */
  action: string;
  /** Action parameters */
  parameters?: FMLStructureRuleParameter[];
  condition?: string;
}

export interface FMLStructureRuleParameter {
  type: 'const' | 'var',
  value: string | any
}


/* Connection */

export class FMLStructureConnection {
  sourceObject: string;
  sourceFieldIdx: number;
  targetObject: string;
  targetFieldIdx: number;
}


/* Concept Map */

export class FMLStructureConceptMap {
  mode: 'internal' | 'external';
  name: string;

  source?: string;
  target?: string;
  mappings?: FMLStructureConceptMapMapping[];
}

export class FMLStructureConceptMapMapping {
  source: string;
  target: string;
}


/* Structure group */

export class FMLStructureGroup {
  objects: {[name: string]: FMLStructureObject} = {};
  rules: FMLStructureRule[] = [];
  _connections: FMLStructureConnection[] = [];

  /* true = generate single rule */
  shareContext = false;

  public get connections(): readonly FMLStructureConnection[] {
    return this._connections;
  }

  public bundle: () => Bundle<StructureDefinition>;


  /* Connections */

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


  /* Rules */

  public putRule(rule: FMLStructureRule): void {
    const exists = this.rules.some(r => r.name === rule.name);
    if (!exists) {
      this.rules.push(rule);
    }
  }


  /**/

  public inputFields = (obj: FMLStructureObject): FMLStructureObjectField[] => {
    return this.connections
      .filter(c => c.targetObject === obj.name)
      .map(c => obj.fields[c.targetFieldIdx])
      .filter(unique);
  };

  public outputFields = (obj: FMLStructureObject): FMLStructureObjectField[] => {
    return this.connections
      .filter(c => c.sourceObject === obj.name)
      .map(c => obj.fields[c.sourceFieldIdx])
      .filter(unique);
  };


  public getSources = (target: string, field?: string): {sourceObject: string, field?: string}[] => {
    return this.connections
      .filter(c => c.targetObject === target)
      .filter(c => isNil(field) || field === this.objects[c.targetObject].fields[c.targetFieldIdx]?.name)
      .map(c => ({
        sourceObject: c.sourceObject,
        field: this.objects[c.sourceObject]?.fields[c.sourceFieldIdx]?.name
      }));
  };

  public getTargets = (source: string, field?: string): {targetObject: string, field?: string}[] => {
    return this.connections
      .filter(c => c.sourceObject === source)
      .filter(c => isNil(field) || field === this.objects[c.sourceObject].fields[c.sourceFieldIdx]?.name)
      .map(c => ({
        targetObject: c.targetObject,
        field: this.objects[c.targetObject]?.fields[c.targetFieldIdx]?.name
      }));
  };


  /* Builders */

  public newFMLObject(resourceType: string, path: string, mode: FMLStructureEntityMode): FMLStructureObject {
    if (isNil(resourceType)) {
      throw Error(`Resource name is missing for the "${path}"`);
    }

    // true => assume resource's definition is described within the structure definition
    const inlineDefinition = path.includes(".") && path === resourceType;

    // try to find resource's structure definition
    const structureDefinition = this.findStructureDefinition(resourceType);
    if (isNil(structureDefinition)) {
      throw Error(`StructureDefinition for the type "${resourceType}" not found!`);
    } else if (isNil(structureDefinition.snapshot)) {
      throw Error(`Snapshot is missing in the StructureDefinition "${resourceType}"!`);
    }

    let elements = structureDefinition.snapshot.element;
    if (inlineDefinition) {
      elements = elements.filter(el => el.path.startsWith(path));
    }

    const selfDefinition = elements[0];
    const selfResourceType = selfDefinition.type?.[0].code ?? selfDefinition.id;
    const selfFields = elements.slice(1);

    // double check whether inline definition assumption was correct
    if (inlineDefinition && !FMLStructureGroup.isBackboneElement(selfResourceType)) {
      // self definition's element MUST be the BackboneElement, but if you got here, it is not!
      return this.newFMLObject(selfResourceType, path, mode);
    }

    if (selfDefinition.type?.length > 1) {
      console.warn(`Self definition "${selfDefinition.id}" has multiple types, using first`);
    }

    const backboneElementPaths = selfFields
      .filter(f => f.type?.some(t => FMLStructureGroup.isBackboneElement(t.code)))
      .map(f => f.path);

    const o = new FMLStructureObject();
    o.element = selfDefinition;
    o.resource = selfResourceType;
    o.url = structureDefinition.url;
    o.name = path;
    o.mode = mode;
    o.rawFields = selfFields.map(e => ({
      name: e.path.substring(selfDefinition.id.length + 1).split("[x]")[0],
      // fixme: the contentReference logic is not very clear
      types: e.type?.map(t => t.code) ?? [e.contentReference].filter(Boolean),
      multiple: e.max !== '1',
      required: e.min === 1,
      part: backboneElementPaths.some(p => e.path.startsWith(p) && e.path !== p)
    }));

    o.rawFields.unshift({
      name: $THIS,
      types: [],
      multiple: false,
      required: true,
      part: false
    });

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

  /**
   * Tries to find the structure definition.
   * 1. Lookup using .id.
   *    If type has "." char in it, assumes it's sub-element (e.g.  Bundle.entry), so the part before "." should be used as search token
   * 2. Lookup using .type
   *
   * Valid arguments:
   * Bundle, Bundle.entry, http://fhir.org/StructureDefinition/Bundle
   * */
  public findStructureDefinition(anyType: string): StructureDefinition {
    // MyResource.whatever.element (anyType) => MyResource (base)
    const base = anyType.includes('.')
      ? anyType.slice(0, anyType.indexOf('.'))
      : anyType;

    const resources = this.bundle()
      .entry
      .map(e => e.resource);

    return resources.find(e => e.id === base)
      ?? resources.find(e => e.type === anyType);
  }

  public isFieldSelectable = (f: FMLStructureObjectField): boolean => {
    return FMLStructureGroup.isBackboneElementField(f) || this.bundle()?.entry.some(e => f.types?.includes(e.resource.type));
  };

  public static isBackboneElement(resourceType: string): boolean {
    return ['BackboneElement', 'Element'].includes(resourceType);
  }

  public static isBackboneElementField = (f: FMLStructureObjectField): boolean => {
    return f.types?.some(t => FMLStructureGroup.isBackboneElement(t) || t.startsWith("#"));
  };
}


/* Structure */

export class FMLStructure {
  bundle: Bundle<StructureDefinition>;
  groups: {[groupName: string]: FMLStructureGroup} = {};
  maps: FMLStructureConceptMap[] = [];

  public setGroup(name: string, group: FMLStructureGroup): void {
    group.bundle = () => this.bundle;
    this.groups = {...this.groups, [name]: group};
  }

  /**
   * Creates the FMLStructure copy, containing objects, rules and connection that make up the chain to target.field.
   *
   * Bundle & concept maps are fully copied
   */
  public subFML(groupName: string, target: string, field: string): FMLStructure[] {
    const _fmlGroup = this.groups[groupName];
    const _rules = group(_fmlGroup.rules, r => r.name);
    const _objects = _fmlGroup.objects;

    return _fmlGroup.connections
      .filter(c => c.targetObject === target)
      .filter(c => field === _objects[c.targetObject].fields[c.targetFieldIdx]?.name)
      .map(c => {
        // for each connection create sub fml
        const fmlGroup = new FMLStructureGroup();
        const _copyResources = (obj): void => {
          if (_objects[obj]) {
            fmlGroup.objects[obj] = _objects[obj];
          } else if (_rules[obj] && !fmlGroup.rules.some(r => r.name === obj)) {
            fmlGroup.putRule(_rules[obj]);
          }
        };


        // copy direct resource & connection from the target.field
        _copyResources(c.targetObject);
        fmlGroup.putConnection(c);

        // traverse to source direction, copy every connection
        const traverse = (objName: string): void => {
          _copyResources(objName);
          return _fmlGroup.connections.filter(c => c.targetObject === objName).forEach(e => {
            fmlGroup.putConnection(e);
            traverse(e.sourceObject);
          });
        };
        traverse(c.sourceObject);


        const fml = new FMLStructure();
        fml.bundle = this.bundle; // structuredClone(this.bundle); // fixme: revert
        fml.maps = structuredClone(this.maps);
        fml.setGroup(groupName, fmlGroup);
        return fml;
      });
  }
}
