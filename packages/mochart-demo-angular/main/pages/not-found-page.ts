import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';

import { demoText } from '@mochart/demo-common';

@Component({
  selector: 'app-not-found-page',
  styles: [':host { display: contents; }'],
  template: '<div class="mochart-demo-message"><div class="demo-alert demo-alert-error" role="alert">{{ text.noRoute(path) }}</div></div>'
})
export class NotFoundPage {
  readonly text = demoText.routeErrors;
  private readonly router = inject(Router);

  get path(): string {
    return this.router.url;
  }
}
