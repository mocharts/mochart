# Thresholds and ranges

Two ways to show reference context around your values: a **threshold line**
drawn at a fixed value on an axis, and a **range series** that fills the band
between two data properties.

<script setup>
import * as thresholdRange from '../examples/thresholdRange'
</script>

<LiveChart :config="thresholdRange.config" :data="thresholdRange.data" demo="threshold-line" />

<<< @/examples/thresholdRange.ts

## How it works

- [`thresholds`](/reference/valueAxes#valueAxes.thresholds) on
  a value axis draws one reference line per entry. Each entry has a `value`,
  an optional `title` beside the line (its `text`, and `side`, `textStyle`
  and the other members that place and style the label), and a `style` for
  the line — color, width and dash array in `normal`, `focused` and
  `defocused` states; `front` puts the line in front of or behind the series. A linear
  category axis takes the same `thresholds` for vertical reference lines (a
  date axis value is an ISO string or timestamp); an ordinal one has no value
  scale to place them on.
- The band is an ordinary `area` series with
  [`rangeProperty`](/reference/series#series.rangeProperty):
  the shape spans from the `rangeProperty` value (here `p5`) to the
  `property` value (`p95`) instead of starting at the axis base. Dropping
  [`shapeStyle.normal.strokeOpacity`](/reference/series#series.shapeStyle.normal.strokeOpacity)
  to 0 and
  [`fillOpacity`](/reference/series#series.shapeStyle.normal.fillOpacity)
  low keeps it as background context; the colors and the focused/defocused
  states stay at their defaults. `rangeProperty` works with the other
  renderers too: `bar` draws floating bars, and `line` draws the two bounds as
  a pair of lines sharing the series' style and legend entry.
- For ranged series the tooltip prints the `rangeProperty` value, then
  [`tooltip.rangeValueSeparator`](/reference/tooltip#tooltip.rangeValueSeparator),
  then the `property` value. That order comes from the config, not from the
  two magnitudes, so the example above reads `low - high` because it puts
  `p5` in `rangeProperty`. When both ends format to the same text, the tooltip
  shows it once instead of repeating it either side of the separator.
- A category with only one of the two values collapses to a zero-extent span
  at the defined one, so the band stays connected; set
  [`partialRangeIsMissing`](/reference/series#series.partialRangeIsMissing)
  to treat such categories as missing instead.
- Thresholds never extend the axis: a line whose value falls outside the
  current domain is simply not drawn. If the data alone wouldn't reach the
  threshold, set [`softMax`](/reference/valueAxes#valueAxes.softMax) at or
  above it so the axis covers it.
