import {inject, Injectable} from '@angular/core';
import {Observable} from 'rxjs';
import {HttpClient} from '@angular/common/http';
import {FHIRStructureDefinition, FHIRStructureMap} from './models/fhir';


@Injectable({providedIn: 'root'})
export class StructureMapService {
  private http = inject(HttpClient)


  public getStructureDefinition(resource: string): Observable<FHIRStructureDefinition> {
    return this.http.get<FHIRStructureDefinition>(`https://hl7.org/fhir/${resource.toLowerCase()}.profile.json`)
  }

  public getStructureMap(name: string): Observable<FHIRStructureMap> {
    return this.http.get<FHIRStructureMap>(`https://www.hl7.org/fhir/${name}.json`)
  }
}
