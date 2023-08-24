import {Component, EventEmitter, Input, isDevMode, Output, ViewChild} from '@angular/core';
import {FMLStructure, FMLStructureRule, FMLStructureRuleParameter} from '../../fml/fml-structure';
import {MuiModalContainerComponent} from '@kodality-web/marina-ui';
import {unique} from '@kodality-web/core-util';

@Component({
  selector: 'app-rule-view',
  template: `
    <div *ngIf="rule">
      <div class="form-view" style="padding: 1rem; border-bottom: var(--border-table);">
        <h5>Rule</h5>

        <m-form-item mLabel="Action">
          {{rule.action}}
        </m-form-item>

        <m-form-item [mLabel]="clbl" *ngIf="isDev">
          <ng-template #clbl>
            Condition
            <m-icon-button mIcon="edit" (mClick)="editCondition()"/>
          </ng-template>

          {{rule.condition ?? '-'}}
        </m-form-item>

        <m-form-item [mLabel]="plbl">
          <ng-template #plbl>
            Parameters
            <m-icon-button mIcon="edit" (mClick)="editParameter()"/>
          </ng-template>

          <span *ngIf="!rule.parameters?.length">-</span>
          <ul>
            <li *ngFor="let p of rule.parameters">
              <kbd *ngIf="p.type === 'var'; else lbl" class="description">{{p.value}}</kbd>
              <ng-template #lbl><code>{{p.value}}</code></ng-template>
            </li>
          </ul>
        </m-form-item>
      </div>

      <div class="form-view" style="padding: 1rem; border-bottom: var(--border-table);">
        <m-form-item mLabel="Source" *ngIf="rule.name | apply: fml.getSources as srcs">
          <span *ngIf="!srcs?.length">-</span>
          <div *ngFor="let src of srcs">{{src.sourceObject}}<b *ngIf="src.field">:{{src.field}}</b></div>
        </m-form-item>
        <m-form-item mLabel="Target" *ngIf="rule.name | apply: fml.getTargets as tgts">
          <span *ngIf="!tgts?.length">-</span>
          <div *ngFor="let tgt of tgts">{{tgt.targetObject}}<b *ngIf="tgt.field">:{{tgt.field}}</b></div>
        </m-form-item>
      </div>


      <div class="form-view" style="padding: 1rem; border-bottom: var(--border-table);">
        <m-form-item mLabel="Position">
          x: {{rule.position?.x ?? '-'}}; y: {{rule.position?.y ?? '-'}}
        </m-form-item>
      </div>
    </div>


    <!-- RULE parameters modal -->
    <m-modal #parameterModal (mClose)="editCancel(parameterModal)">
      <div *m-modal-header>
        Parameters
      </div>

      <div *m-modal-content>
        <ng-container *ngIf="_cp">
          <m-table mSize="small">
            <tr *ngFor="let param of _cp.parameters; let first = first; let last = last">
              <td>
                <m-input *ngIf="param.type === 'const'" [(ngModel)]="param.value"></m-input>
                <kbd *ngIf="param.type === 'var'" class="description">{{param.value}}</kbd>
              </td>
              <td style="width: 0; padding: 0">
                <m-icon-button mIcon="up" [disabled]="first" (mClick)="moveParameter(_cp.parameters, param, 'up')"/>
              </td>
              <td style="width: 0; padding: 0">
                <m-icon-button mIcon="down" [disabled]="last" (mClick)="moveParameter(_cp.parameters, param, 'down')"/>
              </td>
              <td style="width: 0">
                <m-icon-button mIcon="delete" (mClick)="removeParameter(_cp.parameters, param)"/>
              </td>
            </tr>

            <tr>
              <td colspan="100%" style="padding: 0">
                <m-button style="width: 100%" mDisplay="text" mSize="small" (mClick)="addParameter(_cp.parameters)">Add parameter</m-button>
              </td>
            </tr>
          </m-table>
        </ng-container>
      </div>

      <div *m-modal-footer class="m-justify-right">
        <m-button mDisplay="text" (mClick)="editCancel(parameterModal)">Cancel</m-button>
        <m-button mDisplay="primary" (mClick)="editApply(parameterModal)">Apply</m-button>
      </div>
    </m-modal>

    <!-- RULE condition modal -->
    <m-modal #conditionModal (mClose)="editCancel(conditionModal)">
      <div *m-modal-header>
        Condition
      </div>

      <div *m-modal-content>
        <ng-container *ngIf=" _cp">
          <m-form-item mLabel="Expression">
            <m-input [(ngModel)]="_cp.condition"></m-input>
          </m-form-item>

          <ng-container *ngIf="_cp.name | apply: ctxVariables as ctxVars">
            <m-form-item mLabel="Context variables"
                *ngIf="ctxVars.length"
            >
              <div class="m-items-middle">
                <kbd *ngFor="let v of ctxVars | reverse" class="description">{{v}}</kbd>
              </div>
            </m-form-item>
          </ng-container>
        </ng-container>
      </div>

      <div *m-modal-footer class="m-justify-right">
        <m-button mDisplay="text" (mClick)="editCancel(conditionModal)">Cancel</m-button>
        <m-button mDisplay="primary" (mClick)="editApply(conditionModal)">Apply</m-button>
      </div>
    </m-modal>
  `
})
export class RuleViewComponent {
  @Input() fml: FMLStructure;
  @Input() rule: FMLStructureRule;
  @Output() ruleChange = new EventEmitter<FMLStructureRule>();

  @ViewChild('parameterModal') private parameterModal: MuiModalContainerComponent;
  @ViewChild('conditionModal') private conditionModal: MuiModalContainerComponent;
  protected _cp: FMLStructureRule;
  protected isDev = isDevMode();

  public editParameter(): void {
    this._cp = structuredClone(this.rule);
    if (this._cp.parameters.length === 0) {
      this.addParameter(this._cp.parameters);
    }
    this.parameterModal.open();
  }

  public editCondition(): void {
    this._cp = structuredClone(this.rule);
    this.conditionModal.open();
  }


  protected editCancel(m: MuiModalContainerComponent): void {
    m.close();
    this._cp = undefined;
  }

  protected editApply(m: MuiModalContainerComponent): void {
    m.close();
    this.rule = this._cp;
    this.ruleChange.emit(this._cp);
    this._cp = undefined;
  }


  /* Parameter manipulation */

  protected moveParameter(params: FMLStructureRuleParameter[], p: FMLStructureRuleParameter, direction: 'up' | 'down'): void {
    const idx = params.indexOf(p);
    if (idx !== -1) {
      params.splice(idx, 1);
      params.splice((direction === 'up' ? Math.max(0, idx - 1) : Math.min(idx + 1, params.length + 1)), 0, p);
    }
  }

  protected removeParameter(params: FMLStructureRuleParameter[], p: FMLStructureRuleParameter): void {
    const idx = params.indexOf(p);
    if (idx !== -1) {
      params.splice(idx, 1);
    }
  }

  protected addParameter(params: FMLStructureRuleParameter[]): void {
    params.push({
      type: 'const',
      value: undefined
    });
  }


  /* Utils */

  protected ctxVariables = (name: string): string[] => {
    return this.fml.getSources(name)
      .map(s => s.sourceObject)
      .flatMap(sn => [sn, ...this.ctxVariables(sn)])
      .filter(unique)
      .filter(n => this.fml.objects[n]);
  };

}
