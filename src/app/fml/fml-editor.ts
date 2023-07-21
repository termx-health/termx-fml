import Drawflow from 'drawflow';
import {FMLStructure} from './fml-structure';

export class FMLEditor extends Drawflow {
  constructor(private _fml: FMLStructure, element: HTMLElement, options?: {
    render?: object,
    parent?: object
  }) {
    super(element, options?.render, options?.parent);
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
