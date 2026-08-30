# mochart monorepo

Monorepo for **mochart**, an animated interactive SVG charting library with
zero framework dependencies, plus its framework wrappers, demo gallery, and
the **@mochart/movalid** validation library it uses for config validation.

**Documentation, live examples, and the demo gallery: [mochart.org](https://mochart.org)**

What sets mochart apart is its
[staged animation](packages/mochart/README.md#staged-animation) model: updates
play as axis expansion → value change (including category and series
transitions) → axis contraction, so only one kind of change is in motion at a
time, and stacked series animate as a single unit so the stack never shows
gaps between segments mid-transition.

Charts are also accessible by default: the keyboard drives the same tooltip,
legend filtering, and pie-slice interaction as the mouse, assistive tech
hears roles, labels, and live value announcements, and the reduced-motion
system preference is honored — all tunable through the `accessibility`
config section.

## Packages

| Package | Description |
| --- | --- |
| [@mochart/core](packages/mochart/README.md) | The core charting library — animated, interactive SVG charts rendered with a retained-mode renderer (no vdom, no framework). |
| [@mochart/angular](packages/mochart-angular/README.md) | Angular components wrapping mochart. |
| [@mochart/lit](packages/mochart-lit/README.md) | lit-html directives wrapping mochart. |
| [@mochart/react](packages/mochart-react/README.md) | React components wrapping mochart. |
| [@mochart/svelte](packages/mochart-svelte/README.md) | Svelte 5 components wrapping mochart. |
| [@mochart/vue](packages/mochart-vue/README.md) | Vue 3 components wrapping mochart. |
| [@mochart/export](packages/mochart-export/README.md) | SVG and PNG image export for rendered mochart charts. |
| [@mochart/editor](packages/mochart-editor/README.md) | Framework-neutral JSON editor with mochart config intelligence — powers the config/data editors in the demo apps. |
| [@mochart/demo-vanilla](packages/mochart-demo-vanilla/README.md) | Full-featured demo gallery in plain TypeScript (private) — the no-framework peer of the framework demo apps. |
| [@mochart/demo-basic](packages/mochart-demo-basic/README.md) | Minimal no-framework demo harness (private) — smallest integration example; home of the core Playwright e2e suite (the vanilla gallery has its own). |
| [@mochart/demo-data](packages/mochart-demo-data/README.md) | Shared demo configs, datasets, and random specs (private) used by every demo app. |
| [@mochart/demo-common](packages/mochart-demo-common/README.md) | Shared framework-agnostic demo logic (private) — config/data editing helpers, random data generator, and shared types used by every demo app. |
| [@mochart/benchmark](packages/mochart-benchmark/README.md) | Performance benchmark harness (private) — measures mount/update/frame-time cost of generated charts at configurable sizes. |
| [@mochart/docs](packages/mochart-docs/README.md) | Documentation site (private) — VitePress guide, recipes with live charts, and a config reference generated from the library's own validators and defaults. |
| [@mochart/movalid](packages/movalid/README.md) | Simple yet powerful chainable JavaScript validators with human-readable error messages. |

Each wrapper framework also has a full-featured demo gallery —
`@mochart/demo-angular`, `@mochart/demo-lit`, `@mochart/demo-react`,
`@mochart/demo-svelte`, and `@mochart/demo-vue` (all private) — with three
demo modes (single edits one chart's config and data as JSON, multi steps a
configurable grid of charts through dataset sizes together, and random
generates whole seeded random datasets) plus transition, rotation, and
sparkline showcases; `@mochart/demo-vanilla` is the same gallery in plain
TypeScript.
All of them share the demo configs from `@mochart/demo-data` and the
framework-agnostic demo logic from `@mochart/demo-common`.
There are also build-free static HTML examples in
[packages/mochart/example](packages/mochart/example/README.md).

## Getting started

This repo uses npm workspaces:

```sh
npm install
npm run dev        # start the demo gallery (@mochart/demo-vanilla) with vite
```

## Scripts

Run from the repo root:

```sh
npm run dev         # dev server for the demo gallery (@mochart/demo-vanilla)
npm run dev:basic   # dev server for the minimal harness (@mochart/demo-basic)
npm run dev:docs    # dev server for the documentation site (@mochart/docs)
npm run dev:editor  # dev playground for the JSON editor (@mochart/editor)
npm run build       # build the demo gallery
npm run build:libs  # build every publishable library to its dist/
```

The gate CI runs on every pull request, in this order:

```sh
npm run lint          # eslint across the monorepo (npm run lint:fix to apply fixes)
npm run deadcode      # knip: unused exports, files and dependencies
npm run typecheck     # typecheck every workspace that has a typecheck script
npm run check:publish # every publishable package's publishConfig.exports is dist-only
npm test              # run tests in every workspace that has them
npm run test:e2e      # playwright against @mochart/demo-basic, then @mochart/demo-vanilla
```

And the rest:

```sh
npm run build:pages         # assemble the deployable site into site/
npm run preview:pages       # build and serve site/ at the root base path
npm run preview:pages:serve # serve an already-built site/ without rebuilding
npm run screenshots -- <out-dir>               # capture the demo screenshots
npm run screenshots:compare -- <dir-a> <dir-b> # diff two captures
```

The screenshot references are not committed, because font rasterization makes
them machine-specific, so capture your own baseline before a change and diff
the fresh capture against it. [scripts/screenshots/README.md](scripts/screenshots/README.md)
has the matrix, the per-port dev server table and the options.

Target a single package with `-w`, e.g. `npm test -w @mochart/core`. `lint` and
`deadcode` exist only at the root; narrow them with `npx eslint <path>` and
`npx knip --workspace packages/<name>`.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for how the repo fits together — the
config metadata pipeline that feeds validation, the generated docs, and IDE
hovers; the golden snapshot tests; the demo gallery conventions; and how the
documentation site is assembled and deployed.

## License

MIT
