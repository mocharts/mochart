# Getting started

mochart draws animated, interactive SVG charts from two plain inputs: a
**config** object describing the chart and a **dataset**. No framework is
required — the core library manipulates the DOM directly through a
retained-mode renderer, and updates write only the attributes that changed.

## Install

```sh
npm install @mochart/core
```

Using a framework? Install its binding instead and get automatic container
sizing on top of the same API:
[Angular](/guide/frameworks/angular), [Lit](/guide/frameworks/lit),
[React](/guide/frameworks/react), [Svelte](/guide/frameworks/svelte), or
[Vue](/guide/frameworks/vue).

### The optional stylesheet

Charts style themselves with inline styles, so no CSS import is required.
The package does ship one optional stylesheet:

```js
import '@mochart/core/mochart.css';
```

It re-asserts the browser default styles that the chart's HTML overlays (the
tooltip and the message overlays) rely on. Import it when your page uses a
global CSS reset — Tailwind's preflight, VitePress's base styles, or a
`normalize.css`-style reset — which can otherwise disturb overlay layout
(for example, `svg { display: block }` wraps the tooltip's color icon onto
its own line). It also carries the chart's keyboard
[focus ring](/guide/accessibility#the-focus-ring), which needs a
`:focus-visible` rule inline styles cannot express. It never overrides the
chart's own styling, and overlays still inherit your page's font and text
color.

## Your first chart

`createDefaultChart` is the simplest entry point: give it a container
element, a raw config, and a dataset (an array of objects or an object of
arrays):

<script setup>
import * as basic from '../examples/basic'
</script>

<LiveChart :config="basic.config" :data="basic.data" :alt-data="basic.altData" />

```js
import { createDefaultChart } from '@mochart/core';

const config = {
  version: '1.0.0',
  title: { text: 'Monthly Revenue' },
  categoryAxis: { property: 'month', type: 'string', scale: 'ordinal' },
  seriesDefaults: { renderer: 'bar' },
  series: [{ property: 'revenue', title: 'Revenue' }]
};

const data = [
  { month: 'Jan', revenue: 12 },
  { month: 'Feb', revenue: 18 },
  { month: 'Mar', revenue: 15 },
  { month: 'Apr', revenue: 24 },
  { month: 'May', revenue: 21 },
  { month: 'Jun', revenue: 28 }
];

const chart = createDefaultChart(document.getElementById('chart'), {
  config,
  data,
  width: 640,
  height: 400
});
```

The two data shapes are interchangeable. Written as an object of arrays —
one array per property — the same dataset is passed through the same `data`
prop, and the chart is identical:

```js
const data = {
  month: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
  revenue: [12, 18, 15, 24, 21, 28]
};

const chart = createDefaultChart(document.getElementById('chart'), {
  config,
  data,
  width: 640,
  height: 400
});
```

Three things to notice:

- `categoryAxis.property` and each series' `property` name the dataset
  fields to read — the category values and the series values.
- `version` is optional and pins the config format. Include it in configs
  you store or share, so `migrateConfig` can upgrade them if the format
  changes ([validation](/guide/config-model#validation)).
- Everything else is optional. Axes, legend, tooltip, crosshair, and
  animation all come with defaults; the
  [config reference](/reference/) documents every property.

## Updating and destroying

The returned `ChartHandle`:

```js
chart.update({ data: nextData });     // animates to the new data
chart.update({ width, height });      // re-layout at a new size
chart.update({ config: nextConfig }); // apply a config change
chart.refresh();                      // re-read data that was mutated in place
chart.destroy();                      // cancel tweens, remove the chart's DOM
```

`update` merges new props into the chart and detects changes by object
identity: pass a **new** data array or config object — mutating the previous
one in place is not detected. If you do mutate your data in place, call
`refresh` to re-read it. `replace` swaps the whole prop set at once: a key
absent from the new props is unset and returns to chart-managed behavior,
where `update` would keep its previous value — for hosts that pass every prop
on every render.

When animation is enabled (the default), data changes and `refresh` animate
through mochart's [staged animation](/guide/staged-animation) phases — try the
button under the chart above. Config changes animate whatever they change in
the chart data (an axis bound, say), redraw the rest instantly, and
[rebuild the chart](/guide/staged-animation#structural-config-changes-rebuild-the-chart)
when they change its structure. Size changes are the exception: a new
`width`/`height` re-lays the chart out instantly.

## The lower-level entry point

`createChart` skips the conveniences: it takes an already-enhanced config and
an explicit data provider, for hosts that manage those themselves:

```js
import { createChart, enhanceConfig, ArrayOfObjectsDataProvider } from '@mochart/core';

const mochartConfig = enhanceConfig(config);
const dataProvider = new ArrayOfObjectsDataProvider(data);

const chart = createChart(container, { mochartConfig, dataProvider, width: 640, height: 400 });
```

See [The config model](/guide/config-model) for what "enhanced" means and
[Data providers](/guide/data-providers) for the provider interface.

## Browser support

Mochart targets modern evergreen browsers (Chrome/Edge, Firefox, Safari).
The published builds — an ES module and an IIFE bundle for script tags
(`@mochart/core/mochart.iife.js`, exposing the global `mochart`) — are
pinned to ES2020. Everything the core uses — SVG rendering, SVG text measurement
(`getBBox`, `getComputedTextLength`) for layout and truncation, and
`requestAnimationFrame` for animation — is baseline in those browsers, so no
polyfills are required. Build-free static HTML examples of both flavors —
script tag and ES module — live in
[packages/mochart/example](https://github.com/mocharts/mochart/tree/main/packages/mochart/example).

A few boundaries:

- **`ResizeObserver`** is used only by the framework bindings, and only to
  track the container when `width`/`height` are omitted. It is
  feature-detected: without it, charts with explicit sizes are unaffected —
  omitted dimensions just stop tracking the container.
- **Server-side rendering** — the core `createChart`/`createDefaultChart`
  need a real DOM; do not call them during server rendering. The five
  framework bindings can be rendered on the server without guards: they emit
  only their container (or nothing) there and mount the chart in the browser
  (React defers to an effect, Angular checks `PLATFORM_ID`, Lit's directive
  falls back to its no-DOM render path, and Vue/Svelte mount hooks are
  client-only). Nothing of the chart itself is server-rendered; each
  framework guide has the details.
- **Test environments** — jsdom has no SVG layout engine; shim
  `getBBox`/`getComputedTextLength`/`getSubStringLength` to return zero
  sizes and the chart takes its documented default-bounds fallbacks (the
  binding test suites show the shims).
- **Export** — [`@mochart/export`](/guide/export) additionally uses
  `XMLSerializer`, `Blob`/`URL.createObjectURL`, and (for PNG) a 2D canvas
  decoding an SVG image — all baseline in the supported browsers. Exports
  inline the chart's computed styles but do not embed font files: an
  exported SVG renders with whatever fonts the viewer has, and a PNG
  rasterizes with the fonts loaded on the exporting page.

## Where to go next

- [The config model](/guide/config-model) — how config sections, shared
  `*Defaults` sections, defaults, and validation fit together
- [Staged animation](/guide/staged-animation) — what animates, in what order,
  and how to tune it
- [Interaction](/guide/interaction) — focus, legend filtering, tooltip,
  crosshair, and the callback props
- [Accessibility](/guide/accessibility) — the keyboard map, screen-reader
  behavior, and reduced-motion support, on by default and tuned via the
  `accessibility` config section
- [Colors, theming, and dark mode](/guide/theming) — customize series
  palettes; chart chrome follows your page's CSS `color`, dark mode included
- [Exporting images](/guide/export) — download any chart as a standalone
  SVG or PNG file
- [Recipes](/recipes/stacked-bars) — working configs for common chart shapes
- The demo galleries ([Vanilla](/vanilla/demos), [Angular](/angular/demos),
  [Lit](/lit/demos), [React](/react/demos), [Svelte](/svelte/demos), [Vue](/vue/demos)) — browse
  dozens of demo charts and edit their configs and data live
