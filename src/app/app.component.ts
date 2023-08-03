import {Component, EnvironmentInjector, OnInit} from '@angular/core';
import {StructureMapService} from './fhir/structure-map.service';
import {FMLStructure, FMLStructureConnection, FMLStructureEntityMode, FMLStructureObject, FMLStructureObjectField, FMLStructureRule} from './fml/fml-structure';
import {forkJoin, map, mergeMap, Observable} from 'rxjs';
import {FMLEditor} from './fml/fml-editor';
import {DrawflowNode} from 'drawflow';
import {Bundle, StructureDefinition, StructureMap} from 'fhir/r5';
import {setExpand} from './fml/fml.utils';
import {group, isDefined} from '@kodality-web/core-util';
import {FMLStructureMapper} from './fml/fml-structure-mapper';
import {createCustomElement} from '@angular/elements';
import {MuiIconComponent} from '@kodality-web/marina-ui';
import {HttpClient} from '@angular/common/http';
import {RULE_ID} from './fml/rule-parsers/parser';

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
  },
  {
    code: 'append',
    name: 'append',
    description: 'Element or string - just append them all together'
  }
];

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
})
export class AppComponent implements OnInit {
  // todo: @Input()
  public structureMap: StructureMap;
  private _structureMap = (): Observable<StructureMap> => {
    const name = localStorage.getItem('selected_structure_map') ?? "step3";
    const url = `assets/StructureMap/${name}.json`;
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
  protected fml: FMLStructure;
  private editor: FMLEditor;
  protected nodeSelected: DrawflowNode;

  // component
  protected ruleDescriptions = RULES;
  protected isExpanded = true;
  protected isAnimated = true;

  protected maps: string[];
  protected localstorage = localStorage;


  constructor(
    private http: HttpClient,
    private structureMapService: StructureMapService,
    injector: EnvironmentInjector
  ) {
    if (!customElements.get('ce-icon')) {
      customElements.define('ce-icon', createCustomElement(MuiIconComponent, {injector}));
    }
  }


  public ngOnInit(): void {
    this.http.get<string[]>("assets/StructureMap/index.json").subscribe(maps => {
      this.maps = maps.sort((a, b) => a.localeCompare(b, undefined, {numeric: true, sensitivity: 'base'}));
      this.init();
    });
  }

  protected init(): void {
    this._structureMap().subscribe(resp => {
      this._resourceBundle(resp).subscribe(bundle => {
        const fml = this.fml = FMLStructureMapper.map(bundle, resp);
        console.log(fml);
        this.initEditor(fml);
      });
    });
  }

  protected export(): void {
    const exp = this.editor.export();
    Object.values(exp.drawflow.Home.data).forEach(el => {
      const {x, y} = (el.data.obj ?? el.data.rule).position;
      el.pos_x = x;
      el.pos_y = y;
    });

    console.log(FMLStructureMapper.compose(this.fml));
  }


  /* Editor */

  private initEditor(fml: FMLStructure): void {
    const element = document.getElementById("drawflow");
    element.innerHTML = ''

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

    // fixme (objects & rules): currently x, y are undefined! they should be stored in StrcutureMap somewhere and restored on load

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
    editor._autoLayout();

    // rerender nodes
    editor._rerenderNodes();
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


  /* Expand */

  protected setExpand(isExpanded: boolean): void {
    this.isExpanded = isExpanded;

    Object.keys(this.fml.objects).forEach(k => {
      setExpand(this.editor, k, isExpanded);
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
  protected readonly localStorage = localStorage;
}
