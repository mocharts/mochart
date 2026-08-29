# API reference

The complete documented API of `@mochart/core`, grouped by task:

| Section | Exports |
| --- | --- |
| [Entry points](#createdefaultchart) | `createDefaultChart`, `createChart`, [`ChartHandle`](#charthandle) |
| [Data providers](#data-providers) | `ArrayOfObjectsDataProvider`, `ObjectOfArraysDataProvider`, the `DataProvider` interface |
| [Config helpers](#config-helpers) | `enhanceConfig`, `validateConfig`, `validateConfigDetailed`, `migrateConfig`, `getDefaults`, `getConfigWithDefaults`, `getConfigWithoutDefaults`, `getDataErrors` |
| [Chart helpers](#chart-helpers) | `createHistogram`, `createWaterfall`, `createHeatmap`, `createCandlestick`, `createOhlc`, `createPie`, `createSparklineConfig` and their math-only companions |
| [Constants](#constants) | `NONE`, `AUTO`, `TYPE_*`, `SCALE_*`, `CHART_TYPE_*`, and the config union types |
| [Styling hooks](#styling-hooks) | `mochartCssClasses` |
| [Version](#version) | `getVersionString` |
| [Advanced exports](#advanced-exports) | `buildMochartConfig`, `hasConfigStructureChange` |

The framework bindings — see the [framework pages](/guide/frameworks/react) —
have their own entry points but accept the same props, callbacks, and helpers
documented here.

The props the entry points accept are listed property by property in
[Chart props](/reference/props) and
[Callbacks and payloads](/reference/callbacks), and the name each binding
gives them in [Framework props](/reference/framework-props). All three are
generated from the packages' type declarations.

## createDefaultChart

```ts
createDefaultChart(container: Element, props: DefaultChartProps): ChartHandle<DefaultChartProps>
```

The simplest entry point (see [Getting started](/guide/getting-started)).
Mounts a chart into `container` from a raw [config](/guide/config-model) and
a plain dataset — an array of objects or an object of arrays. Whenever
`config` or `data` changes, the config is validated and enhanced internally,
`data` is wrapped in the matching data provider
(`ArrayOfObjectsDataProvider` or `ObjectOfArraysDataProvider`) by shape, and
the dataset is checked with `getDataErrors`. An invalid config shows the
config error [chart state](/guide/chart-states), a data problem the error
state, instead of a broken chart.

Props: `config` and `data`, plus everything in
[Chart props](/reference/props) — sizing, `loading`/`error`, the controlled
focus and filter props, the [state factories](/reference/props#factories),
and the [callbacks](/reference/callbacks).

## createChart

```ts
createChart(container: Element, props: ManagedChartProps): ChartHandle<ManagedChartProps>
```

The lower-level entry point for hosts that manage
[config enhancement](/guide/config-model#enhancement) and
[data providers](/guide/data-providers) themselves. Identical to
`createDefaultChart` except it takes `mochartConfig` (from `enhanceConfig`)
and `dataProvider` in place of `config` and `data` — useful when several
charts share one enhanced config, or when data lives in a custom store.
Either may be `null` while the host is still loading. A managed chart trusts
its inputs: it does not run `getDataErrors`, so run it yourself when the data
isn't guaranteed valid. Its props are listed under
[Chart props](/reference/props#managedChartProps).

## ChartHandle

Returned by both entry points, typed by the props they take:

```ts
interface ChartHandle<TProps> {
  update(nextProps: Partial<TProps>): void;
  replace(nextProps: TProps): void;
  refresh(): void;
  destroy(): void;
}
```

- `update(nextProps)` merges new props into the chart. Change detection is
  by object identity — pass a new config/data reference; a key set to
  `undefined` means "no change", like an absent key. Data changes — and config
  changes that move the chart data, such as an axis bound — animate through
  the [staged animation](/guide/staged-animation) phases when animation is
  enabled; other config changes redraw instantly; structural config changes
  (see [`hasConfigStructureChange`](#advanced-exports)) rebuild the chart and
  replay its initial animation; width/height changes re-layout the chart
  instantly.
- `replace(nextProps)` swaps the props wholesale: a key absent from
  `nextProps` is unset and returns to chart-managed behavior, where `update`
  would keep its previous value. For hosts that pass the complete prop set
  on every render.
- `refresh()` re-reads the current data without a new reference — the escape
  hatch for hosts that mutate their data in place. A default chart rebuilds
  its provider over `data`; a managed chart calls the provider's optional
  `refresh()` hook, then re-reads it.
- `destroy()` cancels running tweens and removes the chart's DOM. It is
  safe to call more than once, and `update`, `replace` and `refresh` no-op
  afterwards — a late call from a pending timer or an unmounted component
  does nothing at all, not even re-read the data or call the provider's
  `refresh()` hook.

## Data providers

```ts
import { ArrayOfObjectsDataProvider, ObjectOfArraysDataProvider } from '@mochart/core';

new ArrayOfObjectsDataProvider(data)  // [{ month: 'Jan', revenue: 10 }, …]
new ObjectOfArraysDataProvider(data)  // { month: ['Jan', …], revenue: [10, …] }
```

Both take only the dataset — which property holds the category values is
the config's knowledge (`categoryAxis.property`) — and both are stateless:
the chart's next re-read sees any in-place change.

Both implement the `DataProvider` interface, which custom providers can
implement to read straight from an existing store:

```ts
type DataValue = number | string | Date | null | undefined;

interface DataProvider {
  // required: one property's values, index-aligned across properties; undefined when absent
  getPropertyValues(property: string): readonly DataValue[] | undefined;
  getError?(): unknown;    // non-null → the chart shows its error state ('' and 0 count)
  getLoading?(): boolean;  // true → the chart shows its loading state
  refresh?(): void;        // called by the handle's refresh() before re-reading — invalidate caches here
}
```

`getPropertyValues` is the interface's one accessor: the chart requests every
property the config names — the category property,
`categoryAxis.keyProperty`, and the series properties alike — as all of
that property's values. Series values are numbers, with `null`, `undefined`,
and `NaN` all reading as missing; category values are strings, numbers, or `Date`s
matching `categoryAxis.type`, and key values are strings or numbers. The config's category property defines the
category count, and `getDataErrors` flags any other property whose value
count doesn't match. A provider missing the accessor is invalid, and
`getDataErrors` says so.

See [Data providers](/guide/data-providers) for the full contract and which
properties are read.

## Config helpers

```ts
import {
  enhanceConfig, validateConfig, validateConfigDetailed, migrateConfig,
  getDefaults, getConfigWithDefaults, getConfigWithoutDefaults, getDataErrors
} from '@mochart/core';

enhanceConfig(config)                        // → MochartConfig (migrated, validated, defaults applied)
validateConfig(config, defaults?, strict?)   // → { valid, errors, warnings }
validateConfigDetailed(config, defaults?, strict?)
                                             // → { valid, errors, warnings, diagnostics }
migrateConfig(config)                        // → a copy upgraded to the current format version
getDefaults(config)                          // → the default values derived from the config
getConfigWithDefaults(config, defaults?)     // → the config with every default value filled in
getConfigWithoutDefaults(config, defaults?)  // → the minimal config: every default-matching value removed
getDataErrors(mochartConfig, dataProvider)   // → string[] of readable data problems
```

Every `defaults` parameter is optional: when omitted it is derived from the
config, which is what one-off calls want. Pass it explicitly — from
`getDefaults(config)` — to reuse one set of defaults across several calls on
the same config.

Defaults belong to the config they were derived from. Every default depends on
the whole config, not just on the property it fills: a second series turns the
default `legend.visible` from `false` to `true`, for instance. So defaults
passed for a config they were not derived from are rejected — a section they
leave out, or a `series`/`valueAxes` list they do not cover, throws rather than
filling the config in halfway. Derive them again after editing the config; the
saving they offer is worth less than a chart built from the wrong defaults.

`strict` defaults to `true`, which is what the chart entry points use:
warnings — an unknown config property, for instance — make the config
invalid. Pass `false` to keep a config valid while still collecting its
warnings, which is what a live-preview editor wants.

- `enhanceConfig` produces the fully-built `MochartConfig` that
  `createChart` consumes: migrated to the current format, validated, every
  default applied, `*Defaults` sections merged, and cross-references
  resolved. It never mutates the config it is given. The lower-level helpers
  below do not migrate: call `migrateConfig` first if you use them directly
  on a stored config.
- `validateConfig` checks a raw config against the same validators that
  generate this reference, returning human-readable `errors` and `warnings`
  (unknown properties). See [Validation](/guide/config-model#validation).
- `validateConfigDetailed` performs the same validation, keeps the
  `validateConfig` result shape, and adds `diagnostics`: one entry per
  problem with a config `path` (keys and array indexes), `severity`
  (`'error'` | `'warning'`), `message`, and `source`, so an editor can
  highlight the property responsible.
- `migrateConfig` upgrades a config written against an older
  [`version`](/guide/config-model#validation) to the current format,
  returning a copy; a config with no `version` is stamped with the current
  one.
- `getDefaults` returns the default values for a config — what every omitted
  property falls back to. It takes the config because some defaults
  are conditional (pie mode hides the axes, a sole value axis becomes every
  series' default `axis`, and so on).
- `getConfigWithDefaults` returns the config a chart would actually run:
  every default filled in and the `*Defaults` sections merged into their
  entries. Unlike `enhanceConfig`, the result is still a plain raw config —
  serializable JSON, no cross-references resolved.
- `getConfigWithoutDefaults` is its inverse: the minimal config, with every
  value that only restates a default removed — what a config editor wants to
  display or store. Re-applying defaults to a minimal config reproduces the
  fully-defaulted one.
- Both return fully independent copies sharing no object with their
  arguments, so the results can be serialized, diffed, or edited freely
  without reaching into a mounted chart.
- `getDataErrors` checks a dataset against an enhanced config —
  non-numeric series values, category values that don't match the configured
  type, duplicate category values, a value count that differs from the
  category count, and out-of-order category values on a linear category
  scale under line or area series. A property the provider reports as absent
  (`getPropertyValues` returns `undefined`) is an error too — a lone one for
  the category property, since nothing else is checkable without it — unless
  the series sets `allowAbsentDataProperties`, which reads an absent series
  property as all-missing values. An invalid config or a `null` provider
  yields no errors. `createDefaultChart` runs this for you; `createChart`
  does not.

## Chart helpers

Factories for chart shapes that are really data transforms plus config
conventions. Each returns chart-ready `data` rows alongside config
*fragments* (`categoryAxis`, `series`, …) to spread into your own
config — they never touch the chart, so titles, axes, and styling stay
yours. Each links to a recipe with a live example.

```ts
import {
  createHistogram, createWaterfall, createHeatmap,
  createCandlestick, createOhlc, createPie, createSparklineConfig
} from '@mochart/core';

createHistogram(values, options?)          // → { bins, data, categoryAxis, seriesConfig }
binValues(values, options?)                // → HistogramBin[]
createWaterfall(items, options?)           // → { steps, data, categoryAxis, series, valueAxes }
computeWaterfallSteps(items, base?)        // → WaterfallStep[]
createHeatmap(rows, options?)              // → { domain, colorScale, data, categoryAxis, valueAxes, series }
createHeatmapColorScale(domain, options?)  // → (value: number) => color
createCandlestick(items, options?)         // → { candles, data, categoryAxis, series, valueAxes? }
createOhlc(items, options?)                // → { candles, data, categoryAxis, series, valueAxes? }
computeCandlesticks(items)                 // → Candlestick[]
createPie(items, options?)                 // → { total, fractions, data, chart, pie, categoryAxis, series }
computePieFractions(values)                // → { total, fractions }
createSparklineConfig(config, options?)    // → config with the sparkline preset applied
```

- `createHistogram` bins an array of numbers (Sturges' count and round bin
  edges by default; `binCount`/`binWidth`/`domain` overrides, `normalize`
  and `cumulative` modes) into contiguous bars. `binValues` returns just the
  bins, without the chart fragments. See [Histogram](/recipes/histogram).
- `createWaterfall` accumulates signed steps into floating bars with
  increase/decrease/total series; its `valueAxes` fragment carries the
  `base` the bars span from. `computeWaterfallSteps` is the math alone. See
  [Waterfall](/recipes/waterfall).
- `createHeatmap` turns a grid of row values into one bar-band series per
  row, each cell colored by value from a shared sequential ramp; the value
  axis fragment labels the rows. `createHeatmapColorScale` builds the same
  value→color scale standalone (e.g. for a ramp legend). See
  [Heatmap](/recipes/heatmap).
- `createCandlestick` turns OHLC items into candles: direction-colored
  open/close bodies over thin low/high wicks, or outlined up bodies with
  the `hollow` option. The `volume` option adds a volume pane on a second
  axis (the result gains a `valueAxes` fragment).
  `computeCandlesticks` is the math alone. See
  [Candlestick](/recipes/candlestick).
- `createOhlc` turns the same OHLC items into tick bars: thin low/high
  lines with a left open tick and a right close tick, with the same
  `volume` option. See [OHLC bars](/recipes/ohlc).
- `createPie` turns labelled values into pie or donut slices — one series
  per slice, sized by its share of the total. Its `chart` fragment is
  what switches the chart into pie mode (`type: 'pie'`); the `donut` option
  fills the `pie` fragment. `computePieFractions` returns just the total and
  per-slice fractions. See [Pie and donut](/recipes/pie).
- `createSparklineConfig` is a config preset rather than a data transform:
  it hides axes, legend, tooltip, crosshairs and markers, and collapses
  margins for tiny inline charts. Values already set on the passed config
  win; the `interactive` option keeps the tooltip and crosshairs, `padding`
  sets the uniform edge padding. See [Sparklines](/recipes/sparklines).

For TypeScript hosts, every helper's item, option, and result shapes are
exported as named types — histogram: `BinValuesOptions`, `HistogramBin`,
`CreateHistogramOptions`, `HistogramData`; waterfall: `WaterfallItem`,
`WaterfallDirection`, `WaterfallStep`, `CreateWaterfallOptions`,
`WaterfallData`; heatmap: `HeatmapRow`, `CreateHeatmapOptions`,
`CreateHeatmapColorScaleOptions`, `HeatmapData`; candlestick:
`CandlestickItem`, `CandlestickDirection`, `Candlestick`,
`CreateCandlestickOptions`, `CandlestickVolumeOptions`, `CandlestickData`;
OHLC: `CreateOhlcOptions`, `OhlcData` (OHLC items are `CandlestickItem`s);
pie: `PieItem`, `CreatePieOptions`, `PieData`; sparkline:
`CreateSparklineConfigOptions`. The shipped `.d.ts` documents every field —
hover the type in your editor. Option members typed as a config union —
`CreatePieOptions.tooltipValueType` (`PieTooltipValueType`) and
`CreateHeatmapColorScaleOptions.colorInterpolation` (`ColorInterpolation`) —
use the unions listed under [Constants](#constants), so a wrapper prop that
forwards one can be typed.

## Constants

Enumerated config values are written as string literals — `renderer: 'bar'`,
`curveType: 'monotoneX'` — and each member's page in this reference lists its
allowed values. Only a handful of constants are exported, for the values that
recur in code that builds configs:

| Constant | Value |
| --- | --- |
| `NONE` | `null` — the explicit "off" value config members accept |
| `AUTO` | `'auto'` |
| `TYPE_STRING`, `TYPE_NUMBER`, `TYPE_DATE` | axis `type` values |
| `SCALE_ORDINAL`, `SCALE_LINEAR` | axis `scale` values |
| `CHART_TYPE_XY`, `CHART_TYPE_PIE` | [`chart.type`](/reference/chart#chart.type) values |
| `CONFIG_VERSION` | the config format version — see [Version](#version) |

The literal type each set of enumerated values forms is exported too, so a
wrapper can name one in its own signature — `function setRenderer(renderer:
RendererType)` — instead of indexing into a config type as
`SeriesConfig['renderer']`. [Enumerated values](/reference/enumerations) lists
every one of them with its values and the config members that use it.

## Styling hooks

`mochartCssClasses` maps every chart part to the CSS class the renderer puts
on it (`mochart-chart`, `mochart-title-text`, `mochart-plot`, …) — useful
for targeted CSS overrides and DOM queries. The `@mochart/export` package
uses these to serialize rendered charts to SVG/PNG — see
[Exporting images](/guide/export).

**Not every value is a single class name.** Parts that exist once per series,
axis or category carry two space-separated tokens: the class shared by all of
them, then a prefix to which the id (or index) is appended. Prefixes that take
a configured id end in `-id-`, so no id can spell out another structural class.

```js
import { mochartCssClasses } from '@mochart/core';

mochartCssClasses.series      // 'mochart-series mochart-series-id-'
mochartCssClasses.seriesBar   // 'mochart-series-bar mochart-series-bar-'

const [shared, prefix] = mochartCssClasses.series.split(' ');
document.querySelectorAll('.' + shared);   // every series
document.querySelector('.' + prefix + 'S0');  // the series with id S0
```

So `'.' + mochartCssClasses.series` is not a valid selector — split first.
Treat any value containing a space this way. The one exception to the
base-plus-prefix reading is `chartError`, whose two tokens are both complete
classes: `'mochart-chart mochart-chart-error'`.

## Version

`getVersionString()` returns the library's package version, e.g. `'1.0.0'`.

`CONFIG_VERSION` is the config *format* version — what `migrateConfig` stamps
onto a config that has none, and what `config.version` is compared against. The
two are separate values and free to diverge, so a host persisting user configs
should compare a stored `version` against `CONFIG_VERSION`, never against
`getVersionString()`.

## Advanced exports

Exports for hosts that manage chart lifecycles by hand — most applications
never need them:

```ts
buildMochartConfig(config, defaults?, validation?): MochartConfig
```

The build step of `enhanceConfig` alone: defaults applied, `*Defaults`
sections merged, and cross-references resolved, with the given validation
result attached (or a blank valid one). Unlike `enhanceConfig` it neither
migrates nor validates — call it directly only to reuse one set of defaults
or one validation result across several steps, the way
[`@mochart/demo-common`](https://github.com/mocharts/mochart/tree/main/packages/mochart-demo-common)
derives a chart build and its editor views from a single `getDefaults` call.

```ts
hasConfigStructureChange(prev: MochartConfig | null, next: MochartConfig | null): boolean
```

Compares two enhanced configs (from `enhanceConfig`; either side may be
`null` while a host is still loading — a config appearing or going away is
structural) and reports whether the change is *structural*: a different
validity (or a new config that is invalid, whatever the old one was), config
`id`, chart type, category axis (property, key property,
type, scale, or `dateUTC`), value axis set, stack set, or series set — series
ids, data properties, or axis/stack/group membership. A structural change makes the
chart rebuild and replay its initial animation instead of animating the
difference in place, so a host can use this to know a config edit's blast
radius before applying it. The entry points run the same check internally;
only hosts that rebuild charts themselves need to call it.

### What is not exported

Everything else is internal: the retained-mode components and rendering
primitives, the data-source and focus controllers, the measure/layout and
staged-animation pipeline types, and the enhanced config views. The shipped
`.d.ts` still describes the shape of every prop and result — editor hovers
show them — but internals are not importable by name from `@mochart/core`
and change without notice. Anything importable but not documented on this
page is repo tooling, not supported API.
