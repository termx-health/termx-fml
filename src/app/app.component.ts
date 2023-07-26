import {Component, EnvironmentInjector, OnInit} from '@angular/core';
import {StructureMapService} from './fhir/structure-map.service';
import {createCustomElement} from '@angular/elements';
import {StructureDefinitionTreeComponent} from './fhir/components/structure-definition/structure-definition-tree.component';
import {FMLStructure, FMLStructureObject, FMLStructureObjectField, FMLStructureRule} from './fml/fml-structure';
import {forkJoin} from 'rxjs';
import {FMLEditor} from './fml/fml-editor';
import {DrawflowNode} from 'drawflow';
import {Bundle, StructureDefinition, StructureMap} from 'fhir/r5';
import {autoLayout, setExpand} from './fml/fml.utils';
import {group, isDefined, isNil} from '@kodality-web/core-util';

interface RuleDescription {
  code: string,
  name: string,
  description?: string
}

const RULES: RuleDescription[] = [
  {
    code: 'create',
    name: 'Create',
    description: 'Use the standard API to create a new instance of data. Where structure definitions have been provided, the type parameter must be a string which is a known type of a root element. Where they haven\'t, the application must know the name somehow'
  },
  {
    code: 'copy',
    name: 'Copy',
    description: 'Simply copy the source to the target as is (only allowed when the types in source and target match- typically for primitive types). In the concrete syntax, this is simply represented as the source variable, e.g. src.a = tgt.b'
  },
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
  protected structureMap: StructureMap;
  protected resourceBundle: Bundle<StructureDefinition>;


  // FML editor
  private fml: FMLStructure;
  private editor: FMLEditor;
  protected nodeSelected: DrawflowNode;

  // component
  protected ruleDescriptions = RULES;
  protected isExpanded = true;


  constructor(
    private structureMapService: StructureMapService,
    injector: EnvironmentInjector
  ) {
    if (!customElements.get('ce-structure-definition')) {
      customElements.define('ce-structure-definition', createCustomElement(StructureDefinitionTreeComponent, {injector}));
    }
  }


  public ngOnInit(): void {
    const _structureMap = () => {
      // const name = "structuremap-supplyrequest-transform";
      const name = "tobacco-use-transform";
      const url = `assets/StructureMap/${name}.json` //`https://www.hl7.org/fhir/${name}.json`;
      return this.structureMapService.getStructureMap(url);
    }
    const _resourceBundle = (sm: StructureMap) => {
      const resources = [
        'CodeableReference',
        'CodeableConcept',
        'Reference',
        'Coding',
        'Annotation',
      ]

      const inputResources = sm.structure.map(s => s.url.substring(s.url.lastIndexOf('/') + 1));
      const reqs$ = inputResources.map(k => this.structureMapService.getStructureDefinition(k));
      resources.forEach(r => reqs$.push(this.structureMapService.getStructureDefinition(r)))
      return forkJoin(reqs$)
    }

    _structureMap().subscribe(resp => {
      this.structureMap = resp;
      _resourceBundle(resp).subscribe(definitions => {
        this.resourceBundle = {
          resourceType: 'Bundle',
          type: 'collection',
          entry: definitions.map(def => ({resource: def}))
        }

        const fml = this.fml = FMLStructure.map(resp)
        this.prepareFML(fml);
        this.initEditor(fml);

      })
    })
  }


  private prepareFML(fml: FMLStructure): void {
    Object.keys(fml.objects).forEach(key => {
      try {
        const {resource, path, mode} = fml.objects[key]
        fml.objects[key] = this.initFMLStructureObject(resource, path, mode)
      } catch (e) {
        console.error(e)
      }
    })
  }


  /* FML */

  private getStructureDefinition(anyPath: string): StructureDefinition {
    const base = anyPath.includes('.')
      ? anyPath.slice(0, anyPath.indexOf('.'))
      : anyPath;

    return this.resourceBundle.entry
      .map(e => e.resource)
      .find(e => e.id === base)
  }

  /**
   * Parent definition elements example:
   *
   * id
   * type
   * type.code
   * type.status
   *
   * $path - element field name ('type', 'type.code' etc.)
   */
  private initFMLStructureObject(resource: string, path: string, mode: string): FMLStructureObject {
    const structureDefinition = this.getStructureDefinition(resource)
    if (isNil(structureDefinition)) {
      throw Error(`StructureDefinition for the "${resource}" not found!`)
    }

    let elements = structureDefinition.snapshot.element;
    if (path === resource) {
      // inline definition
      elements = elements.filter(el => el.path.startsWith(path));
    }

    const selfDefinition = elements[0];
    const selfFields = elements.slice(1);

    const o = new FMLStructureObject()
    o._fhirDefinition = selfDefinition;
    o.resource = resource;
    o.path = path
    o.mode = mode;
    o.fields = selfFields.map(e => ({
      name: e.path.substring(selfDefinition.id.length + 1),
      types: e.type?.map(t => t.code)
    }))

    // fixme: wtf? could be done different?
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
    autoLayout(editor, fml)
  }


  /* Structure tree */

  public onStructureItemSelect(parentObj: FMLStructureObject, field: string): void {
    const path = `${parentObj.resource}.${field}`;
    const obj = this.fml.objects[path] = this.initFMLStructureObject(path, path, parentObj.mode);

    if (isNil(obj._fhirDefinition)) {
      console.warn(`FHIR Element Definition is missing, ${obj.resource}`)
      // wtf? id field?
      return;
    }

    this.editor._createObjectNode(obj, {outputs: 1});
    this.editor._createConnection(obj.path, 1, parentObj.path, field);
  }


  /* Drag & drop */

  public onDragStart(ev: DragEvent, ruleDescription: RuleDescription): void {
    ev.dataTransfer.setData("application/json", JSON.stringify(ruleDescription))
  }

  public onDragOver(ev: DragEvent): void {
    ev.preventDefault();
  }

  public onDrop(ev: DragEvent): void {
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

  protected isComplexResource = (f: FMLStructureObjectField): boolean => {
    return f.types?.some(t => this._isComplexResource(t))
  }

  private _isComplexResource(type: string): boolean {
    return isDefined(type) && type.charAt(0).toUpperCase() === type.charAt(0);
  }

  protected isResourceSelectable = (f: FMLStructureObjectField) => {
    return f.types?.some(t => ['BackboneElement', 'Element'].includes(t)) ||
      this.resourceBundle.entry.some(e => f.types?.includes(e.resource.type));
  }

  protected get simpleFML(): FMLStructure {
    return {
      objects: group(Object.values(this.fml?.objects || {}), o => o.path, o => ({
        resource: o.resource,
        path: o.path,
        fields: o.fields,
        mode: o.mode
      }) as FMLStructureObject),
      rules: []
    }
  }
}
