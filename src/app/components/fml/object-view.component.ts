import {Component, EventEmitter, Input, Output} from '@angular/core';
import {isDefined, isNil, unique} from '@kodality-web/core-util';
import {Bundle, ElementDefinition, StructureDefinition} from 'fhir/r5';
import {FMLStructureGroup, FMLStructureObject, FMLStructureObjectField} from '../../fml/fml-structure';

@Component({
  selector: 'app-object-view',
  template: `
    <ng-container *ngIf="object">
      <div *ngIf="object | apply: isArrayElement" class="block">
        <m-form-item mLabel="List option">
          <m-radio-group [(ngModel)]="object.listOption" (ngModelChange)="updateObject()" mSize="small">
            <label m-radio-button [mValue]="'every'">Every</label>
            <label m-radio-button [mValue]="'first'">First</label>
            <label m-radio-button [mValue]="'last'">Last</label>
            <label m-radio-button [mValue]="null">None</label>
          </m-radio-group>
        </m-form-item>

        <m-form-item mLabel="Condition">
          <m-input [(ngModel)]="object.condition" (ngModelChange)="updateObject()"></m-input>

          <ng-container *ngIf="object.name | apply: ctxVariables as ctxVars">
            <div *ngIf="ctxVars.length" style="margin-top: 0.5rem">
              <div class="m-items-middle" style="flex-wrap: wrap">
                <kbd *ngFor="let v of ctxVars | reverse" class="m-clickable description" (click)="object.condition = (object.condition ?? '') + v">{{v}}</kbd>
              </div>
            </div>
          </ng-container>
        </m-form-item>
      </div>


      <div class="block">
        <h5 class="m-justify-between">
          <span>Resource | {{object.mode}} </span>
          <div>
            <nz-switch [(ngModel)]="treeView" (ngModelChange)="setTreeView($event)" nzSize="small"></nz-switch>
          </div>
        </h5>

        <app-structure-definition-tree
            *ngIf="treeView"
            [definition]="object | apply: findDefinition: fmlGroup"
            [definitionBase]="object.element.path"
            [selectFn]="object | apply: isElementSelectable"
            (selected)="onElementFieldClick(object, $event)"
        ></app-structure-definition-tree>

        <m-table *ngIf="!treeView" mSize="small">
          <tr *ngFor="let f of object.fields">
            <td>
              <div class="m-items-top m-justify-between">
                <div>
                  <a *ngIf="f | apply: isResourceSelectable: object; else name" (mClick)="onFieldClick(object, f.name)">
                    <ng-container *ngTemplateOutlet="name"></ng-container>
                  </a>
                  <div class="description">{{f.types | join: ', '}}</div>
                </div>
                <ng-template #name>
                  <span
                      [mPopover]="f | apply: isBackboneElementField"
                      [mTitle]="backboneRawFields"
                      [mTitleContext]="{base: f.name}"
                      mPosition="leftTop"
                  >
                    {{f.name}}
                  </span>
                </ng-template>

                <span class="m-subtitle">{{f.required ? '1' : '0'}}{{f.multiple ? '..*' : '..1'}}</span>
              </div>
            </td>
          </tr>
        </m-table>

        <ng-template #backboneRawFields let-base="base">
          <app-structure-definition-tree
              [definition]="object | apply: findDefinition: fmlGroup"
              [definitionBase]="object.element.path + '.' + base"
          ></app-structure-definition-tree>
        </ng-template>
      </div>

      <div class="form-view block">
        <m-form-item mLabel="Source" *ngIf="object.name | apply: fmlGroup.getSources as srcs">
          <span *ngIf="!srcs?.length">-</span>
          <div *ngFor="let src of srcs" style="word-wrap: break-word;">{{src.sourceObject}}<b *ngIf="src.field">:{{src.field}}</b></div>
        </m-form-item>
        <m-form-item mLabel="Target" *ngIf="object.name | apply: fmlGroup.getTargets as tgts">
          <span *ngIf="!tgts?.length">-</span>
          <div *ngFor="let tgt of tgts" style="word-wrap: break-word;">{{tgt.targetObject}}<b *ngIf="tgt.field">:{{tgt.field}}</b></div>
        </m-form-item>
      </div>
    </ng-container>


    <m-modal #wizard [mVisible]="resourceModal.visible" (mClose)="resourceModal = {visible: false}">
      <ng-container *ngIf="resourceModal.visible">
        <form #f="ngForm">
          <div *m-modal-header>
            Resource select
          </div>

          <div *m-modal-content>
            <m-form-item mName="sources" required>
              <app-structure-definition-select
                  name="sources"
                  [(ngModel)]="resourceModal.resource"
                  [bundle]="fmlGroup.bundle() | apply: bundle: resourceModal.types"
                  required
              />
            </m-form-item>
          </div>

          <div *m-modal-footer class="m-justify-right">
            <m-button mDisplay="text" (mClick)="wizard.close()">
              Cancel
            </m-button>
            <m-button mDisplay="primary" (mClick)="resourceConfirm(resourceModal.field, resourceModal.resource)" [disabled]="f.invalid">
              Confirm
            </m-button>
          </div>
        </form>
      </ng-container>
    </m-modal>
  `
})
export class ObjectViewComponent {
  @Input() fmlGroup: FMLStructureGroup;
  @Input() object: FMLStructureObject;
  @Output() objectChange = new EventEmitter<FMLStructureObject>();
  @Output() fieldSelect = new EventEmitter<{
    object: FMLStructureObject,
    field: string,
    type?: string,
  }>();

  protected treeView = (sessionStorage.getItem('object-view-as-tree') ?? 'true') === 'true';
  protected resourceModal: {visible: boolean, field?: string, resource?: StructureDefinition, types?: string[]} = {
    visible: false
  };


  public onFieldClick(object: FMLStructureObject, field: string): void {
    const types = object.fields.find(f => f.name === field).types;
    if (types.includes("Resource")) {
      this.resourceModal = {visible: true, field};
    } else if (types.length > 1) {
      this.resourceModal = {visible: true, field, types};
    } else {
      this.fieldSelect.emit({object, field});
    }
  }

  protected onElementFieldClick(object: FMLStructureObject, field: string): void {
    this.onFieldClick(object, FMLStructureGroup.getElementField(field, object.element.id));
  }


  protected updateObject(): void {
    this.objectChange.emit(this.object);
  }

  protected findDefinition(obj: FMLStructureObject, fml: FMLStructureGroup): StructureDefinition {
    return fml.bundle().entry.find(e => e.resource.url === obj.url)?.resource;
  }

  protected setTreeView(isTree: boolean): void {
    sessionStorage.setItem('object-view-as-tree', String(isTree));
  }


  /* Resource modal */

  protected resourceConfirm(field: string, sd: StructureDefinition): void {
    this.fieldSelect.emit({object: this.object, field, type: sd.type});
    this.resourceModal = {visible: false};
  }

  protected bundle(bundle: Bundle<StructureDefinition>, types: string[]): Bundle<StructureDefinition> {
    if (isDefined(types)) {
      return <Bundle<StructureDefinition>>{
        entry: bundle.entry
          .filter(e => types.includes(e.resource.type))
          .sort((a, b) => types.indexOf(a.resource.type) - types.indexOf(b.resource.type))
      };
    }
    return bundle;
  }


  /* Utils */

  protected isResourceSelectable = (f: FMLStructureObjectField, object: FMLStructureObject): boolean => {
    return object.mode !== 'produced' && (this.fmlGroup.isFieldSelectable(f) || f.types?.includes('Resource'));
  };

  protected isBackboneElementField = (f: FMLStructureObjectField): boolean => {
    return FMLStructureGroup.isBackboneElementField(f);
  };

  protected isElementSelectable = (object: FMLStructureObject) => (e: ElementDefinition): boolean => {
    const isBackboneElement = (e.path.substring(object.element.id.length + 1).match(/\./g) ?? []).length === 0;
    return isBackboneElement && this.isResourceSelectable({
      name: FMLStructureGroup.getElementField(e.path, object.element.id),
      types: e.type?.map(t => t.code) ?? [e.contentReference].filter(Boolean),
    }, object);
  };


  protected isArrayElement = (obj: FMLStructureObject): boolean => {
    if (obj.mode !== 'element') {
      return;
    }
    const srcs = this.fmlGroup.getSources(obj.name);
    const src = srcs[0];
    if (isNil(src)) {
      return false;
    }
    const srcObj = this.fmlGroup.objects[src.sourceObject];
    if (isNil(srcObj)) {
      return false;
    }
    return srcObj.fields.find(f => f.name === src.field)?.multiple;
  };

  protected ctxVariables = (name: string): string[] => {
    return this.fmlGroup.getSources(name)
      .map(s => s.sourceObject)
      .flatMap(sn => [sn, ...this.ctxVariables(sn)])
      .filter(unique)
      .filter(n => this.fmlGroup.objects[n]);
  };
}
