import { initTheme } from '@mochart/demo-common';

import type { ThemeController } from './theme';

import { getPath, navigate, onNavigate } from './router';
import { el } from '../ui/dom';
import { getEntry } from '../content/manifest';
import { galleryPage } from '../components/GalleryPage';
import { demoPage } from '../components/DemoPage';
import { sparklinesPage } from '../components/SparklinesPage';
import { wallPage } from '../components/WallPage';

interface Route {
  redirect?: string;
  notFound?: string;
  gallery?: boolean;
  wall?: boolean;
  slug?: string;
}

function resolveRoute(path: string): Route {
  const segments = path.split('/').filter(segment => segment.length > 0);
  if (segments.length === 0) {
    return { gallery: true };
  }
  if (segments[0] === 'wall' && segments.length === 1) {
    return { wall: true };
  }
  if (segments[0] === 'd' && segments.length === 2) {
    return { slug: segments[1] };
  }
  // Bare /<slug> forgives a hand-typed link.
  if (segments.length === 1 && getEntry(segments[0]) !== undefined) {
    return { redirect: '/d/' + segments[0] };
  }
  return { notFound: path };
}

// The site build injects VITE_SITE_ROOT (the docs site root) so the gallery
// can link back to it; a standalone dev/build leaves it unset and no link
// renders. `?siteRoot` forces the link (to `/`) for styling without a site
// build, and `?siteRoot=<url>` points it at a specific target.
function getDebugSiteRootUrl(): string | undefined {
  const param = new URLSearchParams(window.location.search).get('siteRoot');
  if (param === null) {
    return undefined;
  }
  return param === '' ? '/' : param;
}

const siteRootUrl = (import.meta.env.VITE_SITE_ROOT as string | undefined) ?? getDebugSiteRootUrl();

type View =
  | { kind: 'none' }
  | { kind: 'gallery' | 'wall' | 'demo' | 'message'; key: string; el: HTMLElement; destroy: () => void };

export function mountApp(root: HTMLElement): void {
  const theme: ThemeController = initTheme();
  let view: View = { kind: 'none' };

  function clearView(): void {
    if (view.kind !== 'none') {
      view.destroy();
    }
    root.replaceChildren();
    view = { kind: 'none' };
  }

  function show(kind: 'gallery' | 'wall' | 'demo' | 'message', key: string, make: () => { el: HTMLElement; destroy?: () => void }): void {
    if (view.kind !== 'none' && view.kind === kind && view.key === key) {
      return;
    }
    clearView();
    const made = make();
    root.append(made.el);
    view = { kind, key, el: made.el, destroy: made.destroy ?? (() => {}) };
    window.scrollTo(0, 0);
  }

  function showMessage(text: string): void {
    show('message', text, () => ({
      el: el('div', { className: 'sc-message' }, [
        el('p', { attrs: { role: 'alert' }, text }),
        el('p', {}, [
          (() => {
            const link = el('a', { attrs: { href: '#' }, text: 'Back to the gallery' });
            link.addEventListener('click', event => {
              event.preventDefault();
              navigate('/');
            });
            return link;
          })()
        ])
      ])
    }));
  }

  function render(): void {
    const route = resolveRoute(getPath());
    if (route.redirect !== undefined) {
      navigate(route.redirect, { replace: true });
      return;
    }
    if (route.notFound !== undefined) {
      showMessage('No page found matching ' + route.notFound);
      return;
    }
    if (route.gallery === true) {
      show('gallery', 'gallery', () => galleryPage({ theme, siteRootUrl }));
      return;
    }
    if (route.wall === true) {
      show('wall', 'wall', () => wallPage({ theme, onBack: () => navigate('/') }));
      return;
    }
    const slug = route.slug!;
    const entry = getEntry(slug);
    if (entry === undefined) {
      showMessage('No demo found for id: ' + slug);
      return;
    }
    if (entry.special === 'sparklines') {
      show('demo', slug, () => sparklinesPage({ entry, theme, onBack: () => navigate('/') }));
      return;
    }
    show('demo', slug, () => demoPage({ entry, theme, onBack: () => navigate('/') }));
  }

  onNavigate(render);
  render();
}
