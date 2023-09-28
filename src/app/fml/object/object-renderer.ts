import {FMLEditor} from '../fml-editor';
import {tokenize} from '../fml.utils';

export class FMLStructureObjectRenderer {
  public static render(editor: FMLEditor, name: string): string {
    window['_objectExpand'] = (name: string): void => {
      const node = editor._getNodeByName(name);
      const expanded = !node.data.obj.expanded;

      editor._updateObject(node.id, node.name, obj => obj.expanded = expanded);
      editor._rerenderNodes();
    };

    window['_fieldSelect'] = (name: string, field: string): void => {
      window.dispatchEvent(new CustomEvent('fmlStructureObjectFieldSelect', {detail: {name, field}}));
    };


    const o = editor._fmlGroup.objects[name];
    const {el} = editor._getNodeElementByName(o.name);

    const renderMeta = (): string => `
      <div class="node-meta" style="position: absolute; top: -1.5rem; left: 0; font-size: 0.7rem; color: var(--color-text-secondary)">
         <span>${o.name}<span>
      </div>
    `;

    const renderCondition = (): string => {
      if (o.condition) {
        el?.classList.add('node--atom--with-where');
        const tokens = Object.keys(editor._fmlGroup.objects);
        const els = tokenize(o.condition, tokens).map(el => el.type === 'var' ? `<kbd>${el.value}</kbd>` : el.value);
        return `<span>where ${els.join('')}</span>`;
      } else {
        el?.classList.remove('node--atom--with-where');
        return '';
      }
    };

    return `
        <div>
          ${renderMeta()}
          <h5 class="node-title">
            <div class="m-justify-between">
              <span>
                ${o.listOption ? `<span style="text-decoration: underline">${o.listOption}</span> ` : ''}
                <span style="font-style: italic">${o.mode === 'object' ? 'new' : o.mode}</span>
                <b>${o.resource}</b>
              </span>

              <span class="m-clickable" style="padding-inline: 0.5rem 4px;" onclick="_objectExpand('${o.name}')">
                <span style="display: flex; align-items: center; justify-content: center; width: 14px; height: 14px; transform: rotate(${o.expanded ? '-90deg' : '90deg'});">
                  <svg xmlns="http://www.w3.org/2000/svg" height="12px" width="12px" viewBox="0 0 185.343 185.343" >
                    <path d="M51.707,185.343c-2.741,0-5.493-1.044-7.593-3.149c-4.194-4.194-4.194-10.981,0-15.175 l74.352-74.347L44.114,18.32c-4.194-4.194-4.194-10.987,0-15.175c4.194-4.194,10.987-4.194,15.18,0l81.934,81.934 c4.194,4.194,4.194,10.987,0,15.175l-81.934,81.939C57.201,184.293,54.454,185.343,51.707,185.343z"/>
                  </svg>
                </span>
              </span>
            </div>

            ${renderCondition()}
          </h5>
        </div>

        ${o.fields.map(f => `
          <div class="m-justify-between node-field">
            <span>${f.name}</span>
            ${o.mode !== 'produced' && (editor._fmlGroup.isFieldSelectable(f) || f.types?.includes('Resource')) ? `<span class="m-clickable" style="padding-inline: 0.5rem" onclick="_fieldSelect('${o.name}', '${f.name}')">+</span>` : ''}
          </div>
        `).join('\n')}
    `;
  }
}
