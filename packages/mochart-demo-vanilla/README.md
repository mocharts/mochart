# @mochart/demo-vanilla

Vanilla TypeScript demo gallery for the [@mochart/core](../mochart/README.md)
charting library (private, not published).

See it running live at [mochart.org/vanilla/demos](https://mochart.org/vanilla/demos).

The full-featured demo app in plain TypeScript — no framework, no vdom, no
reactivity layer. It is a feature-for-feature peer of the framework galleries
([@mochart/demo-angular](../mochart-demo-angular/README.md),
[@mochart/demo-lit](../mochart-demo-lit/README.md),
[@mochart/demo-react](../mochart-demo-react/README.md),
[@mochart/demo-svelte](../mochart-demo-svelte/README.md),
[@mochart/demo-vue](../mochart-demo-vue/README.md)): browse every demo chart in
three modes — single edits one chart's config and data as JSON, multi
steps a configurable grid of charts through dataset sizes together, and
random generates whole seeded random datasets — visit the transition,
rotation, and sparkline showcases, and export charts as SVG/PNG. Comparing this package with a framework
port shows exactly what the mochart bindings do for you.

Components are plain factory functions returning DOM elements plus targeted
update methods (see [src/components/misc/dom.ts](src/components/misc/dom.ts));
routing is a tiny history-based router with the same URL scheme as the other
demos. The JSON demo configs and datasets are shared from
[@mochart/demo-data](../mochart-demo-data/README.md);
[@mochart/demo-basic](../mochart-demo-basic/README.md) is a smaller
no-framework harness of the same demos that hosts the core e2e suite. This
package has its own suite in [e2e/](e2e/), covering the share links, editor
tabs, export and phone fold that only the full gallery has.

## Install

This repo uses npm workspaces; install once from the repo root:

```sh
npm install
```

## Run

From the repo root (`npm run dev` targets this package):

```sh
npm run dev        # vite dev server on http://localhost:5179
npm run build      # production build to dist/
npm run test:e2e   # demo-basic's playwright suite, then this package's
```

Or from this package: `npm run dev`, `npm run build`, `npm run preview`
(port 4179), `npm run typecheck`, and `npm run test:e2e` for this suite
alone. It runs Chromium only, in a desktop and a phone project, against the
dev server on port 5179.

## Adding a demo

Demos live in the shared [@mochart/demo-data](../mochart-demo-data/README.md)
package — add the config/data/random JSON there and every demo app (including
this one) picks it up.
