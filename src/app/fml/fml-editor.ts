import Drawflow, {DrawflowNode} from 'drawflow';
import {FMLPosition, FMLStructure, FMLStructureObject, FMLStructureRule} from './fml-structure';
import {isDefined, remove} from '@kodality-web/core-util';
import dagre from "dagre";
import {FMLDefaultRuleRenderer} from './rule-renderers/default.renderer';
import {getCanvasFont, getPortNumber, getTextWidth} from './fml.utils';
import {RULE_ID} from './rule-parsers/parser';
import {FMLAppendRuleRenderer} from './rule-renderers/append.renderer';
import {FMLRuleRenderer} from './rule-renderers/renderer';


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

export interface FMLDrawflowNode extends FMLDrawflowRuleNode, FMLDrawflowObjectNode {
  data: any
}


export class FMLEditor extends Drawflow {
  public _isObj = (n: DrawflowNode): n is FMLDrawflowObjectNode => 'obj' in n.data;
  public _isRule = (n: DrawflowNode): n is FMLDrawflowRuleNode => 'rule' in n.data;

  // object
  public _updateObject = (nodeId: number, name: string, fn: (obj: FMLStructureObject) => void): void => {
    const obj = this._fml.objects[name];
    fn(obj);
    this.updateNodeDataFromId(nodeId, {obj});
  };

  // rule
  public _updateRule = (nodeId: number, name: string, fn: (rule: FMLStructureRule) => void): void => {
    const rule = this._fml.rules.find(r => r.name === name);
    fn(rule);
    this.updateNodeDataFromId(nodeId, {rule});
  };


  // rule renderer
  private _getRuleRenderer = (action: string): FMLRuleRenderer => this.ruleRenderers.find(rr => rr.action === action) ?? new FMLDefaultRuleRenderer();
  private ruleRenderers = [
    new FMLAppendRuleRenderer()
  ];


  constructor(public _fml: FMLStructure, public element: HTMLElement, options?: {
    render?: object,
    parent?: object
  }) {
    super(element, options?.render, options?.parent);
    this.curvature = 0.4;


    this.on('nodeMoved', nodeId => {
      const el = document.getElementById(`node-${nodeId}`);
      const y = el.style.top.replace('px', '');
      const x = el.style.left.replace('px', '');
      const position: FMLPosition = {x: Number(x), y: Number(y)};

      const node = this.getNodeFromId(nodeId);
      if (this._isObj(node)) {
        this._updateObject(nodeId, node.data.obj.name, obj => obj.position = position);
      } else if (this._isRule(node)) {
        this._updateRule(nodeId, node.data.rule.name, rule => rule.position = position);
      }

      this._rerenderNodes();
    });


    this.on('nodeRemoved', nodeId => {
      Object.values(_fml.objects).forEach(o => {
        if (o['_nodeId'] === Number(nodeId)) {
          delete _fml.objects[o.name];
        }
      });

      _fml.rules.forEach(r => {
        if (r['_nodeId'] === Number(nodeId)) {
          remove(_fml.rules, r);
        }
      });
    });


    this.on('connectionCreated', e => {
      const source: FMLDrawflowNode = this.getNodeFromId(e.output_id);
      const target: FMLDrawflowNode = this.getNodeFromId(e.input_id);
      const undo = (): void => this.removeSingleConnection(e.output_id, e.input_id, e.output_class, e.input_class);


      // rule -> node
      if (this._isRule(source) && this._isObj(target)) {
        const renderer = this._getRuleRenderer(source.data.rule.action);
        renderer.onOutputConnectionCreate(this, source, getPortNumber(e.output_class), target, getPortNumber(e.input_class));
      }

      // node -> rule
      if (this._isObj(source) && this._isRule(target)) {
        const renderer = this._getRuleRenderer(target.data.rule.action);
        renderer.onInputConnectionCreate(this, target, getPortNumber(e.input_class), source, getPortNumber(e.output_class));
      }

      // rule -> rule
      if (this._isRule(source) && this._isRule(target)) {
        const sr = this._getRuleRenderer(source.data.rule.action);
        sr.onOutputConnectionCreate(this, source, getPortNumber(e.output_class), target, getPortNumber(e.input_class));

        const tr = this._getRuleRenderer(target.data.rule.action);
        tr.onInputConnectionCreate(this, target, getPortNumber(e.input_class), source, getPortNumber(e.output_class));
      }

      // node -> node
      if (this._isObj(source) && this._isObj(target)) {
        const sourceFieldIdx = getPortNumber(e.output_class);
        const targetFieldIdx = getPortNumber(e.input_class);

        // build objects
        const action = source.data.obj.mode === 'object' ? 'create' : 'copy';
        const rule = new FMLStructureRule();
        rule.name = `${action}#${RULE_ID.next()}`;
        rule.action = action;

        const sourceConn = _fml.newFMLConnection(source.data.obj.name, sourceFieldIdx - 1, rule.name, 0);
        const targetConn = _fml.newFMLConnection(rule.name, 0, target.data.obj.name, targetFieldIdx - 1,);


        // calculate position
        const getOffset = (n: HTMLElement, dir) => {
          const {top, left} = this._getOffsets();
          return {
            top: n.getBoundingClientRect().top - top,
            left: n.getBoundingClientRect().left - left
          }[dir];
        };

        const sourceOutputNode = this.element.querySelector<HTMLElement>(`#node-${e.output_id} .output_${sourceFieldIdx}`);
        const targetInputNode = this.element.querySelector<HTMLElement>(`#node-${e.input_id} .input_${targetFieldIdx}`);
        const midX = (getOffset(sourceOutputNode, 'left') + getOffset(targetInputNode, 'left')) / 2;
        const midY = (getOffset(sourceOutputNode, 'top') + getOffset(targetInputNode, 'top')) / 2;
        const font = getCanvasFont();
        const maxWidth = getTextWidth(rule.name, font);


        // propagate changes
        _fml.rules.push(rule);
        this._createRuleNode(rule, {x: midX - maxWidth / 2, y: midY});

        [sourceConn, targetConn].forEach(c => {
          _fml.putConnection(c);
          this._createConnection(c.sourceObject, c.sourceFieldIdx + 1, c.targetObject, c.targetFieldIdx + 1);
        });

        undo();
      }
    });


    this.on('connectionRemoved', e => {
      const source: FMLDrawflowNode = this.getNodeFromId(e.output_id);
      const target: FMLDrawflowNode = this.getNodeFromId(e.input_id);

      // node -> rule
      if (this._isObj(source) && this._isRule(target)) {
        const renderer = this._getRuleRenderer(target.data.rule.action);
        renderer.onInputConnectionRemove(this, target, getPortNumber(e.input_class), source, getPortNumber(e.output_class));
      }

      // rule -> node
      if (this._isRule(source) && this._isObj(target)) {
        const renderer = this._getRuleRenderer(source.data.rule.action);
        renderer.onOutputConnectionRemove(this, source, getPortNumber(e.output_class), target, getPortNumber(e.input_class));
      }

      // rule -> rule
      if (this._isRule(source) && this._isRule(target)) {
        const sr = this._getRuleRenderer(source.data.rule.action);
        sr.onOutputConnectionRemove(this, source, getPortNumber(e.output_class), target, getPortNumber(e.input_class));

        const tr = this._getRuleRenderer(target.data.rule.action);
        tr.onOutputConnectionRemove(this, target, getPortNumber(e.input_class), source, getPortNumber(e.output_class));
      }
    });
  }


  /* Creator */

  public _createObjectNode(obj: FMLStructureObject, options?: {y?: number, x?: number, outputs?: number}): number {
    if (isDefined(this._getNodeId(obj.name))) {
      throw Error(`Object node with name "${obj.name}" is already created`);
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


    const nodeId = this.addNode(
      obj.name,
      inputs, outputs,
      options?.x && !isNaN(options.x) ? options.x : 50, // x
      options?.y && !isNaN(options.y) ? options.y : 50, // y
      'node--with-title', {obj},
      obj.html(),
      false
    );

    this._updateObject(nodeId, obj.name, o => o['_nodeId'] = nodeId);
    return nodeId;
  }

  public _createRuleNode(rule: FMLStructureRule, options?: {y?: number, x?: number}): number {
    if (isDefined(this._getNodeId(rule.name))) {
      throw Error(`Rule node with name "${rule.name}" is already created`);
    }

    const isConstant = ['uuid'].includes(rule.action);
    const htmlRenderer = this._getRuleRenderer(rule.action);

    const nodeId = this.addNode(
      rule.name,
      isConstant ? 0 : 1, 1,
      options?.x && !isNaN(options.x) ? options.x : 50, // x
      options?.y && !isNaN(options.y) ? options.y : 50, // y
      'node--rule', {rule},
      htmlRenderer.render(rule),
      false
    );

    this._updateRule(nodeId, rule.name, r => r['_nodeId'] = nodeId);
    return nodeId;
  }

  public _createConnection(
    source: string,
    sourceField: string | number,
    target: string,
    targetField: string | number
  ): void {
    // field name OR port number same as field index + 1
    const oIdx = typeof sourceField === 'string' ? this._fml.objects[source].getFieldIndex(sourceField) + 1 : sourceField;
    const iIdx = typeof targetField === 'string' ? this._fml.objects[target].getFieldIndex(targetField) + 1 : targetField;

    try {
      this.addConnection(
        this._getNodeId(source), this._getNodeId(target),
        `output_${oIdx}`,
        `input_${iIdx}`,
      );
    } catch (e) {
      console.error(`Connection "${source}:${sourceField}" -> "${target}:${targetField}" failed!`);
    }
  }


  /* Layout */

  public _autoLayout(): void {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));
    dagreGraph.setGraph({rankdir: 'LR', align: 'UL', ranker: 'longest-path'});

    // objects
    Object.keys(this._fml.objects).forEach(name => {
      const {el} = this._getNodeElementByName(name);
      if (isDefined(el)) {
        dagreGraph.setNode(name, {
          width: el.offsetWidth,
          height: el.offsetHeight
        });
      }
    });

    // rules
    this._fml.rules.forEach(rule => {
      const {el} = this._getNodeElementByName(rule.name);
      if (isDefined(el)) {
        dagreGraph.setNode(rule.name, {
          width: el.offsetWidth,
          height: el.offsetHeight
        });
      }
    });

    // connections
    this._fml.connections.forEach(c => {
      dagreGraph.setEdge(c.sourceObject, c.targetObject);
    });

    dagre.layout(dagreGraph);


    const setHTMLPosition = (name: string): {nodeId: number, x: number, y: number} => {
      const {el, nodeId} = this._getNodeElementByName(name);
      const nodeWithPosition = dagreGraph.node(name);
      const y = nodeWithPosition.y - el.offsetHeight / 2;
      const x = nodeWithPosition.x - el.offsetWidth / 2;

      // hacky way to update position.
      // export: position should be saved in data and later transferred to node pos_x and pos_y values
      el.style.top = y + "px";
      el.style.left = x + "px";
      this.updateConnectionNodes(`node-${nodeId}`);

      return {nodeId, y, x};
    };

    Object.keys(this._fml.objects).forEach(name => {
      const {nodeId, ...position} = setHTMLPosition(name);
      this._updateObject(nodeId, name, obj => obj.position = position);
    });

    this._fml.rules.forEach(rule => {
      const {nodeId, ...position} = setHTMLPosition(rule.name);
      this._updateRule(nodeId, rule.name, obj => obj.position = position);
    });
  }

  public _rerenderNodes(): void {
    // fixme: performance issue

    Object.keys(this._fml.objects).forEach(name => {
      const {el} = this._getNodeElementByName(name);
      if (isDefined(el)) {
        const content = el.getElementsByClassName('drawflow_content_node')[0];
        content.innerHTML = this._fml.objects[name].html();
      }
    });

    this._fml.rules.forEach(rule => {
      const {el} = this._getNodeElementByName(rule.name);
      if (isDefined(el)) {
        const content = el.getElementsByClassName('drawflow_content_node')[0];
        content.innerHTML = this._getRuleRenderer(rule.action).render(rule);
      }
    });
  }

  /* Utils */

  private _getNodeElementByName(name: string) {
    const nodeId = this._getNodeId(name);
    return {el: document.getElementById(`node-${nodeId}`), nodeId};
  }

  public _getNodeByName(name): DrawflowNode {
    const nodeId = this._getNodeId(name);
    return this.getNodeFromId(nodeId);
  }

  public _getNodeId(name): number {
    return this.getNodesFromName(name)[0];
  }

  public _getOffsets(): {top: number, left: number} {
    const [_, x, y] = (this.element.firstElementChild as HTMLDivElement).style.transform.match(/translate\(([+\-\d]+)px, ([+\-\d]+)px\)/m) ?? [0, 0, 0];
    return {
      top: this.element.offsetTop + Number(y),
      left: this.element.offsetLeft + Number(x)
    };
  }
}
