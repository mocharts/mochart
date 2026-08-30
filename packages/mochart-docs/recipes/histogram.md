# Histogram

The `createHistogram` helper bins a plain array of numbers and returns
chart-ready rows plus the config fragments that make the bars read as a
histogram — contiguous, one bar per bin.

<script setup>
import * as histogram from '../examples/histogram'
</script>

<LiveChart :config="histogram.config" :data="histogram.data" demo="histogram" />

<<< @/examples/histogram.ts

## How it works

- `createHistogram(values, options)` returns `{ bins, data, categoryAxis,
  seriesConfig }` and picks the bins for you: roughly Sturges' count by
  default, with edges rounded to 1/2/5-style numbers. Override with
  `binCount` (approximate), `binWidth` (exact, wins over `binCount`) or
  `domain` to bin over a fixed range (values outside it are ignored);
  `nice: false` divides the domain exactly instead of rounding. Either
  override throws past 10000 bins, whether from a large `binCount` or a
  `binWidth` small enough to need that many across the domain. Bins are
  half-open — a value on an edge falls into the upper bin, except the last
  bin, which includes its upper edge.
- The returned `categoryAxis` fragment uses an ordinal axis with
  [`categoryPaddingFraction`](/reference/categoryAxis#categoryAxis.categoryPaddingFraction)
  zeroed so the bars touch, which is what visually separates a histogram from
  a bar chart. Bins are contiguous and equal width, so an ordinal axis
  positions them identically to a linear one — and on a linear category axis
  a bar always spans a single category *value*, which would leave
  multi-unit-wide bins as slivers.
- `normalize` switches each bin's value from the raw `'count'` to
  `'probability'` (sums to 1) or `'density'` (integrates to 1), and
  `cumulative: true` accumulates the bins left to right. The default series
  title follows the mode (`Count`, `Probability`, `Density`); set
  `seriesTitle` to override it.
- Each row stores its bin's value under the property named by
  `valueProperty` (default `'value'`) — the returned `seriesConfig` fragment
  points at it — plus `binStart`, `binEnd`, `binCenter` and `count`. The
  category value is `binLabel`, formatted by the `binLabel` option (default
  `start–end`; the labels must be unique). The raw bin descriptions come back
  under `bins`, useful for annotations built alongside the chart.
- The lower-level `binValues(values, options)` returns just the bins with no
  chart fragments, for when you want the binning without the charting.
