import {FMLEditor} from './fml-editor';
import {FMLStructureConnection, FMLStructureObject} from './fml-structure';
import {Bundle, StructureDefinition} from 'fhir/r5';
import {isNil} from '@kodality-web/core-util';

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


/* FML editor  */

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


/* FML structure */

export function newFMLConnection(source: string, sourceIdx: number, target: string, targetIdx: number): FMLStructureConnection {
  const c = new FMLStructureConnection();
  c.sourceObject = source;
  c.sourceFieldIdx = sourceIdx;
  c.targetObject = target;
  c.targetFieldIdx = targetIdx;
  return c;
}

/* fixme: move to FMLStructure as class method? */
export function newFMLObject(bundle: Bundle<StructureDefinition>, resource: string, path: string, mode: string): FMLStructureObject {
  if (isNil(resource)) {
    throw Error(`Resource name is missing for the "${path}"`);
  }

  // true => assume resource's definition is described within the structure definition
  const inlineDefinition = mode === 'object' && path === resource;

  // try to find resource's structure definition
  const structureDefinition = findStructureDefinition(bundle, resource)
  if (isNil(structureDefinition)) {
    throw Error(`StructureDefinition for the "${resource}" not found!`)
  } else if (isNil(structureDefinition.snapshot)) {
    throw Error(`Snapshot is missing in the StructureDefinition "${resource}"!`)
  }

  let elements = structureDefinition.snapshot.element;
  if (inlineDefinition) {
    elements = elements.filter(el => el.path.startsWith(path));
  }

  const selfDefinition = elements[0];
  // fixme: provide type as an argument? currently take the first one
  const selfResourceType = selfDefinition.type?.[0].code ?? selfDefinition.id;
  const selfFields = elements.slice(1);

  // double check whether inline definition assumption was correct
  if (inlineDefinition && !isBackboneElement(selfResourceType)) {
    // self definition's element MUST be the BackboneElement, but if you got here, it is not!
    return newFMLObject(bundle, selfResourceType, path, mode)
  }

  if (selfDefinition.type?.length > 1) {
    // fixme: as for now, warn about multiple types, see fixme above
    console.warn(`Self definition "${selfDefinition.id}" has multiple types, using first`)
  }

  const o = new FMLStructureObject()
  o.element = selfDefinition;
  o.resource = selfResourceType;
  o.name = path
  o.mode = mode;
  o.fields = selfFields.map(e => ({
    name: e.path.substring(selfDefinition.id.length + 1).split("[x]")[0],  // fixme: wtf [x] part? could be done differently?
    types: e.type?.map(t => t.code) ?? [],
    multiple: e.max !== '1',
    required: e.min === 1
  }))

  return o;
}

export function findStructureDefinition(bundle: Bundle<StructureDefinition>, anyPath: string): StructureDefinition {
  // Resource.whatever.element (anyPath) => Resource (base)
  const base = anyPath.includes('.')
    ? anyPath.slice(0, anyPath.indexOf('.'))
    : anyPath;

  return bundle.entry
    .map(e => e.resource)
    .find(e => e.id === base)
}

export function isBackboneElement(resource: string): boolean {
  return ['BackboneElement', 'Element'].includes(resource);
}

