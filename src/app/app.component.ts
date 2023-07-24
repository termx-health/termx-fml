import {Component, EnvironmentInjector, OnInit} from '@angular/core';
import {StructureMapService} from './fhir/structure-map.service';
import {createCustomElement} from '@angular/elements';
import {StructureDefinitionTreeComponent} from './fhir/components/structure-definition/structure-definition-tree.component';
import {FMLStructure, FMLStructureObject, FMLStructureObjectField, FMLStructureRule} from './fml/fml-structure';
import {forkJoin} from 'rxjs';
import {FMLEditor} from './fml/fml-editor';
import {DrawflowNode} from 'drawflow';
import {Bundle, StructureDefinition, StructureMap} from 'fhir/r5';
import {getCanvasFont, getTextWidth} from './fml/fml.utils';
import {isDefined, isNil} from '@kodality-web/core-util';

interface RuleDescription {
  code: string,
  name: string,
  description?: string,
  constant?: boolean
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
    description: 'Generate a random UUID (in lowercase). No Parameters',
    constant: true
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
      const name = "structuremap-supplyrequest-transform";
      const url = `assets/StructureMap/${name}.json` //`https://www.hl7.org/fhir/${name}.json`;
      return this.structureMapService.getStructureMap(url);
    }
    const _resourceBundle = (sm: StructureMap) => {
      const resources = [
        'CodeableReference',
        'CodeableConcept',
        'Reference',
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
        this.prepareObjects(fml);
        this.initEditor(fml);
        console.log(fml)
      })
    })
  }


  private prepareObjects(fml: FMLStructure): void {
    Object.keys(fml.objects).forEach(key => {
      fml.objects[key] = this.getFMLStructureObject(
        this.getStructureDefinition(key),
        key, // aka. path
        fml.objects[key].mode
      )
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
  private getFMLStructureObject(parentDef: StructureDefinition, path: string, mode: string): FMLStructureObject {
    // find matching element
    const pathElement = parentDef.snapshot.element.find(el => el.path === path);
    const pathElementType = pathElement.type?.[0].code; // fixme: the first type is used!

    let structureDefinition = parentDef;
    let elements = parentDef.snapshot.element.filter(el => el.path.startsWith(path));

    if (this._isComplexResource(pathElementType) && !['BackboneElement', 'Element'].includes(pathElementType)) {
      // external definition (provided in Bundle)
      structureDefinition = this.getStructureDefinition(pathElementType);
      if (isNil(structureDefinition)) {
        throw Error(`ElementDefinition for "${path}" not found`);
      }
      elements = structureDefinition.snapshot.element;
    }


    const pathElementDefinition = elements[0];
    const pathElementFields = elements;

    const o = new FMLStructureObject()
    o.resource = pathElementDefinition.id;
    o.name = path
    o.mode = mode;
    o.fields = pathElementFields.slice(1).map(e => ({
      name: e.path.substring(pathElementDefinition.id.length + 1),
      types: e.type?.map(t => t.code)
    }))

    o._fhirDefinition = pathElementDefinition;
    return o;
  }


  /* Editor */

  private initEditor(fml: FMLStructure): void {
    const element = document.getElementById("drawflow");
    const viewportWidth = element.offsetWidth;

    const editor = this.editor = new FMLEditor(fml, element);
    editor.start();
    editor.on('nodeSelected', id => this.nodeSelected = editor.getNodeFromId(id))
    editor.on('nodeUnselected', () => this.nodeSelected = undefined)


    // render objects
    Object.keys(fml.objects).forEach(k => {
      const obj = fml.objects[k];
      const isSource = obj.mode === 'source';
      const isCustomObj = !this.structureMap.structure.some(s => s.url.endsWith(obj.resource));

      const font = getCanvasFont()
      const maxWidth = Math.max(...obj.fields.map(f => getTextWidth(f, font)))

      editor._createObjectNode(obj, {
        x: isSource ? 80 : viewportWidth - maxWidth - 100,
        y: 40,
        outputs: isCustomObj ? 1 : 0
      })
    })


    // render rules
    fml.rules.forEach(rule => {
      const prevRule = Array.from(document.getElementsByClassName('node--rule')).at(-1);
      const prevRuleBounds = prevRule?.getBoundingClientRect();

      editor._createRuleNode(rule, {
        y: 25 + prevRuleBounds?.top + prevRuleBounds?.height,
        x: viewportWidth / 2,
      });

      editor._createConnection(rule.sourceObject, rule.sourceField, rule.name, 1);
      editor._createConnection(rule.name, 1, rule.targetObject, rule.targetField);
    })
  }


  protected setExpand(isExpanded: boolean): void {
    this.isExpanded = isExpanded;

    Object.keys(this.fml.objects).forEach(k => {
      const node = this.editor.getNodeFromId(this.editor._getNodeId(k));
      const max = Math.max(Object.keys(node.inputs).length, Object.keys(node.outputs).length)

      const nodeEl = document.getElementById(`node-${node.id}`);
      const inputEls = nodeEl.getElementsByClassName('inputs').item(0).children
      const outputEls = nodeEl.getElementsByClassName('outputs').item(0).children
      const contentEls = nodeEl.getElementsByClassName('drawflow_content_node').item(0).children

      for (let i = 0; i < max; i++) {
        inputEls.item(i)?.classList.remove('hidden')
        outputEls.item(i)?.classList.remove('hidden');
        contentEls.item(i + 1).classList.remove('hidden')


        if (
          !node.inputs[`input_${i + 1}`]?.connections?.length &&
          !node.outputs[`output_${i + 1}`]?.connections?.length &&
          !this.isExpanded
        ) {
          inputEls.item(i)?.classList.add('hidden')
          outputEls.item(i)?.classList.add('hidden');
          contentEls.item(i + 1).classList.add('hidden')
        }
      }

      this.editor.updateConnectionNodes(`node-${node.id}`)
    })
  }


  /* Structure tree */

  public onStructureItemSelect(parentObj: FMLStructureObject, field: string): void {
    const path = `${parentObj.resource}.${field}`;

    const obj = this.fml.objects[path] = this.getFMLStructureObject(
      this.getStructureDefinition(parentObj.resource),
      path,
      parentObj.mode
    );

    if (isNil(obj._fhirDefinition)) {
      console.warn(`FHIR Element Definition is missing, ${obj.resource}`)
      // wtf? id field?
      return;
    }

    this.editor._createObjectNode(obj, {outputs: 1});
    this.editor._createConnection(obj.name, 1, parentObj.name, field);
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
    this.editor._createRuleNode(rule, {y: ev.y, x: ev.x, constant: data.constant})
  }


  /* Utils */

  protected isComplexResource = (f: FMLStructureObjectField): boolean => {
    return f.types.some(t => this._isComplexResource(t))
  }

  private _isComplexResource(type: string): boolean {
    return isDefined(type) && type.charAt(0).toUpperCase() === type.charAt(0);
  }

  protected isResourceSelectable = (f: FMLStructureObjectField) => {
    return f.types.some(t => ['BackboneElement', 'Element'].includes(t)) ||
      this.resourceBundle.entry.some(e => f.types.includes(e.resource.type));
  }

  protected get simpleFML(): FMLStructure {
    return structuredClone(this.fml)
  }
}
