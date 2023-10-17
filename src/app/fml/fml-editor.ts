import Drawflow, {DrawflowConnectionDetail, DrawflowNode} from 'drawflow';
import {FMLPosition, FMLStructure, FMLStructureEntityMode, FMLStructureGroup, FMLStructureObject, FMLStructureRule} from './fml-structure';
import {isDefined, isNil, remove} from '@kodality-web/core-util';
import dagre from "dagre";
import {asResourceVariable, fromPx, getPortNumber, renderExpand} from './fml.utils';
import {getRuleRenderer} from './rule/renderers/_renderers';
import {FMLStructureObjectRenderer} from './object/object-renderer';
import {plainToClass} from 'class-transformer';

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
    const obj = this._fmlGroup.objects[name];
    if (typeof fn === 'function') {
      fn(obj);
      this.updateNodeDataFromId(nodeId, {obj});
    } else {
      const _fn = plainToClass(FMLStructureObject, fn);
      this.updateNodeDataFromId(nodeId, {obj: _fn});
      this._fmlGroup.objects[name] = _fn;
    }
  };

  // rule
  public _updateRule = (nodeId: number, name: string, fn: FMLStructureRule | ((rule: FMLStructureRule) => void)): void => {
    const rule = this._fmlGroup.rules.find(r => r.name === name);
    if (typeof fn === 'function') {
      fn(rule);
      this.updateNodeDataFromId(nodeId, {rule});
    } else {
      const _fn = plainToClass(FMLStructureRule, fn);
      this.updateNodeDataFromId(nodeId, {rule: _fn});
      this._fmlGroup.rules.splice(this._fmlGroup.rules.indexOf(rule), 1, _fn);
    }
  };


  // meta
  public _initialized = false;

  public _ready(): void {
    this._initialized = true;
    this._rerenderNodes();
  }


  // Getters

  public get _fmlGroup(): FMLStructureGroup {
    return this._fml?.getGroup(this._groupName);
  }

  constructor(
    public _fml: FMLStructure,
    public _groupName: string,
    public element: HTMLElement,
    options?: {render?: object, parent?: object}
  ) {
    super(element, options?.render, options?.parent);
    this.curvature = 0.4;
    this.zoom_min = 0.3;
    this.zoom_max = 1.8;


    this.on('nodeMoved', nodeId => {
      const el = document.getElementById(`node-${nodeId}`);
      const position: FMLPosition = {
        x: fromPx(el.style.left),
        y: fromPx(el.style.top)
      };

      const node = this.getNodeFromId(nodeId);
      if (this._isObj(node)) {
        this._updateObject(nodeId, node.data.obj.name, obj => obj.position = position);
      } else if (this._isRule(node)) {
        this._updateRule(nodeId, node.data.rule.name, rule => rule.position = position);
      }

      this._rerenderNodes();
    });


    this.on('nodeRemoved', nodeId => {
      Object.values(this._fmlGroup.objects).forEach(o => {
        if (o._nodeId === Number(nodeId)) {
          delete this._fmlGroup.objects[o.name];
        }
      });

      this._fmlGroup.rules.forEach(r => {
        if (r._nodeId === Number(nodeId)) {
          remove(this._fmlGroup.rules, r);
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

        const conn = this._fmlGroup.newFMLConnection(source.data.obj.name, sourceFieldIdx - 1, target.data.obj.name, targetFieldIdx - 1);
        this._fmlGroup.putConnection(conn);
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

        this._fmlGroup.removeConnection(source.name, sourceFieldIdx - 1, target.name, targetFieldIdx - 1);
      }

      this._rerenderNodes();
    });


    const _removeNodeId = this.removeNodeId;
    this.removeNodeId = function (id: string): void {
      // const node = this.getNodeFromId(id.slice('node-'.length));
      return _removeNodeId.bind(this)(id);
    };
  }


  /* */

  public _updateGroupName(before: string, after: string): void {
    if (this._fml.isMainGroup(before)) {
      this._fml.mainGroupName = after;
    }

    const _group = this._fml.getGroup(before);
    _group.name = after;

    if (this._groupName === before) {
      this._groupName = after;
    }

    Object.values(this._fml.groups)
      .flatMap(g => g.rules)
      .filter(r => r.action === 'rulegroup')
      .forEach(rule => {
        rule.parameters
          .filter(p => p.value === before)
          .forEach(p => p.value = after);
      });

    this._rerenderNodes();
  }


  /* Creator */

  public _createObjectNode(obj: FMLStructureObject, options?: {y?: number, x?: number}): number {
    if (isDefined(this._getNodeId(obj.name))) {
      throw Error(`Object node with name "${obj.name}" is already created`);
    }

    const fieldCount = obj.fields.length;
    const inputs: { [k in Exclude<FMLStructureEntityMode, 'rule'>]: number } = {
      source: 0,
      target: fieldCount,
      object: fieldCount,
      element: 1,
      produced: 1
    };
    const outputs: { [k in Exclude<FMLStructureEntityMode, 'rule'>]: number } = {
      source: fieldCount,
      target: 0,
      object: 1,
      element: fieldCount,
      produced: 1
    };

    const nodeId = this.addNode(
      obj.name,
      inputs[obj.mode], outputs[obj.mode],
      options?.x && !isNaN(options.x) ? options.x : 50, // x
      options?.y && !isNaN(options.y) ? options.y : 50, // y
      `node--atom node--${obj.mode}`, {obj},
      '',
      false
    );

    this._updateObject(nodeId, obj.name, o => o._nodeId = nodeId);
    return nodeId;
  }

  public _createRuleNode(rule: FMLStructureRule, options?: {y?: number, x?: number}): number {
    if (isDefined(this._getNodeId(rule.name))) {
      throw Error(`Rule node with name "${rule.name}" is already created`);
    }

    const nodeId = this.addNode(
      rule.name,
      1, 1,
      options?.x && !isNaN(options.x) ? options.x : 50, // x
      options?.y && !isNaN(options.y) ? options.y : 50, // y
      `node--rule node--${rule.action}`, {rule},
      '',
      false
    );

    this._updateRule(nodeId, rule.name, r => r._nodeId = nodeId);
    getRuleRenderer(rule.action).init(this, rule);

    return nodeId;
  }

  public _createConnection(
    source: string,
    sourceField: string | number,
    target: string,
    targetField: string | number
  ): void {
    // field name OR port number same as field index + 1
    const oIdx = typeof sourceField === 'string' ? this._fmlGroup.objects[source].fieldIndex(sourceField) + 1 : sourceField;
    const iIdx = typeof targetField === 'string' ? this._fmlGroup.objects[target].fieldIndex(targetField) + 1 : targetField;

    try {
      this.addConnection(this._getNodeId(source), this._getNodeId(target), `output_${oIdx}`, `input_${iIdx}`);
    } catch (e) {
      console.error(`Connection "${source}:${sourceField}" -> "${target}:${targetField}" failed!`, e);
    }
  }


  /* Layout */

  public _autoLayout(): void {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));
    dagreGraph.setGraph({rankdir: 'LR', align: 'UL', ranker: 'longest-path', nodesep: 20, marginx: 20, marginy: 30});

    // objects
    Object.keys(this._fmlGroup.objects).forEach(name => {
      const {el} = this._getNodeElementByName(name);
      if (isDefined(el)) {
        dagreGraph.setNode(name, {
          width: el.offsetWidth,
          height: el.offsetHeight
        });
      }
    });

    // rules
    this._fmlGroup.rules.forEach(rule => {
      const {el} = this._getNodeElementByName(rule.name);
      if (isDefined(el)) {
        dagreGraph.setNode(rule.name, {
          width: el.offsetWidth,
          height: el.offsetHeight
        });
      }
    });

    // connections
    this._fmlGroup.connections.forEach(c => {
      dagreGraph.setEdge(c.sourceObject, c.targetObject);
    });

    dagre.layout(dagreGraph);


    const setHTMLPosition = (name: string): {nodeId: number, x: number, y: number} => {
      const {el} = this._getNodeElementByName(name);
      const nodeWithPosition = dagreGraph.node(name);
      const y = nodeWithPosition.y - el.offsetHeight / 2;
      const x = nodeWithPosition.x - el.offsetWidth / 2;
      return this._setHTMLPosition(name, x, y);
    };

    Object.keys(this._fmlGroup.objects).forEach(name => {
      const {nodeId, ...position} = setHTMLPosition(name);
      this._updateObject(nodeId, name, obj => obj.position = position);
    });

    this._fmlGroup.rules.forEach(rule => {
      const {nodeId, ...position} = setHTMLPosition(rule.name);
      this._updateRule(nodeId, rule.name, obj => obj.position = position);
    });
  }

  public _setHTMLPosition = (name: string, x: number, y: number): {nodeId: number, x: number, y: number} => {
    const position: FMLPosition = {x, y};
    const {el, nodeId} = this._getNodeElementByName(name);

    // hacky way to update position.
    // export: position should be saved in data and later transferred to node pos_x and pos_y values
    el.style.top = position.y + "px";
    el.style.left = position.x + "px";
    this.updateConnectionNodes(`node-${nodeId}`);

    // fixme: this part is called too many times?
    const node = this.getNodeFromId(nodeId);
    if (this._isObj(node)) {
      this._updateObject(nodeId, node.data.obj.name, obj => obj.position = position);
    } else if (this._isRule(node)) {
      this._updateRule(nodeId, node.data.rule.name, rule => rule.position = position);
    }

    return {nodeId, ...position};
  };

  public _rerenderNodes(): void {
    if (!this._initialized) {
      return;
    }


    // rerender objects
    Object.keys(this._fmlGroup.objects).forEach(name => {
      const {el, nodeId} = this._getNodeElementByName(name);
      if (isNil(el)) {
        return;
      }

      // update HTML content
      const content = el.getElementsByClassName('drawflow_content_node')[0];
      content.innerHTML = FMLStructureObjectRenderer.render(this, name);
      // recalculate connection positions
      this.updateConnectionNodes(`node-${nodeId}`);

      if (['object'].includes(this._fmlGroup.objects[name]?.mode)) {
        // highlight connections going from $this of current object
        Array.from(document.getElementsByClassName(`node_out_node-${nodeId} output_1`))
          .map(wrapper => wrapper.firstElementChild)
          .forEach((svg: SVGPathElement) => svg.style.setProperty('--stroke-color', 'var(--color-primary-5)'));
      }

      // expand
      renderExpand(this, name);
    });


    // rerender rules
    this._fmlGroup.rules.forEach(rule => {
      const {el, nodeId} = this._getNodeElementByName(rule.name);
      if (isNil(el)) {
        return;
      }

      // update HTML content
      const content = el.getElementsByClassName('drawflow_content_node')[0];
      content.innerHTML = getRuleRenderer(rule.action).render(this, rule);
      // recalculate connection positions
      this.updateConnectionNodes(`node-${nodeId}`);

      // expand
      renderExpand(this, rule.name);
    });


    // highlight ports that have any connection
    Object.values(this.drawflow.drawflow.Home.data).forEach(node => {
      const el = document.getElementById(`node-${node.id}`);

      Object.keys(node.inputs).forEach(k => {
        const inputEl = el.getElementsByClassName(k).item(0) as HTMLElement;
        inputEl.classList.remove('has-input-connection');

        if (node.inputs[k].connections?.length) {
          inputEl.classList.add('has-input-connection');
        }
      });

      if (this._isObj(node) && ['source', 'element'].includes(node.data.obj.mode)) {
        Object.keys(node.outputs).forEach(k => {
          const inputEl = el.getElementsByClassName(k).item(0) as HTMLElement;
          inputEl.classList.remove('has-output-connection');

          if (node.outputs[k].connections?.length) {
            inputEl.classList.add('has-output-connection');
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
    const el = this.element.firstElementChild as HTMLDivElement;
    const re = /translate\(([+\-\d].+)px, ([+\-\d.]+)px\)/m;
    const [_, x, y] = el.style.transform.match(re) ?? [0, 0, 0];

    // todo: take into account 'scale' factor
    return {
      top: this.element.offsetTop + Number(y),
      left: this.element.offsetLeft + Number(x)
    };
  }
}
