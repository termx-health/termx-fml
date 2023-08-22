import {Component, isDevMode, OnInit, ViewChild} from '@angular/core';
import {FMLStructure} from './fml/fml-structure';
import {StructureMap} from 'fhir/r5';
import {HttpCacheService, isDefined} from '@kodality-web/core-util';
import {MuiModalContainerComponent, MuiNotificationService} from '@kodality-web/marina-ui';
import {HttpClient} from '@angular/common/http';
import {FmlStructureGenerator} from './fml/fml-structure-generator';
import {FMLGraph} from './fml/fml-graph';
import {saveAs} from 'file-saver';
import {EditorComponent} from './editor.component';
import {IframeContext} from './context/iframe.context';
import {EditorContext} from './context/editor.context';
import {LocalContext} from './context/local.context';


@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html'
})
export class AppComponent implements OnInit {
  protected ctx: EditorContext;
  protected fml: {text: string, json: StructureMap};
  protected isDev = isDevMode();
  protected isAnimated = true;

  @ViewChild(EditorComponent) public editor: EditorComponent;

  constructor(
    private http: HttpClient,
    private cache: HttpCacheService,
    private notificationService: MuiNotificationService,
  ) { }


  public ngOnInit(): void {
    this.ctx = this.isIframe
      ? new IframeContext({exportMap: ()=> this.export()})
      : new LocalContext(this.http, this.cache);
  }


  /* Left side */

  // New
  protected initFromWizard(groupName: string, fml: FMLStructure): void {
    const sm = FmlStructureGenerator.generate(fml, {mapName: groupName});
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

    this.http.post('http://localhost:8200/transformation-definitions/generate-fml', {structureMap: JSON.stringify(map)}, {responseType: 'text'})
      .subscribe(resp => {
        this.fml = {
          text: resp
            .replaceAll(',  ', ',\n    ')
            .replaceAll(' ->  ', ' ->\n    ')
            .replaceAll("#", "_"),
          json: map
        };
        m.open();
      });
  }

  // Save
  protected save(): void {
    try {
      const sm = this.export();
      this.ctx.saveMap(sm);
      this.notificationService.success("Saved", 'Check console for any errors!', {placement: 'top'});
    } catch (e) {
      /* empty */
    }
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

  protected autoLayout(): void {
    this.editor.autoLayout();
  }

  protected topology(): void {
    const sorted = FMLGraph.fromFML(this.editor.fml).topologySort();
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
      console.error(e)
      throw e;
    }
  }

  protected get isIframe(): boolean {
    try {
      return window.self !== window.top;
    } catch (e) {
      return true;
    }
  }
}
