import { Component, Input, inject } from '@angular/core';
import { Router } from '@angular/router';

import { demoText } from '@mochart/demo-common';
import demoData from '@mochart/demo-data';

import { DemoSingle } from '../../src/components/single/demo-single';
import { createDemoNavigation, isKnownDemo, siteRootUrl } from './navigation';

@Component({
  selector: 'app-single-page',
  imports: [DemoSingle],
  styles: [':host { display: contents; }'],
  template: `
    @if (!knownDemo) {
      <div class="mochart-demo-message"><div class="demo-alert demo-alert-error" role="alert">{{ text.noDemo(demoId) }}</div></div>
    } @else {
      <app-demo-single [demoData]="demoData" [initialDemoId]="demoId" [siteRootUrl]="siteRootUrl"
                       [onModeChanged]="onModeChanged" [onBackToDemos]="nav.onBackToDemos" />
    }
  `
})
export class SinglePage {
  /** Bound from the :demoId route param (withComponentInputBinding). */
  @Input({ required: true }) demoId!: string;

  readonly text = demoText.routeErrors;
  readonly demoData = demoData;
  readonly siteRootUrl = siteRootUrl;
  readonly nav = createDemoNavigation(inject(Router));
  readonly onModeChanged = this.nav.makeOnModeChanged(() => this.demoId);

  get knownDemo(): boolean {
    return isKnownDemo(this.demoId);
  }
}
