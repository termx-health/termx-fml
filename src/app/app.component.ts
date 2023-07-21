import {Component, EnvironmentInjector, OnInit} from '@angular/core';
import {StructureMapService} from './fhir/structure-map.service';
import {createCustomElement} from '@angular/elements';
import {StructureDefinitionTreeComponent} from './fhir/components/structure-definition/structure-definition-tree.component';
import {FMLStructure, FMLStructureRule} from './fml/fml-structure';
import {forkJoin, map} from 'rxjs';
import {FMLEditor} from './fml/fml-editor';
import {DrawflowNode} from 'drawflow';
import {StructureDefinition} from 'fhir/r5';


@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
})
export class AppComponent implements OnInit {
  private editor: FMLEditor;
  protected nodeSelected: DrawflowNode;

  constructor(
    private structureMapService: StructureMapService,
    injector: EnvironmentInjector
  ) {
    if (!customElements.get('ce-structure-definition')) {
      customElements.define('ce-structure-definition', createCustomElement(StructureDefinitionTreeComponent, {injector}));
    }
  }

  public ngOnInit(): void {
    const name = "structuremap-supplyrequest-transform";
    this.structureMapService.getStructureMap(name).subscribe(resp => {
      const fml = FMLStructure.map(resp)
      const reqs$ = Object.keys(fml.objects).map(k => this.structureMapService.getStructureDefinition(k).pipe(map(r => [k, r])));

      forkJoin(reqs$).subscribe((resps: [string, StructureDefinition][]) => {
        this.initObjects(resps, fml);
        this.initEditor(fml);
      })
    })
  }

  private initEditor(fml: FMLStructure): void {
    const element = document.getElementById("drawflow");
    const viewportWidth = element.offsetWidth;
    const editor = this.editor = new FMLEditor(fml, element);
    editor.start();

    editor.on('nodeSelected', id => {
      this.nodeSelected = editor.getNodeFromId(id)
    })


    Object.keys(fml.objects).forEach(k => {
      const obj = fml.objects[k];
      editor._createObjectNode(obj, {
        viewportWidth
      })
    })


    fml.rules.forEach((rule, rIdx) => {
      const prevRule = Array.from(document.getElementsByClassName('node--rule')).at(-1);
      const prevRuleBounds = prevRule?.getBoundingClientRect();

      editor._createRuleNode(rule, {
        y: 25 + prevRuleBounds?.top + prevRuleBounds?.height,
        x: viewportWidth / 2 - 100,
      });
      editor._createConnection(rule.sourceObject, rule.sourceField, rule.name, 1);
      editor._createConnection(rule.name, 1, rule.targetObject, rule.targetField);
    })
  }


  private initObjects(resps: [string, StructureDefinition][], mapped: FMLStructure): void {
    resps.forEach(([key, resp]) => {
      mapped.objects[key].fields = resp.differential.element.slice(1).map(e => e.path.substring(key.length + 1))
      mapped.objects[key].fields.unshift('id')
      mapped.objects[key]._fhir = resp;
    })
  }


  /* Drag & drop */

  public onDragOver(ev: DragEvent): void {
    ev.preventDefault();

  }

  public onDrop(ev: DragEvent): void {
    console.log(ev)
    const rule = new FMLStructureRule();
    rule.name = 'copy';

    this.editor._createRuleNode(rule, {x: ev.x, y: ev.y})
  }


  /* Utils */

  protected encodeURIComponent = encodeURIComponent;
}
