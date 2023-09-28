import {NgModule} from '@angular/core';
import {RouterModule} from '@angular/router';
import {AppComponent} from './app.component';
import {ValidationComponent} from './validate/validation.component';

@NgModule({
  imports: [RouterModule.forRoot([
    {path: '', component: AppComponent},
    {path: 'validate', component: ValidationComponent},
  ])],
  exports: [RouterModule]
})
export class RootRoutingModule {
}
