import {Bundle, StructureDefinition, StructureMap} from 'fhir/r5';
import {BehaviorSubject} from 'rxjs';
import {EditorStorage} from './storage';

export interface LoadMessage {
  action: 'load',
  bundle: Bundle<StructureDefinition>,
  structureMap?: StructureMap
}

export class IframeStorage implements EditorStorage {
  public maps$ = new BehaviorSubject<string[]>([]);
  public structureMap$ = new BehaviorSubject<StructureMap>(undefined);
  public bundle$ = new BehaviorSubject<Bundle<StructureDefinition>>(undefined);


  private _postMessage(message: any): void {
    window.parent.postMessage(JSON.stringify(message), '*');
  }


  public constructor() {
    this._attachListener();
    this._postMessage({event: 'init'});
  }


  private _attachListener(): void {
    window.addEventListener("message", event => {
        if (event.origin === location.origin) {
          return;
        }

        const msg: LoadMessage = JSON.parse(event.data);
        switch (msg.action) {
          case'load':
            this.structureMap$.next(msg.structureMap);
            this.bundle$.next(msg.bundle);
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

  public saveMap(sm: StructureMap): void {
    this._postMessage({event: 'export', data: sm});
  }

  public exit(): void {
    this._postMessage({event: 'exit'});
  }

  public isSaved = (_name: string): boolean => {
    return false;
  };
}
