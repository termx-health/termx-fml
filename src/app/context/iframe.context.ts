import {Bundle, FhirResource, StructureDefinition, StructureMap} from 'fhir/r5';
import {BehaviorSubject, Observable, Subject, take} from 'rxjs';
import {EditorContext} from './editor.context';

type ExportFormat = 'json' | 'json+svg' | string;


type Requests = LoadAction | ExportAction | RenderFmlAction;

interface LoadAction {
  action: 'load',
  bundle: Bundle<StructureDefinition>,
  structureMap?: StructureMap,
  contained?: FhirResource[],
}

interface ExportAction {
  action: 'export',
  format: ExportFormat
}

interface RenderFmlAction {
  action: 'render-fml',
  fml: string
}


type Messages = InitMessage | SaveMessage | ExportMessage | FmlRenderMessage | ExitMessage;

interface InitMessage {
  event: 'init'
}

interface SaveMessage {
  event: 'save'
}

interface ExportMessage {
  event: 'export',
  data: string,
  format: ExportFormat
}

interface FmlRenderMessage {
  event: 'render-fml',
  structureMap: StructureMap
}

interface ExitMessage {
  event: 'exit'
}


export class IframeContext implements EditorContext {
  public maps$ = new BehaviorSubject<string[]>([]);
  public structureMap$ = new BehaviorSubject<StructureMap>(undefined);
  public bundle$ = new BehaviorSubject<Bundle<StructureDefinition>>(undefined);
  public contained$ = new BehaviorSubject<FhirResource[]>([]);

  private _renderFml$ = new Subject<string>();

  private _postMessage(msg: Messages): void {
    window.parent.postMessage(JSON.stringify(msg), '*');
  }


  public constructor(private opt: {
    exportMap: (format: ExportFormat) => Promise<StructureMap>
  }) {
    this._attachListener();
    this._postMessage({event: 'init'});
  }


  private _attachListener(): void {
    window.addEventListener("message", event => {
        console.log(event);
        if (event.origin === location.origin) {
          // return;
        }

        const msg: Requests = JSON.parse(event.data);
        switch (msg.action) {
          case 'load':
            this.contained$.next(msg.contained ?? []);
            this.structureMap$.next(msg.structureMap);
            this.bundle$.next(msg.bundle);
            break;
          case 'export':
            this.opt.exportMap(msg.format).then(sm => {
              this._postMessage({event: 'export', data: JSON.stringify(sm), format: msg.format});
            });
            break;
          case 'render-fml':
            this._renderFml$.next(msg.fml);
            break;
        }
      }
    );
  }


  public selectMap(): void {
    throw Error('Not supported!');
  }

  public get selectedMapName(): string {
    return this.structureMap$.getValue()?.name;
  }

  public renderFML(sm: StructureMap): Observable<string> {
    this._postMessage({
      event: 'render-fml',
      structureMap: sm
    });
    // see this._attachListener() where next val is emitted
    return this._renderFml$.pipe(take(1));
  }

  public importMap(sm: StructureMap): void {
    this.structureMap$.next(sm);
  }

  public saveMap(): void {
    this._postMessage({event: 'save'});
  }

  public exit(): void {
    this._postMessage({event: 'exit'});
  }

  public isSaved(): boolean {
    return false;
  }
}
