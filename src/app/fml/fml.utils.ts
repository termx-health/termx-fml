import {FMLEditor} from './fml-editor';


/* FML  */

export function renderExpand(editor: FMLEditor, name: string): void {
  const {el, nodeId} = editor._getNodeElementByName(name);
  const node = editor.getNodeFromId(nodeId);
  const isExpanded = editor._isObj(node) ? node.data.obj.expanded : editor._isRule(node) ? node.data.rule.expanded : true;

  const inputs = el.getElementsByClassName('inputs').item(0).children;
  const outputs = el.getElementsByClassName('outputs').item(0).children;
  const contents = el.getElementsByClassName('drawflow_content_node').item(0).children;

  const max = Math.max(
    Object.keys(node.inputs).length,
    Object.keys(node.outputs).length
  );

  for (let i = 0; i < max; i++) {
    inputs.item(i)?.classList.remove('hidden');
    outputs.item(i)?.classList.remove('hidden');
    contents.item(i + 1)?.classList.remove('hidden');

    if (
      !node.inputs[`input_${i + 1}`]?.connections?.length &&
      !node.outputs[`output_${i + 1}`]?.connections?.length &&
      !isExpanded
    ) {
      inputs.item(i)?.classList.add('hidden');
      outputs.item(i)?.classList.add('hidden');
      contents.item(i + 1)?.classList.add('hidden');
    }
  }

  if (editor._isRule(node)) {
    const nextSibling = el.getElementsByClassName('node-header').item(0)?.nextElementSibling;
    nextSibling?.classList.remove('hidden');
    if (!isExpanded) {
      nextSibling?.classList.add('hidden');
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

export const VARIABLE_SEP = '#';
export const asResourceVariable = (name: string): string => {
  return `${name}${VARIABLE_SEP}${SEQUENCE.next()}`;
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
