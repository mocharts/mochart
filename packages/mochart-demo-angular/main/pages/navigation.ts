import { inject } from '@angular/core';
import { Router } from '@angular/router';
import type { CanActivateFn } from '@angular/router';

import { isPhoneViewport, phoneFallbackDemoMode } from '@mochart/demo-common';
import demoData from '@mochart/demo-data';

import type { SwitchableDemoMode } from '../../src/types';

// The site build injects VITE_SITE_ROOT (the docs site root) so the demo can
// link back to it; standalone dev/build leaves it unset and no link renders.
// Every view places the link itself (top-left, before its own navigation).
// For styling/debugging without a site build, `?siteRoot` forces the button
// (linking to `/`), and `?siteRoot=<url>` points it at a specific target.
function getDebugSiteRootUrl(): string | undefined {
  const param = new URLSearchParams(window.location.search).get('siteRoot');
  if (param === null) {
    return undefined;
  }
  return param === '' ? '/' : param;
}

export const siteRootUrl = (import.meta.env.VITE_SITE_ROOT as string | undefined) ?? getDebugSiteRootUrl();

/**
 * Navigate preserving the current query string (e.g. the ?siteRoot debug
 * switch); routes themselves only ever consume the pathname. `replaceUrl` is for
 * navigations the user did not ask for, which have no business in the history.
 */
export function navigate(router: Router, commands: (string | number)[], replaceUrl = false): void {
  void router.navigate(commands, { queryParamsHandling: 'preserve', replaceUrl });
}

export interface DemoNavigation {
  onBackToDemos: () => void;
  makeOnModeChanged: (getDemoId: () => string, replaceUrl?: boolean) => (nextDemoMode: SwitchableDemoMode) => void;
}

/**
 * The gallery/mode navigation callbacks shared by the routed pages: the
 * gallery lives at /demos and a demo is always viewed at /<mode>/<demoId>,
 * driven by @angular/router.
 */
export function createDemoNavigation(router: Router): DemoNavigation {
  return {
    onBackToDemos: () => navigate(router, ['/demos']),
    // Switching mode keeps the current demo; the demo id comes from the route
    // param binding so the switcher stays correct after any navigation.
    makeOnModeChanged: (getDemoId, replaceUrl = false) => (nextDemoMode) => {
      const demoId = getDemoId();
      if (nextDemoMode === 'random') {
        navigate(router, ['/random', demoId, 0], replaceUrl);
      }
      else {
        navigate(router, ['/', nextDemoMode, demoId], replaceUrl);
      }
    }
  };
}

/**
 * Multi mode isn't offered on a phone, so /multi/:demoId lands on the same demo
 * in the fallback mode there. The redirect keeps the query string and the
 * fragment, so the ?siteRoot switch and a #share= payload both survive it. A
 * multi payload is then dropped by the mode check in consumeShareState.
 */
export const multiPhoneFallbackGuard: CanActivateFn = (route) => {
  const demoId = route.paramMap.get('demoId');
  if (demoId === null || !isPhoneViewport()) {
    return true;
  }
  return inject(Router).createUrlTree(['/', phoneFallbackDemoMode, demoId], {
    queryParams: route.queryParams,
    fragment: route.fragment ?? undefined
  });
};

export function isKnownDemo(demoId: string): boolean {
  return demoData.demoObjectMap[demoId] !== undefined;
}
