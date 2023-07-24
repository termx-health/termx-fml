import {NgModule} from '@angular/core';
import {BrowserModule} from '@angular/platform-browser';

import {AppRoutingModule} from './app-routing.module';
import {AppComponent} from './app.component';
import {HttpClientModule} from '@angular/common/http';
import {MarinaUiModule} from '@kodality-web/marina-ui';
import {CoreUtilModule} from '@kodality-web/core-util';
import {StructureDefinitionTreeComponent} from './fhir/components/structure-definition/structure-definition-tree.component';
import {BrowserAnimationsModule} from '@angular/platform-browser/animations';
import {FormsModule} from '@angular/forms';

@NgModule({
  declarations: [
    AppComponent,
    StructureDefinitionTreeComponent
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    AppRoutingModule,
    HttpClientModule,
    CoreUtilModule,
    MarinaUiModule,
    FormsModule
  ],

  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule {
}
