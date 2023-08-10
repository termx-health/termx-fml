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
import {APP_BASE_HREF} from '@angular/common';
import {environment} from '../environments/environment';
import {RuleViewComponent} from './components/rule-view.component';
import {ObjectViewComponent} from './components/object-view.component';

@NgModule({
  declarations: [
    AppComponent,
    StructureDefinitionTreeComponent,
    RuleViewComponent,
    ObjectViewComponent
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
  providers: [
    {provide: APP_BASE_HREF, useFactory: () => environment.baseHref}
  ],
  bootstrap: [AppComponent]
})
export class AppModule {
}
