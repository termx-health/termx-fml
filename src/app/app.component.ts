import {Component, EnvironmentInjector, OnInit} from '@angular/core';
import {StructureMapService} from './fhir/structure-map.service';
import {FHIRStructureDefinition} from './fhir/models/fhir';
import {createCustomElement} from '@angular/elements';
import {StructureDefinitionTreeComponent} from './fhir/components/structure-definition/structure-definition-tree.component';
import {FMLStructure} from './fml/fml-structure';
import {forkJoin, map} from 'rxjs';
import {FMLEditor} from './fml/fml-editor';
import {DrawflowNode} from 'drawflow';


@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
})
export class AppComponent implements OnInit {
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

      forkJoin(reqs$).subscribe((resps: [string, FHIRStructureDefinition][]) => {
        this.initObjects(resps, fml);
        this.initEditor(fml);
      })
    })

  }

  private initEditor(fml: FMLStructure): void {
    const element = document.getElementById("drawflow");
    const viewportWidth = element.offsetWidth;
    const editor = new FMLEditor(fml, element);
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
        viewportWidth,
        top: prevRuleBounds?.top + prevRuleBounds?.height
      });
      editor._createConnection(rule.sourceObject, rule.sourceField, rule.name, 1);
      editor._createConnection(rule.name, 1, rule.targetObject, rule.targetField);
    })
  }


  private initObjects(resps: [string, FHIRStructureDefinition][], mapped: FMLStructure): void {
    resps.forEach(([key, resp]) => {
      mapped.objects[key].fields = resp.differential.element.slice(1).map(e => e.path.substring(key.length + 1))
      mapped.objects[key].fields.unshift('id')
      mapped.objects[key]._fhir = resp;
    })
  }


  protected encodeURIComponent = encodeURIComponent;
}
