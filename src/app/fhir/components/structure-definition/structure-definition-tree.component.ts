import {Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, ViewChild} from '@angular/core';
import {isDefined, LoadingManager} from '@kodality-web/core-util';
import {MuiTreeComponent, MuiTreeNode, MuiTreeNodeOptions} from '@kodality-web/marina-ui';
import {StructureDefinitionFhirMapperUtil} from './structure-definition-mapper.util';

@Component({
  selector: 'app-structure-definition-tree',
  template: `
    <m-tree
      *ngIf="treeOptions"
      class="structure-definition-tree"
      [mData]="treeOptions"
      [mOption]="option"
      [mExpandIcon]="expandIcon"
      (mSelect)="selectElement($event)"
      mSelectMode
      mExpandAll
    >
      <ng-template #expandIcon let-node>
        <m-icon [mCode]="node.isExpanded ? 'minus-square' : 'plus-square'"></m-icon>
      </ng-template>

      <ng-template #option let-node let-data="data">
        <div style="display: flex">
          <label>{{node.title}}</label>

        </div>
      </ng-template>
    </m-tree>
  `,
  styles: [`
    ::ng-deep .structure-definition-tree {
      .m-tree-node__option {
        width: 100%;

        &:not(.m-tree-node__option--leaf) {
          border: 1px solid #d2d2d2;
        }

        &--selected {
          background: #eee;
          color: initial;
        }
      }

      .m-tree-title label {
        cursor: inherit;
      }
    }
  `]
})
export class StructureDefinitionTreeComponent implements OnChanges {
  @Input() public fhir?: string;
  @Output() public selected = new EventEmitter<Element>();

  protected type?: 'diff' | 'snap' | 'hybrid' = 'diff';
  protected structureDefinitionValue?: any;
  protected loader = new LoadingManager();

  @ViewChild(MuiTreeComponent) private tree: MuiTreeComponent;
  protected treeOptions: MuiTreeNodeOptions<StructureDefinitionData>[];


  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['fhir'] && this.fhir) {
      this.fhir = decodeURIComponent(this.fhir);
      this.processJson(this.fhir);
    }
  }


  protected selectElement(node: MuiTreeNode<StructureDefinitionData>): void {
    const element = node.data.element;
    if (element) {
      this.selected.emit(element);
    }
  }


  private processJson(json: string): void {
    try {
      this.structureDefinitionValue = undefined;
      this.treeOptions = undefined;

      if (json) {
        this.structureDefinitionValue = StructureDefinitionFhirMapperUtil.mapToKeyValue(JSON.parse(json));
        setTimeout(() => this.treeOptions = this.mapDefToNode(this.structureDefinitionValue));
      }
    } catch (e) {
      console.error("Failed to init structure definition from JSON", e);
    }
  }

  private mapDefToNode(object: any): MuiTreeNodeOptions<StructureDefinitionData>[] {
    if (!(object instanceof Object)) {
      return undefined;
    }

    return Object.keys(object).filter(key => {
      const notElement = !['diff', 'snap', 'el'].includes(key);
      const correspondsToType = this.type === 'hybrid' || isDefined(object[key][this.type!]) || !isDefined(object[key][this.type === 'diff' ? 'snap' : 'diff']);
      return notElement && correspondsToType;
    }).map(key => {
      const data = this.diffTransformer({
        diff: object[key]['diff'],
        mappings: object[key]['el']?.mapping,
      });
      return ({
        key: key,
        title: key,
        children: this.mapDefToNode(object[key]),
        selectable: !!data.element,
        data: data,
      });
    });
  }


  private diffTransformer = ({diff, mappings}: {diff: Element, mappings: ElementMapping}): StructureDefinitionData => ({
    element: diff,
    type: diff?.type?.[0]?.code,
    targetProfile: diff?.type?.[0]?.targetProfile,
    fixedUri: diff?.fixedUri,
    fixedCoding: diff?.fixedCoding ? diff.fixedCoding : undefined,
    cardinality: isDefined(diff?.min) || isDefined(diff?.max) ? (isDefined(diff?.min) ? diff?.min : '*') + '..' + (isDefined(diff?.max) ? diff?.max : '*') : '',
    short: diff?.short,
    definition: isDefined(diff?.definition) && diff?.definition !== diff?.short ? diff?.definition : undefined,
    binding: diff?.binding,
    mappings: diff?.mapping || mappings,
  });
}

interface StructureDefinitionData {
  fixedUri?: string;
  fixedCoding?: any;
  type?: string;
  targetProfile?: string[];
  cardinality?: string;
  short?: string;
  definition?: string;
  binding?: {valueSet?: string, strength?: string};
  mappings?: ElementMapping;
  element?: Element;
  diff?: Element;
  snap?: Element;
}

export class Element {
  public id?: string;
  public path?: string;
  public fixedUri?: string;
  public fixedCoding?: {code?: string, system?: string, display?: string};
  public min?: number;
  public max?: string;
  public short?: string;
  public definition?: string;
  public binding?: {valueSet?: string, strength?: string};
  public mapping?: ElementMapping;
  public type?: ElementType[];
  public constraint?: ElementConstraint[];
}

export class ElementMapping {
  public identity?: string;
  public map?: string;
}

export class ElementType {
  public code?: string;
  public targetProfile?: string[];
  public profile?: string[];
}

export class ElementConstraint {
  public key?: string;
  public requirements?: string;
  public severity?: 'error' | 'warning';
  public human?: string;
  public expression?: string;
  public source?: string;
}
