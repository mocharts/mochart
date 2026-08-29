# The config model

A mochart config is a plain, JSON-serializable object made of per-concern
**sections**. Every section — and almost every property inside one — is
optional and falls back to a default, so configs only say what differs from
the defaults.

```js
const config = {
  title: { … },          // chart title
  categoryAxis: { … },   // the category axis (requires `property`)
  series: [ … ],         // one entry per series (each requires `property`)
  seriesDefaults: { … }, // values shared by every series
  valueAxes: [ … ],      // one or more value axes
  legend: { … },
  tooltip: { … },
  crosshair: { … },
  animation: { … },
  // …
};
```

The [config reference](/reference/) lists every section and is generated from
the library's own validators, defaults, and descriptions — it can't drift
from the code.

## Object sections and list sections

Sections come in two shapes:

- **Object sections** configure a single thing: `title`,
  `categoryAxis`, `legend`, `tooltip`, `crosshair`,
  `animation`, `chart`, `plot`, `colorPalette`, `accessibility`, `pie`,
  `clipIndicator`.
- **List sections** configure a collection and take an array of config
  objects: `series`, `valueAxes`, `seriesGroups`,
  `seriesStacks`, `linearGradients`, `radialGradients`, `patterns`.
  Passing a single object instead of an array is allowed and treated as a
  one-entry list.

## Shared `*Defaults` sections

Every list section has a companion `*Defaults` section — `seriesDefaults`,
`valueAxisDefaults`, and so on — whose values apply to **every** entry of
the list. A value set on an individual entry wins over the shared one:

```js
seriesDefaults: { renderer: 'bar', valueFormat: ',.0f' },
series: [
  { property: 'revenue' },                      // bar, ',.0f'
  { property: 'target', renderer: 'line' }      // line, ',.0f'
]
```

## Styles and focus states

Everything the chart draws is styled by a **style** object rather than by a
flat set of color properties. A style holds `strokeColor`, `strokeOpacity`,
`strokeWidth` and `strokeDashArray`, plus `fillColor` and `fillOpacity` for
shapes that have an interior. Lines — grid lines, tick marks, thresholds,
crosshairs, error-bar whiskers — take the stroke half only.

Most elements are drawn differently depending on what has focus, so their
style is nested one level deeper, under `normal`, `focused` and `defocused`:

```js
series: [{
  property: 'revenue',
  shapeStyle: {
    normal:    { fillColor: '#3366cc', fillOpacity: 0.8 },
    focused:   { fillOpacity: 1 },
    defocused: { fillOpacity: 0.3 }
  }
}]
```

In the `focused` and `defocused` states a color — and likewise `strokeWidth`
and `strokeDashArray` — may be the literal `'same'`, meaning "whatever the
`normal` state resolved to". That is the default almost everywhere: elements
change opacity or width on focus but keep their color. Opacities are the
exception — they are always concrete numbers, never `'same'`.

Series styles additionally accept the palette modes `'seriesIndex'` and
`'categoryIndex'` in place of a color, and — everywhere but `shapeStyle`,
which defines the series color itself — `'series'` for the series' own
color; see [`colorPalette`](/reference/colorPalette). Any style color also
accepts `'currentColor'` to follow the host page's CSS `color` (how chart
chrome themes itself — see
[Colors, theming, and dark mode](/guide/theming)), and `'none'` to switch
that half of the style off.

Style colors are written straight to the DOM, so any CSS color the browser
understands works — named (`red`), hex 3/4/6/8, `rgb()`/`hsl()` in either
syntax, `oklch()`, `var(--brand)`. The exception is the series color-scale
bounds (`colorScale.min`, `colorScale.max`, `colorScale.missing`,
`colorScale.base.*`), `colorPalette` entries, and gradient stop colors: mochart
interpolates those itself, so they must be concrete colors — no keywords, no
`var()`.

Reference pages link to nested members with dotted anchors, so
[`shapeStyle.normal.fillColor`](/reference/series#series.shapeStyle.normal.fillColor)
is addressable in its own right.

## Partial overrides

Config layers are merged member by member at every depth, so a config only
names what it changes. In the example above `shapeStyle.normal.strokeColor`,
`strokeWidth` and both other states' colors keep their defaults — writing one
member never blanks out its siblings. The same holds when a `*Defaults` section
merges into an individual list entry.

Two values do not merge:

- **Arrays replace wholesale.** `ticks`, gradient `stops` and the palette
  color lists are values, not structures to merge element-wise.
- **`null` is a real value, not a hole.** On a plain style,
  `{ strokeColor: null }` overrides a non-null default and leaves the SVG
  attribute unset so CSS can supply it. Use `undefined` (or simply omit the
  key) to mean "not specified".

  Inside a `normal` / `focused` / `defocused` state this applies to
  `strokeWidth` and `strokeDashArray` only: a state always writes its color
  and opacity attributes, so those must be concrete values — use `'none'` to
  switch a half of the style off.

## Cross-references and id defaulting

Entries in list sections are wired together by id: a series names its value
axis via [`axis`](/reference/series#series.axis), its stack via
[`stack`](/reference/series#series.stack), and its series group via
[`group`](/reference/series#series.group), each matching an
`id` in the corresponding section.

When exactly one target exists, the reference defaults to it — with a single
`valueAxes` entry (or none at all) you never need to mention axis
ids, and with a single `seriesStacks` entry every series joins that
stack automatically (see the [stacked bars recipe](/recipes/stacked-bars)).
Validation reports references that don't resolve.

## Validation

Configs are validated with [@mochart/movalid](https://github.com/mocharts/mochart/tree/main/packages/movalid),
producing human-readable messages rather than schema jargon:

```js
import { validateConfig } from '@mochart/core';

const { valid, errors, warnings } = validateConfig(config);
// e.g. "series[1] - had 1 invalid properties: valueFormt"
```

Editor and tooling integrations can ask for structured locations on top of
the same result:

```js
import { validateConfigDetailed } from '@mochart/core';

const { valid, errors, warnings, diagnostics } = validateConfigDetailed(config);
// diagnostics: [{
//   path: ['series', 1, 'axis'],
//   severity: 'error',
//   message: 'should equal the id property of one of the valueAxes: "missing"',
//   source: 'mochart'
// }]
```

`path` holds the object keys and array indexes leading to the offending
value; a top-level problem that belongs to no one property has an empty path.

Two things validation insists on:

- **`version`**, when present, must equal the current config format version
  (`'1.0.0'`). Omitting it means "the current format". Include it in configs
  you store or share: `enhanceConfig` migrates on the way in, so a config
  written against an older format keeps working, but only if it says which
  format it was written against. `migrateConfig(config)` returns the
  upgraded config on its own, without building a chart.
- **Unknown properties** produce warnings, and a config with warnings is
  rejected in strict mode — typos surface immediately instead of being
  silently ignored. Strict mode is the default and is what the chart entry
  points use; `validateConfig(config, getDefaults(config), false)` and the
  same third argument on `validateConfigDetailed` collect the warnings
  without invalidating the config.

When a chart receives an invalid config it renders its
[config error state](/guide/chart-states) instead of a broken chart.

## Enhancement

`createDefaultChart` validates and defaults the raw config for you on every
update. The lower-level `createChart` expects that work done up front via
`enhanceConfig`:

```js
import { enhanceConfig } from '@mochart/core';

const mochartConfig = enhanceConfig(config);
// validated, defaults applied, *Defaults sections merged, references resolved
```

`enhanceConfig` returns a `MochartConfig` — the fully-built form with every
default applied and cross-references resolved — which is what the renderer
consumes. Data can then be checked against it with
`getDataErrors(mochartConfig, dataProvider)` (see
[Data providers](/guide/data-providers)).

To work with defaults on the *raw* config — a config editor showing or
hiding them, for instance — use the
[`getConfigWithDefaults` / `getConfigWithoutDefaults`](/reference/api#config-helpers)
pair instead: the first fills every default in, the second strips every value
that only restates one, and both return plain serializable configs that share
nothing with the object passed in.
