# @mochart/svelte

Svelte 5 components for the [@mochart/core](https://github.com/mocharts/mochart) charting library.

Docs: [mochart.org](https://mochart.org) — start with the
[Svelte guide](https://mochart.org/guide/frameworks/svelte).

Config and data changes get mochart's
[staged animations](https://github.com/mocharts/mochart/tree/main/packages/mochart#staged-animation)
for free — axis expansion, value change (with category and series transitions),
axis contraction, and gapless stacked transitions — no extra wiring needed.

## Install

```sh
npm install @mochart/svelte @mochart/core svelte
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

`Chart` is the lower-level component for hosts that manage config enhancement
and data providers themselves:

```svelte
<script>
  import { enhanceConfig, ArrayOfObjectsDataProvider } from '@mochart/core';
  import { Chart } from '@mochart/svelte';

  const mochartConfig = enhanceConfig(config);
  const dataProvider = new ArrayOfObjectsDataProvider(data);
</script>

<Chart {mochartConfig} {dataProvider} width={640} height={400} />
```

## Sizing

`width` and `height` are optional. The component renders a container div the
chart mounts into; whichever dimension you omit tracks that div's size via
`ResizeObserver`. Size the div with the `class`/`style` props and the chart
follows it:

```svelte
<Chart {mochartConfig} {dataProvider} style="width: 100%; height: 400px" />
```

The optional `dataTestId` prop sets a `data-testid` attribute on the same
container div, for test selectors.

## When the data changes

Config and data changes are detected **by reference identity**: the chart
compares the props it receives, not their contents. `$state`'s deep
reactivity updates your own markup after an in-place `push`, but the chart
still sees the same array — reassign instead of mutate:

```js
// ✓ a new array — the chart animates to it
data = [...data, { month: 'Mar', revenue: 30 }];

// ✗ invisible to the chart — same array identity
data.push({ month: 'Mar', revenue: 30 });
```

The same rule applies to `config` on `DefaultChart` and to
`mochartConfig`/`dataProvider` on `Chart`. For hosts that do mutate data in
place, `bind:this` exposes a `ChartRef` handle with `refresh()`, which re-reads
the current data, re-indexing the built-in providers:

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

## Props

Both components accept the chart callbacks (`onChartClick`, `onSliceClick`, `onSeriesClick`,
`onChartMouseEnter`, `onChartMouseMove`, `onChartMouseLeave`, `onTitleClick`,
`onFocus`, `onSeriesFilter`, `onSeriesLayoutBoundsChange`) and the placeholder
components (`loadingComponent`, `errorComponent`, `noDataComponent`,
`noSizeComponent`, `noSeriesComponent`, `configErrorComponent`). Each
placeholder prop takes a **Svelte component** that receives the chart context
(`width`, `height`, `error`, …) as props and is rendered while the chart is in
that state. It is mounted with a copy of the chart component's contexts, so
`getContext` inside it reaches anything an ancestor set with `setContext`. Both
components also accept `loading` and `error` to force the loading or error
state.

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

## Sourcemaps and debugging

`dist/` ships `.d.ts.map` files for the TypeScript modules, so go-to-definition
on any published type lands on its declaration in `src/` (which `files`
publishes alongside `dist/`).

It ships no `.js.map`. `svelte-package` forces `sourceMap: false` on its
TypeScript transpile and its CLI has no option to change that, so JavaScript
maps cannot be produced by the tool that builds this package. Little is lost:
the three components are published as `.svelte` files that are their own
source, `index.js` and `types.js` are re-exports with no logic, and `host.js`
and `placeholders.svelte.js` are the `.ts` sources with the type annotations
stripped — unbundled, unminified, comments intact.

The `development` export condition above is the supported route for stepping
through the real TypeScript sources: enable it and the debugger runs `src/`
directly, so no mapping is involved.
