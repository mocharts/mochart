# Vue

`@mochart/vue` wraps [@mochart/core](https://github.com/mocharts/mochart/tree/main/packages/mochart)
in Vue 3 components. Config and data changes get mochart's
[staged animations](/guide/staged-animation) for free — axis expansion, value
change, axis contraction, and gapless stacked transitions — no extra wiring
needed.

## Install

```sh
npm install @mochart/vue @mochart/core vue
```

Vue 3.3 or later is required (`vue` and `@mochart/core` are peer
dependencies).

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

`Chart` is the lower-level component for hosts that manage
[config enhancement](/guide/config-model#enhancement) and
[data providers](/guide/data-providers) themselves:

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

`Chart` accepts `null` for `mochartConfig` and `dataProvider` while the host
is still loading them; pair it with the `loading` prop to show the loading
state until they arrive.

## Sizing and the container

`width` and `height` are optional. The component renders a container div the
chart mounts into; whichever dimension you omit tracks that div's size via
`ResizeObserver`. `class` and `style` fall through to that div, so size it
however you like and the chart follows it:

```vue
<Chart :mochart-config="mochartConfig" :data-provider="dataProvider" style="width: 100%; height: 400px" />
```

Explicit `width`/`height` props win over conflicting `style` values.

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
import { ref } from 'vue';

const data = ref(initialData);

// ✓ a new array — the chart animates to it
data.value = [...data.value, { month: 'Mar', revenue: 30 }];

// ✗ invisible to the chart — same array identity
data.value.push({ month: 'Mar', revenue: 30 });
```

The same rule applies to `config` on `DefaultChart` and to
`mochartConfig`/`dataProvider` on `Chart` — pass a new object (or provider)
to change them.

For hosts that do mutate data in place, a template ref on either component
exposes the core
[`refresh()`](/guide/data-providers#when-the-data-changes) escape hatch —
it re-reads the current data (the built-in providers read live, so
any in-place change is seen):

```vue
<script setup lang="ts">
import { ref } from 'vue';
import type { DataObject } from '@mochart/core';
import { DefaultChart } from '@mochart/vue';
import type { ChartRef } from '@mochart/vue';

const data = ref<DataObject[]>(initialData);
const chart = ref<ChartRef | null>(null);

function addRow(row: DataObject) {
  data.value.push(row);
  chart.value?.refresh();
}
</script>

<template>
  <DefaultChart ref="chart" :config="config" :data="data" />
</template>
```

`refresh()` is also on the components' own instance types, so a ref typed
`InstanceType<typeof DefaultChart>` works too.

## Callbacks and states

Both components accept the [chart callbacks](/guide/interaction#callbacks)
under their core names (`onChartClick`, `onFocus`, `onSeriesFilter`,
`onSeriesClick`, `onSliceClick`, `onTitleClick`, …) with the core payloads;
in templates they are usable as `@chart-click`, `@series-filter`, and so on.
They are declared as props, so they reach the chart rather than falling
through to the container div. Only the callbacks you pass are wired into the chart,
which matters where the core switches behavior on a callback's presence —
an `onTitleClick` makes the title a button, for instance.

Both components also accept `loading` and `error` to force the
[loading or error state](/guide/chart-states), and a placeholder prop per
state: `loadingComponent`, `errorComponent`, `noDataComponent`,
`noSizeComponent`, `noSeriesComponent`, and `configErrorComponent`. Each takes
a **Vue component** that receives the
[chart state context](/guide/chart-states#customizing-what-renders) (`width`,
`height`, `error`, …) as props and is rendered while the chart is in that
state; leave a prop off to keep the built-in placeholder.

A placeholder is rendered as its own Vue root that carries the chart
component's **app context**, so it can use globally registered components and
directives and can `inject()` a value passed to `app.provide()`. It has no
parent component, so a value an ancestor component supplied with `provide()` is
not reachable — `inject()` returns its default (and warns when there is none).
If a placeholder needs such a value, either move it to `app.provide()`, or
`inject()` it in the host component and define the placeholder there as a
component that closes over it. This is narrower than React, where a placeholder
reads any ancestor's context; see [React](/guide/frameworks/react).

Every prop, with its type and its core counterpart, is listed in
[Framework props](/reference/framework-props#vue).

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
The components carry runtime prop declarations, so templates type-check
against them with `vue-tsc`. Config, data, and callback payload types
(`MochartInputConfig`, `DataObject`, `ChartFocus`, `ChartEventPayload`, …)
come from `@mochart/core`; see [Callbacks and payloads](/reference/callbacks).

## Server-side rendering

The chart mounts in `onMounted`, which Vue does not run on the server: SSR
emits only the container div, and the chart is created in the browser after
hydration. No `typeof window` guards are needed in your own code. Nothing of
the chart itself is server-rendered — the page shows an empty container until
the client mounts — so a chart contributes no SEO or first-paint content, and
a size measured from the container is only known in the browser. See
[Browser support](/guide/getting-started#browser-support) for what the core
itself needs.

## See it in action

The [Vue demo gallery](/vue/demos) is a full application built on
`@mochart/vue` (with a small history router built on Vue's reactivity); its
source lives in
[packages/mochart-demo-vue](https://github.com/mocharts/mochart/tree/main/packages/mochart-demo-vue).
