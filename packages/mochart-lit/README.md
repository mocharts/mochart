# @mochart/lit

[lit-html](https://lit.dev/docs/libraries/standalone-templates/) directives for
the [@mochart/core](https://github.com/mocharts/mochart) charting library. Works in
standalone lit-html templates and inside `LitElement` render methods alike.

Docs: [mochart.org](https://mochart.org) — start with the
[Lit guide](https://mochart.org/guide/frameworks/lit).

Config and data changes get mochart's
[staged animations](https://github.com/mocharts/mochart/tree/main/packages/mochart#staged-animation)
for free — axis expansion, value change (with category and series transitions),
axis contraction, and gapless stacked transitions — no extra wiring needed.

## Install

```sh
npm install @mochart/lit @mochart/core lit-html
```

## The optional stylesheet

If your app uses a global CSS reset (Tailwind's preflight, a
`normalize.css`-style reset), also import the core package's optional
stylesheet — it re-asserts the browser defaults the chart's tooltip and
message overlays rely on, and never overrides the chart's own styling:

```js
import '@mochart/core/mochart.css';
```

## Usage

`defaultChart` is the simplest entry point — give it a raw config and a plain
dataset — an array of objects or an object of arrays:

```js
import { html, render } from 'lit-html';
import { defaultChart } from '@mochart/lit';

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

render(html`${defaultChart({ config, data, width: 640, height: 400 })}`, document.body);
```

`chart` is the lower-level directive for hosts that manage config enhancement
and data providers themselves:

```js
import { enhanceConfig, ArrayOfObjectsDataProvider } from '@mochart/core';
import { chart } from '@mochart/lit';

const mochartConfig = enhanceConfig(config);
const dataProvider = new ArrayOfObjectsDataProvider(data);

render(html`${chart({ mochartConfig, dataProvider, width: 640, height: 400 })}`, document.body);
```

Both directives have to sit in **child position** — an `${…}` slot between
tags, as in the snippets above — because each one renders a container div and
mounts the chart into it. In an attribute, property, or event binding
(`<div class=${chart({ … })}>`) the directive's constructor throws
`mochart-lit chart directives can only be used in child position`.

## Sizing

`width` and `height` are optional. The directive renders a container div the
chart mounts into; whichever dimension you omit tracks that div's size via
`ResizeObserver`, so you can size the div from surrounding layout and the
chart follows it:

```js
html`<div style="width: 100%; height: 400px">${chart({ mochartConfig, dataProvider })}</div>`
```

The optional `className` and `style` props land on the container div itself —
the directive equivalent of the class/style fallthrough the component
wrappers get (explicit `width`/`height` props still win over `style`):

```js
html`${chart({ mochartConfig, dataProvider, style: 'flex: 1 1 auto; min-width: 0;' })}`
```

The optional `dataTestId` prop sets a `data-testid` attribute on the same
container div, for test selectors.

## When the data changes

Config and data changes are detected **by reference identity**: the chart
compares the values it receives, not their contents. That matches Lit's own
change detection (`hasChanged` is identity-based too), so the familiar Lit
rule applies doubly here — reassign instead of mutate:

```ts
// ✓ a new array — Lit re-renders and the chart animates to it
this.data = [...this.data, { month: 'Mar', revenue: 30 }];

// ✗ invisible — same reference: neither Lit nor the chart sees it
this.data.push({ month: 'Mar', revenue: 30 });
```

The same rule applies to `config` and to `mochartConfig`/`dataProvider`.
For hosts that do mutate data in place, the `chartRef` prop — a callback
ref, like Lit's own `ref()` directive — receives a `ChartRef` handle whose
`refresh()` re-reads the current data. The built-in providers read live, so
any in-place change is seen:

```ts
import type { DataObject } from '@mochart/core';
import type { ChartRef } from '@mochart/lit';

private chart: ChartRef | null = null;

render() {
  return html`${defaultChart({
    config,
    data: this.data,
    chartRef: (chart) => { this.chart = chart; }
  })}`;
}

addRow(row: DataObject) {
  this.data.push(row);
  this.chart?.refresh();
}
```

## Props

Both directives accept the chart callbacks (`onChartClick`, `onSliceClick`, `onSeriesClick`,
`onChartMouseEnter`, `onChartMouseMove`, `onChartMouseLeave`, `onTitleClick`,
`onFocus`, `onSeriesFilter`, `onSeriesLayoutBoundsChange`) and the placeholder
templates (`loadingTemplate`, `errorTemplate`, `noDataTemplate`,
`noSizeTemplate`, `noSeriesTemplate`, `configErrorTemplate`). Each placeholder
prop takes a **lit-html template function** that receives the chart context
(`width`, `height`, `error`, …) and is rendered while the chart is in that
state:

```js
const loadingTemplate = ({ width, height }) => html`<div>Loading ${width}x${height}…</div>`;

html`${chart({ mochartConfig, dataProvider, loading, loadingTemplate })}`
```

A placeholder template is a plain function the binding calls and renders with
lit-html rather than a component the framework instantiates, so nothing is
injected into it: it sees the chart context it is called with plus whatever its
closure captures.

Both directives also accept `loading` and `error` to force the loading or
error state.

### Controlled state

Focus and legend filtering are chart-managed by default, but each piece of
that state has a matching prop that takes over while it is set (not
`undefined`): `focusedCategoryIndex` (`-1` = none), `focusedSeriesId` and
`focusedValueAxisId` (`null` = none), and `filteredSeriesIds` (a map of
series id → `true` = filtered out). Pass back what `onFocus` and
`onSeriesFilter` report to keep focus and filtering in sync across several
charts; leave a prop `undefined` to let the chart keep managing that piece
itself.

## The `development` export condition

In this repository's manifest, the `exports` map has a `development` entry
pointing at this package's TypeScript sources; the repo's own dev servers,
tests and `tsx` scripts run the library from source through it. It never
reaches npm: publishing goes through `pnpm publish`, which replaces the map
with the dist-only `publishConfig.exports`, so installed copies of this
package always resolve the built `dist/`.
