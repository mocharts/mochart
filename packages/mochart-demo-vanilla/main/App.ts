import demoData from '@mochart/demo-data';

import { demoText, isPhoneViewport, phoneFallbackDemoMode, watchPhoneViewport } from '@mochart/demo-common';
import type { SwitchableDemoMode } from '@mochart/demo-common';

import { getPath, navigate, onNavigate } from './router';

import { el } from '../src/components/misc/dom';
import { galleryPage } from '../src/components/gallery/GalleryPage';
import type { GalleryPageHandle } from '../src/components/gallery/GalleryPage';
import { demoSingle } from '../src/components/single/DemoSingle';
import type { DemoSingleHandle } from '../src/components/single/DemoSingle';
import { demoMulti } from '../src/components/multi/DemoMulti';
import type { DemoMultiHandle } from '../src/components/multi/DemoMulti';
import { demoRandom } from '../src/components/random/DemoRandom';
import type { DemoRandomHandle } from '../src/components/random/DemoRandom';
import { demoTransition } from '../src/components/transition/DemoTransition';
import { demoRotation } from '../src/components/rotation/DemoRotation';
import { demoSparkline } from '../src/components/sparkline/DemoSparkline';

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
//
// A phone has no Multi mode (the switcher leaves it out), so a /multi URL —
// shared link, bookmark, rotation — redirects to the fallback mode rather than
// rendering a grid the viewport cannot show.
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
    if (mode === 'multi' && isPhoneViewport()) {
      return { redirect: `/${phoneFallbackDemoMode}/${demoId}` };
    }
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

type View =
  | { kind: 'none' }
  | { kind: 'message'; el: HTMLElement }
  | { kind: 'gallery'; handle: GalleryPageHandle }
  | { kind: 'single'; handle: DemoSingleHandle }
  | { kind: 'multi'; handle: DemoMultiHandle }
  | { kind: 'random'; handle: DemoRandomHandle }
  | { kind: 'transition' | 'rotation' | 'sparkline'; el: HTMLElement; destroy: () => void };

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

export function mountApp(root: HTMLElement): void {
  let view: View = { kind: 'none' };

  function clearView(): void {
    if (view.kind === 'gallery' || view.kind === 'single' || view.kind === 'multi' || view.kind === 'random') {
      view.handle.destroy();
    }
    else if (view.kind === 'transition' || view.kind === 'rotation' || view.kind === 'sparkline') {
      view.destroy();
    }
    root.replaceChildren();
    view = { kind: 'none' };
  }

  function showMessage(text: string): void {
    clearView();
    const element = el('div', { className: 'mochart-demo-message' }, [
      el('div', { className: 'demo-alert demo-alert-error', attrs: { role: 'alert' }, text })
    ]);
    root.append(element);
    view = { kind: 'message', el: element };
  }

  function showGallery(): void {
    if (view.kind === 'gallery') {
      return;
    }
    clearView();
    const gallery = galleryPage({
      demoData,
      siteRootUrl,
      onOpenDemo: demoId => navigate(`/single/${demoId}`),
      onOpenPage: mode => navigate(`/${mode}`)
    });
    root.append(gallery.el);
    view = { kind: 'gallery', handle: gallery };
  }

  function onBackToDemos(): void {
    navigate('/demos');
  }

  // Switching mode keeps the current demo; the demo id comes from the URL so
  // the switcher stays correct after any navigation.
  function makeOnModeChanged(): (nextDemoMode: SwitchableDemoMode) => void {
    return (nextDemoMode: SwitchableDemoMode) => {
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
  }

  function showShellDemo(mode: 'transition' | 'rotation' | 'sparkline'): void {
    if (view.kind === mode) {
      return;
    }
    clearView();
    const demo = mode === 'transition'
      ? demoTransition({ siteRootUrl, onBackToDemos })
      : mode === 'rotation'
        ? demoRotation({ siteRootUrl, onBackToDemos })
        : demoSparkline({ siteRootUrl, onBackToDemos });
    root.append(demo.el);
    view = { kind: mode, el: demo.el, destroy: () => demo.destroy() };
  }

  function render(): void {
    const route = resolveRoute(getPath());

    if (route.redirect !== undefined) {
      navigate(route.redirect, { replace: true });
      return;
    }
    if (route.notFound !== undefined) {
      showMessage(demoText.routeErrors.noRoute(route.notFound));
      return;
    }
    if (route.gallery === true) {
      showGallery();
      return;
    }
    if (route.mode === 'transition' || route.mode === 'rotation' || route.mode === 'sparkline') {
      showShellDemo(route.mode);
      return;
    }

    const demoId = route.demoId!;
    if (demoObjectMap[demoId] === undefined) {
      showMessage(demoText.routeErrors.noDemo(demoId));
      return;
    }

    if (route.mode === 'single') {
      if (view.kind === 'single') {
        view.handle.update(demoId);
      }
      else {
        clearView();
        const handle = demoSingle({
          demoData, initialDemoId: demoId, siteRootUrl,
          onModeChanged: makeOnModeChanged(), onBackToDemos
        });
        root.append(handle.el);
        view = { kind: 'single', handle };
      }
    }
    else if (route.mode === 'multi') {
      if (view.kind === 'multi') {
        view.handle.update(demoId);
      }
      else {
        clearView();
        const handle = demoMulti({
          demoData, initialDemoId: demoId, siteRootUrl,
          onModeChanged: makeOnModeChanged(), onBackToDemos
        });
        root.append(handle.el);
        view = { kind: 'multi', handle };
      }
    }
    else if (route.mode === 'random') {
      const randomId = Number(route.randomId);
      const isValidRandomId = randomId > Number.MIN_SAFE_INTEGER && randomId < Number.MAX_SAFE_INTEGER;
      if (!isValidRandomId) {
        showMessage(demoText.routeErrors.badRandomId(route.randomId!));
        return;
      }
      const incrementRandomId = () => {
        navigate(`/random/${getCurrentRandomDemoId()}/${Math.floor(getCurrentRandomId()) + 1}`);
      };
      const decrementRandomId = () => {
        navigate(`/random/${getCurrentRandomDemoId()}/${Math.floor(getCurrentRandomId()) - 1}`);
      };
      if (view.kind === 'random') {
        view.handle.update(demoId, randomId);
      }
      else {
        clearView();
        const handle = demoRandom({
          demoData, initialDemoId: demoId, siteRootUrl,
          onModeChanged: makeOnModeChanged(), onBackToDemos,
          randomId, incrementRandomId, decrementRandomId
        });
        root.append(handle.el);
        view = { kind: 'random', handle };
      }
    }
  }

  // The randomize buttons read the demo id / random id from the current URL so
  // they stay correct after any navigation.
  function getCurrentRandomDemoId(): string {
    const route = resolveRoute(getPath());
    return route.demoId !== undefined ? route.demoId : demoData.demoIds[0];
  }

  function getCurrentRandomId(): number {
    const route = resolveRoute(getPath());
    return Number(route.randomId);
  }

  onNavigate(render);
  // Rotating a phone into portrait can leave Multi mode on screen; re-resolving
  // the route takes it to the fallback mode and replaces the URL, exactly as it
  // would have on a fresh load at that width.
  watchPhoneViewport(() => render());
  render();
}
