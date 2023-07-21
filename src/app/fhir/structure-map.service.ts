import {inject, Injectable} from '@angular/core';
import {Observable} from 'rxjs';
import {HttpClient} from '@angular/common/http';
import {FHIRStructureDefinition, FHIRStructureMap} from './models/fhir';


@Injectable({providedIn: 'root'})
export class StructureMapService {
  private http = inject(HttpClient)


  public getStructureDefinition(url: string): Observable<FHIRStructureDefinition> {
    if (url.startsWith("http://hl7.org/fhir/StructureDefinition")) {
      return this.http.get<FHIRStructureDefinition>(`https://hl7.org/fhir/${url.split("http://hl7.org/fhir/StructureDefinition")[1].toLowerCase()}.profile.json`)
    }
    throw Error("FHIR Resource Provider not supported")
  }

  public getStructureMap(url: string): Observable<FHIRStructureMap> {
    return this.http.get<FHIRStructureMap>(url)
  }
}
