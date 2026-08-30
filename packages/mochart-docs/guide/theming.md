# Colors, theming, and dark mode

A chart has two kinds of color. **Series colors** — bars, lines, markers,
slices — come from the config: the
[color palette](/reference/colorPalette), per-series style overrides, or a
color ramp. **Chrome** — the title, axis lines, tick marks and labels, grid
lines, the legend, the crosshair — defaults to the CSS keyword
`currentColor`, so it resolves to whatever CSS `color` the chart's container
inherits from your page.

That split is most of the theming story. Put the chart on a page whose text
color flips with the theme and every piece of chrome follows along, with no
config and no second stylesheet — the live examples on this site restyle
when you toggle the site theme (try it). Series colors never follow the
page; they stay whatever the palette or your config says.

<script setup>
import * as theming from '../examples/theming'
import * as palette from '../examples/palette'
</script>

The page color doesn't have to be a theme. This chart's host element sets
`style="color: #7c3aed"`, and every default-styled piece of chrome takes the
tint while the series keep their palette colors:

<LiveChart :config="theming.config" :data="theming.data" color="#7c3aed" />

## Series color palettes

Mochart's default is Paul Tol's
[Bright qualitative color scheme](https://sronpersonalpages.nl/~pault/), in
its recommended order:

```js
['#4477aa', '#ee6677', '#228833', '#ccbb44', '#66ccee', '#aa3377', '#bbbbbb']
```

It is designed to distinguish unordered categories for people with common
forms of color-vision deficiency. A default series shape takes the color at
its series index; a style set to `categoryIndex` instead takes the color at
the datum's category index. Indices wrap, so index 7 reuses index 0. If that
would make two things that readers must identify share a color, add another
visual encoding or choose a suitable palette with more entries — see
[Color and visual encoding](/guide/accessibility#color-and-visual-encoding).

Set both `strokeColors` and `fillColors` when line and filled renderers should
share a palette. The arrays are replacements, not extensions of the defaults.
This example replaces the normal series palette with Tol's three-color
high-contrast scheme:

<LiveChart :config="palette.config" :data="palette.data" demo="monthly" />

<<< @/examples/palette.ts

The default `focused` and `defocused` series styles use `same`, so the normal
color remains in effect during interaction and the example only needs to
override `normal`. If a custom style uses `seriesIndex` or `categoryIndex`
directly in either focus state, configure that state's palette arrays too.

The four top-level palette groups serve different elements:

- `shape` colors the main line, area, bar, or pie shape.
- `marker`, `label`, and `errorBar` provide independent colors when those
  elements' styles explicitly use `seriesIndex` or `categoryIndex`.
- By default, markers and error bars use the owning `series` color, while
  labels use the page's `currentColor`, so changing `shape` is usually enough.

See the [`colorPalette` reference](/reference/colorPalette) for the complete
shape and [the config model](/guide/config-model#partial-overrides) for merge
behavior. A qualitative palette identifies separate categories; to map a
numeric magnitude through a continuous or diverging ramp, use
[`colorProperty` and `colorScale`](/recipes/color-by-value) instead.

## Chrome and `currentColor`

Chrome style fields default to `'currentColor'`, which is written to the
rendered SVG as-is — the browser resolves it against the inherited `color`,
so mochart never computes a theme itself. The defaults that resolve this
way:

- the title text, and the axis title texts
- axis lines, base lines, tick marks, and tick label text
- grid lines, threshold lines and titles, the axis focus range, and focus
  tick marks
- the crosshair lines
- legend item text, and the series-icon borders in the legend and tooltip
- series value labels, and the pie center labels

Each comes with a tuned default opacity so a single value reads correctly
over both light and dark backgrounds — grid lines at `strokeOpacity` 0.13,
axis lines and tick marks at 0.65, the crosshair at 0.3, text at or near 1.
Chrome contrast is therefore adjusted through opacities, not by picking new
colors per theme.

## What does not follow the page

- **Series colors.** The palette and the color-ramp fields produce concrete
  colors by design — chart data should look the same on every page. Restyle
  them per theme by passing a different config (for example a different
  [`colorPalette`](/reference/colorPalette)) when your theme changes.
- **Colors you set yourself.** Any literal color in your config is used
  exactly as written, in every theme.
- **The tooltip surface** — see below.

## Dark mode

For chrome there is nothing to configure: when your page (or the chart's
container) sets a light text color on a dark background, the chart follows.

The chart's own surfaces are transparent, so whatever sits behind the chart on
your page shows through and follows the theme with it — no config needed. To
give a surface its own background, every part that has one takes a
`backgroundStyle`: [`chart`](/reference/chart#chart.backgroundStyle),
[`plot`](/reference/plot#plot.backgroundStyle),
[`legend`](/reference/legend#legend.backgroundStyle),
[`title`](/reference/title#title.backgroundStyle) and the axes. Those are
concrete colors like any other, so a config that sets them needs a per-theme
variant.

The tooltip is the one exception. It is an HTML overlay, and its background
and border form a *surface* that must sit at the opposite end of the
contrast pair from the text on top of it — something no inherited text
color can express — so its defaults are a translucent white background with
a dark border. Its text does inherit the page color, which is right for a
light surface in both themes; if you keep the light surface on a dark page,
scope a `color` override to the tooltip instead. To flip the surface
itself, override it with CSS scoped to your dark theme (the colors are
inline styles, so the overrides need `!important`):

```css
html.dark .mochart-tooltip-container .mochart-tooltip {
  background: rgba(32, 33, 39, 0.94) !important;
  border-color: rgba(140, 145, 160, 0.55) !important;
}
```

This is exactly what this docs site does for its live examples.
Alternatively, keep it in config: pass a config with a dark
[`tooltip.backgroundStyle`](/reference/tooltip#tooltip.backgroundStyle)
when your theme changes.

## Using `currentColor` in your config

Every style color field accepts `'currentColor'`
([the config model](/guide/config-model#styles-and-focus-states) covers the
style shape), so any element you restyle can opt back into following the
page — for example a series drawn in the page's text color:

```js
series: [{
  property: 'total',
  shapeStyle: { normal: { fillColor: 'currentColor' } }
}]
```

The places it is rejected are the series color-scale bounds
(`colorScale.min`, `colorScale.max`, `colorScale.missing` and
`colorScale.base.*`), `colorPalette` entries, and gradient stop colors: those
are interpolated by d3 scales, which need concrete colors, so validation turns a
keyword away rather than letting it produce `NaN` colors.

## Exports

Exported images inline the chart's *resolved* colors, so a chart exported
from a dark page has light chrome — pass the export a background color that
matches the page, or export transparent. See
[Exporting images](/guide/export#dark-pages).
