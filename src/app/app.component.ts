import {Component, EnvironmentInjector, inject, OnInit} from '@angular/core';
import {StructureMapService} from './fhir/structure-map.service';
import {collect, group} from '@kodality-web/core-util';
import Drawflow from 'drawflow'
import {FHIRStructureMap} from './fhir/models/fhir';
import {createCustomElement} from '@angular/elements';
import {StructureDefinitionTreeComponent} from './fhir/components/structure-definition/structure-definition-tree.component';

export class StructureRule {
  name: string;
  sources: {
    name: string;
    element?: string;
    variable?: string;
  }[];
  target: {
    name: string;
    element?: string;
    variable?: string;
    action?: string;
    parameters?: any[];
  }[];
}

export class StructureRuleGroup {
  name: string;
  inputs: { [type in ('source' | 'target')]: {[varName: string]: string} }
  rules: StructureRule[]

  public get sources(): {[varName: string]: string} {
    return this.inputs.source
  }

  public get targets(): {[varName: string]: string} {
    return this.inputs.target
  }
}

export class Structure {
  objects: {
    [name: string]: {
      resource: string,
      fields: string[],
      mode: 'source' | 'target'
    }
  } = {};


  rules:{
    name:string,
    action: string,
    sourceObject: string,
    sourceField: string,
    targetObject: string,
    targetField:string
  }[]


  sources: string[];
  targets: string[];

  groups: StructureRuleGroup[]

  public static map(o: FHIRStructureMap): Structure {
    console.log(o)
    const struc = new Structure();

    const refs = collect(o.structure, s => s.mode, s => s.url);
    struc.sources = refs['source']
    struc.targets = refs['target']


    // groups
    struc.groups = o.group.map(g => {
      const _group = new StructureRuleGroup()
      _group.name = g.name;

      // sources & targets
      const inputs = collect(g.input, s => s.mode);
      _group.inputs = {
        source: group(inputs['source'], i => i.name, i => i.type),
        target: group(inputs['target'], i => i.name, i => i.type)
      };

      // rules
      _group.rules = g.rule.map(r => {
        const _rule = new StructureRule()
        _rule.name = r.name;
        _rule.sources = r.source.map(rs => ({
          name: rs.context,
          element: rs.element,
          variable: rs.variable
        }))
        _rule.target = r.target.map(rt => ({
          name: rt.context,
          element: rt.element,
          variable: rt.variable,
          action: rt.transform,
          parameter: rt.parameter?.map(p =>
            p.valueId ??
            p.valueString ??
            p.valueBoolean ??
            p.valueInteger ??
            p.valueDecimal ??
            p.valueDate ??
            p.valueTime ??
            p.valueDateTime
          )
        }));

        return _rule
      })
      return _group;
    })


    console.log(struc);
    return struc
  }
}

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


    const url = "https://www.hl7.org/fhir/structuremap-supplyrequest-transform.json";
    this.structureMapService.getStructureMap(url).subscribe(resp => {
      this.structureMap = resp;
      const mapped = Structure.map(resp)

      // mapped.sources.forEach(s => {
      //   this.structureMapService.getStructureDefinition(s).subscribe(resp => {
      //     const json = JSON.stringify(resp);
      //     const html = `
      //       <div><ce-structure-definition fhir="${encodeURIComponent(json)}"></ce-structure-definition></div>
      //     `;
      //
      //     editor.addNode('github', 0, 1, 0, 0, 'github', {}, html, false);
      //   })
      // })


      mapped.groups.forEach((g, gIdx) => {
        Object.keys(g.sources).forEach((varName, varIdx) => {
          editor.addNode(varName, 0, 1, 100, 300 + 100 * (gIdx + varIdx), '', {}, g.sources[varName], false);
        })

        Object.keys(g.targets).forEach((varName, varIdx) => {
          editor.addNode(varName, 1, 0, 1200, 300 + 100 * (gIdx + varIdx), '', {}, g.targets[varName], false);
        })

        g.rules.forEach((r, rIdx) => {


          const nr = editor.addNode(r.name, r.sources.length, 1 ?? r.target.length, 650, 100 + 110 * (gIdx + rIdx), '', {}, r.name, false)
          editor.addConnection(
            editor.getNodesFromName(r.sources[0].name)[0],
            nr,
            'output_1', 'input_1'
          );
          editor.addConnection(
            nr,
            editor.getNodesFromName(r.target[0].name)[0],
            'output_1', 'input_1'
          )

        })
      })

    })

  }

}
