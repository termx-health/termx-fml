import {inject, Injectable} from '@angular/core';
import {Observable} from 'rxjs';
import {HttpClient} from '@angular/common/http';
import {StructureDefinition, StructureMap} from 'fhir/r5';


@Injectable({providedIn: 'root'})
export class StructureMapService {
  private http = inject(HttpClient)


  public getStructureDefinition(resource: string): Observable<StructureDefinition> {
    return this.http.get<StructureDefinition>(`https://hl7.org/fhir/${resource.toLowerCase()}.profile.json`)
  }

  public getStructureMap(name: string): Observable<StructureMap> {
    return this.http.get<StructureMap>(`https://www.hl7.org/fhir/${name}.json`)
  }
}
