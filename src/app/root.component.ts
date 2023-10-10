import {Component} from '@angular/core';


@Component({
  selector: 'app-root',
  template: `
    <router-outlet></router-outlet>
    <app-update-version/>
  `
})
export class RootComponent {
}
