import Drawflow, {DrawflowNode} from 'drawflow';
import {FMLPosition, FMLStructure, FMLStructureObject, FMLStructureRule} from './fml-structure';
import {isDefined} from '@kodality-web/core-util';
import dagre from "dagre";
import {FMLCopyRuleRenderer} from './rule-renderers/copy.renderer';
import {FMLDefaultRuleRenderer} from './rule-renderers/default.renderer';
import {getCanvasFont, getTextWidth} from './fml.utils';
import {FMLAppendRuleRenderer} from './rule-renderers/append.renderer';

let ID = 42;

export interface FMLDrawflowRuleNode extends DrawflowNode {
  data: {
    rule?: FMLStructureRule
  }
}

export interface FMLDrawflowObjectNode extends DrawflowNode {
  data: {
    obj?: FMLStructureObject,
  }
}

interface FMLDrawflowNode extends FMLDrawflowRuleNode, FMLDrawflowObjectNode {
  data: any
}

export const getPortIdx = (str: string): number => {
  return Number(str.split("_")[1])
}


export class FMLEditor extends Drawflow {
  // object
  private _getObject = (path: string): FMLStructureObject => this._fml.objects[path];
  public _updateObject = (nodeId: number, path: string, fn: (obj: FMLStructureObject) => void) => {
    const obj = this._getObject(path);
    fn(obj)
    this.updateNodeDataFromId(nodeId, {obj})
  }

  // rule
  private _getRule = (name: string): FMLStructureRule => this._fml.rules.find(r => r.name === name);
  public _updateRule = (nodeId: number, name: string, fn: (rule: FMLStructureRule) => void) => {
    const rule = this._getRule(name);
    fn(rule)
    this.updateNodeDataFromId(nodeId, {rule})
  }


  // rule renderer
  private getRuleRenderer = (action: string) => this.ruleRenderers.find(rr => rr.action === action) ?? new FMLDefaultRuleRenderer();
  private ruleRenderers = [
    new FMLCopyRuleRenderer(),
    new FMLAppendRuleRenderer()
  ]


  constructor(private _fml: FMLStructure, private element: HTMLElement, options?: {
    render?: object,
    parent?: object
  }) {
    super(element, options?.render, options?.parent);
    this.curvature = 0.4

    const isObj = (n: DrawflowNode): n is FMLDrawflowObjectNode => 'obj' in n.data;
    const isRule = (n: DrawflowNode): n is FMLDrawflowRuleNode => 'rule' in n.data;

    this.on('nodeMoved', nodeId => {
      const el = document.getElementById(`node-${nodeId}`)
      const y = el.style.top.replace('px', '');
      const x = el.style.left.replace('px', '');
      const position: FMLPosition = {x: Number(x), y: Number(y)};

      const node = this.getNodeFromId(nodeId);
      if (isObj(node)) {
        this._updateObject(nodeId, node.data.obj.name, obj => obj.position = position)
      } else if (isRule(node)) {
        this._updateRule(nodeId, node.data.rule.name, rule => rule.position = position)
      }

      this._rerenderNodes()
    })


    this.on('connectionCreated', e => {
      const source: FMLDrawflowNode = this.getNodeFromId(e.output_id);
      const target: FMLDrawflowNode = this.getNodeFromId(e.input_id);
      const undo = () => this.removeSingleConnection(e.output_id, e.input_id, e.output_class, e.input_class);


      // node -> node
      if (isObj(source) && isObj(target)) {
        const sourceFieldIdx = getPortIdx(e.output_class);
        const targetFieldIdx = getPortIdx(e.input_class);

        const sourceNode = this.element.querySelector<HTMLElement>(`#node-${e.output_id} .output_${sourceFieldIdx}`)
        const targetNode = this.element.querySelector<HTMLElement>(`#node-${e.input_id} .input_${targetFieldIdx}`)


        const isSourceObject = source.data.obj.mode === 'object';
        const rule = new FMLStructureRule();
        rule.action = isSourceObject ? 'create' : 'copy';
        rule.name = `${rule.action}_${ID++}`;
        rule.sourceObject = source.data.obj.name;
        rule.sourceField = source.data.obj.fields[sourceFieldIdx - 1]?.name;
        rule.targetObject = target.data.obj.name;
        rule.targetField = target.data.obj.fields[targetFieldIdx - 1]?.name;
        this._fml.rules.push(rule)


        const midX = (sourceNode.getBoundingClientRect().left + targetNode.getBoundingClientRect().left) / 2;
        const midY = (sourceNode.getBoundingClientRect().top + targetNode.getBoundingClientRect().top) / 2;
        const font = getCanvasFont()
        const maxWidth = getTextWidth(rule.name, font)

        undo()
        this._createRuleNode(rule, {x: midX - maxWidth / 2, y: midY})
        this._createConnection(rule.sourceObject, rule.sourceField, rule.name, 1);
        this._createConnection(rule.name, 1, rule.targetObject, rule.targetField);
      }


      // rule -> rule
      if (isRule(source) && isRule(target)) {
        console.warn(`Connection forbidden: "${source.data.rule.name}" -> "${target.data.rule.name}"`)
        undo();
      }

      // rule -> node
      if (isRule(source) && isObj(target)) {
        const renderer = this.getRuleRenderer(source.data.rule.action);
        renderer.onOutputConnectionCreate(this, source, getPortIdx(e.output_class), target, getPortIdx(e.input_class))
      }

      // node -> rule
      if (isObj(source) && isRule(target)) {
        const renderer = this.getRuleRenderer(target.data.rule.action);
        renderer.onInputConnectionCreate(this, target, getPortIdx(e.input_class), source, getPortIdx(e.output_class))
      }
    });


    this.on('connectionRemoved', e => {
      const source: FMLDrawflowNode = this.getNodeFromId(e.output_id);
      const target: FMLDrawflowNode = this.getNodeFromId(e.input_id);

      // rule -> node
      if (isRule(source) && isObj(target)) {
        this._updateRule(source.id, source.data.rule.name, rule => {
          rule.targetObject = undefined;
          rule.targetField = undefined;
        })
      }
      // node -> rule
      if (isObj(source) && isRule(target)) {
        this._updateRule(target.id, target.data.rule.name, rule => {
          rule.sourceObject = undefined;
          rule.sourceField = undefined;
        })
      }
    })
  }


  public _rerenderNodes(): void {
    // fixme: performance issue

    Object.keys(this._fml.objects).forEach(name => {
      const {el} = this._getNodeElementByName(name)
      if (isDefined(el)) {
        const content = el.getElementsByClassName('drawflow_content_node')[0];
        content.innerHTML = this._fml.objects[name].html();
      }
    });

    this._fml.rules.forEach(rule => {
      const {el} = this._getNodeElementByName(rule.name)
      if (isDefined(el)) {
        const content = el.getElementsByClassName('drawflow_content_node')[0];
        content.innerHTML = this.getRuleRenderer(rule.action).render(rule)
      }
    })
  }


  /* Creator */

  public _createObjectNode(obj: FMLStructureObject, options?: {y?: number, x?: number, outputs?: number}): number {
    if (isDefined(this._getNodeId(obj.name))) {
      throw Error(`Object node with name "${obj.name}" is already created`)
    }


    const fieldCount = obj.fields.length;
    const inputs = {
      source: 0,
      target: fieldCount,
      object: fieldCount
    }[obj.mode];
    const outputs = options?.outputs ?? {
      source: fieldCount,
      target: 0,
      object: 1
    }[obj.mode];


    return this.addNode(
      obj.name,
      inputs, outputs,
      options?.x && !isNaN(options.x) ? options.x : 50, // x
      options?.y && !isNaN(options.y) ? options.y : 50, // y
      'node--with-title', {obj},
      obj.html(),
      false
    );
  }

  public _createRuleNode(rule: FMLStructureRule, options?: {y?: number, x?: number}): number {
    if (isDefined(this._getNodeId(rule.name))) {
      throw Error(`Rule node with name "${rule.name}" is already created`)
    }

    const isConstant = ['uuid'].includes(rule.action);
    const htmlRenderer = this.getRuleRenderer(rule.action)

    return this.addNode(
      rule.name,
      isConstant ? 0 : 1, 1,
      options?.x && !isNaN(options.x) ? options.x : 50, // x
      options?.y && !isNaN(options.y) ? options.y : 50, // y
      'node--rule', {rule},
      htmlRenderer.render(rule),
      false
    )
  }

  public _createConnection(
    source: string, sField: string | number,
    target: string, tField: string | number
  ) {
    const oIdx = typeof sField === 'string' ? this._fml.objects[source].getFieldIndex(sField) + 1 : sField
    const iIdx = typeof tField === 'string' ? this._fml.objects[target].getFieldIndex(tField) + 1 : tField

    try {
      this.addConnection(
        this._getNodeId(source), this._getNodeId(target),
        `output_${oIdx}`,
        `input_${iIdx}`,
      );
    } catch (e) {
      console.error(`Connection failed "${source}:${sField}" -> "${target}:${tField}"`)
    }
  };


  /* Layout */

  public _autoLayout() {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));
    dagreGraph.setGraph({rankdir: 'LR', align: 'UL', ranker: 'longest-path'});

    Object.keys(this._fml.objects).forEach(name => {
      const {el: {offsetWidth, offsetHeight}} = this._getNodeElementByName(name)
      dagreGraph.setNode(name, {
        width: offsetWidth,
        height: offsetHeight
      });
    });

    this._fml.rules.forEach(rule => {
      const {el: {offsetWidth, offsetHeight}} = this._getNodeElementByName(rule.name)
      dagreGraph.setNode(rule.name, {
        width: offsetWidth,
        height: offsetHeight
      });
      dagreGraph.setEdge(rule.sourceObject, rule.name);
      dagreGraph.setEdge(rule.name, rule.targetObject);
    });

    dagre.layout(dagreGraph);

    const setPosition = (name: string): {
      nodeId: number,
      x: number,
      y: number
    } => {
      const nodeWithPosition = dagreGraph.node(name);
      const {el, nodeId} = this._getNodeElementByName(name)
      const y = nodeWithPosition.y - el.offsetHeight / 2;
      const x = nodeWithPosition.x - el.offsetWidth / 2;

      el.style.top = y + "px"
      el.style.left = x + "px"
      this.updateConnectionNodes(`node-${nodeId}`)
      return {nodeId, y, x}
    }

    Object.keys(this._fml.objects).forEach(name => {
      const {nodeId, ...position} = setPosition(name)
      this._updateObject(nodeId, name, obj => obj.position = position);
    });

    this._fml.rules.forEach(rule => {
      const {nodeId, ...position} = setPosition(rule.name)
      this._updateRule(nodeId, rule.name, obj => obj.position = position);
    });
  }


  /* Utils */

  private _getNodeElementByName(name: string) {
    const nodeId = this._getNodeId(name);
    return {el: document.getElementById(`node-${nodeId}`), nodeId};
  }

  public _getNodeId(name) {
    return this.getNodesFromName(name)[0]
  };
}
