import {Component, EventEmitter, Input, Output} from '@angular/core';
import {FMLStructureGroup, FMLStructureObject, FMLStructureObjectField} from '../../fml/fml-structure';
import {Bundle, StructureDefinition} from 'fhir/r5';
import {isDefined, isNil, unique} from '@kodality-web/core-util';

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
        ></app-structure-definition-tree>

        <m-table *ngIf="!treeView" mSize="small">
          <tr *ngFor="let f of object.fields">
            <td>
              <div class="m-items-top m-justify-between">
                <div>
                  <a *ngIf="f | apply: isResourceSelectable; else name" (mClick)="onFieldClick(object, f.name)">
                    <ng-container *ngTemplateOutlet="name"></ng-container>
                  </a>
                  <div class="description">{{f.types | join: ', '}}</div>
                </div>
                <ng-template #name>
                  <span
                      [mPopover]="f | apply: isBackboneElementField"
                      [mTitle]="backboneRawFields"
                      [mTitleContext]="{base: f.name}"
                      mPosition="left"
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
          <div *ngFor="let f of object.rawFields | apply: backboneFields: base">
            <div class="m-items-top m-justify-between">
              {{f.name}}
              <span class="m-subtitle">{{f.required ? '1' : '0'}}{{f.multiple ? '..*' : '..1'}}</span>
            </div>
          </div>
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

  protected treeView = sessionStorage.getItem('object-view-as-tree') === 'true';
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

  protected isResourceSelectable = (f: FMLStructureObjectField): boolean => {
    return this.fmlGroup.isFieldSelectable(f) || f.types?.includes('Resource');
  };

  protected isBackboneElementField = FMLStructureGroup.isBackboneElementField;

  protected backboneFields = (fields: FMLStructureObjectField[], base: string): FMLStructureObjectField[] => {
    return fields.filter(f => f.name.startsWith(base));
  };
}
