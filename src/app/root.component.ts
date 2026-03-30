import {Component} from '@angular/core';


@Component({
  standalone: false,
  selector: 'app-root',
  template: `
    <router-outlet></router-outlet>
    <app-update-version/>
  `
})
export class RootComponent {
}
