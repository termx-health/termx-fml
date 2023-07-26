import Drawflow, {DrawflowNode} from 'drawflow';
import {FMLStructure, FMLStructureObject, FMLStructureRule} from './fml-structure';
import {getCanvasFont, getTextWidth} from './fml.utils';
import {isDefined} from '@kodality-web/core-util';
import dagre from "dagre";

type FMLDrawflowNode = DrawflowNode & {
  data: {
    obj?: FMLStructureObject,
    rule?: FMLStructureRule
  }
}

let ID = 42;

const getClassIdx = (str: string): number => {
  return Number(str.split("_")[1])
}

export class FMLEditor extends Drawflow {
  constructor(private _fml: FMLStructure, private element: HTMLElement, options?: {
    render?: object,
    parent?: object
  }) {
    super(element, options?.render, options?.parent);
    this.curvature = 0.4

    this.on('connectionCreated', e => {
      const sourceNode: FMLDrawflowNode = this.getNodeFromId(e.output_id);
      const targetNode: FMLDrawflowNode = this.getNodeFromId(e.input_id);


      if ('rule' in sourceNode.data) {
        const targetFieldIdx = Number(e.input_class.split("_")[1]);

        const rule = this._fml.rules.find(r => r.name === sourceNode.data.rule.name);
        rule.targetObject = targetNode.data.obj.path
        rule.targetField = targetNode.data.obj.fields[targetFieldIdx - 1].name


        this.updateNodeDataFromId(sourceNode.id, {rule})
      }
    });


    this.on('connectionCreated', e => {
      const source: FMLDrawflowNode = this.getNodeFromId(e.output_id)
      const target: FMLDrawflowNode = this.getNodeFromId(e.input_id)
      const undo = () => this.removeSingleConnection(e.output_id, e.input_id, e.output_class, e.input_class);

      if ('obj' in source.data && 'obj' in target.data) {
        const sourceFieldIdx = getClassIdx(e.output_class);
        const targetFieldIdx = getClassIdx(e.input_class);

        const sourceNode = this.element.querySelector<HTMLElement>(`#node-${e.output_id} .output_${sourceFieldIdx}`)
        const targetNode = this.element.querySelector<HTMLElement>(`#node-${e.input_id} .input_${targetFieldIdx}`)

        const rule = new FMLStructureRule();
        rule.name = 'copy_' + ID++;
        rule.action = 'copy';
        rule.sourceObject = source.data.obj.path;
        rule.sourceField = source.data.obj.fields[sourceFieldIdx - 1]?.name;
        rule.targetObject = target.data.obj.path;
        rule.targetField = target.data.obj.fields[targetFieldIdx - 1]?.name;
        rule.html = () => `copy`
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
    })
  }

  public _createObjectNode(obj: FMLStructureObject, options?: {y?: number, x?: number, outputs?: number}): number {
    if (isDefined(this._getNodeId(obj.path))) {
      throw Error(`Object node with path "${obj.path}" is already created`)
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
      obj.path,
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

    const isConstant = ['uuid'].includes(rule.action)

    return this.addNode(
      rule.name,
      isConstant ? 0 : 1, 1,
      options?.x && !isNaN(options.x) ? options.x : 50, // x
      options?.y && !isNaN(options.y) ? options.y : 50, // y
      'node--rule', {rule},
      rule.html(),
      false
    )
  }

  public _getNodeId(name) {
    return this.getNodesFromName(name)[0]
  };

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


  private _getNodeElement(editor: FMLEditor, name: string) {
    const nodeId = editor._getNodeId(name);
    return {el: document.getElementById(`node-${nodeId}`), nodeId};
  }

  public _autoLayout() {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));
    dagreGraph.setGraph({rankdir: 'LR', align: 'UL', ranker: 'longest-path'});

    Object.keys(this._fml.objects).forEach(path => {
      const {el} = this._getNodeElement(this, path)
      dagreGraph.setNode(path, {
        width: el.offsetWidth,
        height: el.offsetHeight
      });
    });

    this._fml.rules.forEach(rule => {
      const {el} = this._getNodeElement(this, rule.name)
      dagreGraph.setNode(rule.name, {
        width: el.offsetWidth,
        height: el.offsetHeight
      });
      dagreGraph.setEdge(rule.sourceObject, rule.name);
      dagreGraph.setEdge(rule.name, rule.targetObject);
    });

    dagre.layout(dagreGraph);

    [...Object.keys(this._fml.objects), ...this._fml.rules.map(r => r.name)].forEach(path => {
      const nodeWithPosition = dagreGraph.node(path);
      const {el, nodeId} = this._getNodeElement(this, path)
      el.style.top = (nodeWithPosition.y - el.offsetHeight / 2) + "px"
      el.style.left = (nodeWithPosition.x - el.offsetWidth / 2) + "px"
      this.updateConnectionNodes(`node-${nodeId}`)
    });
  }
}
