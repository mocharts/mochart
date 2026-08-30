# @mochart/demo-basic

Minimal no-framework demo harness for the
[@mochart/core](../mochart/README.md) charting library (private, not published,
not deployed to the demo site).

**Role:** this package is deliberately small — a single-file vanilla-TypeScript
Vite app that renders every demo chart from the shared
[@mochart/demo-data](../mochart-demo-data/README.md) configs, with a flat DOM,
stable element ids, and hash routing. That makes it two things:

1. The smallest possible integration example — closer to what you'd paste
   into your own project than the full galleries.
2. The host of the core Playwright e2e suite (see [e2e/](e2e/)) — the vanilla
   gallery has its own — which depends on this app's simple, stable DOM
   contract (`#chart-host`, toolbar button ids, `/#<demo-id>` hash routing).
   Keep that contract stable when editing.

Live controls exercise mochart's
[staged animations](../mochart/README.md#staged-animation):
randomize values (kept within each demo's random spec and axis range),
add/remove categories — which plays the full axis expansion → value change →
axis contraction sequence — and autoplay. The stacked demos show the gapless
stacked transitions.

The full-featured galleries live in the peer packages:
[@mochart/demo-angular](../mochart-demo-angular/README.md),
[@mochart/demo-lit](../mochart-demo-lit/README.md),
[@mochart/demo-react](../mochart-demo-react/README.md),
[@mochart/demo-svelte](../mochart-demo-svelte/README.md),
[@mochart/demo-vanilla](../mochart-demo-vanilla/README.md) (no framework), and
[@mochart/demo-vue](../mochart-demo-vue/README.md).

## Install

This repo uses npm workspaces; install once from the repo root:

```sh
npm install
```

## Run

From the repo root:

```sh
npm run dev:basic  # vite dev server on http://localhost:5173
npm run test:e2e   # this suite (see e2e/), then the vanilla gallery's
```

Or from this package: `npm run dev`, `npm run build`, `npm run preview`, and
`npm run test:e2e` for this suite alone.

## Adding a demo

Demos live in the shared [@mochart/demo-data](../mochart-demo-data/README.md)
package — add the config/data/random JSON there and every demo app (including
this one) picks it up.
