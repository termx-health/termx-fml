import {Component, EnvironmentInjector, Input, OnChanges, OnInit, SimpleChanges, ViewChild} from '@angular/core';
import {FMLStructure, FMLStructureConceptMap, FMLStructureEntityMode, FMLStructureGroup, FMLStructureObject, FMLStructureRule} from './fml/fml-structure';
import {FMLEditor} from './fml/fml-editor';
import {DrawflowNode} from 'drawflow';
import {Bundle, StructureDefinition, StructureMap} from 'fhir/r5';
import {isNil, unique} from '@kodality-web/core-util';
import {FMLStructureMapper} from './fml/fml-structure-mapper';
import {MuiIconComponent, MuiModalContainerComponent} from '@kodality-web/marina-ui';
import {FmlStructureComposer} from './fml/fml-structure-composer';
import {asResourceVariable, SEQUENCE, substringAfterLast, substringBeforeLast, VARIABLE_SEP} from './fml/fml.utils';
import Mousetrap from 'mousetrap';
import {RuleViewComponent} from './components/fml/rule-view.component';
import {createCustomElement} from '@angular/elements';
import {ObjectViewComponent} from './components/fml/object-view.component';


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
    action: 'evaluate',
    name: 'evaluate',
    description: 'Execute the supplied FHIRPath expression and use the value returned by that.'
  },
  {
    action: 'truncate',
    name: 'truncate',
    description: 'Source must be some stringy type that has some meaningful length property.'
  },
  {
    action: 'cast',
    name: 'cast'
  },
  {
    action: 'append',
    name: 'append',
    description: 'Element or string - just append them all together'
  },
  {
    action: 'translate',
    name: 'translate',
    description: 'Source, map URI, output (code, system, display, Coding, or CodeableConcept)'
  },
  {
    action: 'reference',
    name: 'reference',
    description: 'Return a string that references the provided tree properly'
  },
  {
    action: 'pointer',
    name: 'pointer',
    description: 'Return the appropriate string to put in a Reference that refers to the resource provided as a parameter'
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
  selector: 'app-editor',
  templateUrl: 'editor.component.html'
})
export class EditorComponent implements OnInit, OnChanges {
  protected FML_MAIN = 'main';
  protected ZOOM_KEY = "fml_zoom";

  @Input() public iframe: boolean;
  @Input() public resourceBundle: Bundle<StructureDefinition>;
  @Input() public structureMap: StructureMap;
  @Input() public mapName: string;

  public get fmlGroup(): FMLStructureGroup {
    return this.editor?._fmlGroup;
  }

  public get fmlGroups(): {[groupName: string]: FMLStructureGroup} {
    return this.editor?._fml.groups;
  }

  // FML editor
  public editor: FMLEditor;
  protected fml: FMLStructure;
  protected groupName = this.FML_MAIN;
  protected nodeSelected: DrawflowNode;

  // component
  protected ruleDescriptions: RuleDescription[] = RULES;
  protected ruleGroups: RuleGroup[] = [];
  protected isAnimated = true;

  @ViewChild('conceptMapModal') public conceptMapModal: MuiModalContainerComponent;
  protected conceptMap: FMLStructureConceptMap;

  @ViewChild(RuleViewComponent) private ruleViewComponent: RuleViewComponent;
  @ViewChild(ObjectViewComponent) private objectViewComponent: ObjectViewComponent;

  constructor(injector: EnvironmentInjector) {
    if (!customElements.get('ce-icon')) {
      customElements.define('ce-icon', createCustomElement(MuiIconComponent, {injector}));
    }
  }

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['resourceBundle'] || changes['structureMap']) {
      if (this.resourceBundle && this.structureMap) {
        this.init();
      }
    }
  }

  public ngOnInit(): void {
    window.addEventListener('fmlStructureObjectFieldSelect', (evt: CustomEvent) => {
      // Freaking event kung fu! Seems like wild hack, but works!
      // Imitates the object view component behaviour.
      const {name, field} = evt.detail;
      this.objectViewComponent.onFieldClick(this.fmlGroup.objects[name], field);
    });
  }

  private init(): void {
    const fml = FMLStructureMapper.map(this.resourceBundle, this.structureMap);
    this.fml = fml;
    this.setFmlGroup(this.FML_MAIN, fml.groups[this.FML_MAIN]);
  }

  private setFmlGroup(groupName: string, fmlGroup: FMLStructureGroup): void {
    this.nodeSelected = undefined;
    this.groupName = groupName;
    this.ruleGroups = Object.keys(this.fml.groups)
      .filter(n => ![this.FML_MAIN, groupName].includes(n))
      .map(n => ({groupName: n}));

    SEQUENCE.current = Math.max(0, ...Object.values(this.fml.groups)
      .flatMap(f => [
        ...Object.keys(f.objects),
        ...f.rules.map(r => r.name)
      ])
      .filter(o => o.includes(VARIABLE_SEP))
      .map(o => substringAfterLast(o, VARIABLE_SEP))
      .map(Number)
      .filter(unique));

    this.fml.setGroup(groupName, fmlGroup);
    this.initEditor(this.fml, groupName);
  }


  /* Public API */

  public export(): StructureMap {
    this.editor._rerenderNodes();
    return FmlStructureComposer.generate(this.fml, {mapName: this.mapName});
  }

  public autoLayout(): void {
    this.editor._autoLayout();
  }

  public zoomIn(): void {
    this.editor.zoom_in();
  }

  public zoomOut(): void {
    this.editor.zoom_out();
  }

  public setExpanded(expanded: boolean): void {
    Object.keys(this.fmlGroup.objects).forEach(name => {
      const node = this.editor._getNodeByName(name);
      this.editor._updateObject(node.id, node.name, obj => obj.expanded = expanded);
    });

    this.fmlGroup.rules.forEach(rule => {
      const node = this.editor._getNodeByName(rule.name);
      this.editor._updateRule(node.id, node.name, r => r.expanded = expanded);
    });

    this.editor._rerenderNodes();
  }

  public setAnimation(animated: boolean): void {
    this.isAnimated = animated;
  }

  public initFmlFromGroup(bundle: Bundle<StructureDefinition>, group: FMLStructureGroup): FMLStructure {
    const fml = new FMLStructure();
    fml.bundle = bundle;
    fml.setGroup(this.FML_MAIN, group);
    return fml;
  }

  /* Editor bar */

  protected selectGroup(name: string): void {
    if (this.fmlGroups[name]) {
      this.setFmlGroup(name, this.fmlGroups[name]);
    }
  }

  protected deleteGroup(name: string): void {
    if (name !== this.FML_MAIN) {
      delete this.fmlGroups[name];
      this.fml.groups = {...this.fmlGroups};
      this.setFmlGroup(this.FML_MAIN, this.fmlGroups[this.FML_MAIN]);
    }
  }

  protected createGroup(groupName: string, fmlGroup: FMLStructureGroup): void {
    this.setFmlGroup(groupName, fmlGroup);
  }


  /* Concept Map */

  protected conceptMapEdit(cm = new FMLStructureConceptMap()): void {
    this.conceptMap = structuredClone(cm);
    this.conceptMap['_origin'] = cm;
    this.conceptMap.mappings ??= [];
    this.conceptMapModal.open();
  }

  protected conceptMapRemove(idx: number): void {
    this.fml.groups
    this.fml.maps.splice(idx, 1);
  }

  protected conceptMapReset(): void {
    if (this.conceptMap) {
      this.conceptMap.source = undefined;
      this.conceptMap.target = undefined;
      this.conceptMap.mappings = [];
    }
  }

  protected conceptMapCancel(): void {
    this.conceptMapModal.close();
    this.conceptMap = undefined;
  }

  protected conceptMapApply(): void {
    const idx = this.fml.maps.indexOf(this.conceptMap['_origin']);
    if (idx !== -1) {
      this.fml.maps.splice(idx, 1, this.conceptMap);
    } else {
      this.fml.maps.push(this.conceptMap);
    }

    this.conceptMapModal.close();
    this.conceptMap = undefined;
  }


  /* Editor */

  private initEditor(fml: FMLStructure, groupName = this.FML_MAIN): void {
    this.editor?.element.remove();

    const parent = document.getElementById("drawflow-parent");
    const element = document.createElement('div');
    element.setAttribute("id", "drawflow");
    element.setAttribute("style", "height: 100%; width: 100%; outline: none");
    parent.appendChild(element);


    const editor = this.editor = new FMLEditor(fml, groupName, element);
    editor.start();

    editor.on('nodeSelected', id => this.nodeSelected = editor.getNodeFromId(id));
    editor.on('nodeUnselected', () => this.nodeSelected = undefined);
    editor.on('nodeMoved', () => {
      const selectedNodeId = this.nodeSelected?.id;
      if (selectedNodeId) {
        this.nodeSelected = editor.getNodeFromId(selectedNodeId);
      }
    });

    editor.on('zoom', v => localStorage.setItem(this.ZOOM_KEY, String(Math.round(v * 100) / 100)));
    if (localStorage.getItem(this.ZOOM_KEY)) {
      editor.zoom = Number(localStorage.getItem(this.ZOOM_KEY));
      editor.zoom_refresh();
    }

    const fmlGroup = editor._fmlGroup;

    // render objects
    Object.values(fmlGroup.objects).forEach(obj => {
      editor._createObjectNode(obj, {
        x: obj.position?.x,
        y: obj.position?.y
      });
    });

    // render rules
    fmlGroup.rules.forEach(rule => {
      editor._createRuleNode(rule, {
        x: rule.position?.x,
        y: rule.position?.y
      });
    });

    // render connections
    fmlGroup.connections.forEach(c => {
      editor._createConnection(c.sourceObject, c.sourceFieldIdx + 1, c.targetObject, c.targetFieldIdx + 1);
    });

    // auto layout
    if (Object.values(fmlGroup.objects).some(o => isNil(o.position))) {
      // schedule after nodes are rendered, fixme: maybe it's better to provided initial HTML to DrawFlow node?
      setTimeout(() => editor._autoLayout());
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
        _rule.name = asResourceVariable(substringBeforeLast(rule.name, VARIABLE_SEP));
        _rule.mode = rule.mode;
        _rule.position = rule.position;
        _rule.action = rule.action;
        _rule.parameters = structuredClone(rule.parameters);
        _rule.condition = rule.condition;
        fmlGroup.putRule(_rule);

        const nodeId = this.editor._createRuleNode(_rule, {..._rule.position});
        fmlGroup.getSources(rule.name).forEach(({sourceObject, field}, idx) => {
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

    const structureDefinition = this.fmlGroup.findStructureDefinition(parentObj.element.id);

    let fieldPath = `${parentObj.element.path}.${field}`;
    const fieldElement = structureDefinition.snapshot.element.find(e => [fieldPath, `${fieldPath}[x]`].includes(e.path));

    let fieldType = type ?? fieldElement.type?.[0]?.code;
    if (fieldElement.contentReference) {
      const type = fieldElement.contentReference.substring(1);
      fieldPath = type;
      fieldType = type;
    } else if (FMLStructureGroup.isBackboneElement(fieldType)) {
      fieldType = fieldPath;
    }

    const obj = this.fmlGroup.newFMLObject(fieldType, fieldPath, mode);
    obj.name = asResourceVariable(`${parentObj.name}.${field}`);
    this.fmlGroup.objects[obj.name] = obj;

    this.editor._createObjectNode(obj);
    if (mode === 'object') {
      this.editor._createConnection(obj.name, 1, parentObj.name, field);
    } else {
      this.editor._createConnection(parentObj.name, field, obj.name, 1);
    }
  }


  /* Drag & drop */

  protected onDragStart(
    ev: DragEvent,
    type: 'rule' | 'group' | 'conceptMap',
    data: RuleDescription | RuleGroup | FMLStructureConceptMap
  ): void {
    ev.dataTransfer.setData("application/json", JSON.stringify({type, data}));
  }

  protected onDragOver(ev: DragEvent): void {
    ev.preventDefault();
  }

  protected onDrop(ev: DragEvent): void {
    const datum:
      {type: 'rule', data: RuleDescription} |
      {type: 'group', data: RuleGroup} |
      {type: 'conceptMap', data: FMLStructureConceptMap}
      = JSON.parse(ev.dataTransfer.getData('application/json'));
    const {top, left} = this.editor._getOffsets();

    const rule = new FMLStructureRule();
    this.fmlGroup.putRule(rule);
    rule.parameters = [];
    rule.position = {
      y: ev.y - top,
      x: ev.x - left
    };

    switch (datum.type) {
      case 'rule':
        rule.action = datum.data.action;
        rule.name = asResourceVariable(datum.data.action);
        break;
      case 'group':
        rule.action = 'rulegroup';
        rule.name = asResourceVariable('rulegroup');
        rule.parameters = [{
          type: 'const',
          value: datum.data.groupName
        }];
        break;
      case 'conceptMap':
        rule.action = 'translate';
        rule.name = asResourceVariable('translate');
        rule.parameters = [
          {type: 'const', value: datum.data.name},
          {type: 'const', value: 'code'}
        ];
        break;
    }

    this.editor._createRuleNode(rule, {...rule.position});
    this.editor._rerenderNodes();
  }


  /* Edit */

  protected applyRule(rule: FMLStructureRule): void {
    if ('rule' in this.nodeSelected.data) {
      this.editor._updateRule(this.nodeSelected.id, this.nodeSelected.name, rule);
    }
    this.editor._rerenderNodes();
  }

  protected applyObject(obj: FMLStructureObject): void {
    if ('obj' in this.nodeSelected.data) {
      this.editor._updateObject(this.nodeSelected.id, this.nodeSelected.name, obj);
    }
    this.editor._rerenderNodes();
  }
}
