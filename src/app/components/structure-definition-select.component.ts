import {Component, forwardRef, Input} from '@angular/core';
import {Bundle, StructureDefinition} from 'fhir/r5';
import {ControlValueAccessor, NG_VALUE_ACCESSOR} from '@angular/forms';
import {BooleanInput} from '@kodality-web/core-util';

@Component({
  selector: 'app-structure-definition-select',
  template: `
    <m-select name="targets" [(ngModel)]="val" (ngModelChange)="fireOnChange()" [multiple]="multiple"  compareWith="id">
      <m-option
          *ngFor="let res of bundle?.entry"
          [mValue]="res.resource"
          [mLabel]="(res.resource.url | apply: splitUrl)[1]"
          [mLabelTemplate]="tlbl"
      >
        <ng-template #tlbl>
          {{(res.resource.url | apply: splitUrl)[1]}} <span class="description">{{(res.resource.url | apply: splitUrl)[0]}}</span>
        </ng-template>
      </m-option>
    </m-select>
  `,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => StructureDefinitionSelectComponent),
      multi: true
    }
  ]
})
export class StructureDefinitionSelectComponent implements ControlValueAccessor {
  @Input() bundle: Bundle<StructureDefinition>;
  @Input() @BooleanInput() multiple: boolean | string;

  protected val: StructureDefinition | StructureDefinition[];
  protected onChange: (_: StructureDefinition | StructureDefinition[]) => void = () => undefined;
  protected onTouch: (_: StructureDefinition | StructureDefinition[]) => void = () => undefined;


  public writeValue(obj?: StructureDefinition | StructureDefinition[]): void {
    this.val = obj;
  }

  public fireOnChange(): void {
    this.onChange(this.val);
  }

  public registerOnChange(fn: (_: StructureDefinition | StructureDefinition[]) => void): void {
    this.onChange = fn;
  }

  public registerOnTouched(fn: (_: StructureDefinition | StructureDefinition[]) => void): void {
    this.onTouch = fn;
  }


  protected splitUrl(url: string): [string, string] {
    return [url.substring(0, url.lastIndexOf('/')), url.substring(url.lastIndexOf('/') + 1)];
  }
}
