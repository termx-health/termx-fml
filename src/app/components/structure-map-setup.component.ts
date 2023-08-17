import {Component, EventEmitter, Input, Output} from '@angular/core';
import {Bundle, StructureDefinition, StructureMap, StructureMapGroupInput} from 'fhir/r5';

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
  @Output() public created = new EventEmitter<StructureMap>();

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



  protected initFromWizard(data: Partial<ModalData>): void {
    const sources = data.sources.map(sd => this.bundle.entry.find(e => e.resource.url === sd.url).resource).map(r => ({
      url: r.url,
      mode: 'source' as any,
      alias: r.id
    }));
    const targets = data.targets.map(sd => this.bundle.entry.find(e => e.resource.url === sd.url).resource).map(r => ({
      url: r.url,
      mode: 'target' as any,
      alias: r.id
    }));

    const map: StructureMap = {
      "id": data.name,
      "resourceType": "StructureMap",
      "status": "draft",
      "name": data.name,
      "url": `http://hl7.org/fhir/StructureMap/${data.name}`,
      "structure": [
        ...sources,
        ...targets
      ],
      "group": [
        {
          "name": "main",
          "input": [
            ...sources.map(s => ({
              name: s.alias,
              type: s.alias,
              mode: 'source' as StructureMapGroupInput['mode']
            })),
            ...targets.map(s => ({
              name: s.alias,
              type: s.alias,
              mode: 'source' as StructureMapGroupInput['mode']
            }))
          ],
          "rule": []
        }
      ]
    };

    this.created.emit(map);
    this.close();
  }
}
