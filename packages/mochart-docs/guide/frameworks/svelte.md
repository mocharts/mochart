# Svelte

`@mochart/svelte` wraps [@mochart/core](https://github.com/mocharts/mochart/tree/main/packages/mochart)
in Svelte 5 components. Config and data changes get mochart's
[staged animations](/guide/staged-animation) for free — axis expansion, value
change, axis contraction, and gapless stacked transitions — no extra wiring
needed.

## Install

```sh
npm install @mochart/svelte @mochart/core svelte
```

Svelte 5 is required (`svelte` and `@mochart/core` are peer dependencies);
the components are written with runes.

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

`DefaultChart` is the simplest entry point — give it a raw config and a plain
dataset — an array of objects or an object of arrays:

```svelte
<script>
  import { DefaultChart } from '@mochart/svelte';

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
</script>

<DefaultChart {config} {data} width={640} height={400} />
```

`Chart` is the lower-level component for hosts that manage
[config enhancement](/guide/config-model#enhancement) and
[data providers](/guide/data-providers) themselves:

```svelte
<script>
  import { enhanceConfig, ArrayOfObjectsDataProvider } from '@mochart/core';
  import { Chart } from '@mochart/svelte';

  const mochartConfig = enhanceConfig(config);
  const dataProvider = new ArrayOfObjectsDataProvider(data);
</script>

<Chart {mochartConfig} {dataProvider} width={640} height={400} />
```

`Chart` accepts `null` for `mochartConfig` and `dataProvider` while the host
is still loading them; pair it with the `loading` prop to show the loading
state until they arrive.

## Sizing and the container

`width` and `height` are optional. The component renders a container div the
chart mounts into; whichever dimension you omit tracks that div's size via
`ResizeObserver`. Size the div with the `class`/`style` props and the chart
follows it:

```svelte
<Chart {mochartConfig} {dataProvider} style="width: 100%; height: 400px" />
```

Explicit `width`/`height` props win over conflicting `style` values.

The optional `dataTestId` prop sets a `data-testid` attribute on the same
container div, for test selectors.

## When the data changes

Config and data changes are detected **by reference identity**: the chart
compares the props it receives, not their contents. `$state`'s deep
reactivity updates your own markup after an in-place `push`, but the chart
still sees the same array — reassign instead of mutate:

```js
let data = $state(initialData);

// ✓ a new array — the chart animates to it
data = [...data, { month: 'Mar', revenue: 30 }];

// ✗ invisible to the chart — same array identity
data.push({ month: 'Mar', revenue: 30 });
```

The same rule applies to `config` on `DefaultChart` and to
`mochartConfig`/`dataProvider` on `Chart` — pass a new object (or provider)
to change them. A prop change made before the component's first effect run
(in a parent's `onMount`, say) is applied too.

For hosts that do mutate data in place, `bind:this` exposes a `ChartRef`
handle with the core
[`refresh()`](/guide/data-providers#when-the-data-changes) escape hatch —
it re-reads the current data (the built-in providers read live, so
any in-place change is seen):

```svelte
<script lang="ts">
  import type { DataObject } from '@mochart/core';
  import type { ChartRef } from '@mochart/svelte';

  let chart: ChartRef | undefined = $state();

  function addRow(row: DataObject) {
    data.push(row);
    chart?.refresh();
  }
</script>

<DefaultChart bind:this={chart} {config} {data} />
```

## Callbacks and states

Both components accept the [chart callbacks](/guide/interaction#callbacks)
under their core names (`onChartClick`, `onFocus`, `onSeriesFilter`,
`onSeriesClick`, `onSliceClick`, `onTitleClick`, …) with the core payloads.
Only the callbacks you pass are wired into the chart, which matters where
the core switches behavior on a callback's presence — an `onTitleClick`
makes the title a button, for instance.

Both components also accept `loading` and `error` to force the
[loading or error state](/guide/chart-states), and a placeholder prop per
state: `loadingComponent`, `errorComponent`, `noDataComponent`,
`noSizeComponent`, `noSeriesComponent`, and `configErrorComponent`. Each takes
a **Svelte component** that receives the
[chart state context](/guide/chart-states#customizing-what-renders) (`width`,
`height`, `error`, …) as props and is rendered while the chart is in that
state; leave a prop off to keep the built-in placeholder.

A placeholder is mounted with a copy of the chart component's contexts, taken
when the chart initialises, so `getContext` inside a placeholder reaches
anything an ancestor set with `setContext`. Contexts are the only thing it
inherits: it is mounted as its own component root rather than as a child of the
chart. Vue and Angular reach less than this; see
[Vue](/guide/frameworks/vue) and [Angular](/guide/frameworks/angular).

Every prop, with its type and its core counterpart, is listed in
[Framework props](/reference/framework-props#svelte).

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
`PlaceholderProps`/`PlaceholderComponent` for typing placeholder components.
Config, data, and callback payload types (`MochartInputConfig`,
`DataObject`, `ChartFocus`, `ChartEventPayload`, …) come from `@mochart/core`;
see [Callbacks and payloads](/reference/callbacks).

## Server-side rendering

The chart mounts in `onMount`, which Svelte does not run on the server: SSR
emits only the container div, and the chart is created in the browser after
hydration. No `browser` guards are needed in your own code. Nothing of the
chart itself is server-rendered — the page shows an empty container until the
client mounts — so a chart contributes no SEO or first-paint content, and a
size measured from the container is only known in the browser. See
[Browser support](/guide/getting-started#browser-support) for what the core
itself needs.

## See it in action

The [Svelte demo gallery](/svelte/demos) is a full application built on
`@mochart/svelte` (with a small history router built on Svelte 5 runes); its
source lives in
[packages/mochart-demo-svelte](https://github.com/mocharts/mochart/tree/main/packages/mochart-demo-svelte).
