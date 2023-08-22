import {Bundle, StructureDefinition, StructureMap} from 'fhir/r5';
import {BehaviorSubject} from 'rxjs';

export interface EditorContext {
  maps$: BehaviorSubject<string[]>
  structureMap$: BehaviorSubject<StructureMap>
  bundle$: BehaviorSubject<Bundle<StructureDefinition>>


  get selectedMapName(): string;

  selectMap(name: string): void;

  importMap(sm: StructureMap): void;

  saveMap(sm: StructureMap): void;

  exit(): void;


  isSaved(name: string): boolean;
}
