import {Component, OnInit} from '@angular/core';
import {StructureMapService} from './fhir/structure-map.service';
import {FMLStructure, FMLStructureObject, FMLStructureObjectField, FMLStructureRule} from './fml/fml-structure';
import {forkJoin, tap} from 'rxjs';
import {FMLEditor} from './fml/fml-editor';
import {DrawflowNode} from 'drawflow';
import {Bundle, StructureDefinition, StructureMap} from 'fhir/r5';
import {setExpand} from './fml/fml.utils';
import {group, isDefined, isNil} from '@kodality-web/core-util';
import {FMLStructureMapper} from './fml/fml-structure-mapper';

interface RuleDescription {
  code: string,
  name: string,
  description?: string
}

const RULES: RuleDescription[] = [
  {
    code: 'uuid',
    name: 'uuid',
    description: 'Generate a random UUID (in lowercase). No Parameters'
  }
]

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
})
export class AppComponent implements OnInit {
  // todo: @Input()
  public structureMap: StructureMap;
  private _structureMap = () => {
    // const name = "structuremap-supplyrequest-transform";
    const name = "tobacco-use-transform";

    const url = `assets/StructureMap/${name}.json`;
    return this.structureMapService.getStructureMap(url).pipe(tap(resp => {
      this.structureMap = resp;
    }));
  }

  // todo: @Input()
  public resourceBundle: Bundle<StructureDefinition>;
  private _resourceBundle = (sm: StructureMap) => {
    const resources = [
      'CodeableReference',
      'CodeableConcept',
      'Reference',
      'Coding',
      'Annotation',
      'Identifier',
    ]

    const inputResources = sm.structure.map(s => s.url.substring(s.url.lastIndexOf('/') + 1));
    const reqs$ = inputResources.map(k => this.structureMapService.getStructureDefinition(k));
    resources.forEach(r => reqs$.push(this.structureMapService.getStructureDefinition(r)))
    return forkJoin(reqs$).pipe(tap(definitions => {
      this.resourceBundle = {
        resourceType: 'Bundle',
        type: 'collection',
        entry: definitions.map(def => ({resource: def}))
      }
    }))
  }

  // FML editor
  private fml: FMLStructure;
  private editor: FMLEditor;
  protected nodeSelected: DrawflowNode;

  // component
  protected ruleDescriptions = RULES;
  protected isExpanded = true;


  constructor(
    private structureMapService: StructureMapService
  ) { }


  public ngOnInit(): void {
    this._structureMap().subscribe(resp => {
      this._resourceBundle(resp).subscribe(() => {
        const fml = this.fml = FMLStructureMapper.map(resp)
        this.prepareFML(fml);
        this.initEditor(fml);
      })
    })
  }

  protected export(): void {
    const exp = this.editor.export();
    Object.values(exp.drawflow.Home.data).forEach(el => {
      const {x, y} = (el.data.obj ?? el.data.rule).position
      el.pos_x = x;
      el.pos_y = y;
    })

    console.log(exp)
  }


  /* FML */

  /**
   * Decorates FMLStructure objects with fields from the Bundle StructureDefinition.
   */
  private prepareFML(fml: FMLStructure): void {
    Object.keys(fml.objects).forEach(key => {
      try {
        const {resource, name, mode} = fml.objects[key]
        fml.objects[key] = this.initFMLStructureObject(resource, name, mode)
      } catch (e) {
        console.error(e)
      }
    })
  }

  private initFMLStructureObject(resource: string, path: string, mode: string): FMLStructureObject {
    // true => assume resource's definition is in the structure definition
    const inlineDefinition = mode === 'object' && path === resource;

    // try to find resource's structure definition
    const structureDefinition = this.getStructureDefinition(resource)
    if (isNil(structureDefinition)) {
      throw Error(`StructureDefinition for the "${resource}" not found!`)
    }

    let elements = structureDefinition.snapshot.element;
    if (inlineDefinition) {
      elements = elements.filter(el => el.path.startsWith(path));
    }

    const selfDefinition = elements[0];
    const selfResourceType = selfDefinition.type?.[0].code ?? selfDefinition.id; // todo: provide type as argument?
    const selfFields = elements.slice(1);

    // double check whether inline definition assumption was correct
    if (inlineDefinition && !this.isBackboneElement(selfResourceType)) {
      // self definition's element MUST be the BackboneElement, but if you got here, it is not!
      return this.initFMLStructureObject(selfResourceType, path, mode)
    }

    if (selfDefinition.type?.length > 1) {
      console.warn(`Self definition "${selfDefinition.id}" has multiple types, using first`)
    }

    const o = new FMLStructureObject()
    o._fhirDefinition = selfDefinition;
    o.resource = selfResourceType;
    o.name = path
    o.mode = mode;
    o.fields = selfFields.map(e => ({
      name: e.path.substring(selfDefinition.id.length + 1),
      types: e.type?.map(t => t.code)
    }))

    // fixme: wtf? could be done differently?
    o.fields.filter(f => f.name.endsWith("[x]")).forEach(f => f.name = f.name.split("[x]")[0])

    return o;
  }

  /* Editor */

  private initEditor(fml: FMLStructure): void {
    const element = document.getElementById("drawflow");

    const editor = this.editor = new FMLEditor(fml, element);
    editor.start();
    editor.on('nodeSelected', id => this.nodeSelected = editor.getNodeFromId(id))
    editor.on('nodeUnselected', () => this.nodeSelected = undefined)
    editor.on('nodeMoved', () => {
      const selectedNodeId = this.nodeSelected?.id;
      if (selectedNodeId) {
        this.nodeSelected = editor.getNodeFromId(selectedNodeId)
      }
    });

    // render objects
    Object.keys(fml.objects).forEach(k => {
      const obj = fml.objects[k];
      const isCustomObj = !this.structureMap.structure.some(s => s.url.endsWith(obj.resource));

      editor._createObjectNode(obj, {
        x: obj.position?.x,
        y: obj.position?.y,
        outputs: isCustomObj ? 1 : undefined
      })
    })


    // render rules
    fml.rules.forEach(rule => {
      editor._createRuleNode(rule, {
        x: rule.position?.x,
        y: rule.position?.y,
      });

      editor._createConnection(rule.sourceObject, rule.sourceField, rule.name, 1);
      editor._createConnection(rule.name, 1, rule.targetObject, rule.targetField);
    })


    // auto layout
    editor._autoLayout()
  }


  /* Structure tree */

  protected onStructureItemSelect(parentObj: FMLStructureObject, field: string): void {
    let structureDefinition, fieldPath;
    if (this.isBackboneElement(parentObj.resource)) {
      structureDefinition = this.getStructureDefinition(parentObj.name)
      fieldPath = `${parentObj.name}.${field}`;
    } else {
      structureDefinition = this.getStructureDefinition(parentObj.resource)
      fieldPath = `${parentObj.resource}.${field}`;
    }

    const fieldElement = structureDefinition.snapshot.element.find(e => [fieldPath, `${fieldPath}[x]`].includes(e.path))

    let resourceType = fieldElement.type?.[0]?.code;
    if (this.isBackboneElement(resourceType)) {
      resourceType = fieldPath;
    }

    const obj = this.fml.objects[fieldPath] = this.initFMLStructureObject(resourceType, fieldPath, 'object');
    if (isNil(obj._fhirDefinition)) {
      console.warn(`FHIR Element Definition is missing, ${obj.resource}`)
      // wtf? id field?
      return;
    }

    this.editor._createObjectNode(obj, {outputs: 1});
    this.editor._createConnection(obj.name, 1, parentObj.name, field);
  }


  /* Drag & drop */

  protected onDragStart(ev: DragEvent, ruleDescription: RuleDescription): void {
    ev.dataTransfer.setData("application/json", JSON.stringify(ruleDescription))
  }

  protected onDragOver(ev: DragEvent): void {
    ev.preventDefault();
  }

  protected onDrop(ev: DragEvent): void {
    const data = JSON.parse(ev.dataTransfer.getData('application/json')) as RuleDescription;
    const rule = new FMLStructureRule();
    rule.name = data.code;
    rule.action = data.code;

    this.fml.rules.push(rule)
    this.editor._createRuleNode(rule, {y: ev.y, x: ev.x})
  }


  /* Expand */

  protected setExpand(isExpanded: boolean): void {
    this.isExpanded = isExpanded;

    Object.keys(this.fml.objects).forEach(k => {
      setExpand(this.editor, k, isExpanded)
    })
  }


  /* Utils */

  private isBackboneElement(resource: string): boolean {
    return ['BackboneElement', 'Element'].includes(resource);
  }

  private getStructureDefinition(anyPath: string): StructureDefinition {
    // Resource.whatever.next (anyPath) => Resource (base)
    const base = anyPath.includes('.')
      ? anyPath.slice(0, anyPath.indexOf('.'))
      : anyPath;

    return this.resourceBundle.entry
      .map(e => e.resource)
      .find(e => e.id === base)
  }

  protected isComplexResource = (f: FMLStructureObjectField): boolean => {
    return f.types?.some(t => this._isComplexResource(t))
  }

  private _isComplexResource(type: string): boolean {
    return isDefined(type) && type.charAt(0).toUpperCase() === type.charAt(0);
  }

  protected isResourceSelectable = (f: FMLStructureObjectField) => {
    return f.types?.some(t => this.isBackboneElement(t)) || this.resourceBundle.entry.some(e => f.types?.includes(e.resource.type));
  }

  protected get simpleFML(): FMLStructure {
    return {
      objects: group(Object.values(this.fml?.objects || {}), o => o.name, o => ({
        ...o,
        html: undefined
      }) as FMLStructureObject),
      rules: this.fml?.rules.map(r => ({
        ...r
      }))
    }
  }
}
