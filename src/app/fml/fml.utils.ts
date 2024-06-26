import {FMLEditor} from './fml-editor';
import {FMLStructureGroup, FMLStructureObject} from './fml-structure';
import {group, isDefined, isNil} from '@kodality-web/core-util';
import {StructureMapGroupRule, StructureMapGroupRuleSource} from 'fhir/r5';
import {FMLGraph} from './fml-graph';

/* StructureMap */

export interface VariableHolder {
  vars: Record<string, string>,
  toVar: (name: string) => string,
  asVar: (name: string, raw?: boolean) => string
}

export function variableHolder(inputObjects: FMLStructureObject[] = []): VariableHolder {
  const vars = group(inputObjects, o => o.name, o => normalize(o.name));
  const alphabet = getAlphabet().map(el => el.toLowerCase());

  let seq = -1;
  const nextVar = (): string => {
    seq++;
    const times = Math.floor(seq / 26);
    return [...Array.from({length: times - 1}).fill(0), seq % 26].map(i => alphabet[i as number]).join('');
  };

  return {
    vars,
    toVar: (name: string): string => {
      return vars[name] = nextVar();
    },
    asVar: (name: string, raw = false): string => {
      return raw
        ? vars[name] ?? name
        : normalize(vars[name] ?? name);
    }
  };
}

export const nestRules = (smRules: StructureMapGroupRule[]): {
  main: StructureMapGroupRule,
  mainOptimized: StructureMapGroupRule,
  last: StructureMapGroupRule
} => {
  let _smRule: StructureMapGroupRule;
  smRules.forEach(r => {
    if (isDefined(_smRule)) {
      _smRule.rule.push(r);
    }
    _smRule = r;
  });

  const _main = smRules[0];
  const _mainOptimized = structuredClone(_main);
  optimizeNestRules(_mainOptimized);

  return {
    main: _main,
    mainOptimized: _mainOptimized,
    last: _smRule
  };
};

export const optimizeNestRules = (smRule: StructureMapGroupRule, ctx?: StructureMapGroupRuleSource): void => {
  const src = requireSingle(smRule.source, `${smRule.name} insufficient amount of sources`);
  const tgt = getSingle(smRule.target, `${smRule.name} too many targets`);

  ctx ??= src;

  if (isDefined(tgt)) {
    if (isNil(src.element)) {
      // {context: 'rule_12', variable: 'a'}
      // if src doesn't have element, it means it came from another rule
      // substitute parameters with src.context
      tgt.parameter
        .filter(p => p.valueId === src.variable)
        .forEach(p => p.valueId = src.context);

      src.context = ctx?.context;
      src.variable = undefined;
    } else {
      ctx = src;
    }

    if (isNil(tgt.element)) {
      // tgt.element does not exist when connection is made with another rule
      tgt.context = undefined;
    }
  }

  smRule.rule?.forEach(r => optimizeNestRules(r, ctx));
};


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

  for (let i = max > 1 ? 0 : 1; i < max; i++) {
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
    const els = Array.from(el.getElementsByClassName('hideable'));
    els.forEach(el => el.classList.remove('hidden'));
    if (!isExpanded) {
      els.forEach(el => el.classList.add('hidden'));
    }
  }

  editor.updateConnectionNodes(`node-${node.id}`);
}

export function renderPath(editor: FMLEditor, id?: number): void {
  const nodes = Array.from(document.getElementsByClassName('drawflow-node')) as HTMLElement[];
  const connections = Array.from(document.getElementsByClassName('connection')) as HTMLElement[];

  const hide = (el: HTMLElement) => {
    el.style.filter = 'opacity(0.6) grayscale(1)';
  };
  const display = (el: HTMLElement) => {
    el.style.filter = '';
  };


  const displaySources = (name: string): void => {
    const {el, nodeId} = editor._getNodeElementByName(name);
    display(el);

    editor._fmlGroup.getSources(name).forEach(s => {
      const connCls = `connection node_in_node-${nodeId} node_out_node-${editor._getNodeByName(s.sourceObject).id} `;
      const inputConns = Array.from(document.getElementsByClassName(connCls)) as HTMLElement[];

      inputConns.forEach(e => {
        display(e);

        const outNodeId = Array.from(e.classList).find(n => n.startsWith('node_out_node-')).slice('node_out_node-'.length);
        const outNode = editor.getNodeFromId(outNodeId);
        displaySources(outNode.name);
      });
    });
  };


  const displayTargets = (name: string): void => {
    const {el, nodeId} = editor._getNodeElementByName(name);
    display(el);

    editor._fmlGroup.getTargets(name).forEach(s => {
      const connCls = `connection node_in_node-${editor._getNodeByName(s.targetObject).id} node_out_node-${nodeId} `;
      const outputConns = Array.from(document.getElementsByClassName(connCls)) as HTMLElement[];

      outputConns.forEach(e => {
        display(e);
      });
    });
  };


  if (isNil(id)) {
    [...nodes, ...connections].forEach(el => display(el));
    return;
  }

  try {
    [...nodes, ...connections].forEach(el => hide(el));
    displaySources(editor.getNodeFromId(id).name);
    displayTargets(editor.getNodeFromId(id).name);
  } catch (e) {
    console.error("Couldn't highlight node path, reverting", e);
    [...nodes, ...connections].forEach(el => display(el));
  }
}

export function getPortNumber(str: string): number {
  return Number(str.split("_")[1]);
}

export function formatFML(fml: string): string {
  // const lines = fml
  //   .replaceAll(',  ', ',\n    ')
  //   .replaceAll(' -> ', ' ->\n    ')

  return fml;

  /*
    todo: please somehow make it work

    const render = (offset: number, l: string): string => '  '.repeat(Math.max(0, offset)) + l;

    ...
      .split('\n')
      .map(l => l.trim());

    const ruleStart = [];
    let offset = 0;
    return lines.map(l => {
      if (l.startsWith('group')) {
        offset = 1;
        return render(0, l);
      }
      if (l.includes('}')) {
        offset--;
      }
      if (l.endsWith('->') || l.endsWith('then {')) {
        ruleStart.push(offset);
        return render(offset++, l);
      }
      if (l.includes('then') && l.includes(';')) {
        const t = render(offset, l);
        offset = ruleStart.pop() ?? 1;
        return t;
      }
      if (l.endsWith('";')) {
        const pop = ruleStart.pop();
        if (l.startsWith('}')) {
          offset = pop;
          return render(offset, l);
        }

        const t = render(offset, l);
        offset = pop;
        return t;
      }
      return render(offset, l);
    }).join("\n");*/
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
};

export function join(els: string[], sep: string): string ;
export function join(...els: string[]): string ;
export function join(...els: any[]): string {
  if (Array.isArray(els[0]) && typeof els[1] === 'string') {
    return els[0].filter(isDefined).join(els[1]);
  }
  return els.filter(isDefined).join('.');
}

export const normalize = (txt: string): string => {
  if (isDefined(txt)) {
    return txt
      .replaceAll(/[.#_-]/gm, '_')
      .replaceAll('_', '');
  }
};


/* Style */

export const fromPx = (v: string): number => {
  return Number(v.replace('px', ''));
};


/* Array */

export const getSingle = <T>(arr: T[], err = 'Array has multiple elements'): T => {
  if (arr.length > 1) {
    throw new Error(err);
  }
  return arr[0];
};

export const requireSingle = <T>(arr: T[], err = 'Array MUST have one value'): T => {
  if (arr.length !== 1) {
    throw new Error(err);
  }
  return arr[0];
};


/* Tokens */

export const tokenize = (str: string, tokens: string[]): {type: 'const' | 'var', value: string}[] => {
  let temp: any[] = [str];

  tokens.sort(n => n.length).reverse().forEach(objName => {
    temp.forEach((token, idx) => {
      if (typeof token === "string") {
        temp[idx] = token.split(objName)
          .flatMap(el => ['__var__', el])
          .slice(1)
          .map(el => el === '__var__' ? {type: 'var', value: objName} : el);
      }
    });
    temp = temp.flat(Infinity);
  });

  return temp.map(el => typeof el === "string" ? {type: 'const', value: el} : el);
};


/* Topology */

export const topologicalSort = (fmlGroup: FMLStructureGroup): {[p: string]: number} => {
  const topology = FMLGraph.fromFML(fmlGroup).topologySort();
  const inputs = Object.values(fmlGroup.objects ?? {}).filter(o => ['source', 'target'].includes(o.mode));

  // set 'max' order to source objects
  inputs
    .filter(i => i.mode === 'source')
    .filter(i => topology[i?.name])
    .forEach((i, idx) => topology[i.name] = 1000 - idx);

  // set 'min' order to target objects
  inputs
    .filter(i => i.mode === 'target')
    .filter(i => topology[i?.name])
    .forEach((i, idx) => topology[i.name] = -1000 + idx);

  return topology;
};
