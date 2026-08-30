# @mochart/core

Animated interactive SVG charting library with zero framework dependencies.

Full documentation with live examples: [mochart.org](https://mochart.org).

Charts are drawn with a retained-mode renderer — updates write only the DOM
attributes that actually changed; there is no vdom and no framework runtime.
Data and config changes animate smoothly, and charts respond to hover, focus,
and series filtering out of the box.

## Features

- **Renderers**: `bar`, `line`, and `area` series, mixable in one chart, plus pie and donut charts
- **Scales**: ordinal and linear category axes over string, number, and date values (via d3-scale)
- **Animation**: [staged transitions](#staged-animation) — axis expansion,
  value change (with category and series transitions), axis contraction — and
  gapless stacked animation
- **Interaction**: crosshair, tooltip, legend with series filtering, click and
  hover callbacks
- **Accessibility**: keyboard-driven tooltip, legend filtering, and pie-slice
  interaction, with screen-reader roles, labels, and live value announcements
  — on by default; the `accessibility` config section localizes or disables
  it, and honors the reduced-motion system preference
- **Extras**: axis thresholds and ranges, linear/radial gradients, built-in
  pattern fills, series markers and labels, stacked and grouped series
- **Config validation**: configs are validated with
  [@mochart/movalid](../movalid/README.md), producing human-readable error messages

## Staged animation

Most charting libraries tween every element straight to its final position in
a single step, which makes updates that change both the data and the axis
domains hard to follow. mochart instead splits each update into sequential
phases, so only one kind of change is in motion at a time:

1. **Axis expansion** — if the new data needs more room (new categories, larger
   values), the axis domains grow first and the existing shapes reflow into
   the wider domains, so incoming data has a place to land.
2. **Value change** — values tween to their new positions. This phase also
   plays **category transitions** (categories added, removed, or reordered are merged
   into one display sequence so old and new categories animate coherently) and
   **series transitions** (series added, removed, or filtered via the legend).
3. **Axis contraction** — once the values settle, the axis domains collapse to
   fit the remaining data.

Phases that a given update doesn't need are skipped, and each phase's duration
scales with the size of its change, so small updates stay snappy while large
ones use the full configured duration. The per-phase durations
(`expansionDuration`, `valueChangeDuration`, `contractionDuration`, plus
`initialDuration` for first load and `focusDuration` for hover/focus
transitions) are set in `animation`.

### Gapless stacked animation

Stacked series animate as a single unit: throughout a transition, each
segment's baseline is derived from the tweened top of the segment below it,
rather than each segment tweening independently toward its final position. The
stack therefore stays contiguous for the whole animation — no gaps or overlaps
between segments — even while series are being added to or removed from the
stack.

## Install

```sh
npm install @mochart/core
```

Charts style themselves with inline styles — no CSS import is required. If
your page uses a global CSS reset (Tailwind preflight, VitePress base styles,
normalize.css), also import the optional stylesheet, which re-asserts the
browser defaults the chart's HTML overlays (tooltip, message states) rely on:

```js
import '@mochart/core/mochart.css';
```

## Quick start

`createDefaultChart` is the simplest entry point — give it a raw config and a
plain dataset — an array of objects or an object of arrays:

```js
import { createDefaultChart } from '@mochart/core';

const config = {
  title: { text: 'Revenue' },
  categoryAxis: { property: 'month', type: 'string', scale: 'ordinal' },
  seriesDefaults: { renderer: 'bar' },
  series: [{ property: 'revenue', title: 'Revenue' }]
};

const data = [
  { month: 'Jan', revenue: 10 },
  { month: 'Feb', revenue: 20 }
];

const chart = createDefaultChart(document.getElementById('chart'), {
  config,
  data,
  width: 640,
  height: 400
});

chart.update({ data: nextData });  // animates to the new data
chart.destroy();
```

`createChart` is the lower-level entry point for hosts that manage config
enhancement and data providers themselves:

```js
import { createChart, enhanceConfig, ArrayOfObjectsDataProvider } from '@mochart/core';

const mochartConfig = enhanceConfig(config);
const dataProvider = new ArrayOfObjectsDataProvider(data);

const chart = createChart(container, { mochartConfig, dataProvider, width: 640, height: 400 });
```

Both return a `ChartHandle`:

- `update(nextProps)` — merge new props into the chart; config and data
  changes animate when animation is enabled, width/height changes re-layout
  instantly. Change detection is by object identity — pass new references,
  or use `refresh` after mutating in place
- `replace(nextProps)` — replace the props wholesale; a key absent from
  `nextProps` is unset and returns to chart-managed behavior, where `update`
  would keep its previous value
- `refresh()` — re-read the current data without a new reference: a default
  chart rebuilds its provider over `data`, a `createChart` chart calls the
  provider's optional `refresh()` hook and re-reads it — the escape hatch
  for hosts that mutate data in place
- `destroy()` — cancel running tweens and remove the chart's DOM

## Configuration

A config is a plain object made of per-concern sections. Nearly every section
and property is optional and falls back to a sensible default — only
`categoryAxis.property` and each series entry's `property` are required:

| Section | Configures |
| --- | --- |
| `title` | chart title text, alignment, style, click behavior |
| `categoryAxis` | the category axis: data `property`, `type` (`string`/`number`/`date`), `scale` (`ordinal`/`linear`), ticks, thresholds |
| `series` | one entry per series: data `property`, `title`, `renderer` (`bar`/`line`/`area`/`none`), colors, markers, labels, focus behavior |
| `seriesDefaults` | shared defaults applied to every entry of `series` |
| `valueAxes` | one or more value axes; series are assigned by `axis` id |
| `seriesGroups` / `seriesStacks` | grouping and stacking of series |
| `legend` | legend placement, item style, series filtering on click |
| `tooltip` | tooltip content, formatting, positioning |
| `crosshair` | crosshair line style, focus behavior, and stacking against the tooltip |
| `animation` | `enabled` on/off plus per-phase durations (initial, expansion, value change, contraction, focus) |
| `accessibility` | keyboard and screen-reader access: `enabled`/`hidden` switches, label localization, `respectReducedMotion` |
| `plot` | plot area (e.g. `inverted` for horizontal charts) |
| `clipIndicator` | the band marking plot edges that have data hidden behind them |
| `patterns` / `patternDefaults` | built-in `lines`/`crosshatch`/`dots` fills series can reference, and their shared defaults |
| `pie` | pie/donut slice geometry and slice labels when `chart.type` is `pie`: radii, angles, label type and formats, tooltip values |
| `chart` / `colorPalette` / `linearGradients` / `radialGradients` | chart-wide style, palette, and gradient definitions |

The full property-by-property reference is at
[mochart.org/reference](https://mochart.org/reference/), generated from the
validation schema: `npm run generate-docs -w @mochart/core` writes
`generated/config-reference.json`, the structured model that the
[@mochart/docs](../mochart-docs/README.md) site renders into its config
reference pages, and `generated/api-reference.json`, the model behind that
site's props and callbacks pages. The command fails if the descriptions,
validators, and defaults ever disagree on a section's keys, or if a prop
interface has no reference page group or an undocumented member — and it
writes nothing at all when it fails.

### Config helpers

- `validateConfig(config, getDefaults(config))` — validate a raw config, returns readable errors
- `getDefaults(config)` — the per-section defaults `validateConfig` needs as its second argument
- `migrateConfig(config)` — migrate configs from older versions
- `enhanceConfig(config)` — validate/default/normalize into a `mochartConfig`
- `getDataErrors(mochartConfig, dataProvider)` — validate data against a config

### Chart helpers

Each returns config fragments and rows to spread into your own config, so the
chart stays an ordinary xy or pie chart rather than a special mode.

- `createHistogram(values, options)` — bins values into a histogram; `binValues` returns just the bins
- `createWaterfall(steps, options)` — a running total with rise/fall/total bars; `computeWaterfallSteps` returns just the steps
- `createHeatmap(rows, options)` — a coloured grid; `createHeatmapColorScale` builds the matching colour ramp
- `createCandlestick(rows, options)` — open/high/low/close candles; `computeCandlesticks` returns just the derived values
- `createOhlc(rows, options)` — the same data drawn as open/close ticks on a high/low bar
- `createPie(slices, options)` — a pie or donut; `computePieFractions` returns just the slice shares
- `createSparklineConfig(config, options)` — strips a chart config down to a tiny inline chart: axes, legend, tooltip and markers off, margins collapsed

See the [chart helpers reference](../mochart-docs/reference/api.md) for the full options.

## Data providers

Two dataset shapes are supported out of the box:

- `ArrayOfObjectsDataProvider` — `[{ month: 'Jan', revenue: 10 }, …]`
- `ObjectOfArraysDataProvider` — `{ month: ['Jan', …], revenue: [10, …] }`

`createDefaultChart` wraps its `data` in whichever built-in provider matches
its shape automatically; `createChart` accepts any object implementing the
`DataProvider` interface. One member is required —
`getPropertyValues(property)` returns all values of one named data property,
index-aligned with every other property's values, or `undefined` when the
property isn't in the data. Every property the config names arrives through
it, the category property and `categoryAxis.keyProperty` included: series
property values are numbers with `null`/`undefined` as missing values,
category property values are strings, numbers, or `Date`s, and key property
values are strings or numbers. `getError`, `getLoading`, and `refresh` are
optional. See the
[data providers guide](../mochart-docs/guide/data-providers.md) for the full
contract.

## Interaction callbacks

All callbacks are optional props on either entry point:

```js
createDefaultChart(container, {
  config, data, width, height,
  onFocus: ({ focusedSeriesId, focusedCategoryIndex }) => { /* hover/click focus changed */ },
  onSeriesFilter: ({ filteredSeriesIds }) => { /* legend filtering changed */ },
  onChartClick: ({ categoryIndex, chartX, chartY }) => { /* plot area clicked */ },
  onSliceClick: ({ seriesId }) => { /* pie slice clicked */ },
  onSeriesClick: ({ seriesId, categoryIndex }) => { /* bar/point/line clicked */ },
  onTitleClick: () => {}
});
```

- `onFocus(focus)` — the focused series/category/axis changed (pointer over/out or
  click, per the series' `focusOnHover`/`focusOnClick` config)
- `onSeriesFilter(filter)` — a legend click toggled a series in/out of the
  filtered set
- `onChartClick` / `onChartMouseEnter` / `onChartMouseMove` /
  `onChartMouseLeave` — plot-area pointer events with chart coordinates and
  the nearest category index
- `onSliceClick(payload)` — a slice of a pie or donut chart was clicked
  (fires only on click, unlike `onFocus`, so it can anchor selection)
- `onSeriesClick(payload)` — a cartesian series shape (bar, marker, label, or
  line/area path) was clicked; reports the series id, the shape's category
  index (`-1` for a whole-series path), and the nearest category index. Fires
  whether or not `focusOnClick` is set — the cartesian counterpart of
  `onSliceClick`
- `onSeriesLayoutBoundsChange(bounds)` — the plot area was re-laid-out

## Loading, error, and empty states

`loading` and `error` props switch the chart into the corresponding state.
What renders in each state is customizable through factory props that return a
DOM node (or string):

```js
createDefaultChart(container, {
  config, data, width, height,
  loading: isLoading,
  getLoadingComponent: () => {
    const el = document.createElement('div');
    el.textContent = 'Loading…';
    return el;
  }
});
```

Every factory is called with the same context object — all six members are
always present:

| Member | Value |
| --- | --- |
| `width` / `height` | Pixel size of the box the returned content fills; which box depends on the state (see the table below) |
| `mochartConfig` | The enhanced config as supplied, including the invalid one in the config-error state; `null` before the host has a config |
| `dataProvider` | The current provider, or `null` when there is none |
| `error` | The active error (the `error` prop or the provider's); `undefined` outside the error state |
| `hasData` | True when the committed dataset holds at least one category |

| Factory | Rendered when | `width`/`height` measure |
| --- | --- | --- |
| `getNoSizeComponent` | `width` or `height` is not a positive number | The chart (so the values given, `0` before a container is laid out) |
| `getConfigErrorComponent` | The config fails validation | The chart |
| `getLoadingComponent` | The `loading` prop is true | The chart before a config arrives, the plot area once the chart is laid out |
| `getErrorComponent` | The `error` prop is set, or the provider reports one | The chart before a config arrives, the plot area once the chart is laid out |
| `getNoSeriesComponent` | The config declares no series | The plot area |
| `getNoDataComponent` | The dataset has no categories | The plot area |

The plot-area states place their content over the plot with the axes drawn, so
sizing a placeholder from `width`/`height` fits the box it actually occupies.

`createDefaultChart` also validates the data against the config on every start,
update and refresh. When they do not match — a series `property` that is not in
the data, or columns of differing lengths — it replaces the provider with one
reporting the error `'Invalid Data'`, so the chart enters the error state and
`getErrorComponent` receives that bare string. The specific messages are not
carried through; call `getDataErrors(mochartConfig, dataProvider)` yourself to
see which property is at fault.

## Framework wrappers

- [@mochart/angular](../mochart-angular/README.md) — Angular components
- [@mochart/lit](../mochart-lit/README.md) — lit-html directives
- [@mochart/react](../mochart-react/README.md) — React components
- [@mochart/svelte](../mochart-svelte/README.md) — Svelte 5 components
- [@mochart/vue](../mochart-vue/README.md) — Vue 3 components

Each wrapper adds automatic container sizing (omit `width`/`height` to track
the container) on top of the same chart props.

## Browser support

Mochart targets modern evergreen browsers (Chrome/Edge, Firefox, Safari);
the published builds are ES modules (plus an IIFE bundle for script
tags) pinned to ES2020, and no polyfills are
required. The core renders SVG, measures text with the SVG APIs
(`getBBox`, `getComputedTextLength`), and animates with
`requestAnimationFrame` — it needs a real DOM, so do not call
`createChart`/`createDefaultChart` during server rendering (the framework
wrappers are SSR-safe and mount only in the browser). `ResizeObserver` is
used only by the wrappers, feature-detected, and only when
`width`/`height` are omitted. In jsdom-style test environments, shim the
SVG measurement APIs to return zero sizes and the chart takes its
default-bounds fallbacks.

## Examples

Build-free static HTML examples (script tag and ES module) live in
[example/](example/README.md). The full demo gallery is the
[@mochart/demo-vanilla](../mochart-demo-vanilla/README.md) package.

## Development

```sh
npm run build -w @mochart/core          # bundle to dist/ with vite
npm test -w @mochart/core               # vitest with v8 coverage (includes golden snapshot tests)
npm run typecheck -w @mochart/core
npm run generate-docs -w @mochart/core   # regenerate generated/{config,api}-reference.json
npm run generate-jsdoc -w @mochart/core  # regenerate the JSDoc on src/types/config.ts from the config docs
npm run fuzz -w @mochart/core            # sweep every config property (see test/fuzz/README.md)
```

The JSDoc on the config interfaces in `src/types/config.ts` is generated
from the same descriptions/validators/defaults as the config reference, so
IDE hovers document every config property; a test
(`test/config/jsdocSync.test.ts`) fails when the file drifts from the
sources.

The golden snapshot tests in `test/golden/` render whole charts (initial
mount, static update, mid-tween, and settled states) and compare serialized
SVG against checked-in snapshots — they are the primary regression oracle for
renderer changes.

## The `development` export condition

In this repository's manifest, the `exports` map has a `development` entry
pointing at this package's TypeScript sources; the repo's own dev servers,
tests and `tsx` scripts run the library from source through it. It never
reaches npm: publishing goes through `pnpm publish`, which replaces the map
with the dist-only `publishConfig.exports`, so installed copies of this
package always resolve the built `dist/`.

## License

MIT
