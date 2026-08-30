# @mochart/vue

Vue 3 components for the [@mochart/core](https://github.com/mocharts/mochart) charting library.

Docs: [mochart.org](https://mochart.org) — start with the
[Vue guide](https://mochart.org/guide/frameworks/vue).

Config and data changes get mochart's
[staged animations](https://github.com/mocharts/mochart/tree/main/packages/mochart#staged-animation)
for free — axis expansion, value change (with category and series transitions),
axis contraction, and gapless stacked transitions — no extra wiring needed.

## Install

```sh
npm install @mochart/vue @mochart/core vue
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

```vue
<script setup>
import { DefaultChart } from '@mochart/vue';

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

<template>
  <DefaultChart :config="config" :data="data" :width="640" :height="400" />
</template>
```

`Chart` is the lower-level component for hosts that manage config enhancement
and data providers themselves:

```vue
<script setup>
import { enhanceConfig, ArrayOfObjectsDataProvider } from '@mochart/core';
import { Chart } from '@mochart/vue';

const mochartConfig = enhanceConfig(config);
const dataProvider = new ArrayOfObjectsDataProvider(data);
</script>

<template>
  <Chart :mochart-config="mochartConfig" :data-provider="dataProvider" :width="640" :height="400" />
</template>
```

## Sizing

`width` and `height` are optional. The component renders a container div the
chart mounts into; whichever dimension you omit tracks that div's size via
`ResizeObserver`. `class` and `style` fall through to that div, so size it
however you like and the chart follows it:

```vue
<Chart :mochart-config="mochartConfig" :data-provider="dataProvider" style="width: 100%; height: 400px" />
```

Other attributes (`id`, `data-testid`, …) fall through to the container div
the same way. The optional `dataTestId` prop is the same surface the other
bindings offer — it also sets `data-testid` and wins over a fallthrough
attribute when both are given.

## When the data changes

Config and data changes are detected **by reference identity**: the chart
compares the props it receives, not their contents. Vue's deep reactivity
re-renders your own template after an in-place `push`, but the chart still
sees the same array — replace instead of mutate:

```js
// ✓ a new array — the chart animates to it
data.value = [...data.value, { month: 'Mar', revenue: 30 }];

// ✗ invisible to the chart — same array identity
data.value.push({ month: 'Mar', revenue: 30 });
```

The same rule applies to `config` on `DefaultChart` and to
`mochartConfig`/`dataProvider` on `Chart`. For hosts that do mutate data in
place, a template ref on the component exposes `refresh()`, which re-reads
the current data, re-indexing the built-in providers:

```vue
<script setup>
import { ref } from 'vue';
import { DefaultChart } from '@mochart/vue';

const chart = ref(null);

function addRow(row) {
  data.value.push(row);
  chart.value.refresh();
}
</script>

<template>
  <DefaultChart ref="chart" :config="config" :data="data" />
</template>
```

## Props

Both components accept the chart callbacks (`onChartClick`, `onSliceClick`, `onSeriesClick`,
`onChartMouseEnter`, `onChartMouseMove`, `onChartMouseLeave`, `onTitleClick`,
`onFocus`, `onSeriesFilter`, `onSeriesLayoutBoundsChange` — usable as
`@chart-click` etc. in templates) and the placeholder components
(`loadingComponent`, `errorComponent`, `noDataComponent`, `noSizeComponent`,
`noSeriesComponent`, `configErrorComponent`). Each placeholder prop takes a
**Vue component** that receives the chart context (`width`, `height`, `error`,
…) as props and is rendered while the chart is in that state. A placeholder is
rendered as its own root carrying the chart component's app context, so it can
`inject()` a value passed to `app.provide()` but not one an ancestor component
supplied with `provide()`. Both components also accept `loading` and `error` to
force the loading or error state.

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
