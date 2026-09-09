import { html } from 'lit';
import { customElement, state } from 'lit/decorators.js';

import { getPath, navigate, subscribe } from './router';

import demoData from '@mochart/demo-data';

import { demoText, isDemoModeAvailable, phoneFallbackDemoMode } from '@mochart/demo-common';
import type { ShowcaseMode, SwitchableDemoMode } from '@mochart/demo-common';

import { LightElement } from '../src/components/misc/LightElement';
import { PhoneViewportController } from '../src/components/misc/PhoneViewportController';
import '../src/components/gallery/gallery-page';
import '../src/components/single/demo-single';
import '../src/components/multi/demo-multi';
import '../src/components/random/demo-random';
import '../src/components/transition/demo-transition';
import '../src/components/rotation/demo-rotation';
import '../src/components/sparkline/demo-sparkline';

interface Route {
  redirect?: string;
  notFound?: string;
  gallery?: boolean;
  mode?: string;
  demoId?: string;
  randomId?: string;
}

const { demoObjectMap } = demoData;

// The gallery at /demos is the landing route; a demo is always viewed at
// /<mode>/<demoId>. The legacy scheme used a 'demos' pseudo-demo-id for the
// list ("/single/demos"), so those URLs redirect to the gallery.
function resolveRoute(path: string): Route {
  const segments = path.split('/').filter(segment => segment.length > 0);
  if (segments.length === 0) {
    return { redirect: '/demos' };
  }
  const [mode, demoId, randomId] = segments;
  if (mode === 'demos' && segments.length === 1) {
    return { gallery: true };
  }
  if ((mode === 'single' || mode === 'multi' || mode === 'random') && demoId === 'demos') {
    return { redirect: '/demos' };
  }
  if ((mode === 'single' || mode === 'multi' || mode === 'random') && segments.length === 1) {
    return { redirect: '/demos' };
  }
  if ((mode === 'single' || mode === 'multi') && segments.length === 2) {
    return { mode, demoId };
  }
  if (mode === 'random' && segments.length === 2) {
    return { redirect: `/random/${demoId}/0` };
  }
  if (mode === 'random' && segments.length === 3) {
    return { mode, demoId, randomId };
  }
  if ((mode === 'transition' || mode === 'rotation' || mode === 'sparkline') && segments.length === 1) {
    return { mode };
  }
  return { notFound: path };
}

// A phone is not offered Multi mode, so a /multi/<demoId> URL — a shared link,
// or the width crossing the breakpoint while multi is showing — resolves to the
// fallback mode for the same demo, and redirects so the address bar agrees.
function applyViewportPolicy(route: Route, isPhone: boolean): Route {
  if (route.mode === 'multi' && !isDemoModeAvailable('multi', isPhone)) {
    return { redirect: `/${phoneFallbackDemoMode}/${route.demoId!}` };
  }
  return route;
}

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

const siteRootUrl = (import.meta.env.VITE_SITE_ROOT as string | undefined) ?? getDebugSiteRootUrl();

@customElement('demo-app')
export class DemoApp extends LightElement {
  @state() private path = getPath();

  private unsubscribe: (() => void) | null = null;

  // A width change re-runs the route, so rotating into phone width redirects
  // away from multi mode just as loading the URL there does.
  private viewport = new PhoneViewportController(this);

  private get route(): Route {
    return applyViewportPolicy(resolveRoute(this.path), this.viewport.isPhone);
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.unsubscribe = subscribe(() => {
      this.path = getPath();
    });
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  override updated(): void {
    const route = this.route;
    if (route.redirect !== undefined) {
      navigate(route.redirect, { replace: true });
    }
  }

  private onBackToDemos = (): void => {
    navigate('/demos');
  };

  // Switching mode keeps the current demo; the demo id comes from the URL so
  // the switcher stays correct after any navigation.
  private onModeChanged = (nextDemoMode: SwitchableDemoMode): void => {
    const route = resolveRoute(getPath());
    const demoId = route.demoId;
    if (demoId === undefined) {
      navigate('/demos');
    }
    else if (nextDemoMode === 'random') {
      navigate(`/random/${demoId}/0`);
    }
    else {
      navigate(`/${nextDemoMode}/${demoId}`);
    }
  };

  private onOpenDemo = (demoId: string): void => {
    navigate(`/single/${demoId}`);
  };

  private onOpenPage = (mode: ShowcaseMode): void => {
    navigate(`/${mode}`);
  };

  override render(): unknown {
    const route = this.route;
    if (route.redirect !== undefined) {
      // redirecting (in updated())
      return null;
    }
    if (route.notFound !== undefined) {
      return html`<div class="mochart-demo-message"><div class="demo-alert demo-alert-error" role="alert">${demoText.routeErrors.noRoute(route.notFound)}</div></div>`;
    }
    if (route.gallery === true) {
      return html`<gallery-page .demoData=${demoData} .siteRootUrl=${siteRootUrl}
          .onOpenDemo=${this.onOpenDemo} .onOpenPage=${this.onOpenPage}></gallery-page>`;
    }
    if (route.mode === 'transition') {
      return html`<demo-transition .siteRootUrl=${siteRootUrl} .onBackToDemos=${this.onBackToDemos}></demo-transition>`;
    }
    if (route.mode === 'rotation') {
      return html`<demo-rotation .siteRootUrl=${siteRootUrl} .onBackToDemos=${this.onBackToDemos}></demo-rotation>`;
    }
    if (route.mode === 'sparkline') {
      return html`<demo-sparkline .siteRootUrl=${siteRootUrl} .onBackToDemos=${this.onBackToDemos}></demo-sparkline>`;
    }
    const demoId = route.demoId!;
    if (demoObjectMap[demoId] === undefined) {
      return html`<div class="mochart-demo-message"><div class="demo-alert demo-alert-error" role="alert">${demoText.routeErrors.noDemo(demoId)}</div></div>`;
    }
    if (route.mode === 'single') {
      return html`<demo-single .demoData=${demoData} .initialDemoId=${demoId} .siteRootUrl=${siteRootUrl}
          .onModeChanged=${this.onModeChanged} .onBackToDemos=${this.onBackToDemos}></demo-single>`;
    }
    if (route.mode === 'multi') {
      return html`<demo-multi .demoData=${demoData} .initialDemoId=${demoId} .siteRootUrl=${siteRootUrl}
          .onModeChanged=${this.onModeChanged} .onBackToDemos=${this.onBackToDemos}></demo-multi>`;
    }
    const randomId = Number(route.randomId);
    const isValidRandomId = randomId > Number.MIN_SAFE_INTEGER && randomId < Number.MAX_SAFE_INTEGER;
    if (!isValidRandomId) {
      return html`<div class="mochart-demo-message"><div class="demo-alert demo-alert-error" role="alert">${demoText.routeErrors.badRandomId(route.randomId!)}</div></div>`;
    }
    // The randomize buttons read the demo id / random id from the routed URL;
    // the closures are rebuilt on every render, so they stay current.
    const incrementRandomId = (): void => {
      navigate(`/random/${demoId}/${Math.floor(randomId) + 1}`);
    };
    const decrementRandomId = (): void => {
      navigate(`/random/${demoId}/${Math.floor(randomId) - 1}`);
    };
    return html`<demo-random .demoData=${demoData} .initialDemoId=${demoId} .siteRootUrl=${siteRootUrl}
        .onModeChanged=${this.onModeChanged} .onBackToDemos=${this.onBackToDemos}
        .randomId=${randomId} .incrementRandomId=${incrementRandomId} .decrementRandomId=${decrementRandomId}></demo-random>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'demo-app': DemoApp;
  }
}
