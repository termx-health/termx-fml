import {Component, Input, isDevMode} from '@angular/core';
import {FMLStructureConnection, FMLStructureGroup, FMLStructureObject, FMLStructureRule} from '../../fml/fml-structure';
import {group, isDefined} from '@kodality-web/core-util';

@Component({
  selector: 'app-fml-view',
  template: `
    <div *ngIf="simpleFML as fml">
      <!-- Objects -->
      <div style="padding: 1rem 1rem 0 1rem">
        <h5>Objects</h5>
        <m-table mSize="small">
          <tr *ngFor="let o of fml.objects | values ">
            <td>
              <div class="m-justify-between">
                <div>{{o.name}}</div>
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
      </div>


      <!-- Rules -->
      <div style="padding: 1rem 1rem 0 1rem">
        <h5>Rules</h5>
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
      </div>


      <!-- Connections -->
      <div *ngIf="_dev" style="padding: 1rem 1rem 0 1rem">
        <h5>Connections</h5>
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
      </div>
    </div>
  `
})
export class FmlViewComponent {
  @Input() fmlGroup: FMLStructureGroup;
  protected _dev = isDevMode();


  protected get simpleFML(): {
    objects: {[name: string]: FMLStructureObject},
    rules: (FMLStructureRule & {sources: string[], targets: string[]})[],
    connections: FMLStructureConnection[]
  } {
    return {
      objects: group(Object.values(this.fmlGroup?.objects || {}), o => o.name, o => (<FMLStructureObject>{
        ...o,
        fields: o.fields,
      })),
      rules: this.fmlGroup?.rules.map(r => ({
        ...r,
        sources: this.fmlGroup.getSources(r.name).map(n => [n.sourceObject, n.field].filter(isDefined).join(':')),
        targets: this.fmlGroup.getTargets(r.name).map(n => [n.targetObject, n.field].filter(isDefined).join(':')),
      })),
      connections: this.fmlGroup?.connections as any
    };
  }
}
