# @mochart/showcase

Curated, mobile-first feature showcase for the
[@mochart/core](../mochart/README.md) charting library (private, not
published).

Where the demo galleries ([@mochart/demo-vanilla](../mochart-demo-vanilla/README.md)
and the framework ports) are organized by *mode* over a shared demo list, the
showcase is organized by *feature*: every capability of the library gets
exactly one polished, deep-linkable home, and every demo page is also a
playground:

- **Gallery** (`/`) — feature sections with live mini-chart thumbnails
  (mounted lazily via IntersectionObserver).
- **Demo page** (`/d/<slug>`) — the chart plus Config / Data / About panels.
  The config panel is powered by [@mochart/editor](../mochart-editor/README.md)
  (completions, hover docs, live movalid diagnostics); edits apply live, and a
  mochart-invalid config renders the chart's own config-error state.
- **Deterministic randomize** — `?seed=N` in the URL; datasets come from
  demo-common's seeded generators, so any state is reproducible by link.
  Play loops the seed to showcase staged transitions.
- **Share & export** — a compressed `#s=` hash payload carries config/data
  edits; SVG/PNG export via [@mochart/export](../mochart-export/README.md).
- **Wall** (`/wall`, desktop only) — a grid of charts driven by one shared
  seed so the whole board transitions together.
- **Specials** — a staged-animation player (slow-motion speed control), an
  axis-layout morph player, a loading/error/empty state switcher, a live
  interaction-callback log, and a sparklines page.

Reused demo configs/data come from [@mochart/demo-data](../mochart-demo-data/README.md);
new showcase-only demos live in [src/content/locals.ts](src/content/locals.ts)
and the curated manifest in [src/content/manifest.ts](src/content/manifest.ts).
Components are plain factory functions returning DOM elements (the same
no-framework idiom as demo-vanilla); the stylesheet is mobile-first with
phone / tablet / desktop tiers and VitePress-synced dark mode.

## Run

This repo uses npm workspaces; install once from the repo root, then:

```sh
npm run dev:showcase   # vite dev server on http://localhost:5181
```

Or from this package: `npm run dev`, `npm run build`, `npm run preview`
(port 4181), `npm run typecheck`.

See [docs/showcase-plan.md](../../docs/showcase-plan.md) for the plan and
status; deployment wiring is deliberately not set up yet.
