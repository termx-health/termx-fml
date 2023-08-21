import {Component, EnvironmentInjector, Input, OnChanges, OnInit, SimpleChanges, ViewChild} from '@angular/core';
import {FMLStructure, FMLStructureEntityMode, FMLStructureGroup, FMLStructureObject, FMLStructureRule} from './fml/fml-structure';
import {FMLEditor} from './fml/fml-editor';
import {DrawflowNode} from 'drawflow';
import {Bundle, StructureDefinition, StructureMap} from 'fhir/r5';
import {isNil, unique} from '@kodality-web/core-util';
import {FMLStructureMapper} from './fml/fml-structure-mapper';
import {MuiIconComponent} from '@kodality-web/marina-ui';
import {FmlStructureGenerator} from './fml/fml-structure-generator';
import {asResourceVariable, SEQUENCE, substringAfterLast, substringBeforeLast} from './fml/fml.utils';
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


  public get fml(): FMLStructure {
    return this.editor?._fml;
  }

  // FML editor
  private editor: FMLEditor;
  protected fmls: {[key: string]: FMLStructure} = {};
  protected groupName = this.FML_MAIN;
  protected nodeSelected: DrawflowNode;

  // component
  protected ruleDescriptions: RuleDescription[] = RULES;
  protected ruleGroups: RuleGroup[] = [];
  protected isAnimated = true;


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
      this.objectViewComponent.onFieldClick(this.fml.objects[name], field);
    });
  }

  protected init(): void {
    const fml = FMLStructureMapper.map(this.resourceBundle, this.structureMap);
    this.fmls = fml;
    this.setFML(this.FML_MAIN, fml[this.FML_MAIN]);
  }

  protected setFML(groupName: string, fml: FMLStructure): void {
    this.nodeSelected = undefined;
    this.groupName = groupName;
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


  /* Public API */

  public export(): StructureMap {
    this.editor._rerenderNodes();
    return FmlStructureGenerator.generate(this.fmls, {mapName: this.mapName});
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

  public setAnimation(isAnimated: boolean): void {
    this.isAnimated = isAnimated;
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

    editor.on('zoom', v => localStorage.setItem(this.ZOOM_KEY, String(Math.round(v * 100) / 100)));
    if (localStorage.getItem(this.ZOOM_KEY)) {
      editor.zoom = Number(localStorage.getItem(this.ZOOM_KEY));
      editor.zoom_refresh();
    }

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

    let fieldType = type ?? fieldElement.type?.[0]?.code;
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
    const datum: {type: 'rule', data: RuleDescription} | {type: 'group', data: RuleGroup} = JSON.parse(ev.dataTransfer.getData('application/json'));
    const {top, left} = this.editor._getOffsets();

    const rule = new FMLStructureRule();
    this.fml.putRule(rule);
    rule.parameters = [];
    rule.position = {
      y: ev.y - top,
      x: ev.x - left
    };

    if (datum.type === 'rule') {
      rule.action = datum.data.action;
      rule.name = asResourceVariable(datum.data.action);

      this.editor._createRuleNode(rule, {...rule.position});
      this.editor._rerenderNodes();
      return;
    }


    if (datum.type === 'group') {
      rule.action = 'rulegroup';
      rule.name = asResourceVariable('rulegroup');
      rule.parameters = [{
        type: 'const',
        value: datum.data.groupName
      }];

      const objects = Object.values(this.fmls[datum.data.groupName].objects);
      this.editor._createRuleNode(rule, {
        ...rule.position,
        // fixme: should not be set like that, cannot save and restore
        inputs: objects.filter(o => o.mode === 'source').length,
        outputs: objects.filter(o => o.mode === 'target').length,
      });

      this.editor._rerenderNodes();
    }
  }


  /* Edit */

  protected applyRule(rule: FMLStructureRule): void {
    if ('rule' in this.nodeSelected.data) {
      this.editor._updateRule(this.nodeSelected.id, this.nodeSelected.name, rule);
    }
    this.editor._rerenderNodes();
  }
}
