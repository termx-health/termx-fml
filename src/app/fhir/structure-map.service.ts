import {inject, Injectable} from '@angular/core';
import {Observable} from 'rxjs';
import {HttpClient} from '@angular/common/http';
import {StructureDefinition, StructureMap} from 'fhir/r5';


@Injectable({providedIn: 'root'})
export class StructureMapService {
  private http = inject(HttpClient);


  public getStructureDefinition(resource: string): Observable<StructureDefinition> {
    return this.http.get<StructureDefinition>(`assets/StructureDefinition/${resource}.json`);
  }

  public getStructureMap(url: string): Observable<StructureMap> {
    return this.http.get<StructureMap>(url);
  }
}
