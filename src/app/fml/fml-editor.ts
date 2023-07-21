import Drawflow from 'drawflow';
import {FMLStructure, FMLStructureObject, FMLStructureRule} from './fml-structure';

export class FMLEditor extends Drawflow {
  constructor(private _fml: FMLStructure, element: HTMLElement, options?: {
    render?: object,
    parent?: object
  }) {
    super(element, options?.render, options?.parent);
  }

  public _createObjectNode(obj: FMLStructureObject, options?: {viewportWidth?: number}): number {
    const resourceName = obj.resource
    const isSource = obj.mode === 'source';

    const fieldCount = obj.fields.length;
    const inputs = isSource ? 0 : fieldCount;
    const outputs = isSource ? fieldCount : 0;

    const getResourceHTML = (obj: FMLStructureObject) => `
      <div>
         <div class="node-title">${obj.resource}</div>
        ${obj.fields.map(f => `<div style="height: 1.5rem; border-bottom: 1px solid var(--color-borders)">${f}</div>`).join('')}
      </div>
    `

    return this.addNode(
      resourceName,
      inputs, outputs,
      isSource ? 100 : options?.viewportWidth ? options.viewportWidth - 500 : 800, // x
      50, // y
      'node--with-title', {obj},
      getResourceHTML(obj),
      false
    );
  }

  public _createRuleNode(rule: FMLStructureRule, options?: {viewportWidth?: number, top?: number}): number {
    console.log(options?.top)
    return this.addNode(
      rule.name,
      1, 1,
      (options?.viewportWidth ? options.viewportWidth - 200 : 800) / 2, // x
      25 + (options?.top && !isNaN(options.top) ? options.top : 50), // y
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
      console.error(`Connection failed "${source}.${sField}" -> "${target}.${tField}"`)
      throw e;
    }
  };
}
