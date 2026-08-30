# @mochart/react

React components for the [@mochart/core](https://github.com/mocharts/mochart) charting library.

Docs: [mochart.org](https://mochart.org) — start with the
[React guide](https://mochart.org/guide/frameworks/react).

Config and data changes get mochart's
[staged animations](https://github.com/mocharts/mochart/tree/main/packages/mochart#staged-animation)
for free — axis expansion, value change (with category and series transitions),
axis contraction, and gapless stacked transitions — no extra wiring needed.

## Install

```sh
npm install @mochart/react @mochart/core react react-dom
```

React 18 or newer.

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

`Chart` is the lower-level component for hosts that manage config enhancement
and data providers themselves:

```tsx
import { enhanceConfig, ArrayOfObjectsDataProvider } from '@mochart/core';
import { Chart } from '@mochart/react';

const mochartConfig = enhanceConfig(config);
const dataProvider = new ArrayOfObjectsDataProvider(data);

<Chart mochartConfig={mochartConfig} dataProvider={dataProvider} width={640} height={400} />
```

## Sizing

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
chart unchanged. Idiomatic React state updates already produce new
references:

```tsx
// ✓ a new array — the chart animates to it
setData(current => [...current, { month: 'Mar', revenue: 30 }]);

// ✗ invisible — same array identity (and no React re-render either)
data.push({ month: 'Mar', revenue: 30 });
```

The same rule applies to `config` on `DefaultChart` and to
`mochartConfig`/`dataProvider` on `Chart`. For hosts that do mutate data in
place, the `ref` prop exposes a `ChartRef` handle whose `refresh()`
re-reads the current data, re-indexing the built-in providers:

```tsx
import { useRef } from 'react';
import type { ChartRef } from '@mochart/react';

const chartRef = useRef<ChartRef>(null);

<DefaultChart ref={chartRef} config={config} data={data} />;

data.push({ month: 'Mar', revenue: 30 });
chartRef.current?.refresh();
```

## Props

Both components accept the chart callbacks (`onChartClick`, `onSliceClick`, `onSeriesClick`,
`onChartMouseEnter`, `onChartMouseMove`, `onChartMouseLeave`, `onTitleClick`,
`onFocus`, `onSeriesFilter`, `onSeriesLayoutBoundsChange`) and the placeholder
components (`loadingComponent`, `errorComponent`, `noDataComponent`,
`noSizeComponent`, `noSeriesComponent`, `configErrorComponent`). Each
placeholder prop takes a **React component** that receives the chart context
(`width`, `height`, `error`, …) as props and is rendered while the chart is in
that state. Placeholders render through a portal in the host component tree, so
they read any React context an ancestor provides and follow provider updates —
the other bindings reach less, each in its own way. Both components also accept
`loading` and `error` to force the loading or error state.

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
