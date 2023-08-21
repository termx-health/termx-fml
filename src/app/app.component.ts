import {Component, isDevMode, OnInit, ViewChild} from '@angular/core';
import {FMLStructure} from './fml/fml-structure';
import {finalize, forkJoin, map, mergeMap, Observable, of, tap} from 'rxjs';
import {Bundle, StructureDefinition, StructureMap} from 'fhir/r5';
import {HttpCacheService, isDefined, isNil, unique, uniqueBy} from '@kodality-web/core-util';
import {MuiModalContainerComponent, MuiNotificationService} from '@kodality-web/marina-ui';
import {HttpClient} from '@angular/common/http';
import {FmlStructureGenerator} from './fml/fml-structure-generator';
import {FMLGraph} from './fml/fml-graph';
import {saveAs} from 'file-saver';
import {substringAfterLast} from './fml/fml.utils';
import {EditorComponent} from './editor.component';


interface RuleDescription {
  action: string,
  name: string,
  description?: string
}

const RULES: RuleDescription[] = [
  {
    action: 'constant',
    name: 'constant'
  },
  {
    action: 'uuid',
    name: 'uuid',
    description: 'Generate a random UUID (in lowercase).'
  },
  {
    action: 'copy',
    name: 'copy'
  },
  {
    action: 'truncate',
    name: 'truncate',
    description: 'Source must be some stringy type that has some meaningful length property.'
  },
  {
    action: 'append',
    name: 'append',
    description: 'Element or string - just append them all together'
  },
  {
    action: 'evaluate',
    name: 'evaluate',
    description: 'Execute the supplied FHIRPath expression and use the value returned by that.'
  },
  {
    action: 'cc',
    name: 'cc',
    description: 'Create a CodeableConcept from the parameters provided.'
  }
];


interface RuleGroup {
  groupName: string,
}

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html'
})
export class AppComponent implements OnInit {
  protected SELECTED_STRUCTURE_MAPS_KEY = "selected_structure_map";
  protected STRUCTURE_MAPS_KEY = "structure_maps";


  public structureMap: StructureMap;
  private _structureMap = (): Observable<StructureMap> => {
    const name = localStorage.getItem(this.SELECTED_STRUCTURE_MAPS_KEY);
    const url = `assets/StructureMap/${name}.json`;

    if (isDefined(name) && name in this.localMaps) {
      return of(this.localMaps[name]).pipe(map(resp => this.structureMap = resp));
    }

    return this.http.get<StructureMap>(url).pipe(map(resp => this.structureMap = resp));
  };

  public resourceBundle: Bundle<StructureDefinition>;
  private _resourceBundle = (sm: StructureMap): Observable<Bundle<StructureDefinition>> => {
    return this.http.get<string[]>("assets/StructureDefinition/index.json").pipe(mergeMap(resources => {
      const mapResources = sm.structure.map(s => substringAfterLast(s.url, '/'));

      this.resourceLoader = {total: mapResources.length + resources.length, current: 0};
      const reqs$ = [...mapResources, ...resources].filter(unique).map(k => {
        return this.cache.put(k, this.http.get<StructureDefinition>(`assets/StructureDefinition/${k}.json`)).pipe(tap(() => this.resourceLoader.current++));
      });

      return forkJoin(reqs$).pipe(
        map(definitions => {
          return this.resourceBundle = {
            resourceType: 'Bundle',
            type: 'collection',
            entry: uniqueBy(definitions.map(def => ({resource: def})), e => e.resource.url)
          };
        }),
        finalize(() => this.resourceLoader = undefined));
    }));
  };

  protected structureMaps: string[];
  protected fmlResult: {text: string, json: StructureMap};
  protected resourceLoader: {total: number, current: number};

  protected isDev = isDevMode();
  protected isAnimated = true;
  protected localstorage = localStorage;


  @ViewChild(EditorComponent) public editor: EditorComponent;


  constructor(
    private http: HttpClient,
    private notificationService: MuiNotificationService,
    private cache: HttpCacheService
  ) {

  }


  public ngOnInit(): void {
    this.http.get<string[]>("assets/StructureMap/index.json").subscribe(maps => {
      const localMaps = Object.values(this.localMaps).map(m => m.name);
      this.structureMaps = [...maps, ...localMaps].filter(unique).sort((a, b) => a.localeCompare(b, undefined, {numeric: true, sensitivity: 'base'}));
      this.init();
    });

  }

  protected init(): void {
    localStorage.setItem(this.SELECTED_STRUCTURE_MAPS_KEY, localStorage.getItem(this.SELECTED_STRUCTURE_MAPS_KEY) ?? "step3");

    this.structureMap = undefined;
    this.resourceBundle = undefined;

    this._structureMap().subscribe(resp => {
      this._resourceBundle(resp).subscribe(bundle => {
        console.log(bundle, resp);
      });
    });
  }


  /* Left side */

  // New
  protected initFromWizard(groupName: string, fml: FMLStructure): void {
    const sm = FmlStructureGenerator.generate(fml, {mapName: groupName});

    localStorage.setItem(this.SELECTED_STRUCTURE_MAPS_KEY, sm.name);
    localStorage.setItem(this.STRUCTURE_MAPS_KEY, JSON.stringify({
      ...this.localMaps,
      [sm.name]: sm
    }));

    this.structureMaps = [...this.structureMaps, sm.name].filter(unique);
    this.init();
  }

  // Import
  protected importStructureMap(m: MuiModalContainerComponent, json: string): void {
    if (isNil(json)) {
      return;
    }

    const sm = JSON.parse(json);

    localStorage.setItem(this.SELECTED_STRUCTURE_MAPS_KEY, sm.name);
    localStorage.setItem(this.STRUCTURE_MAPS_KEY, JSON.stringify({
      ...this.localMaps,
      [sm.name]: sm
    }));

    this.init();
    m.close();
  }

  // Export
  protected exportStructureMap(): void {
    const sm = this.export();
    const blob = new Blob([JSON.stringify(sm, null, 2)], {type: 'application/json'});
    saveAs(blob, `${sm.name}.json`);
  }

  // FML
  protected viewAsFML(m: MuiModalContainerComponent): void {
    const map = this.export();

    this.http.post('http://localhost:8200/transformation-definitions/fml', {body: JSON.stringify(map)}, {responseType: 'text'}).subscribe(resp => {
      this.fmlResult = {
        text: resp
          .replaceAll(',  ', ',\n    ')
          .replaceAll(' ->  ', ' ->\n    ')
          .replaceAll("#", "_"),
        json: map
      };
      m.open();
    });
  }

  // Save
  protected save(): void {
    try {
      const sm = this.export();

      localStorage.setItem(this.STRUCTURE_MAPS_KEY, JSON.stringify({
        ...this.localMaps,
        [sm.name]: sm
      }));

      this.notificationService.success("Saved into localstorage", 'Check console for any errors!', {placement: 'top'});
    } catch (e) {
      /* empty */
    }
  }


  /* Right side */

  protected zoomIn(): void {
    this.editor.zoomIn();
  }

  protected zoomOut(): void {
    this.editor.zoomOut();
  }


  protected autoLayout(): void {
    this.editor.autoLayout();
  }

  protected topology(): void {
    const sorted = FMLGraph.fromFML(this.editor.fml).topologySort();
    const order = Object.keys(sorted).sort(e => sorted[e]).reverse();

    const nodeEls = Array.from(document.getElementsByClassName('node-meta'));
    const timeout = 500;

    order.forEach((o, i) => {
      nodeEls.filter(e => e.textContent.trim() === o).forEach(e => {
        setTimeout(() => e.closest<HTMLElement>('.drawflow-node').style.backgroundColor = 'var(--color-primary-2)', (i + 1) * timeout);
      });
    });

    setTimeout(() => nodeEls.forEach(e => e.closest<HTMLElement>('.drawflow-node').style.backgroundColor = ''), (order.length + 1) * timeout);
  }


  /* Utils */

  private export(): StructureMap {
    try {
      return this.editor.export();
    } catch (e) {
      this.notificationService.error('Export failed', e);
      throw e;
    }
  }

  protected get localMaps(): {[k: string]: StructureMap} {
    return JSON.parse(localStorage.getItem(this.STRUCTURE_MAPS_KEY) ?? '{}');
  }

  protected get inIframe(): boolean {
    try {
      return window.self !== window.top;
    } catch (e) {
      return true;
    }
  }
}
