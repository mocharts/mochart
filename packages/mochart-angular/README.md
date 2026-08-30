# @mochart/angular

Angular components for the [@mochart/core](https://github.com/mocharts/mochart) charting library.

Docs: [mochart.org](https://mochart.org) — start with the
[Angular guide](https://mochart.org/guide/frameworks/angular).

Config and data changes get mochart's
[staged animations](https://github.com/mocharts/mochart/tree/main/packages/mochart#staged-animation)
for free — axis expansion, value change (with category and series transitions),
axis contraction, and gapless stacked transitions — no extra wiring needed.

## Install

```sh
npm install @mochart/angular @mochart/core @angular/core
```

Angular 22 or newer. The package ships partial-Ivy output, so newer Angular
versions link it with their own compiler and need no release here.

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

```ts
import { Component } from '@angular/core';
import type { MochartInputConfig } from '@mochart/core';
import { DefaultChart } from '@mochart/angular';

@Component({
  selector: 'app-revenue',
  imports: [DefaultChart],
  template: '<mochart-default-chart [config]="config" [data]="data" [width]="640" [height]="400" />'
})
export class Revenue {
  config: MochartInputConfig = {
    title: { text: 'Revenue' },
    categoryAxis: { property: 'month', type: 'string', scale: 'ordinal' },
    seriesDefaults: { renderer: 'bar' },
    series: [{ property: 'revenue', title: 'Revenue' }]
  };

  data = [
    { month: 'Jan', revenue: 10 },
    { month: 'Feb', revenue: 20 }
  ];
}
```

`Chart` is the lower-level component for hosts that manage config enhancement
and data providers themselves:

```ts
import { Component } from '@angular/core';
import { enhanceConfig, ArrayOfObjectsDataProvider } from '@mochart/core';
import { Chart } from '@mochart/angular';

@Component({
  selector: 'app-revenue',
  imports: [Chart],
  template: '<mochart-chart [mochartConfig]="mochartConfig" [dataProvider]="dataProvider" [width]="640" [height]="400" />'
})
export class Revenue {
  mochartConfig = enhanceConfig(config);
  dataProvider = new ArrayOfObjectsDataProvider(data);
}
```

## Sizing

`width` and `height` are optional. The component's own host element
(`<mochart-chart>` / `<mochart-default-chart>`) is the container the chart
mounts into; whichever dimension you omit tracks that element's size via
`ResizeObserver`. `class` and `style` set on the element style that same
container, so size it however you like and the chart follows it:

```html
<mochart-chart [mochartConfig]="mochartConfig" [dataProvider]="dataProvider" style="width: 100%; height: 400px" />
```

Explicit `width`/`height` inputs win over conflicting `style` values.

Any other attribute written on the element (`id`, `data-testid`, `aria-…`)
naturally lands on that same container. The optional `dataTestId` input is
the same surface the other bindings offer — it sets and removes
`data-testid` dynamically, and a static `data-testid` attribute is left
untouched when the input is never used.

## When the data changes

Config and data changes are detected **by reference identity**: the chart
compares the inputs it receives, not their contents. An in-place `push`
leaves the input reference unchanged, so change detection has nothing new
to pass on — reassign instead of mutate:

```ts
// ✓ a new array — the chart animates to it
this.data = [...this.data, { month: 'Mar', revenue: 30 }];

// ✗ invisible — same reference, the input never changes
this.data.push({ month: 'Mar', revenue: 30 });
```

The same rule applies to `config` on `mochart-default-chart` and to
`mochartConfig`/`dataProvider` on `mochart-chart`. For hosts that do mutate
data in place, the components expose `refresh()` as a public method — it
re-reads the current data, re-indexing the built-in providers.
Reach it through a template reference variable or `@ViewChild`:

```ts
@ViewChild('chart') chart!: DefaultChart;

addRow(row: DataObject) {
  this.data.push(row);
  this.chart.refresh();
}
```

```html
<mochart-default-chart #chart [config]="config" [data]="data" />
```

Both components extend the exported abstract `BaseChart`, which carries
everything except the config/data inputs — sizing, the state and placeholder
inputs, the controlled focus/filter inputs, every output, and `refresh()`.
Type a `@ViewChild` (or a helper accepting either component) as `BaseChart`
when it shouldn't care which chart it gets. There are no separate prop
interfaces to import: the inputs are declared on the classes, so templates
type-check against them and these three classes are the types to reference.

## Inputs & outputs

Both components emit the chart callbacks as outputs (`chartClick`,
`sliceClick`, `seriesClick`, `chartMouseEnter`, `chartMouseMove`, `chartMouseLeave`,
`titleClick`, `focusChange`, `seriesFilter`, `seriesLayoutBoundsChange` —
usable as `(chartClick)="..."` etc. in templates; only subscribed outputs
are wired into the chart) and accept the
placeholder components (`loadingComponent`, `errorComponent`,
`noDataComponent`, `noSizeComponent`, `noSeriesComponent`,
`configErrorComponent`). Each placeholder input takes an **Angular component
class** whose declared inputs among the chart context names (`width`,
`height`, `error`, …) are kept up to date while the chart is in that state. It
is created with the chart's `EnvironmentInjector`, so it can inject what the
application or route injector provides but not a provider declared in an
ancestor component's `providers` or `viewProviders` array. Both components also
accept `loading` and `error` to force the loading or error state.

### Controlled state

Focus and legend filtering are chart-managed by default, but each piece of
that state has a matching input that takes over while it is set (not
`undefined`): `focusedCategoryIndex` (`-1` = none), `focusedSeriesId` and
`focusedValueAxisId` (`null` = none), and `filteredSeriesIds` (a map of
series id → `true` = filtered out). Pass back what the `focusChange` and
`seriesFilter` outputs emit to keep focus and filtering in sync across
several charts; leave an input `undefined` to let the chart keep managing
that piece itself.

## The `development` export condition

In this repository's manifest, the `exports` map has a `development` entry
pointing at this package's TypeScript sources; the repo's own dev servers,
tests and `tsx` scripts run the library from source through it. It never
reaches npm: publishing goes through `pnpm publish`, which replaces the map
with the dist-only `publishConfig.exports`, so installed copies of this
package always resolve the built `dist/`.
