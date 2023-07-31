import {Component, EnvironmentInjector, OnInit} from '@angular/core';
import {StructureMapService} from './fhir/structure-map.service';
import {FMLStructure, FMLStructureObject, FMLStructureObjectField, FMLStructureRule} from './fml/fml-structure';
import {forkJoin, mergeMap, tap} from 'rxjs';
import {FMLEditor} from './fml/fml-editor';
import {DrawflowNode} from 'drawflow';
import {Bundle, StructureDefinition, StructureMap} from 'fhir/r5';
import {setExpand} from './fml/fml.utils';
import {group, isDefined, isNil} from '@kodality-web/core-util';
import {FMLStructureMapper} from './fml/fml-structure-mapper';
import {createCustomElement} from '@angular/elements';
import {MuiIconComponent} from '@kodality-web/marina-ui';
import {HttpClient} from '@angular/common/http';

let ID = 69;

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
  },
  {
    code: 'append',
    name: 'append',
    description: 'Element or string - just append them all together'
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
    const name = "step3";
    // const name = "step5";
    // const name = "structuremap-supplyrequest-transform";
    // const name = "tobacco-use-transform";

    const url = `assets/StructureMap/${name}.json`;
    return this.structureMapService.getStructureMap(url).pipe(tap(resp => {
      this.structureMap = resp;
    }));
  }

  // todo: @Input()
  public resourceBundle: Bundle<StructureDefinition>;
  private _resourceBundle = (sm: StructureMap) => {
    return this.http.get<string[]>("assets/StructureDefinition/index.json").pipe(mergeMap(resources => {
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
    }))

  }

  // FML editor
  private fml: FMLStructure;
  private editor: FMLEditor;
  protected nodeSelected: DrawflowNode;

  // component
  protected ruleDescriptions = RULES;
  protected isExpanded = true;
  protected isAnimated = true;


  constructor(
    private http: HttpClient,
    private structureMapService: StructureMapService,
    injector: EnvironmentInjector
  ) {
    if (!customElements.get('ce-icon')) {
      customElements.define('ce-icon', createCustomElement(MuiIconComponent, {injector}));
    }
  }


  public ngOnInit(): void {
    this._structureMap().subscribe(resp => {
      this._resourceBundle(resp).subscribe((a) => {
        console.log(a)
        const fml = this.fml = FMLStructureMapper.map(resp)
        console.log(fml)
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

    console.log(FMLStructureMapper.compose(this.fml))
  }


  /* FML */

  /**
   * Decorates FMLStructure objects with fields from the Bundle StructureDefinition.
   */
  private prepareFML(fml: FMLStructure): void {
    const sm = group(this.structureMap.structure,
      s => s.alias ?? s.url.slice(s.url.lastIndexOf("/") + 1),
      s => this.resourceBundle.entry.find(c => s.url === c.resource.url)?.resource
    );

    Object.values(fml.objects).forEach(({resource, name, mode}) => {
      try {
        fml.objects[name] = this.initFMLStructureObject(sm[resource]?.id ?? resource, name, mode)
      } catch (e) {
        console.error(e)
      }
    })
  }

  private initFMLStructureObject(resource: string, path: string, mode: string): FMLStructureObject {
    if (isNil(resource)) {
      throw Error(`Resource name is missing for the "${path}"`);
    }

    // true => assume resource's definition is described in the structure definition
    const inlineDefinition = mode === 'object' && path === resource;

    // try to find resource's structure definition
    const structureDefinition = this.getStructureDefinition(resource)
    if (isNil(structureDefinition)) {
      throw Error(`StructureDefinition for the "${resource}" not found!`)
    }
    if (!('snapshot' in structureDefinition)) {
      throw Error(`StructureDefinition "${resource}" does not have the snapshot!`)
    }

    let elements = structureDefinition.snapshot.element;
    if (inlineDefinition) {
      elements = elements.filter(el => el.path.startsWith(path));
    }

    const selfDefinition = elements[0];
    const selfResourceType = selfDefinition.type?.[0].code ?? selfDefinition.id; // todo: provide type as an argument?
    const selfFields = elements.slice(1);

    // double check whether inline definition assumption was correct
    if (inlineDefinition && !this.isBackboneElement(selfResourceType)) {
      // self definition's element MUST be the BackboneElement, but if you got here, it is not!
      return this.initFMLStructureObject(selfResourceType, path, mode)
    }

    if (selfDefinition.type?.length > 1) {
      // fixme: as for now, warn about multiple types
      console.warn(`Self definition "${selfDefinition.id}" has multiple types, using first`)
    }

    const o = new FMLStructureObject()
    o.element = selfDefinition;
    o.resource = selfResourceType;
    o.name = path
    o.mode = mode;
    o.fields = selfFields.map(e => ({
      name: e.path.substring(selfDefinition.id.length + 1).split("[x]")[0],  // fixme: wtf [x] part? could be done differently?
      types: e.type?.map(t => t.code),
      multiple: e.max !== '1'
    }))

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

    // fixme (objects & rules): currently x, y are undefined! they should be stored in StrcutureMap somewhere and restored on load

    // render objects
    Object.values(fml.objects).forEach(obj => {
      editor._createObjectNode(obj, {
        x: obj.position?.x,
        y: obj.position?.y,
        outputs: obj.mode === 'object' ? 1 : undefined
      })
    })

    // render rules
    fml.rules.forEach(rule => {
      editor._createRuleNode(rule, {
        x: rule.position?.x,
        y: rule.position?.y,
      });

      // fixme: some rule can have multiple inputs, what to do then?
      editor._createConnection(rule.sourceObject, rule.sourceField, rule.name, 1);
      editor._createConnection(rule.name, 1, rule.targetObject, rule.targetField);
    })

    // auto layout
    editor._autoLayout()

    // rerender nodes
    editor._rerenderNodes();
  }


  /* Structure tree */

  protected onStructureItemSelect(parentObj: FMLStructureObject, field: string): void {
    const structureDefinition = this.getStructureDefinition(parentObj.element.id)

    const fieldPath = `${parentObj.element.path}.${field}`;
    const fieldElement = structureDefinition.snapshot.element.find(e => [fieldPath, `${fieldPath}[x]`].includes(e.path))

    // fixme: ACHTUNG! the first type is selected!
    let fieldType = fieldElement.type?.[0]?.code;
    if (this.isBackboneElement(fieldType)) {
      fieldType = fieldPath;
    }

    const obj = this.initFMLStructureObject(fieldType, fieldPath, 'object');
    obj.name = `${fieldPath}#${ID++}`;
    this.fml.objects[obj.name] = obj;

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
    rule.name = data.code + new Date().getTime();
    rule.action = data.code;
    rule.parameters = [];
    this.fml.rules.push(rule)

    const {top, left} = this.editor._getOffsets()
    this.editor._createRuleNode(rule, {
      y: ev.y - top,
      x: ev.x - left
    })
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
    // Resource.whatever.element (anyPath) => Resource (base)
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
    // fixme: if starts with capital letter, then complex resource?
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
