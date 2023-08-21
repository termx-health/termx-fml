import Drawflow, {DrawflowConnectionDetail, DrawflowNode} from 'drawflow';
import {FMLPosition, FMLStructure, FMLStructureGroup, FMLStructureObject, FMLStructureObjectRenderer, FMLStructureRule} from './fml-structure';
import {isDefined, remove} from '@kodality-web/core-util';
import dagre from "dagre";
import {asResourceVariable, getPortNumber} from './fml.utils';
import {getRuleRenderer} from './rule-renderers/_renderers';

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
  public _updateObject = (nodeId: number, name: string, fn: FMLStructureObject | ((obj: FMLStructureObject) => void)): void => {
    const obj = this._fml.objects[name];
    if (typeof fn === 'function') {
      fn(obj);
      this.updateNodeDataFromId(nodeId, {obj});
    } else {
      this.updateNodeDataFromId(nodeId, {obj: fn});
      this._fml.objects[name] = fn;
    }
  };

  // rule
  public _updateRule = (nodeId: number, name: string, fn: FMLStructureRule | ((rule: FMLStructureRule) => void)): void => {
    const rule = this._fml.rules.find(r => r.name === name);
    if (typeof fn === 'function') {
      fn(rule);
      this.updateNodeDataFromId(nodeId, {rule});
    } else {
      this.updateNodeDataFromId(nodeId, {rule: fn});
      this._fml.rules.splice(this._fml.rules.indexOf(rule), 1, fn);
    }
  };


  // meta
  public _initialized = false;

  public _ready(): void {
    this._initialized = true;
    this._rerenderNodes();
  }

  public get _fml(): FMLStructure {
    return this._fmls?.[this._selectedFml];
  }

  constructor(
    public _fmls: FMLStructureGroup,
    public _selectedFml: string,
    public element: HTMLElement,
    options?: {render?: object, parent?: object}
  ) {
    super(element, options?.render, options?.parent);
    this.curvature = 0.4;

    this.on('nodeCreated', event => event);

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
      Object.values(this._fml.objects).forEach(o => {
        if (o['_nodeId'] === Number(nodeId)) {
          delete this._fml.objects[o.name];
        }
      });

      this._fml.rules.forEach(r => {
        if (r['_nodeId'] === Number(nodeId)) {
          remove(this._fml.rules, r);
        }
      });
    });


    this.on('connectionCreated', e => {
      const source: FMLDrawflowNode = this.getNodeFromId(e.output_id);
      const target: FMLDrawflowNode = this.getNodeFromId(e.input_id);

      // rule -> *
      if (this._isRule(source)) {
        const renderer = getRuleRenderer(source.data.rule.action);
        renderer.onOutputConnectionCreate(this, source, getPortNumber(e.output_class), target, getPortNumber(e.input_class));
      }

      // * -> rule
      if (this._isRule(target)) {
        const renderer = getRuleRenderer(target.data.rule.action);
        renderer.onInputConnectionCreate(this, target, getPortNumber(e.input_class), source, getPortNumber(e.output_class));
      }

      // node -> node
      if (this._isObj(source) && this._isObj(target)) {
        const sourceFieldIdx = getPortNumber(e.output_class);
        const targetFieldIdx = getPortNumber(e.input_class);

        // build objects
        const action = source.data.obj.mode === 'object' ? 'create' : 'copy';
        const rule = new FMLStructureRule();
        rule.name = asResourceVariable(action);
        rule.action = action;

        const conn = this._fml.newFMLConnection(source.data.obj.name, sourceFieldIdx - 1, target.data.obj.name, targetFieldIdx - 1);
        this._fml.putConnection(conn);
        this._createConnection(conn.sourceObject, conn.sourceFieldIdx + 1, conn.targetObject, conn.targetFieldIdx + 1);

      }

      this._rerenderNodes();
    });


    this.on('connectionRemoved', e => {
      const source: FMLDrawflowNode = this.getNodeFromId(e.output_id);
      const target: FMLDrawflowNode = this.getNodeFromId(e.input_id);

      // rule -> *
      if (this._isRule(source)) {
        const renderer = getRuleRenderer(source.data.rule.action);
        renderer.onOutputConnectionRemove(this, source, getPortNumber(e.output_class), target, getPortNumber(e.input_class));
      }

      // * -> rule
      if (this._isRule(target)) {
        const renderer = getRuleRenderer(target.data.rule.action);
        renderer.onInputConnectionRemove(this, target, getPortNumber(e.input_class), source, getPortNumber(e.output_class));
      }

      // node -> node
      if (this._isObj(source) && this._isObj(target)) {
        const sourceFieldIdx = getPortNumber(e.output_class);
        const targetFieldIdx = getPortNumber(e.input_class);

        this._fml.removeConnection(source.name, sourceFieldIdx - 1, target.name, targetFieldIdx - 1);
      }

      this._rerenderNodes();
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
      object: fieldCount,
      element: 1
    }[obj.mode];
    const outputs = options?.outputs ?? {
      source: fieldCount,
      target: 0,
      object: 1,
      element: fieldCount,
    }[obj.mode];


    const nodeId = this.addNode(
      obj.name,
      inputs, outputs,
      options?.x && !isNaN(options.x) ? options.x : 50, // x
      options?.y && !isNaN(options.y) ? options.y : 50, // y
      'node--with-title', {obj},
      '',
      false
    );

    this._updateObject(nodeId, obj.name, o => o['_nodeId'] = nodeId);
    return nodeId;
  }

  public _createRuleNode(rule: FMLStructureRule, options?: {y?: number, x?: number, inputs?: number, outputs?: number}): number {
    if (isDefined(this._getNodeId(rule.name))) {
      throw Error(`Rule node with name "${rule.name}" is already created`);
    }

    const nodeId = this.addNode(
      rule.name,
      options?.inputs ?? 1, options?.outputs ?? 1,
      options?.x && !isNaN(options.x) ? options.x : 50, // x
      options?.y && !isNaN(options.y) ? options.y : 50, // y
      'node--rule', {rule},
      '',
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
    const oIdx = typeof sourceField === 'string' ? this._fml.objects[source].fieldIndex(sourceField) + 1 : sourceField;
    const iIdx = typeof targetField === 'string' ? this._fml.objects[target].fieldIndex(targetField) + 1 : targetField;

    try {
      this.addConnection(
        this._getNodeId(source), this._getNodeId(target),
        `output_${oIdx}`,
        `input_${iIdx}`,
      );
    } catch (e) {
      console.error(`Connection "${source}:${sourceField}" -> "${target}:${targetField}" failed!`, e);
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
    if (!this._initialized) {
      return;
    }

    Object.keys(this._fml.objects).forEach(name => {
      const {el, nodeId} = this._getNodeElementByName(name);
      if (isDefined(el)) {
        const content = el.getElementsByClassName('drawflow_content_node')[0];
        content.innerHTML = FMLStructureObjectRenderer.html(this._fml, this._fml.objects[name]);
        this.updateConnectionNodes(`node-${nodeId}`);


        Array.from(document.getElementsByClassName(`node_out_node-${nodeId} output_1`)).forEach(svg => {
          (svg.firstElementChild as SVGPathElement).style.setProperty('--stroke-color', 'var(--color-borders)');
        });
      }
    });

    this._fml.rules.forEach(rule => {
      const {el, nodeId} = this._getNodeElementByName(rule.name);
      if (isDefined(el)) {
        const content = el.getElementsByClassName('drawflow_content_node')[0];
        content.innerHTML = getRuleRenderer(rule.action).render(this, rule);
        this.updateConnectionNodes(`node-${nodeId}`);
      }
    });

    Object.values(this.drawflow.drawflow.Home.data).forEach(node => {
      const el = document.getElementById(`node-${node.id}`);

      Object.keys(node.inputs).forEach(k => {
        const inputEl = el.getElementsByClassName(k).item(0) as HTMLElement;
        inputEl.style.background = '';
        inputEl.style.borderColor = '';

        if (node.inputs[k].connections?.length) {
          inputEl.style.background = 'var(--color-green-0)';
          inputEl.style.borderColor = 'var(--color-green-7)';
        }
      });

      if (this._isObj(node) && ['source', 'element'].includes(node.data.obj.mode)) {
        Object.keys(node.outputs).forEach(k => {
          const inputEl = el.getElementsByClassName(k).item(0) as HTMLElement;
          inputEl.style.background = '';
          inputEl.style.borderColor = '';

          if (node.outputs[k].connections?.length) {
            inputEl.style.background = 'var(--color-primary-1)';
            inputEl.style.borderColor = 'var(--color-primary-6)';
          }
        });
      }
    });
  }

  /* Utils */

  public _getNodeInputConnections(id: number, port: number): DrawflowConnectionDetail[] {
    return this.getNodeFromId(id).inputs[`input_${port}`]?.connections ?? [];
  }

  public _getNodeOutputConnections(id: number, port: number): DrawflowConnectionDetail[] {
    return this.getNodeFromId(id).outputs[`output_${port}`]?.connections ?? [];
  }

  public _getNodeElementByName(name: string) {
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
