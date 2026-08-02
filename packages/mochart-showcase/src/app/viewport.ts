// The showcase's one layout breakpoint JS needs to know about: the wall (and
// the demo page's side-by-side split) only exist at desktop widths. The
// stylesheet uses the same 1000px figure — keep them in sync by hand.

const desktopQuery = '(min-width: 1000px)';

export function isDesktopViewport(): boolean {
  return window.matchMedia(desktopQuery).matches;
}

export function watchDesktopViewport(onChange: (isDesktop: boolean) => void): () => void {
  const query = window.matchMedia(desktopQuery);
  const listener = (event: MediaQueryListEvent): void => onChange(event.matches);
  query.addEventListener('change', listener);
  return () => query.removeEventListener('change', listener);
}
