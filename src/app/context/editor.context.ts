import {Bundle, StructureDefinition, StructureMap} from 'fhir/r5';
import {BehaviorSubject, Observable} from 'rxjs';
import {Injectable} from '@angular/core';

export type ExportFormat = 'json' | 'json+svg' | string;

interface EditorContextOpts {
  exportMap?: (format: ExportFormat) => Promise<StructureMap>
}

@Injectable({providedIn: 'root'})
export abstract class EditorContext {
  // the list of available StructureMaps
  maps$ = new BehaviorSubject<string[]>([]);

  bundle$ = new BehaviorSubject<Bundle<StructureDefinition>>(undefined);
  structureMap$ = new BehaviorSubject<StructureMap>(undefined);
  externalStructureMaps$ = new BehaviorSubject<StructureMap[]>([]);

  opts: EditorContextOpts = {};

  public configure(opts: EditorContextOpts): void {
    this.opts = opts ?? {};
  }

  abstract get selectedMapName(): string;

  abstract selectMap(name: string): void;


  abstract renderFML(sm: StructureMap): Observable<string>;

  abstract importMap(sm: StructureMap): void;

  abstract saveMap(sm: StructureMap): void;

  abstract exit(): void;


  abstract isSaved(name: string): boolean;
}
