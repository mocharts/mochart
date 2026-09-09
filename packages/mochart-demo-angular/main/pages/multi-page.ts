import { Component, Input, inject } from '@angular/core';
import type { OnDestroy } from '@angular/core';
import { Router } from '@angular/router';

import { demoText, phoneFallbackDemoMode, watchPhoneViewport } from '@mochart/demo-common';
import demoData from '@mochart/demo-data';

import { DemoMulti } from '../../src/components/multi/demo-multi';
import { createDemoNavigation, isKnownDemo, siteRootUrl } from './navigation';

@Component({
  selector: 'app-multi-page',
  imports: [DemoMulti],
  styles: [':host { display: contents; }'],
  template: `
    @if (!knownDemo) {
      <div class="mochart-demo-message"><div class="demo-alert demo-alert-error" role="alert">{{ text.noDemo(demoId) }}</div></div>
    } @else {
      <app-demo-multi [demoData]="demoData" [initialDemoId]="demoId" [siteRootUrl]="siteRootUrl"
                      [onModeChanged]="onModeChanged" [onBackToDemos]="nav.onBackToDemos" />
    }
  `
})
export class MultiPage implements OnDestroy {
  /** Bound from the :demoId route param (withComponentInputBinding). */
  @Input({ required: true }) demoId!: string;

  readonly text = demoText.routeErrors;
  readonly demoData = demoData;
  readonly siteRootUrl = siteRootUrl;
  readonly nav = createDemoNavigation(inject(Router));
  readonly onModeChanged = this.nav.makeOnModeChanged(() => this.demoId);

  // Rotating into phone width applies the same policy as multiPhoneFallbackGuard,
  // which only sees the width the route was entered at. It replaces the entry the
  // way the guard's redirect does: pushing one would leave a multi URL behind
  // that the guard only redirects away from again, swallowing the first Back.
  private readonly onPhoneFallback = this.nav.makeOnModeChanged(() => this.demoId, true);

  private readonly unsubscribe = watchPhoneViewport(phone => {
    if (phone) {
      this.onPhoneFallback(phoneFallbackDemoMode);
    }
  });

  get knownDemo(): boolean {
    return isKnownDemo(this.demoId);
  }

  ngOnDestroy(): void {
    this.unsubscribe();
  }
}
