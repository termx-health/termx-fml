import {Component, Input, OnChanges, SimpleChanges} from '@angular/core';
import {StructureDefinition} from 'fhir/r5';
import {FMLStructure} from '../../fml/fml-structure';
import {MuiTreeNodeOptions} from '@kodality-web/marina-ui';

@Component({
  selector: 'app-structure-definition-tree',
  template: `
    <m-tree *ngIf="options.length" [mData]="options" [mOption]="option" [mExpandedKeys]="[definition?.name]" [mAnimate]="false">
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
  @Input() base: string;

  protected options: MuiTreeNodeOptions[] = [];

  public ngOnChanges(changes: SimpleChanges): void {
    this.composeTree(this.definition, this.base);
  }

  protected composeTree = (sm: StructureDefinition, base: string) => {
    this.options = [{
      key: sm.id,
      title: base ?? sm.name,
      children: this.compose(sm, base ?? sm.name)
    }];
  };

  private compose = (sm: StructureDefinition, base: string) => {
    const isBackboneElement = f => f.type?.some(t => FMLStructure.isBackboneElement(t.code));

    const elements = sm.snapshot.element
      .filter(e => e.path.startsWith(base) && e.path !== base);

    const backboneElementPaths = elements
      .filter(isBackboneElement)
      .map(f => f.path);

    return elements
      .filter(e => !backboneElementPaths.some(p => e.path.startsWith(p) && e.path !== p))
      .map<MuiTreeNodeOptions>(e => {
        const isBackbone = isBackboneElement(e);
        return ({
          key: e.path,
          title: e.path.substring(base.length).replace(/^\./, ''),
          data: {
            types: e.type?.map(t => t.code)
          },
          selectable: isBackbone,
          expandable: isBackbone,
          children: this.compose(sm, e.path + '.')
        });
      });
  };
}
