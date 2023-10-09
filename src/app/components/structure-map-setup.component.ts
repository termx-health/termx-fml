import {ChangeDetectorRef, Component, EventEmitter, inject, Input, Output} from '@angular/core';
import {Bundle, ElementDefinition, StructureDefinition} from 'fhir/r5';
import {FMLStructureEntityMode, FMLStructureGroup} from '../fml/fml-structure';
import {asResourceVariable} from '../fml/fml.utils';
import {collect, group, isDefined, isNil} from '@kodality-web/core-util';

interface ModalData {
  name: string;
  sources: StructureDefinition[];
  sourceMappings: {[url: string]: string};
  targets: StructureDefinition[];
  targetMappings: {[url: string]: string};
  produced: StructureDefinition[];

  _new: boolean;
  _fmlGroup?: FMLStructureGroup;
}

@Component({
  selector: 'app-structure-map-setup',
  template: `
    <!-- Setup wizard -->
    <m-modal #wizard [mVisible]="modalData.visible" mPlacement="top" (mClose)="close()">
      <ng-container *ngIf="modalData.visible">
        <form #f="ngForm" *ngIf="modalData.data as data">
          <div *m-modal-header>
            {{data._new ? 'Setup' : 'Group Settings'}}
          </div>

          <div *m-modal-content>
            <m-form-item mName="name" mLabel="Name" required>
              <m-input name="name" [(ngModel)]="data.name" required/>
            </m-form-item>

            <m-form-row>
              <div *m-form-col>
                <m-form-item mName="sources" mLabel="Sources" required>
                  <app-structure-definition-select name="sources"
                      [(ngModel)]="data.sources"
                      (ngModelChange)="initMappings($event, 'source')"
                      [bundle]="bundle"
                      multiple
                      required
                  />
                </m-form-item>
                <ng-container *ngTemplateOutlet="tree; context: {defs: data.sources, mappings: data.sourceMappings, mode: 'source'}"></ng-container>
              </div>

              <div *m-form-col>
                <m-form-item mName="targets" mLabel="Target" required>
                  <app-structure-definition-select name="targets"
                      [(ngModel)]="data.targets"
                      (ngModelChange)="initMappings($event, 'target')"
                      [bundle]="bundle"
                      multiple
                      required
                  ></app-structure-definition-select>
                </m-form-item>
                <ng-container *ngTemplateOutlet="tree; context: {defs: data.targets, mappings: data.targetMappings, mode: 'target'}"></ng-container>
              </div>
            </m-form-row>

            <ng-template #tree let-defs="defs" let-mappings="mappings" let-mode="mode">
              <m-card mDisplay="bordered" *ngIf="defs?.length">
                <ng-container *ngFor="let def of defs">
                  <m-form-item [mLabel]="def.url" *ngIf="{edit: false} as d">
                    <div *ngIf="!d.edit">
                      <m-icon class="m-tree-toggle" style="display: inline-block" mCode="edit" (click)="d.edit = true"/>
                      <span class="m-tree-node__option">{{mappings[def.url]}}</span>
                    </div>

                    <app-structure-definition-tree
                        *ngIf="d.edit"
                        [definition]="def"
                        [selectFn]="selectableBackbone"
                        (selected)="mappings[def.url] = $event; d.edit = false"
                    ></app-structure-definition-tree>
                  </m-form-item>
                </ng-container>
              </m-card>
            </ng-template>


            <m-form-item mName="produced" mLabel="Produced">
              <app-structure-definition-select name="produced" [(ngModel)]="data.produced" [bundle]="bundle" multiple/>
              <m-alert
                  class="m-alert--vertical"
                  style="margin-top: 0.5rem"
                  mType="info"
                  mTitle="Produced API may change!"
                  mDescription="Use produced objects at your own responsibility"
                  mShowIcon
              />
            </m-form-item>
          </div>

          <div *m-modal-footer>
            <m-button mDisplay="primary" style="width: 100%" (mClick)="initFromWizard(data)" [disabled]="f.invalid">
              {{data._new ? "Let's Go" : 'Confirm changes'}}
            </m-button>
          </div>
        </form>
      </ng-container>
    </m-modal>
  `
})
export class StructureMapSetupComponent {
  @Input() public bundle: Bundle<StructureDefinition>;
  @Output() public created = new EventEmitter<{fmlGroup: FMLStructureGroup}>();
  @Output() public updated = new EventEmitter<{updated: FMLStructureGroup, current: FMLStructureGroup}>();

  private cdr = inject(ChangeDetectorRef);
  protected modalData: {
    visible: boolean,
    data?: Partial<ModalData>
  } = {
    visible: false
  };


  public open(fmlGroup?: FMLStructureGroup): void {
    this.modalData = {
      visible: true,
      data: {
        _new: isNil(fmlGroup)
      }
    };

    if (isDefined(fmlGroup)) {
      const map = collect(Object.values(fmlGroup.objects), o => o.mode);
      map.source ??= [];
      map.target ??= [];
      map.produced ??= [];

      this.modalData.data.sourceMappings = group(map.source, o => o.url, o => o.element.id);
      this.modalData.data.sources = map.source
        .map(o => this.bundle.entry.find(e => e.resource.url === o.url))
        .map(e => e.resource);

      this.modalData.data.targetMappings = group(map.target, o => o.url, o => o.element.id);
      this.modalData.data.targets = map.target
        .map(o => this.bundle.entry.find(e => e.resource.url === o.url))
        .map(e => e.resource);

      this.modalData.data.produced = map.produced
        .map(o => this.bundle.entry.find(e => e.resource.url === o.url))
        .map(e => e.resource);

      this.modalData.data.name = fmlGroup.name;
      this.modalData.data._fmlGroup = fmlGroup;

      this.cdr.detectChanges();
    }
  }

  public close(): void {
    this.modalData = {visible: false};
  }

  protected initFromWizard(data: Partial<ModalData>): void {
    const fmlGroup = new FMLStructureGroup(data.name, () => this.bundle);

    const createObject = (url: string, mode: FMLStructureEntityMode): void => {
      const mapping = {
        'source': (u: string) => data.sourceMappings[u],
        'target': (u: string) => data.targetMappings[u],
        'produced': (u: string) => this.bundle.entry.find(e => e.resource.url === u)?.resource?.id
      } [mode](url);

      const obj = fmlGroup.newFMLObject(mapping, mapping, mode);
      if (obj.resource !== obj.name) {
        obj.name = asResourceVariable(obj.name);
      }
      fmlGroup.objects[obj.name] = obj;
    };

    data.sources?.forEach(sd => createObject(sd.url, 'source'));
    data.targets?.forEach(sd => createObject(sd.url, 'target'));
    data.produced?.forEach(sd => createObject(sd.url, 'produced'));

    if (data._new) {
      this.created.emit({fmlGroup});
    } else {
      this.updated.emit({current: data._fmlGroup, updated: fmlGroup});
    }
    this.close();
  }

  protected initMappings(defs: StructureDefinition[], mode: 'source' | 'target'): void {
    if (mode === 'target') {
      this.modalData.data.targetMappings = group(defs, d => d.url, d => this.modalData.data.targetMappings?.[d.url] ?? d.id);
    } else {
      this.modalData.data.sourceMappings = group(defs, d => d.url, d => this.modalData.data.sourceMappings?.[d.url] ?? d.id);
    }
  }

  protected selectableBackbone = (e: ElementDefinition): boolean => {
    return e.type?.some(t => FMLStructureGroup.isBackboneElement(t.code));
  };
}
