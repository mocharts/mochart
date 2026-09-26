# Thresholds and ranges

Three ways to show reference context around your values: a **threshold line**
drawn at a fixed value on an axis, a **threshold range** filled between two
fixed values, and a **range series** that fills the band between two data
properties.

<script setup>
import * as thresholdLine from '../examples/thresholdLine'
import * as thresholdRange from '../examples/thresholdRange'
</script>

<LiveChart :config="thresholdLine.config" :data="thresholdLine.data" demo="threshold-line" />

<<< @/examples/thresholdLine.ts

## How it works

- [`thresholds`](/reference/valueAxes#valueAxes.thresholds) on a value axis
  draws one reference line per entry. Each entry has a `value`, an optional
  `title` beside the line (its `text`, and `side`, `textStyle` and the other
  members that place and style the label), and a `style` for the line (color,
  width and dash array in `normal`, `focused` and `defocused` states); `front`
  puts the line in front of or behind the series. A linear category axis takes
  the same `thresholds` for vertical reference lines (a date axis value is an
  ISO string or timestamp); an ordinal one places them by category, described
  below.
- The data band is an ordinary `area` series with
  [`rangeProperty`](/reference/series#series.rangeProperty): the shape spans
  from the `rangeProperty` value (here `p5`) to the `property` value (`p95`)
  instead of starting at the axis base. Dropping
  [`shapeStyle.normal.strokeOpacity`](/reference/series#series.shapeStyle.normal.strokeOpacity)
  to 0 and
  [`fillOpacity`](/reference/series#series.shapeStyle.normal.fillOpacity) low
  keeps it as background context; the colors and the focused/defocused states
  stay at their defaults. `rangeProperty` works with the other renderers too:
  `bar` draws floating bars, and `line` draws the two bounds as a pair of lines
  sharing the series' style and legend entry.
- For ranged series the tooltip prints the `rangeProperty` value, then
  [`tooltip.rangeValueSeparator`](/reference/tooltip#tooltip.rangeValueSeparator),
  then the `property` value. That order comes from the config, not from the two
  magnitudes, so the example above reads `low - high` because it puts `p5` in
  `rangeProperty`. When both ends format to the same text, the tooltip shows it
  once instead of repeating it either side of the separator.
- A category with only one of the two values collapses to a zero-extent span at
  the defined one, so the band stays connected; set
  [`partialRangeIsMissing`](/reference/series#series.partialRangeIsMissing) to
  treat such categories as missing instead.
- Thresholds never extend the axis: a line whose value falls outside the current
  domain is simply not drawn. If the data alone wouldn't reach the threshold,
  set [`softMax`](/reference/valueAxes#valueAxes.softMax) at or above it so the
  axis covers it.


## Threshold ranges

Give a thresholds entry a
[`rangeValue`](/reference/valueAxes#valueAxes.thresholds.rangeValue) and it
fills the range between its two values instead of drawing a line:

<LiveChart :config="thresholdRange.config" :data="thresholdRange.data" demo="threshold-range" />

<<< @/examples/thresholdRange.ts{18-24}

- The stroke members of
  [`style`](/reference/valueAxes#valueAxes.thresholds.style) draw the range's
  two edge lines and its fill members fill the interior; a stroke opacity of 0
  leaves just the fill. A
  [`pattern`](/reference/valueAxes#valueAxes.thresholds.pattern) or
  [`gradient`](/reference/valueAxes#valueAxes.thresholds.gradient) id fills the
  range with that definition instead, and a pattern's `owner` color resolves to
  the range's fill color. `front: false` keeps the range behind the series.
- The title's `side` is `low` or `high` of the whole range, or `inside` to
  center it within the range; `align` places any threshold title at the `start`,
  `middle` or `end` of the plot instead of the axis side.
- A range partly outside the axis domain is clipped to it; one wholly outside is
  not drawn.
- Ordinal category axes take thresholds too: a value names a category, so a line
  sits at that category's center, as the `Midweek` line at `Wed` above, and a
  range covers whole slots from the first named category to the second.
- [`thresholdStep`](/reference/categoryAxis#categoryAxis.thresholdStep) repeats
  a line or range by rule instead of listing values. It is off by default, so
  set `visible: true` along with the rule: every `count`-th candidate from an
  `offset`, where the candidates are an ordinal axis's categories, the periods
  of a date axis under a `period`, or the multiples of an `interval` on a number
  scale. `period: 'week'` with `count: 2` draws a range over every other week of
  a daily trading axis, holidays included, as the threshold step demo in the
  gallery does, and on a value axis `interval: 10` with `count: 2` draws ranges
  over 0 to 10, 20 to 30 and so on. `range: false` draws lines at the candidates
  instead. The stepped shapes share one `style`, `pattern` or `gradient` and
  carry no title. On a linear axis
  [`minSpacing`](/reference/valueAxes#valueAxes.thresholdStep.minSpacing) is the
  least distance in pixels allowed between the thresholds the rule draws: when
  they would sit closer together than that, none are drawn and a console warning
  names the axis.
