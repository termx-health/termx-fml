import {NgModule} from '@angular/core';
import {BrowserModule} from '@angular/platform-browser';

import {RootRoutingModule} from './root-routing.module';
import {AppComponent} from './app.component';
import {HttpClient, HttpClientModule} from '@angular/common/http';
import {MarinaUiModule} from '@kodality-web/marina-ui';
import {CoreI18nService, CoreUtilModule, HttpCacheService} from '@kodality-web/core-util';
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
import {RootComponent} from './root.component';
import {isIframe} from './global';
import {EditorContext} from './context/editor.context';
import {IframeContext} from './context/iframe.context';
import {StandaloneContext} from './context/standalone.context';
import {ValidationComponent} from './validate/validation.component';
import {CdkMenu, CdkMenuBar, CdkMenuItem, CdkMenuTrigger} from '@angular/cdk/menu';


@NgModule({
  declarations: [
    RootComponent,
    UpdateVersionComponent,

    AppComponent,
    EditorComponent,
    StructureMapSetupComponent,
    FmlViewComponent,
    ObjectViewComponent,
    RuleViewComponent,

    StructureDefinitionTreeComponent,
    StructureDefinitionSelectComponent,

    ValidationComponent
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    RootRoutingModule,
    FormsModule,
    HttpClientModule,

    MarinaUiModule,
    CoreUtilModule,

    CdkMenuBar,
    CdkMenu,
    CdkMenuItem,
    CdkMenuTrigger,
  ],
  providers: [
    {
      provide: APP_BASE_HREF,
      useFactory: (): string => environment.baseHref
    },
    {
      provide: EditorContext,
      useFactory: (http: HttpClient): EditorContext => {
        if (isIframe()) {
          return new IframeContext();
        }
        return new StandaloneContext(http, new HttpCacheService());
      },
      deps: [HttpClient]
    }
  ],
  bootstrap: [RootComponent]
})
export class RootModule {
  public constructor(muiTranslate: CoreI18nService) {
    muiTranslate.use('en');
  }
}
