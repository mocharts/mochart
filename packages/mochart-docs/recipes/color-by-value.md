# Color by value

A series normally takes one color from the palette. Point
[`colorProperty`](/reference/series#series.colorProperty) at a
data property and each bar is colored per category instead, mapped through the
series' [`colorScale`](/reference/series#series.colorScale)
ramp — a second measure encoded on the same bars.

<script setup>
import * as colorByValue from '../examples/colorByValue'
import * as colorByValueBase from '../examples/colorByValueBase'
</script>

<LiveChart :config="colorByValue.config" :data="colorByValue.data" demo="color-property" />

<<< @/examples/colorByValue.ts

## How it works

- Each category's `colorProperty` value maps linearly from
  [`colorScale.min`](/reference/series#series.colorScale.min) to
  [`colorScale.max`](/reference/series#series.colorScale.max)
  across the property's extent *in that series* — the palest bar is always
  the smallest color value and the darkest the largest, whatever the numbers
  are. Point `colorProperty` at the series' own `property` to shade each bar
  by its own value instead of a second measure.
- [`colorScale.interpolation`](/reference/series#series.colorScale.interpolation)
  picks the d3 color space to interpolate in (`rgb`, `hsl`, `lab`, `hcl`).
  Setting `colorProperty` is the switch: once it's set, the scale defaults to
  `hcl` through `#8f8fff` → `#0000ff` — the example above overrides the ramp,
  everything else is defaults.
- Per-category color applies to `bar` series (including floating bars via
  [`rangeProperty`](/reference/series#series.rangeProperty)) —
  line and area shapes and markers keep their single series color.
- Bar fills and strokes default to `0.8` opacity, which dilutes the ramp
  against the background; the example sets
  [`shapeStyle.normal`](/reference/series#series.shapeStyle.normal)'s
  two opacities to `1` so the colors read true.
- A category with no color value gets
  [`colorScale.missing`](/reference/series#series.colorScale.missing)
  (default `#cccccc`, the Services bar above); set it to `null` to fall back
  to the series' own style colors instead.
- The series' legend and tooltip color chips become a min→max ramp swatch,
  so the legend doubles as a compact color key
  ([`showColorInLegend`](/reference/series#series.showColorInLegend) /
  [`showColorInTooltip`](/reference/series#series.showColorInTooltip)
  turn the chips off).
- The tooltip shows the series value, not the color value; point
  [`tooltipProperty`](/reference/series#series.tooltipProperty)
  at the color property to surface it, as the
  [heatmap](/recipes/heatmap) does.
- `colorProperty` cannot be combined with a [gradient](/recipes/gradients).
  A [pattern](/recipes/patterns) replaces the per-category fill; the per-category
  stroke color still applies.

## Diverging around a base

Set [`colorScale.base.value`](/reference/series#series.colorScale.base.value)
and the ramp splits in two: one color pair above the threshold, another below
— growth in blue, decline in red.

<LiveChart :config="colorByValueBase.config" :data="colorByValueBase.data" demo="color-base-property" />

<<< @/examples/colorByValueBase.ts

- With `base.value` set, `min`/`max` must be `null` (their default in that
  case — setting them alongside a base is a validation error) and the four
  [`base`](/reference/series#series.colorScale.base) colors take
  over. Each anchors to its half's data extent: `aboveMin` sits *at* the base
  and `aboveMax` at the highest value; `belowMin` sits at the *most negative*
  value and `belowMax` at the base. The defaults give the classic diverging
  look — palest at the base, saturated at both extremes.
- Each half fits its own side of the color property's extent, so the deepest
  red and deepest blue always mark the current extremes.
- The base splits only the *colors*. Here the bars measure revenue (all
  positive) while the color diverges on growth; when the color property is
  the series' own values, pin the value axis with
  [`base`](/reference/valueAxes#valueAxes.base) so the bars grow
  out of the same divide the colors split on.

For value-colored *grids* — rows of full-width bars sharing one global ramp —
see the [heatmap recipe](/recipes/heatmap).
