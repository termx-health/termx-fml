import {Component, isDevMode, OnInit} from '@angular/core';
import {StructureMapService} from './fhir/structure-map.service';
import {FMLStructure, FMLStructureEntityMode, FMLStructureObject, FMLStructureRule} from './fml/fml-structure';
import {finalize, forkJoin, interval, map, mergeMap, Observable, of, tap} from 'rxjs';
import {FMLEditor} from './fml/fml-editor';
import {DrawflowNode} from 'drawflow';
import {Bundle, StructureDefinition, StructureMap, StructureMapGroupInput} from 'fhir/r5';
import {HttpCacheService, isDefined, isNil, unique, uniqueBy} from '@kodality-web/core-util';
import {FMLStructureMapper} from './fml/fml-structure-mapper';
import {MuiModalContainerComponent, MuiNotificationService} from '@kodality-web/marina-ui';
import {HttpClient} from '@angular/common/http';
import {FmlStructureGenerator} from './fml/fml-structure-generator';
import {FMLGraph} from './fml/fml-graph';
import {saveAs} from 'file-saver';
import {SEQUENCE} from './fml/fml.utils';


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
    code: 'copy',
    name: 'copy'
  },
  {
    code: 'constant',
    name: 'constant'
  },
  {
    code: 'append',
    name: 'append',
    description: 'Element or string - just append them all together'
  },
  {
    code: 'evaluate',
    name: 'evaluate',
    description: 'Execute the supplied FHIRPath expression and use the value returned by that'
  },
  {
    code: 'truncate',
    name: 'truncate',
    description: 'Source must be some stringy type that has some meaningful length property'
  },
  {
    code: 'cc',
    name: 'cc',
    description: 'Create a CodeableConcept from the parameters provided'
  }
];

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  host: {
    '[style.filter]': `_setupWizard ? 'blur(3px)' : 'initial'`
  }
})
export class AppComponent implements OnInit {
  // todo: @Input()
  public structureMap: StructureMap;
  private _structureMap = (): Observable<StructureMap> => {
    const name = localStorage.getItem('selected_structure_map');
    const url = `assets/StructureMap/${name}.json`;

    if (isDefined(name) && name in this.localMaps) {
      return of(this.localMaps[name]);
    }

    return this.structureMapService.getStructureMap(url).pipe(map(resp => this.structureMap = resp));
  };

  // todo: @Input()
  public resourceBundle: Bundle<StructureDefinition>;
  private _resourceBundle = (sm: StructureMap): Observable<Bundle<StructureDefinition>> => {
    return this.http.get<string[]>("assets/StructureDefinition/index.json").pipe(mergeMap(resources => {
      const mapResources = sm.structure.map(s => s.url.substring(s.url.lastIndexOf('/') + 1));

      this.resourceLoader = {total: mapResources.length + resources.length, current: 0};
      const reqs$ = [
        ...mapResources.map(k => this.cache.put(k, this.structureMapService.getStructureDefinition(k)).pipe(tap(() => this.resourceLoader.current++))),
        ...resources.map(r => this.cache.put(r, this.structureMapService.getStructureDefinition(r)).pipe(tap(() => this.resourceLoader.current++)))
      ];
      return forkJoin(reqs$).pipe(map(definitions => {
        return this.resourceBundle = {
          resourceType: 'Bundle',
          type: 'collection',
          entry: uniqueBy(definitions.map(def => ({resource: def})), e => e.resource.url)
        };
      }), finalize(() => this.resourceLoader = undefined));
    }));
  };

  // FML editor
  private editor: FMLEditor;
  protected fml: FMLStructure;
  protected nodeSelected: DrawflowNode;

  // component
  protected ruleDescriptions = RULES;
  protected isAnimated = true;

  protected maps: string[];
  protected localstorage = localStorage;
  protected resourceLoader: {total: number, current: number};
  protected _fmlResult: string;
  protected _setupWizard: boolean;
  protected _dev = isDevMode();


  constructor(
    private http: HttpClient,
    private structureMapService: StructureMapService,
    private notificationService: MuiNotificationService,
    private cache: HttpCacheService
  ) {
    interval(5000).subscribe(val => {
      this.http.get('./assets/env.js', {responseType: 'text'}).subscribe(resp => {
        if (val === 0) {
          localStorage.setItem('env', resp);
        } else if (localStorage.getItem('env') !== resp) {
          this.notificationService.warning("New version", "Save changes and refresh browser", {duration: 0, messageKey: 'update-version'});
        }
      });
    });
  }


  public ngOnInit(): void {
    this.http.get<string[]>("assets/StructureMap/index.json").subscribe(maps => {
      const local = Object.values(this.localMaps).map(m => m.name);
      this.maps = [...maps, ...local].filter(unique).sort((a, b) => a.localeCompare(b, undefined, {numeric: true, sensitivity: 'base'}));
      this.init();
    });
  }

  protected init(): void {
    this.localstorage.setItem('selected_structure_map', localStorage.getItem('selected_structure_map') ?? "step3");

    this._structureMap().subscribe(resp => {
      this._resourceBundle(resp).subscribe(bundle => {
        const fml = this.fml = FMLStructureMapper.map(bundle, resp);
        console.log(fml);

        const nums = fml.connections
          .flatMap(c => [c.sourceObject, c.targetObject])
          .filter(o => o.includes("#"))
          .map(o => o.split("#")[1])
          .map(Number)
          .filter(unique);
        const max = Math.max(...nums)
        while (SEQUENCE.v <= max) {
          SEQUENCE.next()
        }


        this.initEditor(fml);
      });
    });
  }


  /* Export */

  private prepareExportData(): void {
    this.editor._rerenderNodes();
    const exp = this.editor.export();
    Object.values(exp.drawflow.Home.data).forEach(el => {
      const {x, y} = (el.data.obj ?? el.data.rule).position;
      el.pos_x = x;
      el.pos_y = y;
    });
  }

  private _export(): StructureMap {
    this.prepareExportData();
    try {
      return FmlStructureGenerator.generate(this.fml, {name: localStorage.getItem('selected_structure_map')});
    } catch (e) {
      this.notificationService.error('Export failed', e);
      throw e;
    }
  }

  protected save(): void {
    try {
      const sm = this._export();

      const maps = this.localMaps;
      maps[sm.name] = sm;
      localStorage.setItem('structure_maps', JSON.stringify(maps));

      this.notificationService.success("Saved into localstorage", 'Check console for any errors!', {placement: 'top'});
    } catch (e) {
      /* empty */
    }
  }

  protected export(): void {
    const sm = this._export();
    saveAs(new Blob([JSON.stringify(sm, null, 2)], {type: 'application/json'}), `${sm.name}.json`);
  }

  protected exportAsFML(m: MuiModalContainerComponent): void {
    this.http.post('http://localhost:8200/transformation-definitions/fml', {body: JSON.stringify(this._export())}, {responseType: 'text'}).subscribe(resp => {
      this._fmlResult = resp
        .replaceAll(',  ', ',\n    ')
        .replaceAll(' ->  ', ' ->\n    ')
        .replaceAll("#", "_");
      m.open();
    });
  }

  protected importStructureMap(m: MuiModalContainerComponent, json: string): void {
    if (isNil(json)) {
      return;
    }

    const sm = JSON.parse(json);
    const maps = this.localMaps;
    maps[sm.name] = sm;

    localStorage.setItem('selected_structure_map', sm.name);
    localStorage.setItem('structure_maps', JSON.stringify(maps));

    this.init();
    m.close();
  }


  protected topology(): void {
    const sorted = FMLGraph.fromFML(this.fml).topologySort();
    const order = Object.keys(sorted).sort(e => sorted[e]).reverse();

    const nodeEls = Array.from(document.getElementsByClassName('node-meta'));
    const timeout = 500;

    order.forEach((o, i) => {
      nodeEls.filter(e => e.textContent.trim() === o).forEach(e => {
        setTimeout(() => e.parentElement.parentElement.style.backgroundColor = 'var(--color-primary-2)', (i + 1) * timeout);
      });
    });

    setTimeout(() => nodeEls.forEach(e => e.parentElement.parentElement.style.backgroundColor = ''), (order.length + 1) * timeout);
  }


  /* Editor */

  private initEditor(fml: FMLStructure): void {
    this.editor?.element.remove();

    const parent = document.getElementById("drawflow-parent");
    const element = document.createElement('div');
    element.setAttribute("id", "drawflow");
    element.setAttribute("style", "height: 100%; width: 100%; outline: none");
    parent.appendChild(element);


    const editor = this.editor = new FMLEditor(fml, element);
    editor.start();
    editor.on('nodeSelected', id => this.nodeSelected = editor.getNodeFromId(id));
    editor.on('nodeUnselected', () => this.nodeSelected = undefined);
    editor.on('nodeMoved', () => {
      const selectedNodeId = this.nodeSelected?.id;
      if (selectedNodeId) {
        this.nodeSelected = editor.getNodeFromId(selectedNodeId);
      }
    });

    // render objects
    Object.values(fml.objects).forEach(obj => {
      editor._createObjectNode(obj, {
        x: obj.position?.x,
        y: obj.position?.y,
        outputs: obj.mode === 'object' ? 1 : undefined
      });
    });

    // render rules
    fml.rules.forEach(rule => {
      editor._createRuleNode(rule, {
        x: rule.position?.x,
        y: rule.position?.y,
      });
    });

    // render connections
    fml.connections.forEach(c => {
      editor._createConnection(c.sourceObject, c.sourceFieldIdx + 1, c.targetObject, c.targetFieldIdx + 1);
    });

    // auto layout
    if (Object.values(fml.objects).some(o => isNil(o.position))) {
      editor._autoLayout();
    }

    // rerender nodes
    editor._rerenderNodes();

    // notify readiness
    editor._ready();
  }


  /* Structure tree */

  protected onStructureItemSelect(parentObj: FMLStructureObject, field: string, type?: string): void {
    let mode: FMLStructureEntityMode = 'object';
    if (['source', 'element'].includes(parentObj.mode)) {
      mode = 'element';
    }

    const structureDefinition = this.fml.findStructureDefinition(this.resourceBundle, parentObj.element.id);

    const fieldPath = `${parentObj.element.path}.${field}`;
    const fieldElement = structureDefinition.snapshot.element.find(e => [fieldPath, `${fieldPath}[x]`].includes(e.path));

    let fieldType = type ?? fieldElement.type?.[0]?.code; // fixme: ACHTUNG! the first type is selected!
    if (FMLStructure.isBackboneElement(fieldType)) {
      fieldType = fieldPath;
    }

    const obj = this.fml.newFMLObject(fieldType, fieldPath, mode);
    obj.name = `${parentObj.name}.${field}#${SEQUENCE.next()}`;
    this.fml.objects[obj.name] = obj;

    this.editor._createObjectNode(obj);
    if (mode === 'object') {
      this.editor._createConnection(obj.name, 1, parentObj.name, field);
    } else {
      this.editor._createConnection(parentObj.name, field, obj.name, 1);
    }
  }


  /* Drag & drop */

  protected onDragStart(ev: DragEvent, ruleDescription: RuleDescription): void {
    ev.dataTransfer.setData("application/json", JSON.stringify(ruleDescription));
  }

  protected onDragOver(ev: DragEvent): void {
    ev.preventDefault();
  }

  protected onDrop(ev: DragEvent): void {
    const {top, left} = this.editor._getOffsets();


    const data = JSON.parse(ev.dataTransfer.getData('application/json')) as RuleDescription;
    const rule = new FMLStructureRule();
    rule.name = `${data.code}#${SEQUENCE.next()}`;
    rule.action = data.code;
    rule.parameters = [];
    rule.position = {
      y: ev.y - top,
      x: ev.x - left
    };
    this.fml.rules.push(rule);

    this.editor._createRuleNode(rule, {...rule.position});
  }


  /* Setup wizard */

  protected initFromWizard(data: {name: string, sources: StructureDefinition[], targets: StructureDefinition[]}): void {
    const sources = data.sources.map(sd => this.resourceBundle.entry.find(e => e.resource.url === sd.url).resource).map(r => ({
      url: r.url,
      mode: 'source' as any,
      alias: r.id
    }));
    const targets = data.targets.map(sd => this.resourceBundle.entry.find(e => e.resource.url === sd.url).resource).map(r => ({
      url: r.url,
      mode: 'target' as any,
      alias: r.id
    }));

    const map: StructureMap = {
      "id": data.name,
      "resourceType": "StructureMap",
      "status": "draft",
      "name": data.name,
      "url": `http://hl7.org/fhir/StructureMap/${data.name}`,
      "structure": [
        ...sources,
        ...targets
      ],
      "group": [
        {
          "name": "main",
          "input": [
            ...sources.map(s => ({
              name: s.alias,
              type: s.alias,
              mode: 'source' as StructureMapGroupInput['mode']
            })),
            ...targets.map(s => ({
              name: s.alias,
              type: s.alias,
              mode: 'source' as StructureMapGroupInput['mode']
            }))
          ],
          "rule": []
        }
      ]
    };

    const maps = this.localMaps;
    maps[data.name] = map;
    localStorage.setItem('selected_structure_map', data.name);
    localStorage.setItem('structure_maps', JSON.stringify(maps));

    this.init();
    this._setupWizard = false;
  }


  /* Edit */

  protected applyRule(rule: FMLStructureRule): void {
    if ('rule' in this.nodeSelected.data) {
      this.editor._updateRule(this.nodeSelected.id, this.nodeSelected.name, rule);
    }
    this.editor._rerenderNodes();
  }


  /* Utils */

  protected get localMaps(): {[k: string]: StructureMap} {
    return JSON.parse(localStorage.getItem('structure_maps') ?? '{}');
  }

  protected splitUrl(url: string): [string, string] {
    return [url.substring(0, url.lastIndexOf('/')), url.substring(url.lastIndexOf('/') + 1)];
  }
}
