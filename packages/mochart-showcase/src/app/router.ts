// Tiny history-based router (same idiom as demo-vanilla's, adapted): routes
// match on the pathname, and `navigate` takes a path with an optional query
// string of its own. Unlike the galleries' router, the current query string is
// NOT carried across navigations. The showcase uses query params for
// per-view state (?seed=, /wall?d=), which must not leak between views.

interface ShowcaseWindowConfig {
  routerBasePath?: string;
}

let routerBasePath = '/';

const config = (window as unknown as { __config?: ShowcaseWindowConfig })['__config'];
if (config !== undefined && config['routerBasePath'] !== undefined) {
  routerBasePath = config['routerBasePath'];
}

const normalizedBase = routerBasePath.replace(/\/+$/, '');

function stripBasePath(pathname: string): string {
  if (normalizedBase !== '' && pathname.startsWith(normalizedBase)) {
    pathname = pathname.slice(normalizedBase.length);
  }
  return pathname === '' ? '/' : pathname;
}

let currentPath = stripBasePath(window.location.pathname);

type RouteListener = (path: string) => void;
const listeners = new Set<RouteListener>();

function notify(): void {
  for (const listener of listeners) {
    listener(currentPath);
  }
}

window.addEventListener('popstate', () => {
  currentPath = stripBasePath(window.location.pathname);
  notify();
});

export function getPath(): string {
  return currentPath;
}

/** The current query params (the part of the URL routes don't match on). */
export function getSearchParams(): URLSearchParams {
  return new URLSearchParams(window.location.search);
}

/**
 * Rewrite the current URL's query string in place (history.replaceState, no
 * route change, no notify). Used for view state like the seed param.
 */
export function replaceSearchParams(params: URLSearchParams): void {
  const search = params.toString();
  const url = normalizedBase + currentPath + (search === '' ? '' : '?' + search) + window.location.hash;
  window.history.replaceState(null, '', url);
}

/** The full href for a route path (for real anchor elements). */
export function hrefFor(to: string): string {
  return normalizedBase + to;
}

/** Navigate to a path (which may carry its own `?query`). */
export function navigate(to: string, { replace = false }: { replace?: boolean } = {}): void {
  const url = normalizedBase + to;
  if (replace) {
    window.history.replaceState(null, '', url);
  }
  else {
    window.history.pushState(null, '', url);
  }
  currentPath = stripBasePath(to.split('?')[0]);
  notify();
}

/** Subscribe to path changes; returns an unsubscribe function. */
export function onNavigate(listener: RouteListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
