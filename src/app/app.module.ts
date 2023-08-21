import {NgModule} from '@angular/core';
import {BrowserModule} from '@angular/platform-browser';

import {AppRoutingModule} from './app-routing.module';
import {AppComponent} from './app.component';
import {HttpClientModule} from '@angular/common/http';
import {MarinaUiModule} from '@kodality-web/marina-ui';
import {CoreI18nService, CoreUtilModule} from '@kodality-web/core-util';
import {BrowserAnimationsModule} from '@angular/platform-browser/animations';
import {FormsModule} from '@angular/forms';
import {APP_BASE_HREF} from '@angular/common';
import {environment} from '../environments/environment';
import {RuleViewComponent} from './components/fml/rule-view.component';
import {ObjectViewComponent} from './components/fml/object-view.component';
import {FmlViewComponent} from './components/fml/fml-view.component';
import {StructureDefinitionSelectComponent} from './components/structure-definition/structure-definition-select.component';
import {StructureDefinitionTreeComponent} from './components/structure-definition/structure-definition-tree.component';
import {StructureMapSetupComponent} from './components/structure-map-setup.component';
import {UpdateVersionComponent} from './components/update-version.component';
import {EditorComponent} from './editor.component';

@NgModule({
  declarations: [
    AppComponent,
    EditorComponent,
    FmlViewComponent,
    ObjectViewComponent,
    RuleViewComponent,
    StructureDefinitionTreeComponent,
    StructureDefinitionSelectComponent,
    StructureMapSetupComponent,
    UpdateVersionComponent,
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    AppRoutingModule,
    FormsModule,
    HttpClientModule,

    MarinaUiModule,
    CoreUtilModule,
  ],
  providers: [
    {provide: APP_BASE_HREF, useFactory: () => environment.baseHref}
  ],
  bootstrap: [AppComponent]
})
export class AppModule {
  public constructor(muiTranslate: CoreI18nService) {
    muiTranslate.use('en');
  }
}
