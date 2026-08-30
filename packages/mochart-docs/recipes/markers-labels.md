# Markers and labels

Markers draw a shape at each value of a series; labels render a data value
next to each shape. Both are per-series config.

<script setup>
import * as markersLabels from '../examples/markersLabels'
import * as scatterBubble from '../examples/scatterBubble'
</script>

<LiveChart :config="markersLabels.config" :data="markersLabels.data" demo="label-property-stacked" />

<<< @/examples/markersLabels.ts

## How it works

- [`marker.shape`](/reference/series#series.marker.shape) picks from `circle`,
  `cross`, `diamond`, `square`, `star`, `triangle` and `wye`; `line`, `area`
  and `none` series default to `circle`, bars to `null` (no marker).
  [`marker.size`](/reference/series#series.marker.size) sets the size (default
  6px) and [`marker.style`](/reference/series#series.marker.style) styles it —
  stroke and fill colors, opacities and widths per `normal`/`focused`/
  `defocused` state. Point
  [`markerProperty`](/reference/series#series.markerProperty) at a data
  property to scale marker size per value — see
  [bubbles](#scatter-and-bubble-charts) below.
- Labels come from [`labelProperty`](/reference/series#series.labelProperty)
  — point it at the series' own `property` (as above) for value labels, or
  at any other data property.
  [`label.format`](/reference/series#series.label.format) formats the value
  (`"auto"` derives a format from the data), and
  [`label.prefix`](/reference/series#series.label.prefix) /
  [`label.suffix`](/reference/series#series.label.suffix) wrap it with text a
  d3 format can't express, such as a unit. They are separate from the
  tooltip's [`valuePrefix`](/reference/series#series.valuePrefix) /
  [`valueSuffix`](/reference/series#series.valueSuffix) because a label may
  show a different property than the series value.
- [`label.position`](/reference/series#series.label.position) places labels
  `inside`, `center` (the default) or `outside` the shape, and
  [`label.offset`](/reference/series#series.label.offset) nudges every label by
  a fixed pixel amount along the value axis.
- Three fraction guards hide labels that wouldn't fit:
  [`label.minRangeFraction`](/reference/series#series.label.minRangeFraction)
  (used above — it hides labels on bars shorter than 5% of the axis extent),
  and
  [`label.minPositionFraction`](/reference/series#series.label.minPositionFraction) /
  [`label.maxPositionFraction`](/reference/series#series.label.maxPositionFraction),
  which hide labels whose values sit too close to the value axis
  [`base`](/reference/valueAxes#valueAxes.base) or too close to the domain end
  they run toward, each by a fraction of the domain extent. Where the axis has
  no `base`, the guards use the domain minimum as the base. `base` defaults to
  `0` on any axis with stacks.
- `label.position`, `label.offset` and the two position-fraction guards each
  have a variant under [`label.aboveBase`](/reference/series#series.label.aboveBase) /
  [`label.belowBase`](/reference/series#series.label.belowBase)
  ([`label.aboveBase.position`](/reference/series#series.label.aboveBase.position),
  [`label.belowBase.offset`](/reference/series#series.label.belowBase.offset), …)
  that apply only to values above or below the value axis
  [`base`](/reference/valueAxes#valueAxes.base) — handy for labeling positive
  and negative bars differently. Their default `'auto'` inherits the plain
  setting (the below-base offset mirrors it, so labels move away from the
  base on both sides).
- [`label.textStyle`](/reference/series#series.label.textStyle) styles the
  label text, again per focus state. Its colors accept the palette modes
  (`series`, `seriesIndex`, `categoryIndex`) as well as literal colors — see
  [`colorPalette`](/reference/colorPalette). The example above sets only
  [`label.textStyle.normal`](/reference/series#series.label.textStyle.normal)`.strokeColor`
  and `.fillColor`; every other member, including both other states, keeps
  its default.

## Scatter and bubble charts

Markers on their own make a scatter chart: set
[`renderer`](/reference/series#series.renderer) to `none` so a series draws
no shape, and only its markers remain.

<LiveChart :config="scatterBubble.config" :data="scatterBubble.data" demo="scatter" />

<<< @/examples/scatterBubble.ts

- Use a `linear` category axis
  [`scale`](/reference/categoryAxis#categoryAxis.scale) (with `number` or
  `date` [`type`](/reference/categoryAxis#categoryAxis.type)) so points are
  positioned by their measured x values rather than evenly spaced category
  slots.
- For bubbles, point
  [`markerProperty`](/reference/series#series.markerProperty) at a data
  property; marker sizes scale between
  [`marker.minSize`](/reference/series#series.marker.minSize) (default 1px) and
  [`marker.size`](/reference/series#series.marker.size) with the property's
  value.
- [`marker.sizeScale`](/reference/series#series.marker.sizeScale) picks how
  they scale: the default `sqrt` scales each marker's **area** with its value
  — the way readers judge bubble magnitude — while `linear` scales its
  diameter, which visually exaggerates differences. The `marker.minSize` floor
  keeps the smallest bubble visible (and hoverable); for exactly
  value-proportional areas, set it to `0` on data whose minimum is `0`.
- Every series reads its x from the row's category value, so series share x
  positions. For series with points at different x values, give each x its
  own row and leave the other series' properties out — a row draws a marker
  only for the series that have a value there.
