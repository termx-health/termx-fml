import {Bundle, StructureDefinition, StructureMap} from 'fhir/r5';
import {BehaviorSubject, Observable} from 'rxjs';

export interface EditorContext {
  maps$: BehaviorSubject<string[]>
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
