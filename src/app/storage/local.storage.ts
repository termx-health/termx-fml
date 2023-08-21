import {Bundle, StructureDefinition, StructureMap} from 'fhir/r5';
import {BehaviorSubject, forkJoin, map, mergeMap, Observable, of} from 'rxjs';
import {HttpClient} from '@angular/common/http';
import {HttpCacheService, isDefined, unique, uniqueBy} from '@kodality-web/core-util';
import {EditorStorage} from './storage';
import {substringAfterLast} from '../fml/fml.utils';


export class LocalStorage implements EditorStorage {
  private SELECTED_STRUCTURE_MAPS_KEY = "selected_structure_map";
  private STRUCTURE_MAPS_KEY = "structure_maps";


  public maps$ = new BehaviorSubject<string[]>([]);
  public structureMap$ = new BehaviorSubject<StructureMap>(undefined);
  public bundle$ = new BehaviorSubject<Bundle<StructureDefinition>>(undefined);


  private get _localMaps(): {[k: string]: StructureMap} {
    return JSON.parse(localStorage.getItem(this.STRUCTURE_MAPS_KEY) ?? '{}');
  }

  private _structureMap = (): Observable<StructureMap> => {
    const name = localStorage.getItem(this.SELECTED_STRUCTURE_MAPS_KEY);
    const url = `assets/StructureMap/${name}.json`;

    if (isDefined(name) && name in this._localMaps) {
      return of(this._localMaps[name]);
    }

    return this.http.get<StructureMap>(url);
  };

  private _resourceBundle = (sm: StructureMap): Observable<Bundle<StructureDefinition>> => {
    return this.http.get<string[]>("assets/StructureDefinition/index.json").pipe(mergeMap(resources => {
      const mapResources = sm.structure.map(s => substringAfterLast(s.url, '/'));

      const reqs$ = [...mapResources, ...resources].filter(unique).map(k => {
        return this.cache.put(k, this.http.get<StructureDefinition>(`assets/StructureDefinition/${k}.json`));
      });

      return forkJoin(reqs$).pipe(map(definitions => {
        return <Bundle<StructureDefinition>>{
          resourceType: 'Bundle',
          type: 'collection',
          entry: uniqueBy(definitions.map(def => ({resource: def})), e => e.resource.url)
        };
      }));
    }));
  };


  constructor(
    private http: HttpClient,
    private cache: HttpCacheService
  ) {
    this.http.get<string[]>("assets/StructureMap/index.json").subscribe(namesPersisted => {
      const namesLocal = Object.values(this._localMaps).map(m => m.name);
      const names = [...namesPersisted, ...namesLocal].filter(unique);

      this.maps$.next(names.sort((a, b) => a.localeCompare(b, undefined, {numeric: true, sensitivity: 'base'})));
      this.reinit();
    });
  }

  private reinit(): void {
    localStorage.setItem(this.SELECTED_STRUCTURE_MAPS_KEY, localStorage.getItem(this.SELECTED_STRUCTURE_MAPS_KEY) ?? "step3");

    this._structureMap().subscribe(resp => {
      this._resourceBundle(resp).subscribe(bundle => {
        this.structureMap$.next(resp);
        this.bundle$.next(bundle);
      });
    });
  }


  public get selectedMapName(): string {
    return this.structureMap$.getValue()?.name;
  }

  public selectMap(name: string): void {
    localStorage.setItem(this.SELECTED_STRUCTURE_MAPS_KEY, name);
    this.reinit();
  }

  public importMap(sm: StructureMap): void {
    this.saveMap(sm);
    this.reinit();
  }

  public saveMap(sm: StructureMap): void {
    localStorage.setItem(this.SELECTED_STRUCTURE_MAPS_KEY, sm.name);
    localStorage.setItem(this.STRUCTURE_MAPS_KEY, JSON.stringify({
      ...this._localMaps,
      [sm.name]: sm
    }));

    this.maps$.next([...this.maps$.getValue(), sm.name].filter(unique));
  }

  public exit(): void {
    throw Error('not implemented');
  }

  public isSaved = (name: string): boolean => {
    return name in this._localMaps;
  };
}
