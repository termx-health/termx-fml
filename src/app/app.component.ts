import {Component, EnvironmentInjector, inject, OnInit} from '@angular/core';
import {StructureMapService} from './fhir/structure-map.service';
import Drawflow from 'drawflow'
import {FHIRStructureDefinition} from './fhir/models/fhir';
import {createCustomElement} from '@angular/elements';
import {StructureDefinitionTreeComponent} from './fhir/components/structure-definition/structure-definition-tree.component';
import {FMLStructure} from './fml-structure';
import {forkJoin, map} from 'rxjs';


@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
})
export class AppComponent implements OnInit {
  private structureMapService = inject(StructureMapService);

  protected structureMap: object;

  constructor(
    injector: EnvironmentInjector
  ) {
    if (!customElements.get('ce-structure-definition')) {
      customElements.define('ce-structure-definition', createCustomElement(StructureDefinitionTreeComponent, {injector}));
    }
  }

  public ngOnInit(): void {
    const id = document.getElementById("drawflow");
    const editor = new Drawflow(id);
    editor.start();


    const name = "structuremap-supplyrequest-transform";
    this.structureMapService.getStructureMap(name).subscribe(resp => {
      this.structureMap = resp;
      const mapped = FMLStructure.map(resp)

      forkJoin(
        Object.keys(mapped.objects).map(k => this.structureMapService.getStructureDefinition(k).pipe(map(r => [k, r])))
      ).subscribe((resps: [string, FHIRStructureDefinition][]) => {
        resps.forEach(([key, resp]) => {
          mapped.objects[key].fields = resp.differential.element.slice(1).map(e => e.path.substring(key.length + 1))
          mapped.objects[key].fields.unshift('id')
        })


        Object.keys(mapped.objects).forEach(k => {
          const obj = mapped.objects[k];

          const resourceName = obj.resource
          const isSource = obj.mode === 'source';

          const fieldCount = obj.fields.length; // obj.fields.length;
          const inputs = isSource ? 0 : fieldCount;
          const outputs = isSource ? fieldCount : 0;


          const html = `
            <div>
               <div class="node-title">${resourceName}</div>
              ${obj.fields.map(f => `<div style="height: 1.5rem; border-bottom: 1px solid var(--color-borders)">${f}</div>`).join('')}
            </div>
          `

          const nr = editor.addNode(resourceName, inputs, outputs, isSource ? 100 : 1200, 50, 'node--with-title', {}, html, false);
        })


        mapped.rules.forEach((rule, rIdx) => {
          const nr = editor.addNode(rule.name, 1, 1, 650, 100 + 110 * rIdx, '', {}, rule.name, false)


          try {
            editor.addConnection(
              editor.getNodesFromName(rule.sourceObject)[0], nr,
              `output_${mapped.objects[rule.sourceObject].getFieldIndex(rule.sourceField) + 1}`,
              `input_1`,
            );

            editor.addConnection(
              nr, editor.getNodesFromName(rule.targetObject)[0],
              'output_1',
              `input_${mapped.objects[rule.targetObject].getFieldIndex(rule.targetField) + 1}`,
            )
          } catch (e) {
            console.error(`Rule "${rule.name}" connection failed ${rule.sourceObject}.${rule.sourceField} -> ${rule.targetObject}.${rule.targetField}`)
          }
        })
      })
    })
  }
}
