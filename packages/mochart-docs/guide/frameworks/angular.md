# Angular

`@mochart/angular` wraps [@mochart/core](https://github.com/mocharts/mochart/tree/main/packages/mochart)
in standalone Angular components. Config and data changes get mochart's
[staged animations](/guide/staged-animation) for free — axis expansion, value
change, axis contraction, and gapless stacked transitions — no extra wiring
needed.

## Install

```sh
npm install @mochart/angular @mochart/core @angular/core
```

Angular 22 or later is required (`@angular/core` and `@mochart/core` are
peer dependencies).

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

`Chart` is the lower-level component for hosts that manage
[config enhancement](/guide/config-model#enhancement) and
[data providers](/guide/data-providers) themselves:

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

`Chart` accepts `null` for `mochartConfig` and `dataProvider` while the host
is still loading them; pair it with the `loading` input to show the loading
state until they arrive.

## Sizing and the container

`width` and `height` are optional. The component's own host element
(`<mochart-chart>` / `<mochart-default-chart>`, a `display: block` element)
is the container the chart mounts into; whichever dimension you omit tracks
that element's size via `ResizeObserver`. `class` and `style` set on the
element style that same container, so size it however you like and the chart
follows it:

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
`mochartConfig`/`dataProvider` on `mochart-chart` — pass a new object (or
provider) to change them.

For hosts that do mutate data in place, the components expose the core
[`refresh()`](/guide/data-providers#when-the-data-changes) escape hatch as
a public method — it re-reads the current data (the built-in
providers read live, so any in-place change is seen). Reach it through a
template reference variable or `@ViewChild`:

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

## Inputs, outputs, and states

Both components emit the [chart callbacks](/guide/interaction#callbacks) as
outputs with the core payloads, dropping the core `on` prefix —
`onChartClick` becomes `chartClick`, `onSliceClick` becomes `sliceClick` —
usable as `(chartClick)="..."` in templates. The one exception is `onFocus`,
exposed as `focusChange`: a bare `(focus)` would collide with the native
focus event. Only subscribed outputs are wired into the chart, which matters
where the core switches behavior on a callback's presence — subscribing to
`titleClick` makes the title a button, for instance. A subscription made
after mount (through a `@ViewChild`, say) is picked up too.

Both components also accept `loading` and `error` inputs to force the
[loading or error state](/guide/chart-states), and a placeholder input per
state: `loadingComponent`, `errorComponent`, `noDataComponent`,
`noSizeComponent`, `noSeriesComponent`, and `configErrorComponent`. Each takes
an **Angular component class**; whichever of the
[chart state context](/guide/chart-states#customizing-what-renders) names
(`width`, `height`, `error`, …) it declares as inputs are kept up to date
while the chart is in that state. Leave an input off to keep the built-in
placeholder.

A placeholder is created with the chart's `EnvironmentInjector`, so it can
inject anything the application injector provides — `providedIn: 'root'`
services, application providers, and the environment providers of the route the
chart sits in. It is not created under the chart's element injector, so a
provider declared in an ancestor component's `providers` or `viewProviders`
array is not reachable: injecting it throws `NullInjectorError`, or — for a
service that also has `providedIn: 'root'` — hands back the root instance
instead of the component-scoped one. Register such a provider at application or
route level, or keep the value in a service both the host and the placeholder
inject. This is narrower than React, where a placeholder reads any ancestor's
context; see [React](/guide/frameworks/react).

Every input and output, with its type and its core counterpart, is listed in
[Framework props](/reference/framework-props#angular).

## Controlled state

Focus and legend filtering are chart-managed by default, but each piece of
that state has a matching input that takes over while it is set (not
`undefined`): `focusedCategoryIndex` (`-1` = none), `focusedSeriesId` and
`focusedValueAxisId` (`null` = none), and `filteredSeriesIds` (a map of
series id → `true` = filtered out). Pass back what the `focusChange` and
`seriesFilter` outputs emit to keep focus and filtering in sync across
several charts (the round-trip is shown in
[Controlled focus and filtering](/guide/interaction#controlled-focus-and-filtering));
leave an input `undefined` to let the chart keep managing that piece itself.

## TypeScript

The package ships its own declarations. Both components extend the exported
abstract `BaseChart`, which carries everything except the config/data inputs —
sizing, the state and placeholder inputs, the controlled focus/filter inputs,
every output, and `refresh()`. Type a `@ViewChild` (or a helper accepting
either component) as `BaseChart` when it shouldn't care which chart it gets.
Unlike the other bindings there are no prop interfaces to import: the inputs
are declared on the classes, so templates type-check against them and
`Chart`, `DefaultChart` and `BaseChart` are the types to reference. The only
other exports are `PlaceholderProps` and `PlaceholderComponent`, for typing
placeholder components. Config, data, and callback payload types
(`MochartInputConfig`, `DataObject`, `ChartFocus`, `ChartEventPayload`, …)
come from `@mochart/core`; see [Callbacks and payloads](/reference/callbacks).

## Server-side rendering

The chart mounts in `ngAfterViewInit`, which Angular also runs on the server,
so the components check `PLATFORM_ID` themselves and skip the mount there:
SSR emits only the host element, and the chart is created once the app runs
in the browser. No `isPlatformBrowser` guards are needed in your own code.
Nothing of the chart itself is server-rendered — the page shows an empty host
element until the client mounts — so a chart contributes no SEO or first-paint
content, and a size measured from the container is only known in the browser.
See [Browser support](/guide/getting-started#browser-support) for what the
core itself needs.

## See it in action

The [Angular demo gallery](/angular/demos) is a full application built on
`@mochart/angular` (Angular router, zoneless); its source lives in
[packages/mochart-demo-angular](https://github.com/mocharts/mochart/tree/main/packages/mochart-demo-angular).
