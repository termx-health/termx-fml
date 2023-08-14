import {Component, EventEmitter, Input, Output} from '@angular/core';
import {FMLStructure, FMLStructureObject, FMLStructureObjectField} from '../fml/fml-structure';

@Component({
  selector: 'app-object-view',
  template: `
    <div *ngIf="object">
      <div style="padding: 1rem; border-bottom: var(--border-table);">
        <h5>Resource | {{object.mode}}</h5>
      </div>

      <m-table mSize="small" style="padding: 1rem; border-bottom: var(--border-table); display: block">
        <tr *ngFor="let f of object.fields">
          <td>
            <div class="m-items-top m-justify-between">
              <div>
                <a *ngIf="f | apply: isResourceSelectable; else name" (mClick)="onFieldClick(object, f.name)">{{f.name}}</a>
                <div class="description">{{f.types | join: ', '}}</div>
              </div>
              <ng-template #name>{{f.name}}</ng-template>

              <span class="m-subtitle">{{f.required ? '1' : '0'}}{{f.multiple ? '..*' : '..1'}}</span>
            </div>
          </td>
        </tr>
      </m-table>


      <div class="form-view" style="padding: 1rem; border-bottom: var(--border-table);">
        <m-form-item mLabel="Source" *ngIf="object.name | apply: fml.getSources as srcs">
          <span *ngIf="!srcs?.length">-</span>
          <div *ngFor="let src of srcs">{{src.object}}<b *ngIf="src.field">:{{src.field}}</b></div>
        </m-form-item>
        <m-form-item mLabel="Target" *ngIf="object.name | apply: fml.getTargets as tgts">
          <span *ngIf="!tgts?.length">-</span>
          <div *ngFor="let tgt of tgts">{{tgt.object}}<b *ngIf="tgt.field">:{{tgt.field}}</b></div>
        </m-form-item>
      </div>
    </div>
  `
})
export class ObjectViewComponent {
  @Input() fml: FMLStructure;
  @Input() object: FMLStructureObject;
  @Output() fieldSelect = new EventEmitter<{
    object: FMLStructureObject,
    field: string
  }>();


  protected onFieldClick(object: FMLStructureObject, field: string): void {
    this.fieldSelect.emit({object, field});
  }

  protected isResourceSelectable = (f: FMLStructureObjectField) => {
    return f.types?.some(t => FMLStructure.isBackboneElement(t)) || this.fml?.bundle?.entry.some(e => f.types?.includes(e.resource.type));
  };
}