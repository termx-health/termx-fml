import {Bundle, StructureDefinition, StructureMap} from 'fhir/r5';
import {BehaviorSubject} from 'rxjs';
import {EditorContext} from './editor.context';

type Requests = LoadRequest | ExportRequest;

interface LoadRequest {
  action: 'load',
  bundle: Bundle<StructureDefinition>,
  structureMap?: StructureMap
}

interface ExportRequest {
  action: 'export',
  format: 'json' | string
}


type Messages = InitMessage | SaveMessage | ExportMessage | ExitMessage;

interface InitMessage {
  event: 'init'
}

interface SaveMessage {
  event: 'save'
}

interface ExportMessage {
  event: 'export',
  data: string,
  format: 'json' | string
}

interface ExitMessage {
  event: 'exit'
}


export class IframeContext implements EditorContext {
  public maps$ = new BehaviorSubject<string[]>([]);
  public structureMap$ = new BehaviorSubject<StructureMap>(undefined);
  public bundle$ = new BehaviorSubject<Bundle<StructureDefinition>>(undefined);


  private _postMessage(msg: Messages): void {
    window.parent.postMessage(JSON.stringify(msg), '*');
  }


  public constructor() {
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
            this.structureMap$.next(msg.structureMap);
            this.bundle$.next(msg.bundle);
            break;
          case 'export': {
            const sm = this.structureMap$.getValue();
            this._postMessage({event: 'export', data: JSON.stringify(sm), format: msg.format});
            break;
          }
        }
      }
    );
  }

  public get selectedMapName(): string {
    return this.structureMap$.getValue()?.name;
  }

  public selectMap(_name: string): void {
    throw Error('not implemented');
  }

  public importMap(sm: StructureMap): void {
    this.structureMap$.next(sm);
  }

  public saveMap(_sm: StructureMap): void {
    this._postMessage({event: 'save'});
  }

  public exit(): void {
    this._postMessage({event: 'exit'});
  }

  public isSaved = (_name: string): boolean => {
    return false;
  };
}
