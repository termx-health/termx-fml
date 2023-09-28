import {ElementDefinition, StructureDefinition} from 'fhir/r5';
import {group} from '@kodality-web/core-util';

function traverseAndFlatten(currentNode: object, target: object, flattenedKey?: string): void {
  for (const key in currentNode) {
    // eslint-disable-next-line no-prototype-builtins
    if (currentNode.hasOwnProperty(key)) {
      let newKey;
      if (flattenedKey === undefined) {
        newKey = key;
      } else {
        newKey = flattenedKey + '.' + key;
      }

      const value = currentNode[key];
      if (typeof value === "object") {
        traverseAndFlatten(value, target, newKey);
      } else {
        target[newKey] = value;
      }
    }
  }
}

export function flatten(obj: object): object {
  const flattenedObject = {};
  traverseAndFlatten(obj, flattenedObject);
  return flattenedObject;
}

export function asStructureDefinition(name: string, obj: object): StructureDefinition {
  const flat = flatten(obj);
  const flatTransformed: Record<string, ElementDefinition> = group(Object.keys(flat), k => k, k => ({
    id: `${name}.${k}`,
    path: `${name}.${k}`,
    type: [{code: flat[k]}]
  }));
  const map: Omit<StructureDefinition, 'resourceType' | 'abstract' | 'kind' | 'name' | 'status'> = {
    id: name,
    type: name,
    url: `http://tx.test.com/${name}`,
    snapshot: {
      element: [
        {id: name, path: name},
        ...Object.values(flatTransformed)
      ]
    }
  };
  return map as StructureDefinition;
};
