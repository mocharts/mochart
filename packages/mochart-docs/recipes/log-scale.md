# Log scales

[`scale: 'log'`](/reference/valueAxes#valueAxes.scale) spaces values by ratio
instead of by difference: each power of 10 takes the same length, so 1 to 10
is as tall as 1000 to 10000. Use it for data spanning several orders of
magnitude, where a linear axis flattens everything but the largest values, and
for growth, where equal rates of growth are equal slopes.

<script setup>
import * as logScale from '../examples/logScale'
import * as logLog from '../examples/logLog'
</script>

<LiveChart :config="logScale.config" :data="logScale.data" demo="log-growth" />

<<< @/examples/logScale.ts

## How it works

- The ticks sit at the powers of 10. When they do not all fit, the axis keeps
  every second, third or n-th one, for the smallest n that fits; when there
  are too few of them, it adds the 2 and 5 multiples as ticks, or every
  multiple from 2 to 9, where they fit. Inside a single power of 10, such as 50 to 80, the ticks are the
  multiples that lie there (50, 60, 70, 80), or linear ones on an axis with
  room for more than twice that many.
- Between the ticks, the minor ticks are the multiples from 2 to 9 that are not
  ticks or, when the axis keeps every n-th power of 10, the powers it skips,
  thinned to sit at least
  [`minTickSpacing`](/reference/valueAxes#valueAxes.minTickSpacing) apart.
  Their tick marks and grid lines show by default, following
  the [`tickMark`](/reference/valueAxes#valueAxes.tickMark.minorVisible) and
  [`gridLine`](/reference/valueAxes#valueAxes.gridLine.minorVisible) settings
  of the ticks themselves, so hiding the grid lines hides the minor grid lines
  too. Their labels stay off.
  [`tickLabel.minorVisible`](/reference/valueAxes#valueAxes.tickLabel.minorVisible)
  `true` labels them all when every label fits, and hides their marks and grid
  lines along with the labels when one does not, so it suits a tall axis with
  few powers of 10; a `minorFormat` alone leaves the labels off on a log axis.
- With the default `"auto"` format, each tick label takes an SI prefix of its
  own magnitude, so `1m`, `1` and `1k` share one axis, where a linear axis's
  tick labels take one prefix for the whole axis; tooltip and label values are
  formatted per value on both. Beyond the prefixes, below 1e-24 or from 1e27,
  a value takes exponent form, `1e+30`.
  The prefix reaches down to milli, so a ratio such as a gain of 0.1 reads
  `100m`; where
  that misleads, a
  [`tickLabel.format`](/reference/valueAxes#valueAxes.tickLabel.format) of
  `"~g"` labels the ticks and the tooltip values as plain decimals, as the
  log-log example below does. A format that leaves its precision open, such
  as `"s"` or `"~g"`, takes 3 significant digits on a log axis, with the
  trailing zeros trimmed, since there is no tick step to take one from.
- [`minMarginFraction`](/reference/valueAxes#valueAxes.minMarginFraction) and
  [`maxMarginFraction`](/reference/valueAxes#valueAxes.maxMarginFraction) are
  taken from the logs of the domain, so a 5% margin is 5% of the axis length on
  either scale.
- Bars and areas grow from the minimum end of the axis unless
  [`base`](/reference/valueAxes#valueAxes.base) is set. A base above 0 works as
  it does on a linear axis: with `base: 1`, ratios above 1 grow up and ratios
  below it grow down, with a doubling and a halving the same length.
- Values and the domain animate in logs, so a value moving from 1 to 1000 is
  halfway up the axis at 31.6 rather than at 500.
- Changing `scale` on an axis restarts the chart without a transition.

## Values at or below 0

A log axis has no position for 0 or a negative value. The chart handles each
kind of value differently. A tooltip shows the value itself, and a series label
shows it only where the point is drawn, at the base under
`missingValueMode: 'base'`.

- A series value at or below 0 is left out of the axis domain and drawn as
  missing, the way the series
  [`missingValueMode`](/reference/series#series.missingValueMode) draws a
  missing value: a gap, a connection across it, or a point at the base. The
  chart logs a console warning naming the series, since nothing on the chart
  says why the point is gone.
- An error bar end at or below 0, low or high, is drawn past the minimum end of
  the axis and cut off at the plot edge, so an error bar crossing 0 (5 plus or
  minus 8) runs off the bottom of the plot. So is the lower end of a range whose
  other end is above 0. The [clip indicator](/reference/clipIndicator) marks
  the edge. A range with both ends at or below 0 is missing.
- A threshold line at or below 0 is a validation error. A threshold range with
  one end at or below 0 fills from the minimum end of the axis, so a range from
  0 to 10 covers everything below 10. A range with no end above 0 is a
  validation error too.

## What a log axis rejects

Each of these is a validation error on a log axis, because it needs a position
a log axis does not have or a fixed distance in values that takes a different
length at each end of the axis:

- `min`, `max`, `softMin`, `softMax`, `base` and explicit `ticks` at or below 0.
  `min: 0` and `base: 0` are the usual leftovers from a linear config.
- A series stack on the axis. A stack starts at 0, and a segment's height would
  depend on the total below it rather than its own value.
- [`minOffset`](/reference/valueAxes#valueAxes.minOffset),
  [`maxOffset`](/reference/valueAxes#valueAxes.maxOffset) and
  [`minTickInterval`](/reference/valueAxes#valueAxes.minTickInterval) other
  than 0. Use the margin fractions to leave space at the ends.
- A [`tickStep`](/reference/valueAxes#valueAxes.tickStep) or
  [`thresholdStep`](/reference/valueAxes#valueAxes.thresholdStep) interval.
  `interval: 100` on an axis from 1 to 100000 would put almost every tick in the
  top power of 10.
- A pie chart's axes, which do not accept `"log"`.

## Log category axes

A category axis whose [`type`](/reference/categoryAxis#categoryAxis.type) is
`number` takes [`scale: 'log'`](/reference/categoryAxis#categoryAxis.scale)
too, for log-log plots such as a frequency response:

<LiveChart :config="logLog.config" :data="logLog.data" demo="log-log" />

<<< @/examples/logLog.ts

- Category values at or below 0 are a
  [data error](/guide/data-providers), like duplicate category values: the
  category values place everything else, so the chart is not drawn.
- It takes line, area and marker-only series. Bar series are a validation
  error, because a bar's width is a fixed distance in values.
- [`categoryValueInterval`](/reference/categoryAxis#categoryAxis.categoryValueInterval)
  must stay `"auto"`, which on a log axis is the smallest ratio between
  neighbouring category values. Values a fixed ratio apart (1, 10, 100, or
  frequencies an octave apart) keep half a slot at each end of the axis, as
  evenly spaced values do on a linear axis.
- A date axis cannot be log, since a date has no natural zero. For elapsed time
  on a log axis, use a number axis of days (or seconds) since an event.

## Log price axes

A candlestick or OHLC chart of a price that multiplies reads best on a log
price axis. See [the candlestick recipe](/recipes/candlestick#log-price-axis)
for how to set it on the price axis alone when there is a volume pane.
