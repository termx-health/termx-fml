import {Component, EventEmitter, Input, Output} from '@angular/core';
import {Bundle, ElementDefinition, StructureDefinition} from 'fhir/r5';
import {FMLStructure} from '../fml/fml-structure';
import {SEQUENCE} from '../fml/fml.utils';

interface ModalData {
  name: string,
  sources: StructureDefinition[],
  targets: StructureDefinition[]
}

@Component({
  selector: 'app-structure-map-setup',
  template: `
    <!-- Setup wizard -->
    <m-modal #wizard [mVisible]="modalData.visible" mPlacement="top" (mClose)="close()">
      <ng-container *ngIf="modalData.visible">
        <form #f="ngForm" *ngIf="modalData.data as data">
          <div *m-modal-header>
            StructureMap setup
          </div>

          <div *m-modal-content>
            <m-form-item mName="name" mLabel="Name" required>
              <m-input name="name" [(ngModel)]="data.name" required/>
            </m-form-item>

            <m-form-row>
              <m-form-item *m-form-col mName="sources" mLabel="Sources" required>
                <app-structure-definition-select name="sources" [(ngModel)]="data.sources" [bundle]="bundle" multiple required/>
              </m-form-item>

              <m-form-item *m-form-col mName="targets" mLabel="Target" required>
                <app-structure-definition-select name="targets" [(ngModel)]="data.targets" [bundle]="bundle" multiple required/>
              </m-form-item>
            </m-form-row>
          </div>

          <div *m-modal-footer>
            <m-button mDisplay="primary" style="width: 100%" (mClick)="initFromWizard(data)" [disabled]="f.invalid">
              Let's Go
            </m-button>
          </div>
        </form>
      </ng-container>
    </m-modal>
  `
})
export class StructureMapSetupComponent {
  @Input() public bundle: Bundle<StructureDefinition>;
  @Output() public created = new EventEmitter<{name: string, fml: FMLStructure}>();

  protected modalData: {
    visible: boolean,
    data?: Partial<ModalData>
  } = {
    visible: false
  };

  public open(): void {
    this.modalData = {visible: true, data: {}};
  }

  public close(): void {
    this.modalData = {visible: false};
  }

  protected selectableBackbone = (e: ElementDefinition): boolean => {
    return e.type?.some(t => FMLStructure.isBackboneElement(t.code));
  };

  protected initFromWizard(data: Partial<ModalData>): void {
    const fml = new FMLStructure();
    fml.bundle = this.bundle;
    data.sources.forEach(sd => {
      fml.objects[sd.id] = fml.newFMLObject(sd.id, sd.id, 'source');
    });
    data.targets.forEach(sd => {
      const obj = fml.newFMLObject(sd.id, sd.id, 'target');
      if (obj.resource !== obj.name) {
        obj.name = `${obj.name}#${SEQUENCE.next()}`
      }
      fml.objects[obj.name] = obj;
    });

    this.created.emit({name: data.name, fml});
    this.close();
  }
}
