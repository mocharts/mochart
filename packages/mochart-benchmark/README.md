# @mochart/benchmark

Performance benchmark harness for the [@mochart/core](../mochart/README.md)
charting library (private, not published).

A minimal vanilla-TypeScript Vite app that mounts generated charts at
configurable sizes and measures what SVG rendering actually costs. It exists
to answer a concrete question: at what data sizes would a canvas rendering
backend pay off? Charts are created with the plain `createChart` API — no
framework binding — so the numbers reflect mochart itself.

## Install

This repo uses npm workspaces; install once from the repo root:

```sh
npm install
```

## Run

From the repo root:

```sh
npm run dev -w @mochart/benchmark       # vite dev server on http://localhost:5178
npm run build -w @mochart/benchmark     # production build to dist/
npm run preview -w @mochart/benchmark   # preview the production build on http://localhost:4178
```

Benchmark in a regular headed browser with the machine otherwise idle;
DevTools being open, background tabs, and low-power mode all skew results.

## Scenarios

Configs and datasets are generated in [src/scenarios.ts](src/scenarios.ts)
(no JSON fixtures) for a chosen series × categories size:

- **Bar** — one `<path>` element per bar, so DOM node count scales with
  series × categories. The main SVG stress case.
- **Line** — one `<path>` per series regardless of point count; the cheap
  baseline to compare against.
- **Line + markers** — line plus one marker element per point.
- **Area** — filled series paths.
- **Dashboard** — a grid of many small charts (the "lots of charts on one
  page" case rather than "one big chart").

The Animate and Legend checkboxes toggle `animation.enabled` and
`legend.visible` in the generated config.

## Measurements

- **mount** — wall time of the `createChart` call(s).
- **settle** — mount plus two `requestAnimationFrame`s, i.e. through the
  browser's first layout/paint of the new DOM.
- **update** — average wall time of a randomize → `chart.update` → paint
  cycle (measured with animation off, so tweening isn't counted).
- **stress** — frame-time distribution (fps, p95, max, frames over 33 ms)
  sampled via `requestAnimationFrame` while data is randomized every 500 ms
  with animation on.
- **nodes** — `querySelectorAll('*').length` under the chart host.

**Run suite** executes the matrix in `SUITE_ROWS`
([src/scenarios.ts](src/scenarios.ts)) from small to large and fills the
results table; **Copy results** puts the table on the clipboard as markdown
with a user-agent/device-pixel-ratio header line. Each suite row mounts twice:
once without animation for the mount/update numbers, then again with
animation for the stress pass.

## Notes

- Generated configs may omit `version` (omitted means the current format);
  when present it must equal the current `CONFIG_VERSION` (see
  `src/config/core/constants.ts` in the mochart package) — `enhanceConfig`
  rejects older versions unless they go through `migrateConfig` first.
- The update metric includes waiting for the next paint, so it has a floor of
  roughly one to two frame intervals; relative growth across sizes is the
  signal, not the absolute value.
