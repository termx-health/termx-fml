import {Component, EventEmitter, Input, OnChanges, Output} from '@angular/core';
import {ElementDefinition, StructureDefinition} from 'fhir/r5';
import {FMLStructureGroup} from '../../fml/fml-structure';
import {MuiTreeNode, MuiTreeNodeOptions} from '@kodality-web/marina-ui';

@Component({
  selector: 'app-structure-definition-tree',
  template: `
    <m-tree
      *ngIf="options.length"
      [mData]="options"
      [mExpandedKeys]="[definition?.name]"
      [mOption]="option"
      [mAnimate]="false"
      (mClick)="nodeClicked($event)"
    >
      <ng-template #option let-node let-data="data">
        <div [class.m-items-middle]="data?.types?.length === 1">
          <div>
            {{node.title}}
          </div>
          <div class="description">
            {{data?.types | join: ', '}}
          </div>
        </div>
      </ng-template>
    </m-tree>
  `
})
export class StructureDefinitionTreeComponent implements OnChanges {
  @Input() definition: StructureDefinition;
  @Input() definitionBase: string;

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
    const isBackboneElement = (f: ElementDefinition): boolean => {
      return f.type?.some(t => FMLStructureGroup.isBackboneElement(t.code));
    };

    const elements = sm.snapshot.element
      .filter(e => e.path.startsWith(base) && e.path !== base);

    const backboneElementPaths = elements
      .filter(isBackboneElement)
      .map(f => f.path);

    return elements
      .filter(e => !backboneElementPaths.some(p => e.path.startsWith(p) && e.path !== p))
      .map(e => {
        return ({
          key: e.path,
          title: e.path.substring(base.length).replace(/^\./, ''),
          children: this._composeTree(sm, e.path + '.'),
          data: {
            path: e.path,
            types: e.type?.map(t => t.code),
          },
          selectable: this.selectFn?.(e) ?? false
        });
      });
  };
}
