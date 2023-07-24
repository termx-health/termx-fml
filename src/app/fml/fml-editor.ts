import Drawflow from 'drawflow';
import {FMLStructure, FMLStructureObject, FMLStructureRule} from './fml-structure';
import {getCanvasFont, getTextWidth} from './fml.utils';
import {isDefined} from '@kodality-web/core-util';

export class FMLEditor extends Drawflow {
  constructor(private _fml: FMLStructure, private element: HTMLElement, options?: {
    render?: object,
    parent?: object
  }) {
    super(element, options?.render, options?.parent);
    this.curvature = 0.4

    this.on('connectionCreated', e => {
      const source = this.getNodeFromId(e.output_id)
      const target = this.getNodeFromId(e.input_id)
      const undo = () => this.removeSingleConnection(e.output_id, e.input_id, e.output_class, e.input_class);

      if ('obj' in source.data && 'obj' in target.data) {
        const srcObj = source.data.obj as FMLStructureObject;
        const trgObj = target.data.obj as FMLStructureObject;

        const sourceFieldIdx = Number(e.output_class.split("_")[1]);
        const targetFieldIdx = Number(e.input_class.split("_")[1]);

        const sourceNode = this.element.querySelector<HTMLElement>(`#node-${e.output_id} .output_${sourceFieldIdx}`)
        const targetNode = this.element.querySelector<HTMLElement>(`#node-${e.input_id} .input_${targetFieldIdx}`)

        const rule = new FMLStructureRule();
        rule.name = 'copy_' + this.getUuid();
        rule.action = 'copy';
        rule.sourceObject = srcObj.name;
        rule.sourceField = srcObj.fields[sourceFieldIdx - 1]?.name;
        rule.targetObject = trgObj.name;
        rule.targetField = trgObj.fields[targetFieldIdx - 1]?.name;
        this._fml.rules.push(rule)

        const midX = (sourceNode.getBoundingClientRect().left + targetNode.getBoundingClientRect().left) / 2;
        const midY = (sourceNode.getBoundingClientRect().top + targetNode.getBoundingClientRect().top) / 2;

        undo()

        const font = getCanvasFont()
        const maxWidth = getTextWidth(rule.name, font)

        this._createRuleNode(rule, {x: midX - maxWidth / 2, y: midY})
        this._createConnection(rule.sourceObject, rule.sourceField, rule.name, 1);
        this._createConnection(rule.name, 1, rule.targetObject, rule.targetField);
      }
    })
  }

  public _createObjectNode(obj: FMLStructureObject, options?: {y?: number, x?: number, outputs?: number}): number {
    if (isDefined(this._getNodeId(obj.name))) {
      throw Error(`Object node with name "${obj.name}" is already created`)
    }

    const isSource = obj.mode === 'source';

    const fieldCount = obj.fields.length;
    const inputs = isSource ? 0 : fieldCount;
    const outputs = isSource ? fieldCount : options?.outputs ?? 0;

    const getResourceHTML = (obj: FMLStructureObject) => `
      <div>
         <h5 class="node-title">${obj.name !== obj.resource ? `<b>${obj.name}</b> | ` : ''} ${obj.resource}</div>
         ${obj.fields.map(f => `<div style="height: 1.5rem; border-bottom: 1px solid var(--color-borders)">${f.name}</div>`).join('')}
      </div>
    `

    return this.addNode(
      obj.name,
      inputs, outputs,
      options?.x && !isNaN(options.x) ? options.x : 50, // x
      options?.y && !isNaN(options.y) ? options.y : 50, // y
      'node--with-title', {obj},
      getResourceHTML(obj),
      false
    );
  }

  public _createRuleNode(rule: FMLStructureRule, options?: {y?: number, x?: number, constant?: boolean}): number {
    if (isDefined(this._getNodeId(rule.name))) {
      throw Error(`Rule node with name "${rule.name}" is already created`)
    }

    return this.addNode(
      rule.name,
      options?.constant ? 0 : 1, 1,
      options?.x && !isNaN(options.x) ? options.x : 50, // x
      options?.y && !isNaN(options.y) ? options.y : 50, // y
      'node--rule', {rule},
      rule.name,
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
      throw e;
    }
  };
}
