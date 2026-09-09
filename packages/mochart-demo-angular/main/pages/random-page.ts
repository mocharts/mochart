import { Component, Input, inject } from '@angular/core';
import { Router } from '@angular/router';

import { demoText } from '@mochart/demo-common';
import demoData from '@mochart/demo-data';

import { DemoRandom } from '../../src/components/random/demo-random';
import { createDemoNavigation, isKnownDemo, navigate, siteRootUrl } from './navigation';

@Component({
  selector: 'app-random-page',
  imports: [DemoRandom],
  styles: [':host { display: contents; }'],
  template: `
    @if (!knownDemo) {
      <div class="mochart-demo-message"><div class="demo-alert demo-alert-error" role="alert">{{ text.noDemo(demoId) }}</div></div>
    } @else if (!isValidRandomId) {
      <div class="mochart-demo-message"><div class="demo-alert demo-alert-error" role="alert">{{ text.badRandomId(randomId) }}</div></div>
    } @else {
      <app-demo-random [demoData]="demoData" [initialDemoId]="demoId" [siteRootUrl]="siteRootUrl"
                       [onModeChanged]="onModeChanged" [onBackToDemos]="nav.onBackToDemos"
                       [randomId]="randomIdNumber" [incrementRandomId]="incrementRandomId" [decrementRandomId]="decrementRandomId" />
    }
  `
})
export class RandomPage {
  /** Bound from the :demoId/:randomId route params (withComponentInputBinding). */
  @Input({ required: true }) demoId!: string;
  @Input({ required: true }) randomId!: string;

  readonly text = demoText.routeErrors;
  readonly demoData = demoData;
  readonly siteRootUrl = siteRootUrl;
  private readonly router = inject(Router);
  readonly nav = createDemoNavigation(this.router);
  readonly onModeChanged = this.nav.makeOnModeChanged(() => this.demoId);

  get knownDemo(): boolean {
    return isKnownDemo(this.demoId);
  }

  get randomIdNumber(): number {
    return Number(this.randomId);
  }

  get isValidRandomId(): boolean {
    return this.randomIdNumber > Number.MIN_SAFE_INTEGER && this.randomIdNumber < Number.MAX_SAFE_INTEGER;
  }

  incrementRandomId = (): void => {
    navigate(this.router, ['/random', this.demoId, Math.floor(this.randomIdNumber) + 1]);
  };

  decrementRandomId = (): void => {
    navigate(this.router, ['/random', this.demoId, Math.floor(this.randomIdNumber) - 1]);
  };
}
