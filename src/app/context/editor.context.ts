import {Bundle, StructureDefinition, StructureMap} from 'fhir/r5';
import {BehaviorSubject, Observable} from 'rxjs';

export interface EditorContext {
  // the list of available StructureMaps
  maps$: BehaviorSubject<string[]>;
  externalStructureMaps$: BehaviorSubject<StructureMap[]>
  structureMap$: BehaviorSubject<StructureMap>
  bundle$: BehaviorSubject<Bundle<StructureDefinition>>


  selectMap(name: string): void;

  get selectedMapName(): string;


  renderFML(sm: StructureMap): Observable<string>;

  importMap(sm: StructureMap): void;

  saveMap(sm: StructureMap): void;

  exit(): void;


  isSaved(name: string): boolean;
}
