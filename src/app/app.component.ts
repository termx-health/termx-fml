import {Component, EnvironmentInjector, isDevMode, OnInit, ViewChild} from '@angular/core';
import {FMLStructure, FMLStructureEntityMode, FMLStructureGroup, FMLStructureObject, FMLStructureRule} from './fml/fml-structure';
import {finalize, forkJoin, map, mergeMap, Observable, of, tap} from 'rxjs';
import {FMLEditor} from './fml/fml-editor';
import {DrawflowNode} from 'drawflow';
import {Bundle, StructureDefinition, StructureMap} from 'fhir/r5';
import {HttpCacheService, isDefined, isNil, unique, uniqueBy} from '@kodality-web/core-util';
import {FMLStructureMapper} from './fml/fml-structure-mapper';
import {MuiIconComponent, MuiModalContainerComponent, MuiNotificationService} from '@kodality-web/marina-ui';
import {HttpClient} from '@angular/common/http';
import {FmlStructureGenerator} from './fml/fml-structure-generator';
import {FMLGraph} from './fml/fml-graph';
import {saveAs} from 'file-saver';
import {asResourceVariable, SEQUENCE, substringAfterLast, substringBeforeLast} from './fml/fml.utils';
import Mousetrap from 'mousetrap';
import {RuleViewComponent} from './components/fml/rule-view.component';
import {createCustomElement} from '@angular/elements';


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
  protected FML_MAIN = 'main';
  protected SELECTED_STRUCTURE_MAPS_KEY = "selected_structure_map";
  protected STRUCTURE_MAPS_KEY = "structure_maps";


  // todo: @Input()
  public structureMap: StructureMap;
  private _structureMap = (): Observable<StructureMap> => {
    const name = localStorage.getItem(this.SELECTED_STRUCTURE_MAPS_KEY);
    const url = `assets/StructureMap/${name}.json`;

    if (isDefined(name) && name in this.localMaps) {
      return of(this.localMaps[name]);
    }

    return this.http.get<StructureMap>(url).pipe(map(resp => this.structureMap = resp));
  };

  // todo: @Input()
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

  // FML editor
  private editor: FMLEditor;
  protected fmls: {[key: string]: FMLStructure} = {};
  protected fmlSelected = this.FML_MAIN;

  protected get fml(): FMLStructure {
    return this.editor?._fml;
  }

  protected nodeSelected: DrawflowNode;

  // component
  protected structureMaps: string[];
  protected ruleDescriptions: RuleDescription[] = RULES;
  protected ruleGroups: RuleGroup[] = [];
  protected fmlResult: {text: string, json: StructureMap};
  protected resourceLoader: {total: number, current: number};
  protected isAnimated = true;
  protected isDev = isDevMode();
  protected localstorage = localStorage;


  @ViewChild(RuleViewComponent) private ruleViewComponent: RuleViewComponent;

  constructor(
    private http: HttpClient,
    private notificationService: MuiNotificationService,
    private cache: HttpCacheService,
    injector: EnvironmentInjector
  ) {
    if (!customElements.get('ce-icon')) {
      customElements.define('ce-icon', createCustomElement(MuiIconComponent, {injector}));
    }
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

    this._structureMap().subscribe(resp => {
      this._resourceBundle(resp).subscribe(bundle => {
        const fml = FMLStructureMapper.map(bundle, resp);
        this.fmls = fml;
        this.setFML(this.FML_MAIN, fml[this.FML_MAIN]);
      });
    });
  }

  protected setFML(groupName: string, fml: FMLStructure): void {
    this.nodeSelected = undefined;
    this.fmlSelected = groupName;
    this.fmls = {...this.fmls, [groupName]: fml};

    this.ruleGroups = Object.keys(this.fmls)
      .filter(n => ![this.FML_MAIN, groupName].includes(n))
      .map(n => ({groupName: n}));

    SEQUENCE.current = Math.max(...Object.values(this.fmls)
      .flatMap(f => [
        ...Object.keys(f.objects),
        ...f.rules.map(r => r.name)
      ])
      .filter(o => o.includes("#"))
      .map(o => substringAfterLast(o, '#'))
      .map(Number)
      .filter(unique));

    this.initEditor(this.fmls, groupName);
  }


  /* Toolbar */

  private export(): StructureMap {
    this.editor._rerenderNodes();
    try {
      return FmlStructureGenerator.generate(this.fmls, {mapName: localStorage.getItem(this.SELECTED_STRUCTURE_MAPS_KEY)});
    } catch (e) {
      this.notificationService.error('Export failed', e);
      throw e;
    }
  }

  protected importStructureMap(m: MuiModalContainerComponent, json: string): void {
    if (isNil(json)) {
      return;
    }

    const sm = JSON.parse(json);
    const maps = this.localMaps;
    maps[sm.name] = sm;

    localStorage.setItem(this.SELECTED_STRUCTURE_MAPS_KEY, sm.name);
    localStorage.setItem(this.STRUCTURE_MAPS_KEY, JSON.stringify(maps));

    this.init();
    m.close();
  }

  protected exportStructureMap(): void {
    const sm = this.export();
    const blob = new Blob([JSON.stringify(sm, null, 2)], {type: 'application/json'});
    saveAs(blob, `${sm.name}.json`);
  }

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

  protected save(): void {
    try {
      const sm = this.export();

      const maps = this.localMaps;
      maps[sm.name] = sm;
      localStorage.setItem(this.STRUCTURE_MAPS_KEY, JSON.stringify(maps));

      this.notificationService.success("Saved into localstorage", 'Check console for any errors!', {placement: 'top'});
    } catch (e) {
      /* empty */
    }
  }


  protected topology(): void {
    const sorted = FMLGraph.fromFML(this.fml).topologySort();
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

  protected autoLayout(): void {
    this.editor._autoLayout();
  }


  /* Editor bar */

  protected selectGroup(name: string): void {
    if (this.fmls[name]) {
      this.setFML(name, this.fmls[name]);
    }
  }

  protected deleteGroup(name: string): void {
    if (name !== this.FML_MAIN) {
      this.fmls = {...this.fmls, [name]: undefined};
      this.setFML(this.FML_MAIN, this.fmls[this.FML_MAIN]);
    }
  }

  protected createGroup(groupName: string, fml: FMLStructure): void {
    this.setFML(groupName, fml);
  }


  /* Editor */

  private initEditor(fmls: FMLStructureGroup, groupName = this.FML_MAIN): void {
    this.editor?.element.remove();

    const parent = document.getElementById("drawflow-parent");
    const element = document.createElement('div');
    element.setAttribute("id", "drawflow");
    element.setAttribute("style", "height: 100%; width: 100%; outline: none");
    parent.appendChild(element);


    const editor = this.editor = new FMLEditor(fmls, groupName, element);
    editor.start();
    editor.on('nodeSelected', id => this.nodeSelected = editor.getNodeFromId(id));
    editor.on('nodeUnselected', () => this.nodeSelected = undefined);
    editor.on('nodeMoved', () => {
      const selectedNodeId = this.nodeSelected?.id;
      if (selectedNodeId) {
        this.nodeSelected = editor.getNodeFromId(selectedNodeId);
      }
    });

    const fml = editor._fml;

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


    // shortcuts, experimental
    Mousetrap.reset();

    Mousetrap.bind('option+d', () => {
      if (!this.nodeSelected) {
        return true;
      }

      const node = editor.getNodeFromId(this.nodeSelected?.id);
      if (this.editor._isRule(node)) {
        const rule = node.data.rule;

        const _rule = new FMLStructureRule();
        _rule.name = asResourceVariable(substringBeforeLast(rule.name, '#'));
        _rule.mode = rule.mode;
        _rule.position = rule.position;
        _rule.action = rule.action;
        _rule.parameters = structuredClone(rule.parameters);
        _rule.condition = rule.condition;
        fml.putRule(_rule);

        const nodeId = this.editor._createRuleNode(_rule, {..._rule.position});
        fml.getSources(rule.name).forEach(({sourceObject, field}, idx) => {
          // fixme: idx + 1 is very sus
          this.editor._createConnection(sourceObject, field ?? 1, _rule.name, idx + 1);
        });

        editor._updateRule(nodeId, _rule.name, r => r.parameters = rule.parameters);
        editor._rerenderNodes();
        return false;
      }
    });

    Mousetrap.bind(['option+p'], () => {
      if (this.ruleViewComponent) {
        this.ruleViewComponent.editParameter();
        return false;
      }
    });
  }


  /* Structure tree */

  protected onStructureItemSelect(parentObj: FMLStructureObject, field: string, type?: string): void {
    let mode: FMLStructureEntityMode = 'object';
    if (['source', 'element'].includes(parentObj.mode)) {
      mode = 'element';
    }

    const structureDefinition = this.fml.findStructureDefinition(parentObj.element.id);

    const fieldPath = `${parentObj.element.path}.${field}`;
    const fieldElement = structureDefinition.snapshot.element.find(e => [fieldPath, `${fieldPath}[x]`].includes(e.path));

    let fieldType = type ?? fieldElement.type?.[0]?.code; // fixme: ACHTUNG! the first type is selected!
    if (FMLStructure.isBackboneElement(fieldType)) {
      fieldType = fieldPath;
    }

    const obj = this.fml.newFMLObject(fieldType, fieldPath, mode);
    obj.name = asResourceVariable(`${parentObj.name}.${field}`);
    this.fml.objects[obj.name] = obj;

    this.editor._createObjectNode(obj);
    if (mode === 'object') {
      this.editor._createConnection(obj.name, 1, parentObj.name, field);
    } else {
      this.editor._createConnection(parentObj.name, field, obj.name, 1);
    }
  }


  /* Drag & drop */

  protected onRuleDragStart(ev: DragEvent, ruleDescription: RuleDescription): void {
    ev.dataTransfer.setData("application/json", JSON.stringify({
      type: 'rule',
      data: ruleDescription
    }));
  }

  protected onGroupDragStart(ev: DragEvent, ruleGroup: RuleGroup): void {
    ev.dataTransfer.setData("application/json", JSON.stringify({
      type: 'group',
      data: ruleGroup
    }));
  }

  protected onDragOver(ev: DragEvent): void {
    ev.preventDefault();
  }

  protected onDrop(ev: DragEvent): void {
    const {top, left} = this.editor._getOffsets();

    const rule = new FMLStructureRule();
    this.fml.putRule(rule);

    rule.parameters = [];
    rule.position = {
      y: ev.y - top,
      x: ev.x - left
    };


    const datum: {type: 'rule', data: RuleDescription} | {type: 'group', data: RuleGroup} = JSON.parse(ev.dataTransfer.getData('application/json'));

    if (datum.type === 'group') {
      rule.action = 'rulegroup';
      rule.name = asResourceVariable('rulegroup');
      rule.parameters = [{
        type: 'const',
        value: datum.data.groupName
      }];

      const objects = Object.values(this.fmls[datum.data.groupName].objects)
      this.editor._createRuleNode(rule, {
        ...rule.position,
        inputs: objects.filter(o=> o.mode === 'source').length,
        outputs: objects.filter(o=> o.mode === 'target').length,
      });
      return;
    }

    rule.action = datum.data.action;
    rule.name = asResourceVariable(datum.data.action);
    this.editor._createRuleNode(rule, {...rule.position});
  }


  /* Setup wizard */

  protected initFromWizard(groupName: string, fml: FMLStructure): void {
    const map = FmlStructureGenerator.generate(fml, {mapName: groupName});

    const maps = this.localMaps;
    maps[map.name] = map;
    localStorage.setItem(this.SELECTED_STRUCTURE_MAPS_KEY, map.name);
    localStorage.setItem(this.STRUCTURE_MAPS_KEY, JSON.stringify(maps));

    this.structureMaps = [...this.structureMaps, map.name].filter(unique);
    this.init();
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
    return JSON.parse(localStorage.getItem(this.STRUCTURE_MAPS_KEY) ?? '{}');
  }
}
