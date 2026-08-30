# React

`@mochart/react` wraps [@mochart/core](https://github.com/mocharts/mochart/tree/main/packages/mochart)
in React components. Config and data changes get mochart's
[staged animations](/guide/staged-animation) for free — axis expansion, value
change, axis contraction, and gapless stacked transitions — no extra wiring
needed.

## Install

```sh
npm install @mochart/react @mochart/core react react-dom
```

React 18 or later is required (`react` and `react-dom` are peer
dependencies, as is `@mochart/core`).

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

```tsx
import type { MochartInputConfig } from '@mochart/core';
import { DefaultChart } from '@mochart/react';

const config: MochartInputConfig = {
  title: { text: 'Revenue' },
  categoryAxis: { property: 'month', type: 'string', scale: 'ordinal' },
  seriesDefaults: { renderer: 'bar' },
  series: [{ property: 'revenue', title: 'Revenue' }]
};

const data = [
  { month: 'Jan', revenue: 10 },
  { month: 'Feb', revenue: 20 }
];

export function Revenue() {
  return <DefaultChart config={config} data={data} width={640} height={400} />;
}
```

`Chart` is the lower-level component for hosts that manage
[config enhancement](/guide/config-model#enhancement) and
[data providers](/guide/data-providers) themselves:

```tsx
import { enhanceConfig, ArrayOfObjectsDataProvider } from '@mochart/core';
import { Chart } from '@mochart/react';

const mochartConfig = enhanceConfig(config);
const dataProvider = new ArrayOfObjectsDataProvider(data);

<Chart mochartConfig={mochartConfig} dataProvider={dataProvider} width={640} height={400} />
```

`Chart` accepts `null` for `mochartConfig` and `dataProvider` while the host
is still loading them; pair it with the `loading` prop to show the loading
state until they arrive.

## Sizing and the container

`width` and `height` are optional. The component renders a container div the
chart mounts into; whichever dimension you omit tracks that div's size via
`ResizeObserver`. Size the div with the `className`/`style` props and the
chart follows it:

```tsx
<Chart mochartConfig={mochartConfig} dataProvider={dataProvider} style={{ width: '100%', height: 400 }} />
```

Explicit `width`/`height` props win over conflicting `style` values.

The optional `dataTestId` prop sets a `data-testid` attribute on the same
container div, for test selectors.

## When the data changes

Config and data changes are detected **by reference identity**: passing the
same array or object again — even after mutating it in place — leaves the
chart unchanged. Update state with a new reference and the change animates
as a normal data update:

```tsx
const [data, setData] = useState(initialData);

// ✓ a new array — the chart animates to it
setData(current => [...current, { month: 'Mar', revenue: 30 }]);

// ✗ invisible — same array identity (and no React re-render either)
data.push({ month: 'Mar', revenue: 30 });
```

Idiomatic React state updates already work this way. The same rule applies
to `config` on `DefaultChart` and to `mochartConfig`/`dataProvider` on
`Chart` — pass a new object (or provider) to change them.

For hosts that do mutate data in place, the `ref` prop exposes a `ChartRef`
handle with the core
[`refresh()`](/guide/data-providers#when-the-data-changes) escape hatch —
it re-reads the current data (the built-in providers read live, so
any in-place change is seen):

```tsx
import { useRef } from 'react';
import type { ChartRef } from '@mochart/react';

const chartRef = useRef<ChartRef>(null);

<DefaultChart ref={chartRef} config={config} data={data} />;

data.push({ month: 'Mar', revenue: 30 });
chartRef.current?.refresh();
```

Both components use `forwardRef`, so the `ref` prop works on React 18 as
well as 19.

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
a **React component** that receives the
[chart state context](/guide/chart-states#customizing-what-renders) (`width`,
`height`, `error`, …) as props and is rendered while the chart is in that
state; leave a prop off to keep the built-in placeholder.

Placeholder components render through a portal in the host component tree, so
they read any React context an ancestor provides (theme, router, i18n, …) like
any other component, and they re-render when a provider's value changes.

How much of the surrounding app a placeholder can reach is not the same in
every binding, and React reaches the furthest. What each of the others gives a
placeholder is stated on its own page: [Vue](/guide/frameworks/vue),
[Svelte](/guide/frameworks/svelte), [Lit](/guide/frameworks/lit),
[Angular](/guide/frameworks/angular).

Every prop, with its type and its core counterpart, is listed in
[Framework props](/reference/framework-props#react).

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

The chart mounts in a layout effect, which React does not run on the server:
`renderToString` emits only the container div, and the chart is created in
the browser after hydration. No `typeof window` guards are needed in your
own code. Nothing of the chart itself is server-rendered — the page shows an
empty container until the client mounts — so a chart contributes no SEO or
first-paint content, and a size measured from the container is only known in
the browser.

Under the Next.js App Router (React Server Components) the components hold
refs and effects, so put them — or the component that renders them — in a
file marked `'use client'`. See
[Browser support](/guide/getting-started#browser-support) for what the core
itself needs.

## See it in action

The [React demo gallery](/react/demos) is a full application built on
`@mochart/react` (react-router 7); its source lives in
[packages/mochart-demo-react](https://github.com/mocharts/mochart/tree/main/packages/mochart-demo-react).
