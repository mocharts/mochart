# Lit

`@mochart/lit` provides
[lit-html](https://lit.dev/docs/libraries/standalone-templates/) directives
for [@mochart/core](https://github.com/mocharts/mochart/tree/main/packages/mochart).
They work in standalone lit-html templates and inside `LitElement` render
methods alike. Config and data changes get mochart's
[staged animations](/guide/staged-animation) for free — axis expansion, value
change, axis contraction, and gapless stacked transitions — no extra wiring
needed.

## Install

```sh
npm install @mochart/lit @mochart/core lit-html
```

lit-html 3 is required (`lit-html` and `@mochart/core` are peer
dependencies); the `lit` package brings it in as well.

## The optional stylesheet

If your app uses a global CSS reset (Tailwind's preflight, a
`normalize.css`-style reset), also import the core package's
[optional stylesheet](/guide/getting-started#the-optional-stylesheet) — it
re-asserts the browser defaults the chart's tooltip and message overlays
rely on, and never overrides the chart's own styling:

```js
import '@mochart/core/mochart.css';
```

## Quick start

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

`chart` is the lower-level directive for hosts that manage
[config enhancement](/guide/config-model#enhancement) and
[data providers](/guide/data-providers) themselves:

```js
import { enhanceConfig, ArrayOfObjectsDataProvider } from '@mochart/core';
import { chart } from '@mochart/lit';

const mochartConfig = enhanceConfig(config);
const dataProvider = new ArrayOfObjectsDataProvider(data);

render(html`${chart({ mochartConfig, dataProvider, width: 640, height: 400 })}`, document.body);
```

`chart` accepts `null` for `mochartConfig` and `dataProvider` while the host
is still loading them; pair it with the `loading` prop to show the loading
state until they arrive.

Both directives have to sit in **child position** — an `${…}` slot between
tags, as in the snippets above — because each one renders a container div and
mounts the chart into it. In an attribute, property, or event binding
(`<div class=${chart({ … })}>`) the directive's constructor throws
`mochart-lit chart directives can only be used in child position`.

The chart itself is mounted in a microtask after the render pass, once the
container div is connected to the document, so the first size measurement
sees real layout.

## Sizing and the container

`width` and `height` are optional. The directive renders a container div the
chart mounts into; whichever dimension you omit tracks that div's size via
`ResizeObserver`, so you can size the div from surrounding layout and the
chart follows it:

```js
html`<div style="width: 100%; height: 400px">${chart({ mochartConfig, dataProvider })}</div>`
```

The optional `className` and `style` props land on the container div itself —
the directive equivalent of the class/style fallthrough the component
wrappers get. Explicit `width`/`height` props win over conflicting `style`
values:

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

The same rule applies to `config` and to `mochartConfig`/`dataProvider` —
pass a new object (or provider) to change them.

For hosts that do mutate data in place, the `chartRef` prop — a callback
ref, like Lit's own `ref()` directive — receives a `ChartRef` handle with
the core [`refresh()`](/guide/data-providers#when-the-data-changes) escape
hatch. It re-reads the current data (the built-in providers read
live, so any in-place change is seen):

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

The callback is called with the handle once the chart mounts and with
`null` when the directive disconnects; the handle itself is stable across
renders, so it is safe to hold onto.

Disconnecting destroys the chart rather than pausing it. A directive that is
re-attached mounts a new one, so the opening animation plays again and any
chart-managed focus or legend filtering starts over. This happens whenever the
host element leaves the DOM and returns, since `LitElement.disconnectedCallback`
disconnects its root part: a view swap or a router that detaches views is
enough. Keep state you need to survive that in your own component and pass it
back in.

## Callbacks and states

Both directives accept the [chart callbacks](/guide/interaction#callbacks)
under their core names (`onChartClick`, `onFocus`, `onSeriesFilter`,
`onSeriesClick`, `onSliceClick`, `onTitleClick`, …) with the core payloads.
Only the callbacks you pass are wired into the chart, which matters where
the core switches behavior on a callback's presence — an `onTitleClick`
makes the title a button, for instance.

Both directives also accept `loading` and `error` to force the
[loading or error state](/guide/chart-states), and a placeholder prop per
state — named `*Template` rather than `*Component`, since each takes a
**lit-html template function** rather than a component class:
`loadingTemplate`, `errorTemplate`, `noDataTemplate`, `noSizeTemplate`,
`noSeriesTemplate`, and `configErrorTemplate`. The function receives the
[chart state context](/guide/chart-states#customizing-what-renders) (`width`,
`height`, `error`, …) and its result is rendered while the chart is in that
state; leave a prop off to keep the built-in placeholder:

```js
const loadingTemplate = ({ width, height }) => html`<div>Loading ${width}x${height}…</div>`;

html`${chart({ mochartConfig, dataProvider, loading, loadingTemplate })}`
```

A placeholder template is a plain function the binding calls itself and renders
with lit-html, not a component the framework instantiates, so nothing is
injected into it: it sees the chart state context it is called with plus
whatever its own closure captures. Define it where the values it needs are in
scope — inside the host element's `render()`, or in a method that reads `this`.
Directives inside the template work as in any other lit-html render, and are
disconnected when the template prop is removed. The component-based bindings
inherit framework context to varying degrees; see
[React](/guide/frameworks/react), [Vue](/guide/frameworks/vue),
[Svelte](/guide/frameworks/svelte) and [Angular](/guide/frameworks/angular).

Every prop, with its type and its core counterpart, is listed in
[Framework props](/reference/framework-props#lit).

## Controlled state

Focus and legend filtering are chart-managed by default, but each piece of
that state has a matching prop that takes over while it is set (not
`undefined`): `focusedCategoryIndex` (`-1` = none), `focusedSeriesId` and
`focusedValueAxisId` (`null` = none), and `filteredSeriesIds` (a map of
series id → `true` = filtered out). Pass back what `onFocus` and
`onSeriesFilter` report to keep focus and filtering in sync across several
charts (the round-trip is shown in
[Controlled focus and filtering](/guide/interaction#controlled-focus-and-filtering));
leave a prop `undefined` to let the chart keep managing that piece itself.

## TypeScript

The package ships its own declarations. It exports the prop interfaces
`ChartProps`, `DefaultChartProps`, `BaseChartProps` (everything except the
config/data props) and `ChartCallbackProps`, the `ChartRef` handle, and
`PlaceholderProps`/`PlaceholderTemplate` for typing placeholder templates.
Config, data, and callback payload types (`MochartInputConfig`,
`DataObject`, `ChartFocus`, `ChartEventPayload`, …) come from `@mochart/core`;
see [Callbacks and payloads](/reference/callbacks).

## Server-side rendering

The directives do all their DOM work in `update()`, which lit-html only calls
in the browser; the server-side `render()` path returns `noChange`, so
nothing is emitted for the chart on the server and both the container div
and the chart are created client-side. Nothing of the chart is
server-rendered — the page shows nothing where the chart goes until the client
mounts — so a chart contributes no SEO or first-paint content, and a size
measured from the container is only known in the browser. See
[Browser support](/guide/getting-started#browser-support) for what the core
itself needs.

## See it in action

The [Lit demo gallery](/lit/demos) is a full `LitElement` application built on
`@mochart/lit` (with a small hand-rolled history router); its source lives in
[packages/mochart-demo-lit](https://github.com/mocharts/mochart/tree/main/packages/mochart-demo-lit).
