import {Component, isDevMode, OnInit, ViewChild} from '@angular/core';
import {FMLStructureGroup} from './fml/fml-structure';
import {StructureMap} from 'fhir/r5';
import {HttpCacheService, isDefined} from '@kodality-web/core-util';
import {MuiModalContainerComponent, MuiNotificationService} from '@kodality-web/marina-ui';
import {HttpClient} from '@angular/common/http';
import {FmlStructureComposer} from './fml/fml-structure-composer';
import {FMLGraph} from './fml/fml-graph';
import {saveAs} from 'file-saver';
import {EditorComponent} from './editor.component';
import {IframeContext} from './context/iframe.context';
import {EditorContext} from './context/editor.context';
import {LocalContext} from './context/local.context';
import {toSvg} from 'html-to-image';
import {fromPx} from './fml/fml.utils';


@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html'
})
export class AppComponent implements OnInit {
  protected ctx: EditorContext;
  protected fml: {text: string, json: StructureMap};
  protected isDev = isDevMode();
  protected isAnimated = true;

  @ViewChild('changeModal') public changeModal: MuiModalContainerComponent;
  protected changes: {text: string, apply: () => void}[] = [];

  @ViewChild(EditorComponent) public editor: EditorComponent;

  constructor(
    private http: HttpClient,
    private cache: HttpCacheService,
    private notificationService: MuiNotificationService,
  ) { }


  public ngOnInit(): void {
    this.ctx = this.isIframe
      ? new IframeContext({
        exportMap: async format => {
          const sm = this.export();
          if (format === 'json+svg') {
            sm.extension.push({
              url: 'fml-svg',
              valueString: await this.generateSvg()
            });
            return sm;
          }
          await Promise.resolve();
          return sm;
        }
      })
      : new LocalContext(this.http, this.cache);
  }


  /* Left side */

  // New
  protected initFromGroup(groupName: string, fmlGroup: FMLStructureGroup): void {
    const fml = this.editor.initFmlFromGroup(this.ctx.bundle$.getValue(), fmlGroup);
    const sm = FmlStructureComposer.generate(fml, {mapName: groupName});
    this.ctx.importMap(sm);
  }

  // Import
  protected importStructureMap(m: MuiModalContainerComponent, json: string): void {
    if (isDefined(json)) {
      const sm = JSON.parse(json);
      this.ctx.importMap(sm);
      m.close();
    }
  }

  // Export
  protected exportStructureMap(): void {
    const sm = this.export();
    const blob = new Blob([JSON.stringify(sm, null, 2)], {type: 'application/json'});
    saveAs(blob, `${sm.name}.json`);
  }

  // FML
  protected viewAsFML(m: MuiModalContainerComponent): void {
    const map = this.export();

    const url = 'http://localhost:8200/transformation-definitions/generate-fml';
    this.http.post<{fml: string}>(url, {structureMap: JSON.stringify(map)}).subscribe(resp => {
      this.fml = {
        text: resp.fml
          .replaceAll(',  ', ',\n    ')
          .replaceAll(' ->  ', ' ->\n    '),
        json: map
      };
      m.open();
    });
  }

  // Save
  protected save(force = false): void {
    this.changes = [];
    if (!force) {
      const fml = this.editor.fmlGroup;
      const sources = Object.values(fml.objects).filter(o => o.mode === 'source');

      const unlinkedRules = fml.rules.filter(rule => fml.getSources(rule.name).length === 0 && fml.getTargets(rule.name).length > 0);
      if (unlinkedRules.length) {
        if (sources.length >= 2) {
          console.log(`Aborting automatic source setting, multiple (${sources.length}) sources found`);
          return;
        }

        unlinkedRules.forEach(rule => {
          this.changes.push({
            text: `Connection from <b>${sources[0].name}</b> to <b>${rule.name}</b>`,
            apply: () => {
              const conn = fml.newFMLConnection(sources[0].name, 0, rule.name, 0);
              fml.putConnection(conn);
              this.editor.editor._createConnection(conn.sourceObject, conn.sourceFieldIdx + 1, conn.targetObject, conn.targetFieldIdx + 1);
            }
          });
        });
      }

      if (this.changes.length) {
        this.changeModal.open();
        return;
      }
    }

    try {
      const sm = this.export();
      this.ctx.saveMap(sm);
      if (!this.isIframe) {
        this.notificationService.success("Saved", 'Check console for any errors!', {placement: 'top'});
      }
    } catch (e) {
      /* empty */
    }
  }

  protected applyChanges(): void {
    this.changes.forEach(c => c.apply());
    this.changes = [];
    this.changeModal.close();
  }

  protected cancelChanges(): void {
    this.changes = [];
    this.changeModal.close();
  }


  /* Right side */

  protected setAnimation(animated: boolean): void {
    this.editor.setAnimation(animated);
  }

  protected zoomIn(): void {
    this.editor.zoomIn();
  }

  protected zoomOut(): void {
    this.editor.zoomOut();
  }

  protected expandAll(): void {
    this.editor.setExpanded(true);
  }

  protected collapseAll(): void {
    this.editor.setExpanded(false);
  }

  protected autoLayout(): void {
    this.editor.autoLayout();
  }

  protected topology(): void {
    const sorted = FMLGraph.fromFML(this.editor.fmlGroup).topologySort();
    const order = Object.keys(sorted).sort(e => sorted[e]).reverse();

    const nodeEls = Array.from(document.getElementsByClassName('node-meta'));
    const timeout = 500;

    order.forEach((o, i) => {
      nodeEls.filter(e => e.textContent.trim() === o).forEach(e => {
        setTimeout(() => e.closest<HTMLElement>('.drawflow-node').style.backgroundColor = 'var(--color-primary-2)', (i + 1) * timeout);
      });
    });

    setTimeout(() => nodeEls.forEach(e => e.closest<HTMLElement>('.drawflow-node').style.backgroundColor = ''), (order.length + 1) * timeout);
  }

  protected exit(): void {
    this.ctx.exit();
  }


  /* Utils */

  private export(): StructureMap {
    try {
      return this.editor.export();
    } catch (e) {
      this.notificationService.error('Export failed', e);
      console.error(e);
      throw e;
    }
  }

  private async generateSvg(): Promise<string> {
    const container = document.getElementById('drawflow');
    const wrapper = container.firstElementChild as HTMLElement;

    // create container
    const cp = document.createElement('div');
    cp.classList.add('drawflow');
    cp.style.padding = `12px`;
    document.body.appendChild(cp);

    // copy entities to new container
    Array.from(wrapper.children).forEach((c: HTMLElement) => {
      cp.append(c.cloneNode(true));
    });

    const nodes = Array.from(cp.children) as HTMLElement[];

    // calculate position and dimensions of object nodes
    const coordinates = nodes
      .filter(n => n.classList.contains('parent-node'))
      .map(n => (n.firstElementChild as HTMLElement))
      .filter(Boolean)
      .map((n => {
        const {left, top, width, height} = n.getBoundingClientRect();
        return ({
          x: left,
          y: top,
          width: width,
          height: height,
          offsetLeft: fromPx(n.style.left),
          offsetTop: fromPx(n.style.top),
        });
      }));

    const maxWidth = Math.max(...coordinates.map(c => c.x + c.width));
    const minWidth = Math.min(...coordinates.map(c => c.x));
    const minOffsetLeft = Math.min(...coordinates.map(c => c.offsetLeft));

    const maxHeight = Math.max(...coordinates.map(c => c.y + c.height));
    const minHeight = Math.min(...coordinates.map(c => c.y));
    const minHeightLeft = Math.min(...coordinates.map(c => c.offsetTop));

    // offset elements into the most left and top position
    nodes.forEach(n => {
      n.style.marginLeft = `${-1 * minOffsetLeft}px`;
      if (n.classList.contains('parent-node')) {
        n.style.marginTop = `${-1 * minHeightLeft}px`;
      }
    });

    // remove redundant classes on objects
    nodes
      .map(n => n.firstElementChild as HTMLElement)
      .filter(Boolean)
      .forEach(n => n.classList.remove('selected'));

    // remove meta information
    Array.from(cp.getElementsByClassName('node-meta')).forEach(n => n.remove());

    // magic
    return toSvg(cp, {
      width: maxWidth - minWidth + 24,
      height: maxHeight - minHeight + 24
    }).then(dataUrl => {
      cp.remove();
      return dataUrl;
    }).catch(() => {
      cp.remove();
      return undefined;
    });
  }

  protected get isIframe(): boolean {
    try {
      return window.self !== window.top;
    } catch (e) {
      return true;
    }
  }
}
