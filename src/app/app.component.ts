import {Component, EnvironmentInjector, inject, OnInit} from '@angular/core';
import {StructureMapService} from './fhir/structure-map.service';
import Drawflow from 'drawflow'
import {FHIRStructureDefinition} from './fhir/models/fhir';
import {createCustomElement} from '@angular/elements';
import {StructureDefinitionTreeComponent} from './fhir/components/structure-definition/structure-definition-tree.component';
import {FMLStructure, FMLStructureObject} from './fml-structure';
import {forkJoin, map} from 'rxjs';


@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
})
export class AppComponent implements OnInit {
  private structureMapService = inject(StructureMapService);


  constructor(
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
    const viewPortWidth = window.innerWidth;
    const id = document.getElementById("drawflow");

    const editor = new Drawflow(id);
    editor.start();

    const getNodeId = (name) => editor.getNodesFromName(name)[0]
    const createConnection = (source: string, sField: string | number, target: string, tField: string | number) => {
      const oIdx = typeof sField === 'string' ? fml.objects[source].getFieldIndex(sField) + 1 : sField
      const iIdx = typeof tField === 'string' ? fml.objects[target].getFieldIndex(tField) + 1 : tField

      try {
        editor.addConnection(
          getNodeId(source), getNodeId(target),
          `output_${oIdx}`,
          `input_${iIdx}`,
        );
      } catch (e) {
        console.error(`Connection failed "${source}.${sField}" -> "${target}.${tField}"`)
        throw e;
      }
    }

    Object.keys(fml.objects).forEach(k => {
      const obj = fml.objects[k];

      const resourceName = obj.resource
      const isSource = obj.mode === 'source';

      const fieldCount = obj.fields.length; // obj.fields.length;
      const inputs = isSource ? 0 : fieldCount;
      const outputs = isSource ? fieldCount : 0;


      editor.addNode(
        resourceName,
        inputs, outputs,
        isSource ? 100 : viewPortWidth - 500, 50,
        'node--with-title',
        {}, this.getResourceHTML(obj),
        false
      );
    })


    fml.rules.forEach((rule, rIdx) => {
      const nodeId = editor.addNode(
        rule.name,
        1, 1,
        (viewPortWidth - 500) / 2, 100 + 110 * rIdx,
        'node--rule',
        {}, rule.name,
        false
      )


      createConnection(rule.sourceObject, rule.sourceField, rule.name, 1);
      createConnection(rule.name, 1, rule.targetObject, rule.targetField);

    })
  }

  private getResourceHTML(obj: FMLStructureObject) {
    return `
      <div>
         <div class="node-title">${obj.resource}</div>
        ${obj.fields.map(f => `<div style="height: 1.5rem; border-bottom: 1px solid var(--color-borders)">${f}</div>`).join('')}
      </div>
    `
  }

  private initObjects(resps: [string, FHIRStructureDefinition][], mapped: FMLStructure): void {
    resps.forEach(([key, resp]) => {
      mapped.objects[key].fields = resp.differential.element.slice(1).map(e => e.path.substring(key.length + 1))
      mapped.objects[key].fields.unshift('id')
    })
  }
}
