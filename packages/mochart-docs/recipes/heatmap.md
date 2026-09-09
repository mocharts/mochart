# Heatmap

The `createHeatmap` helper turns a grid of values into heatmap pieces: rows
become full-width bar series stacked on a row-labelled axis, and each cell's
value colors it from a shared sequential ramp.

<script setup>
import * as heatmap from '../examples/heatmap'
</script>

<LiveChart :config="heatmap.config" :data="heatmap.data" demo="heatmap" />

<<< @/examples/heatmap.ts

## How it works

- `createHeatmap(rows, options)` returns `{ domain, colorScale, data,
  categoryAxis, valueAxes, series }`. Each row is a `bar` series floating on
  a fixed one-unit band of the value axis via
  [`rangeProperty`](/reference/series#series.rangeProperty) (`rows[0]` on
  top). The returned `valueAxes` fragment pins the axis to exactly the
  stacked bands and labels each band's center with the row name through
  explicit [`ticks`](/reference/valueAxes#valueAxes.ticks) (auto numeric
  ticks would land on the band edges and mislabel the rows). The row series
  stay out of the legend
  ([`showInLegend: false`](/reference/series#series.showInLegend)) — hiding a
  row from a legend would read as missing data, and a color-ramp strip built
  from `colorScale` makes the better legend.
- Cell colors come from
  [`colorProperty`](/reference/series#series.colorProperty): each cell's
  value drives its fill (see [color by value](/recipes/color-by-value) for
  the basic per-bar usage). The core color scale spans each series' *own*
  extent, so the helper sets every row's
  [`colorScale.min`](/reference/series#series.colorScale.min) /
  [`colorScale.max`](/reference/series#series.colorScale.max) to the global
  ramp sampled at that row's min/max — keeping cell colors comparable across
  rows. The default ramp is a light-to-dark sequential blue; override it with
  the helper's `colorMin`, `colorMax` and `colorInterpolation` options
  (default `'lab'`; they land in each row's `colorScale`), or fix the scale
  across datasets with `domain` (cell values outside it clamp to the end
  colors).
- Each series sets
  [`tooltipProperty`](/reference/series#series.tooltipProperty) to the cell
  value, so the tooltip shows the value driving the color rather than the
  cell's band coordinates —
  [`valueFormat`](/reference/series#series.valueFormat) formats it as usual.
- `null`/`undefined` cells leave a gap in the grid:
  [`missingValueMode: 'connect'`](/reference/series#series.missingValueMode) skips
  them without disturbing their neighbours. Pass `missingColor` instead to
  draw them as a full band in that colour (it becomes each row's
  [`colorScale.missing`](/reference/series#series.colorScale.missing)) — pick
  one clearly off the ramp, so a missing cell reads as "no data" rather than
  as a value.
- `cellPadding` (default 0.03) sets the gap between cells as a fraction
  trimmed from each side (0 for a contiguous grid; it must be below 0.5), and
  `columnLabels` names the columns (defaults to 1-based numbers). They become
  the category values, so pass one per column and keep them unique —
  `createHeatmap` throws otherwise.
- The returned `colorScale` maps any value to its hex color and `domain` is
  the extent the colors are scaled over — the pieces you need to render a
  color-ramp legend next to the chart. `createHeatmapColorScale(domain,
  options)` builds the same scale standalone.
