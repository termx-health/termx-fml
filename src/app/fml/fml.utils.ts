import {FMLEditor} from './fml-editor';
import {FMLStructure} from './fml-structure';
import dagre from "dagre";

export function getTextWidth(text, font) {
  // re-use canvas object for better performance
  let canvas = getTextWidth['canvas'] || (getTextWidth['canvas'] = document.createElement("canvas"));
  const context = canvas.getContext("2d");
  context.font = font;
  const metrics = context.measureText(text);
  return metrics.width;
}

export function getCssStyle(element, prop) {
  return window.getComputedStyle(element, null).getPropertyValue(prop);
}

export function getCanvasFont(el = document.body) {
  const fontWeight = getCssStyle(el, 'font-weight') || 'normal';
  const fontSize = getCssStyle(el, 'font-size') || '16px';
  const fontFamily = getCssStyle(el, 'font-family') || 'Times New Roman';

  return `${fontWeight} ${fontSize} ${fontFamily}`;
}


export function getNodeElement(editor: FMLEditor, name: string) {
  const nodeId = editor._getNodeId(name);
  return {el: document.getElementById(`node-${nodeId}`), nodeId};
}

export function autoLayout(editor: FMLEditor, fml: FMLStructure) {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({rankdir: 'LR', align: 'UL', ranker: 'longest-path'});


  Object.keys(fml.objects).forEach(path => {
    const {el} = getNodeElement(editor, path)
    dagreGraph.setNode(path, {
      width: el.offsetWidth,
      height: el.offsetHeight
    });
  });

  fml.rules.forEach(rule => {
    const {el} = getNodeElement(editor, rule.name)
    dagreGraph.setNode(rule.name, {
      width: el.offsetWidth,
      height: el.offsetHeight
    });
    dagreGraph.setEdge(rule.sourceObject, rule.name);
    dagreGraph.setEdge(rule.name, rule.targetObject);
  });

  dagre.layout(dagreGraph);

  [...Object.keys(fml.objects), ...fml.rules.map(r => r.name)].forEach(path => {
    const nodeWithPosition = dagreGraph.node(path);
    const {el, nodeId} = getNodeElement(editor, path)
    el.style.top = (nodeWithPosition.y - el.offsetHeight / 2) + "px"
    el.style.left = (nodeWithPosition.x - el.offsetWidth / 2) + "px"
    editor.updateConnectionNodes(`node-${nodeId}`)
  });
}

export function setExpand(editor: FMLEditor, id: string, isExpanded: boolean): void {
  const node = editor.getNodeFromId(editor._getNodeId(id));

  const max = Math.max(Object.keys(node.inputs).length, Object.keys(node.outputs).length)

  const nodeEl = document.getElementById(`node-${node.id}`);
  const inputEls = nodeEl.getElementsByClassName('inputs').item(0).children
  const outputEls = nodeEl.getElementsByClassName('outputs').item(0).children
  const contentEls = nodeEl.getElementsByClassName('drawflow_content_node').item(0).children

  for (let i = 0; i < max; i++) {
    inputEls.item(i)?.classList.remove('hidden')
    outputEls.item(i)?.classList.remove('hidden');
    contentEls.item(i + 1).classList.remove('hidden')


    if (
      !node.inputs[`input_${i + 1}`]?.connections?.length &&
      !node.outputs[`output_${i + 1}`]?.connections?.length &&
      !isExpanded
    ) {
      inputEls.item(i)?.classList.add('hidden')
      outputEls.item(i)?.classList.add('hidden');
      contentEls.item(i + 1).classList.add('hidden')
    }
  }

  editor.updateConnectionNodes(`node-${node.id}`)
}
