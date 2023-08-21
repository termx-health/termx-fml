import {Bundle, StructureDefinition, StructureMap} from 'fhir/r5';
import {BehaviorSubject} from 'rxjs';
import {EditorStorage} from './storage';


export class IframeStorage implements EditorStorage {
  public maps$ = new BehaviorSubject<string[]>([]);
  public structureMap$ = new BehaviorSubject<StructureMap>(undefined);
  public bundle$ = new BehaviorSubject<Bundle<StructureDefinition>>(undefined);


  private _postMessage(message: any): void {
    window.parent.postMessage(JSON.stringify(message), '*');
  }


  public constructor() {
    this._postMessage({event: 'init'});

    window.addEventListener("message", (event) => {
        if (event.origin === 'http://localhost:4300') {
          return;
        }

        const msg: {action: 'load', bundle: Bundle<StructureDefinition>, structureMap?: StructureMap} = JSON.parse(event.data);
        console.log("received from parent", msg);

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
    this._postMessage({event: 'save', data: sm});
  }

  public isSaved = (_name: string): boolean => {
    return false;
  };
}
