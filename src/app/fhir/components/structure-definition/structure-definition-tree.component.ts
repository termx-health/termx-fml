import {Component, Input, OnChanges, SimpleChanges, ViewChild} from '@angular/core';
import {isDefined, LoadingManager} from '@kodality-web/core-util';
import {MuiTreeComponent, MuiTreeNodeOptions} from '@kodality-web/marina-ui';
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
  @Input() public value?: string;

  protected type?: 'diff' | 'snap' | 'hybrid' = 'diff';
  protected structureDefinitionValue?: any;

  @ViewChild(MuiTreeComponent) private tree: MuiTreeComponent;
  protected treeOptions: MuiTreeNodeOptions[];

  protected loader = new LoadingManager();


  public change = function (value) {
    this.data = value;
    this.element.value = value;
  };

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['fhir'] && this.fhir) {
      this.fhir = decodeURIComponent(this.fhir);
      this.processJson(this.fhir);
    }
  }


  private processJson(json: string): void {
    try {
      this.structureDefinitionValue = StructureDefinitionFhirMapperUtil.mapToKeyValue(JSON.parse(json));
      console.log(this.structureDefinitionValue)
      this.initTree(this.structureDefinitionValue);
    } catch (e) {
      console.error("Failed to init structure definition from JSON", e);
    }
  }


  private initTree(val: any): void {
    this.treeOptions = undefined;
    setTimeout(() => this.treeOptions = this.mapDefToNode(val));
  }

  private mapDefToNode(object: any): MuiTreeNodeOptions[] | undefined {
    if (!(object instanceof Object)) {
      return undefined;
    }

    return Object.keys(object).filter(key => {
      const notElement = !['diff', 'snap', 'el'].includes(key);
      const correspondsToType = this.type === 'hybrid' || isDefined(object[key][this.type!]) || !isDefined(object[key][this.type === 'diff' ? 'snap' : 'diff']);
      return notElement && correspondsToType;
    }).map(key => {
      const data = this.transformer({
        mappings: object[key]['el']?.mapping,
        diff: object[key]['diff'],
        snap: object[key]['snap'],
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


  private transformer = (node: {snap: Element, diff: Element, mappings: ElementMapping}): StructureDefinitionData => {
    switch (this.type) {
      case 'snap':
        return this.snapTransformer(node);
      case 'diff':
        return this.diffTransformer(node);
      case 'hybrid':
        return this.hybridTransformer(node);
    }
  };

  private snapTransformer = ({snap, mappings}: {snap: Element, mappings: ElementMapping}): StructureDefinitionData => ({
    element: snap,
    type: snap?.type?.[0]?.code,
    targetProfile: snap?.type?.[0]?.targetProfile,
    fixedUri: snap?.fixedUri,
    fixedCoding: snap?.fixedCoding ? snap.fixedCoding : undefined,
    cardinality: isDefined(snap?.min) || isDefined(snap?.max) ? (isDefined(snap?.min) ? snap?.min : '*') + '..' + (isDefined(snap?.max) ? snap?.max : '*') : '',
    short: snap?.short,
    definition: isDefined(snap?.definition) && snap?.definition !== snap?.short ? snap?.definition : undefined,
    binding: snap?.binding,
    mappings: snap?.mapping || mappings,
  });

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

  private hybridTransformer = ({diff, snap, mappings}: {snap: Element, diff: Element, mappings: ElementMapping}): StructureDefinitionData => ({
    element: diff || snap,
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


  protected lastWordFromUrl = (url: string): string | undefined => {
    return url.split('/').pop();
  };
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
