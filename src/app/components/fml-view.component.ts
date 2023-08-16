import {Component, Input, isDevMode} from '@angular/core';
import {FMLStructure, FMLStructureConnection, FMLStructureObject, FMLStructureRule} from '../fml/fml-structure';
import {group, isDefined} from '@kodality-web/core-util';

@Component({
  selector: 'app-fml-view',
  template: `
    <div *ngIf="simpleFML as fml " style="padding: 1rem; display: flex; flex-direction: column">
      <!-- Objects -->
      <m-form-item mLabel="Objects">
        <m-table mSize="small">
          <tr *ngFor="let o of fml.objects | values ">
            <td>
              <div class="m-justify-between">
                <div>{{o.name}} ({{o.fields.length}})</div>
              </div>
              <div class="description">{{o.resource}}</div>
            </td>
          </tr>

          <tr *ngIf="!(fml.objects | values)?.length">
            <td colspan="100%">
              <m-no-data/>
            </td>
          </tr>
        </m-table>
      </m-form-item>


      <!-- Rules -->
      <m-form-item mLabel="Rules">
        <m-table mSize="small">
          <tr *ngFor="let r of fml.rules">
            <td>
              <div class="m-justify-between">
                <div>{{r.name}}</div>
                <div style="display: flex; flex-direction: column; align-items: flex-end;">
                  <div class="m-subtitle">{{r.action}}</div>
                </div>
              </div>
              <div class="description">
                <div>
                  <div *ngFor="let s of r.sources" style="color: var(--color-green-6)">
                    {{s}}
                  </div>
                </div>
                <div>
                  <div *ngFor="let t of r.targets">
                    {{t}}
                  </div>
                </div>
              </div>
            </td>
          </tr>

          <tr *ngIf="!fml.rules?.length">
            <td colspan="100%">
              <m-no-data/>
            </td>
          </tr>
        </m-table>
      </m-form-item>


      <!-- Connections -->
      <m-form-item *ngIf="_dev" mLabel="Connections">
        <m-table mSize="small">
          <tr *ngFor="let con of fml.connections">
            <td>{{con.sourceObject}}</td>
            <td>{{con.sourceFieldIdx}}</td>
            <td>{{con.targetObject}}</td>
            <td>{{con.targetFieldIdx}}</td>
          </tr>

          <tr *ngIf="!fml.connections?.length">
            <td colspan="100%">
              <m-no-data/>
            </td>
          </tr>
        </m-table>
      </m-form-item>
    </div>
  `
})
export class FmlViewComponent {
  @Input() fml: FMLStructure;
  protected _dev = isDevMode();


  protected get simpleFML(): {
    objects: {[name: string]: FMLStructureObject},
    rules: (FMLStructureRule & {sources: string[], targets: string[]})[],
    connections: FMLStructureConnection[]
  } {
    return {
      objects: group(Object.values(this.fml?.objects || {}), o => o.name, o => (<FMLStructureObject>{
        ...o,
        fields: o.fields,
      })),
      rules: this.fml?.rules.map(r => ({
        ...r,
        sources: this.fml.getSources(r.name).map(this.toObjectFieldPath),
        targets: this.fml.getTargets(r.name).map(this.toObjectFieldPath),
      })),
      connections: this.fml?.connections as any
    };
  }


  protected toObjectFieldPath = ({object, field}) => {
    return [object, field].filter(isDefined).join(':');
  };
}
