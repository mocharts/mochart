# @mochart/showcase

Curated, mobile-first feature showcase for the
[@mochart/core](../mochart/README.md) charting library (private, not
published).

Where the demo galleries ([@mochart/demo-vanilla](../mochart-demo-vanilla/README.md)
and the framework ports) are organized by *mode* over a shared demo list, the
showcase is organized by *feature*: every capability of the library gets
exactly one polished, deep-linkable home, and every demo page is also a
playground:

- **Gallery** (`/`): feature sections with live mini-chart thumbnails
  (mounted lazily via IntersectionObserver).
- **Demo page** (`/d/<slug>`): the chart plus Config / Data / About panels.
  The config panel is powered by [@mochart/editor](../mochart-editor/README.md)
  (completions, hover docs, live movalid diagnostics); edits apply live, and a
  mochart-invalid config renders the chart's own config-error state.
- **Deterministic randomize**: `?seed=N` in the URL (up to four digits);
  datasets come from demo-common's seeded generators, so any state is
  reproducible by link. A reused demo's generic random spec is derived from
  its curated rows ([src/content/randomFromCurated.ts](src/content/randomFromCurated.ts)):
  category count, range and spacing, and the series value range. Each seed
  then walks that category window
  ([src/content/randomForSeed.ts](src/content/randomForSeed.ts)): the
  window's centre takes a seeded random walk away from the curated one, and a
  window inside a single day also walks its interval, so successive seeds
  change which categories are in view rather than only reshuffling values.
  An entry can pin the walk with `walkBounds` (Clipped Values keeps its
  window inside its axis; Easing keeps its six categories fixed). Play steps
  the seed to showcase staged transitions.
- **Share & export**: a compressed `#s=` hash payload carries config/data
  edits; SVG/PNG export via [@mochart/export](../mochart-export/README.md).
- **Wall** (`/wall`, desktop only): a grid of charts driven by one shared
  seed so the whole board transitions together.
- **Specials**: a staged-animation player (slow-motion speed control), an
  axis-layout morph player, an easing picker, a loading/error/empty state
  switcher, a live interaction-callback log, and a sparklines page.

Reused demo configs/data come from [@mochart/demo-data](../mochart-demo-data/README.md);
new showcase-only demos live in [src/content/locals.ts](src/content/locals.ts)
and the curated manifest in [src/content/manifest.ts](src/content/manifest.ts).
Components are plain factory functions returning DOM elements (the same
no-framework idiom as demo-vanilla); the stylesheet is mobile-first with
phone / tablet / desktop tiers and VitePress-synced dark mode.

## Run

This repo uses npm workspaces; install once from the repo root, then:

```sh
npm run dev:showcase   # vite dev server on http://localhost:5182
```

Or from this package: `npm run dev`, `npm run build`, `npm run preview`
(port 4182), `npm run typecheck`, `npm run lint`, `npm test` (vitest unit
tests over the content derivation, seed walk and share codec) and
`npm run test:e2e` (the Playwright smoke suite, also run by root
`npm run test:e2e`).

The deployed site places the showcase at `/showcase/` next to the docs and
the demo galleries (see `scripts/build-pages.mjs` and the docs site's nav
entry). Under that base a bare `/<slug>` redirects to `/d/<slug>`, and deep
links are restored through the docs 404 redirect on GitHub Pages and the
`_redirects` rewrite on Cloudflare Pages.
