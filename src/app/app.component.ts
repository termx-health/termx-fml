import {Component, EnvironmentInjector, OnInit} from '@angular/core';
import {StructureMapService} from './fhir/structure-map.service';
import {createCustomElement} from '@angular/elements';
import {StructureDefinitionTreeComponent} from './fhir/components/structure-definition/structure-definition-tree.component';
import {FMLStructure, FMLStructureRule} from './fml/fml-structure';
import {forkJoin} from 'rxjs';
import {FMLEditor} from './fml/fml-editor';
import {DrawflowNode} from 'drawflow';
import {Bundle, StructureDefinition, StructureMap} from 'fhir/r5';
import {getCanvasFont, getTextWidth} from './fml/fml.utils';

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
  private editor: FMLEditor;
  protected nodeSelected: DrawflowNode;

  // component
  protected ruleDescriptions = RULES;


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
      return this.structureMapService.getStructureMap(name);
    }
    const _resourceBundle = (sm: StructureMap) => {
      const inputResources = sm.structure.map(s => s.url.substring(s.url.lastIndexOf('/') + 1));
      const reqs$ = inputResources.map(k => this.structureMapService.getStructureDefinition(k));
      return forkJoin(reqs$)
    }

    _structureMap().subscribe(resp => {
      _resourceBundle(resp).subscribe(definitions => {
        const fml = FMLStructure.map(resp)
        this.initObjects(definitions, fml);
        this.initEditor(fml);
      })
    })
  }

  private initObjects(definitions: StructureDefinition[], mapped: FMLStructure): void {
    definitions.forEach(def => {
      const key = def.id;
      mapped.objects[key].fields = def.differential.element.slice(1).map(e => e.path.substring(key.length + 1))
      mapped.objects[key].fields.unshift('id')
      mapped.objects[key]._fhir = def;
    })
  }


  private initEditor(fml: FMLStructure): void {
    const element = document.getElementById("drawflow");
    const viewportWidth = element.offsetWidth;

    const editor = this.editor = new FMLEditor(fml, element);
    editor.start();
    editor.on('nodeSelected', id => this.nodeSelected = editor.getNodeFromId(id))
    editor.on('nodeUnselected', () => this.nodeSelected = undefined)


    // objects
    Object.keys(fml.objects).forEach(k => {
      const obj = fml.objects[k];

      const isSource = obj.mode === 'source';
      const font = getCanvasFont()
      const maxWidth = Math.max(...obj.fields.map(f => getTextWidth(f, font)))

      editor._createObjectNode(obj, {
        x: isSource ? 80 : viewportWidth - maxWidth - 100,
        y: 40
      })
    })


    // rules
    fml.rules.forEach((rule, rIdx) => {
      const prevRule = Array.from(document.getElementsByClassName('node--rule')).at(-1);
      const prevRuleBounds = prevRule?.getBoundingClientRect();

      editor._createRuleNode(rule, {
        y: 25 + prevRuleBounds?.top + prevRuleBounds?.height,
        x: viewportWidth / 2 ,
      });
      editor._createConnection(rule.sourceObject, rule.sourceField, rule.name, 1);
      editor._createConnection(rule.name, 1, rule.targetObject, rule.targetField);
    })
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

    this.editor._createRuleNode(rule, {y: ev.y, x: ev.x, constant: data.constant})
  }


  /* Utils */

  protected encodeURIComponent = encodeURIComponent;



}
