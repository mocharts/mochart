# Date axis

Time-series data uses a category axis with
[`type: 'date'`](/reference/categoryAxis#categoryAxis.type). Combined
with [`scale: 'linear'`](/reference/categoryAxis#categoryAxis.scale),
each point is positioned by its actual date — note the uneven horizontal
spacing below matching the gaps in the data.

<script setup>
import * as dateAxis from '../examples/dateAxis'
</script>

<LiveChart :config="dateAxis.config" :data="dateAxis.data" demo="tick-prune" />

<<< @/examples/dateAxis.ts

## How it works

- Date values in the data can be ISO strings (as in the example above),
  `Date` objects, or millisecond timestamps.
  [`dateUTC`](/reference/categoryAxis#categoryAxis.dateUTC) decides whether
  ticks are placed and labels formatted in UTC or local time. It defaults to
  `true`, so set it to `false` for data whose day boundaries are local ones.
- [`tickLabel.format`](/reference/categoryAxis#categoryAxis.tickLabel.format)
  takes a d3 time-format string for date axes (`'%b %d'` → "Jun 01"), as does
  the category axis
  [`valueFormat`](/reference/categoryAxis#categoryAxis.valueFormat) shown in
  the tooltip.
- With `scale: 'ordinal'` instead, dates are spaced evenly in data order —
  useful when the gaps are noise (e.g. trading days).
- [`min`](/reference/categoryAxis#categoryAxis.min) /
  [`max`](/reference/categoryAxis#categoryAxis.max) (and the soft bounds)
  window a linear date axis; they take an ISO date string or a timestamp — see
  [axis bounds](/recipes/axis-bounds).
- A date that is present but has no value is a gap in the shape;
  [`missingValueMode`](/reference/series#series.missingValueMode) chooses whether
  the shape breaks there (default), connects across it, or drops to the base.
- The `area` renderer fills to the value axis
  [`base`](/reference/valueAxes#valueAxes.base) when one is set; with no base
  set — the default for an axis without stacks, as here — it fills to the
  minimum end of the axis. Swap in `line` or `bar` per series via
  [`renderer`](/reference/series#series.renderer).
