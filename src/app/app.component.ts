import {Component, OnInit} from '@angular/core';
import {StructureMapService} from './fhir/structure-map.service';
import {
  FMLStructure,
  FMLStructureConnection,
  FMLStructureEntityMode,
  FMLStructureObject,
  FMLStructureObjectField,
  FMLStructureRule,
  FMLStructureRuleParameter
} from './fml/fml-structure';
import {forkJoin, map, mergeMap, Observable, of} from 'rxjs';
import {FMLEditor} from './fml/fml-editor';
import {DrawflowNode} from 'drawflow';
import {Bundle, StructureDefinition, StructureMap, StructureMapGroupInput} from 'fhir/r5';
import {group, isDefined, isNil, unique} from '@kodality-web/core-util';
import {FMLStructureMapper} from './fml/fml-structure-mapper';
import {MuiModalContainerComponent, MuiNotificationService} from '@kodality-web/marina-ui';
import {HttpClient} from '@angular/common/http';
import {RULE_ID} from './fml/rule-parsers/parser';
import {FmlStructureGenerator} from './fml/fml-structure-generator';

let ID = 69;

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
  }, {
    code: 'copy',
    name: 'copy'
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
  }
];

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  host: {
    '[style.filter]': `_setupWizard ? 'blur(5px)' : 'initial'`
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
      const reqs$ = [
        ...mapResources.map(k => this.structureMapService.getStructureDefinition(k)),
        ...resources.map(r => this.structureMapService.getStructureDefinition(r))
      ];
      return forkJoin(reqs$).pipe(map(definitions => {
        return this.resourceBundle = {
          resourceType: 'Bundle',
          type: 'collection',
          entry: definitions.map(def => ({resource: def}))
        };
      }));
    }));
  };

  // FML editor
  private editor: FMLEditor;
  protected fml: FMLStructure;
  protected nodeSelected: DrawflowNode;
  protected _nodeSelected: DrawflowNode; // copy for edit

  // component
  protected ruleDescriptions = RULES;
  protected isAnimated = true;

  protected maps: string[];
  protected localstorage = localStorage;
  protected _fmlResult: string;
  protected _setupWizard: boolean;


  constructor(
    private http: HttpClient,
    private structureMapService: StructureMapService,
    private notificationService: MuiNotificationService,
  ) { }


  public ngOnInit(): void {
    this.http.get<string[]>("assets/StructureMap/index.json").subscribe(maps => {
      const local = Object.values(this.localMaps).map(m => m.name);
      this.maps = [...maps, ...local].sort((a, b) => a.localeCompare(b, undefined, {numeric: true, sensitivity: 'base'}));
      this.init();
    });
  }

  protected init(): void {
    this.localstorage.setItem('selected_structure_map', localStorage.getItem('selected_structure_map') ?? "step3");

    this._structureMap().subscribe(resp => {
      this._resourceBundle(resp).subscribe(bundle => {
        const fml = this.fml = FMLStructureMapper.map(bundle, resp);
        console.log(fml);
        this.initEditor(fml);
      });
    });
  }


  /* Export */
  private _export(): StructureMap {
    this.prepareExportData();
    try {
      return FmlStructureGenerator.generate(this.fml, {name: localStorage.getItem('selected_structure_map')});
    } catch (e) {
      this.notificationService.error('Export failed', e);
    }
  }

  protected save(): void {
    const sm = this._export();

    const maps = this.localMaps;
    maps[sm.name] = sm;
    localStorage.setItem('structure_maps', JSON.stringify(maps));
  }

  protected export(): void {
    this._export();
  }

  protected exportAsFML(m: MuiModalContainerComponent): void {
    this.http.post('http://localhost:8200/transformation-definitions/fml', {body: JSON.stringify(this._export())}, {responseType: 'text'}).subscribe(resp => {
      this._fmlResult = resp;
      m.open();
    });
  }

  private prepareExportData(): void {
    this.editor._rerenderNodes();
    const exp = this.editor.export();
    Object.values(exp.drawflow.Home.data).forEach(el => {
      const {x, y} = (el.data.obj ?? el.data.rule).position;
      el.pos_x = x;
      el.pos_y = y;
    });
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

  protected onStructureItemSelect(parentObj: FMLStructureObject, field: string): void {
    let mode: FMLStructureEntityMode = 'object';
    if (['source', 'element'].includes(parentObj.mode)) {
      mode = 'element';
    }

    const structureDefinition = this.fml.findStructureDefinition(this.resourceBundle, parentObj.element.id);

    const fieldPath = `${parentObj.element.path}.${field}`;
    const fieldElement = structureDefinition.snapshot.element.find(e => [fieldPath, `${fieldPath}[x]`].includes(e.path));
    let fieldType = fieldElement.type?.[0]?.code; // fixme: ACHTUNG! the first type is selected!
    if (FMLStructure.isBackboneElement(fieldType)) {
      fieldType = fieldPath;
    }

    const obj = this.fml.newFMLObject(fieldType, fieldPath, mode);
    obj.name = `${fieldPath}#${ID++}`;
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
    const data = JSON.parse(ev.dataTransfer.getData('application/json')) as RuleDescription;
    const rule = new FMLStructureRule();
    rule.name = `${data.code}#${RULE_ID.next()}`;
    rule.action = data.code;
    rule.parameters = [];
    this.fml.rules.push(rule);

    const {top, left} = this.editor._getOffsets();
    this.editor._createRuleNode(rule, {
      y: ev.y - top,
      x: ev.x - left
    });
  }


  /* Setup wizard */

  protected initFromWizard(data: {sources: string[], targets: string[]}): void {
    const sources = data.sources.map(url => this.resourceBundle.entry.find(e => e.resource.url === url).resource).map(r => ({
      url: r.url,
      mode: 'source' as any,
      alias: r.id
    }));
    const targets = data.targets.map(url => this.resourceBundle.entry.find(e => e.resource.url === url).resource).map(r => ({
      url: r.url,
      mode: 'target' as any,
      alias: r.id
    }));

    const name = "new";
    const map: StructureMap = {
      "resourceType": "StructureMap",
      "id": name,
      "url": `http://hl7.org/fhir/StructureMap/${name}`,
      "name": name,
      "status": "draft",
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
    maps[name] = map;
    localStorage.setItem('selected_structure_map', name);
    localStorage.setItem('structure_maps', JSON.stringify(maps));

    this.init();
    this._setupWizard = false;
  }

  /* Edit */

  protected editStart(m: MuiModalContainerComponent): void {
    this._nodeSelected = structuredClone(this.nodeSelected);
    m.open();
  }

  protected editCancel(m: MuiModalContainerComponent): void {
    m.close();
    this._nodeSelected = undefined;
  }

  protected editApply(m: MuiModalContainerComponent): void {
    m.close();
    this.nodeSelected = this._nodeSelected;
    this._nodeSelected = undefined;

    if ('rule' in this.nodeSelected.data) {
      this.editor._updateRule(this.nodeSelected.id, this.nodeSelected.name, this.nodeSelected.data.rule);
    } else if ('obj' in this.nodeSelected.data) {
      this.editor._updateObject(this.nodeSelected.id, this.nodeSelected.name, this.nodeSelected.data.obj);
    }

    this.editor._rerenderNodes();
  }

  protected moveParameter(params: FMLStructureRuleParameter[], p: FMLStructureRuleParameter, direction: 'up' | 'down'): void {
    const idx = params.indexOf(p);
    if (idx !== -1) {
      params.splice(idx, 1);
      params.splice((direction === 'up' ? Math.max(0, idx - 1) : Math.min(idx + 1, params.length + 1)), 0, p);
    }
  }

  protected removeParameter(params: FMLStructureRuleParameter[], p: FMLStructureRuleParameter): void {
    const idx = params.indexOf(p);
    if (idx !== -1) {
      params.splice(idx, 1);
    }
  }

  protected addParameter(params: FMLStructureRuleParameter[]): void {
    params.push({
      type: 'const',
      value: undefined
    });
  }


  /* Utils */

  protected isResourceSelectable = (f: FMLStructureObjectField) => {
    return f.types?.some(t => FMLStructure.isBackboneElement(t)) || this.resourceBundle.entry.some(e => f.types?.includes(e.resource.type));
  };

  protected get simpleFML(): {
    objects: {[name: string]: FMLStructureObject},
    rules: (FMLStructureRule & {sources: string[], targets: string[]})[],
    connections: FMLStructureConnection[]
  } {
    return {
      objects: group(Object.values(this.fml?.objects || {}), o => o.name, o => ({
        ...o,
        fields: o.fields,
        html: undefined
      }) as FMLStructureObject),
      rules: this.fml?.rules.map(r => ({
        ...r,
        sources: this.fml.getSources(r.name).map(this.toObjectFieldPath),
        targets: this.fml.getTargets(r.name).map(this.toObjectFieldPath),
      })),
      connections: this.fml?.connections as any
    };
  }

  protected toObjectFieldPath = ({object, field}) => {
    return [object, field].filter(isDefined).join(':');
  };


  protected ctxVariables = (name: string): string[] => {
    return this.fml.getSources(name)
      .map(s => s.object)
      .flatMap(sn => [sn, ...this.ctxVariables(sn)])
      .filter(unique)
      .filter(n => this.fml.objects[n]);
  };

  protected get localMaps(): {[k: string]: StructureMap} {
    const _maps = localStorage.getItem('structure_maps') ?? '{}';
    return JSON.parse(_maps);
  }
}
