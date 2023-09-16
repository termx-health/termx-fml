import {Component, isDevMode, OnInit} from '@angular/core';
import {interval} from 'rxjs';
import {HttpClient} from '@angular/common/http';
import {MuiNotificationService} from '@kodality-web/marina-ui';

@Component({
  selector: 'app-update-version',
  template: ``
})
export class UpdateVersionComponent implements OnInit {
  constructor(
    private http: HttpClient,
    private notificationService: MuiNotificationService,
  ) { }

  public ngOnInit(): void {
    if (isDevMode()) {
      return;
    }

    interval(5000).subscribe(val => {
      this.http.get(`./assets/env.js?ts=${new Date().getTime()}`, {responseType: 'text'}).subscribe(resp => {
        if (val === 0) {
          localStorage.setItem('env', resp);
        } else if (localStorage.getItem('env') !== resp) {
          this.notificationService.warning("New version", "Save changes and refresh browser window", {duration: 0, messageKey: 'update-version'});
        }
      });
    });
  }
}
