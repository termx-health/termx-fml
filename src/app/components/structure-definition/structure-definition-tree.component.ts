import {Component, EventEmitter, Input, OnChanges, Output} from '@angular/core';
import {MuiTreeNode, MuiTreeNodeOptions} from '@kodality-web/marina-ui';
import {ElementDefinition, StructureDefinition} from 'fhir/r5';
import {substringAfterLast, selfElements, isBackboneElementDefinition} from '../../fml/fml.utils';

@Component({
  selector: 'app-structure-definition-tree',
  template: `
    <m-tree
        class="fml-tree"
        *ngIf="options.length"
        [mData]="options"
        [mExpandedKeys]="[definition?.id]"
        [mOption]="option"
        [mAnimate]="false"
        (mClick)="nodeClicked($event)"
    >
      <ng-template #option let-node let-data="data">
        <div class="m-justify-between">
          <div>
            <div [class.m-items-middle]="data?.types?.length === 1" style="row-gap: 0; flex-wrap: wrap;">
              <div>
                {{node.title}}
              </div>
              <div *ngIf="data?.types?.length" class="description" style="word-break: break-all">
                <ng-container *ngFor="let type of data.types | map: shortenType; let isLast = last">
                  <span [mTooltip]="type.isShorted" [mTitle]="type.source" mPosition="left">{{type.short}}{{isLast ? '' : ', '}}</span>
                </ng-container>
              </div>
            </div>

            <div *ngIf="data?.sliceName" class="description" style="word-break: break-all; color: var(--color-green-7)">
              {{data.sliceName}}
            </div>
          </div>

          <span class="description m-bold">
            {{data.required ? '1' : '0'}}{{data.multiple ? '..*' : '..1'}}
          </span>
        </div>
      </ng-template>
    </m-tree>
  `,
  styles: [`
    ::ng-deep .fml-tree .m-tree-node__option {
      width: 100%;
    }
  `]
})
export class StructureDefinitionTreeComponent implements OnChanges {
  @Input() definition: StructureDefinition;
  @Input() definitionBase: string;

  @Input() highlightFn: (el: ElementDefinition) => boolean;
  @Input() selectFn: (el: ElementDefinition) => boolean;
  @Output() selected = new EventEmitter<string>();

  protected options: MuiTreeNodeOptions[] = [];

  public ngOnChanges(): void {
    this.composeTree(this.definition, this.definitionBase);
  }

  protected nodeClicked(node: MuiTreeNode): void {
    if (node.selectable) {
      this.selected.emit(node.data['path']);
    }
  }


  protected composeTree = (sm: StructureDefinition, base: string): void => {
    const name = base ?? sm.id;
    this.options = [{
      key: sm.id,
      title: name,
      children: this._composeTree(sm, name),
      data: {
        path: name,
      },
      selectable: true
    }];
  };

  private _composeTree = (sm: StructureDefinition, base: string): MuiTreeNodeOptions[] => {
    const {children: elements} = selfElements(sm.snapshot.element, base, true);

    const backboneElementPaths = elements
      .filter(isBackboneElementDefinition)
      .map(f => f.path);

    return elements
      .filter(e => !backboneElementPaths.some(p => e.path.startsWith(`${p}.`)))
      .map(e => {
        return ({
          key: e.path,
          title: e.path.substring(base.length).replace(/^\./, ''),
          children: this._composeTree(sm, e.path + '.'),
          data: {
            path: e.path,
            types: e.type?.map(t => t.code),
            sliceName: e.sliceName,
            multiple: e.max !== '1',
            required: e.min === 1,
            highlighted: this.highlightFn?.(e)
          },
          selectable: this.selectFn?.(e) ?? false
        });
      });
  };


  protected shortenType(type: string): {
    isShorted: boolean,
    source: string,
    short: string,
  } {
    return {
      isShorted: type.includes('/'),
      source: type,
      short: type.includes('/') ? `../${substringAfterLast(type, '/')}` : type
    };
  }
}
