import {FMLEditor} from './fml-editor';


/* FML  */

export function setExpand(editor: FMLEditor, id: string, isExpanded: boolean): void {
  const node = editor.getNodeFromId(editor._getNodeId(id));

  const max = Math.max(Object.keys(node.inputs).length, Object.keys(node.outputs).length);

  const nodeEl = document.getElementById(`node-${node.id}`);
  const inputEls = nodeEl.getElementsByClassName('inputs').item(0).children;
  const outputEls = nodeEl.getElementsByClassName('outputs').item(0).children;
  const contentEls = nodeEl.getElementsByClassName('drawflow_content_node').item(0).children;

  for (let i = 0; i < max; i++) {
    inputEls.item(i)?.classList.remove('hidden');
    outputEls.item(i)?.classList.remove('hidden');
    contentEls.item(i + 1).classList.remove('hidden');

    if (
      !node.inputs[`input_${i + 1}`]?.connections?.length &&
      !node.outputs[`output_${i + 1}`]?.connections?.length &&
      !isExpanded
    ) {
      inputEls.item(i)?.classList.add('hidden');
      outputEls.item(i)?.classList.add('hidden');
      contentEls.item(i + 1).classList.add('hidden');
    }
  }

  editor.updateConnectionNodes(`node-${node.id}`);
}


export function getPortNumber(str: string): number {
  return Number(str.split("_")[1]);
}


/* Sequence */

export const SEQUENCE = {
  current: 0,
  next: function () {
    return ++this.current;
  }
};

export const asResourceVariable = (name: string): string => {
  return `${name}#${SEQUENCE.next()}`;
};


/* String */

export const substringBeforeLast = (str: string, sep: string): string => {
  return str.includes(sep) ? str.slice(0, str.lastIndexOf(sep)) : str;
};

export const substringAfterLast = (str: string, sep: string): string => {
  return str.includes(sep) ? str.slice(str.lastIndexOf(sep) + 1) : str;
};

export const getAlphabet = (): string[] => {
  const alpha = Array.from(Array(26)).map((e, i) => i + 65);
  return alpha.map((x) => String.fromCharCode(x));
}
