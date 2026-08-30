# Waterfall

The `createWaterfall` helper accumulates a list of signed steps into floating
bars: increases and decreases ride the running total, and **total** steps
drop a full bar back to the base.

<script setup>
import * as waterfall from '../examples/waterfall'
</script>

<LiveChart :config="waterfall.config" :data="waterfall.data" demo="waterfall" />

<<< @/examples/waterfall.ts

## How it works

- Each item is `{ label, value }` for a delta step, or `{ label, total: true }`
  for a total bar showing the running total so far (give a total a `value` to
  reset the running total, e.g. an audited closing balance). Labels must be
  unique — they become the category values.
- The helper returns `{ steps, data, categoryAxis, series, valueAxes }`. The
  floating bars are three ordinary `bar` series — increase, decrease, total —
  all spanning from the shared `start` property via
  [`rangeProperty`](/reference/series#series.rangeProperty). Every row
  carries a value for exactly one of them, and
  [`missingValueMode: 'connect'`](/reference/series#series.missingValueMode) with
  [`partialRangeIsMissing`](/reference/series#series.partialRangeIsMissing)
  keeps the other two from rendering (`start` exists on every row, so without
  `partialRangeIsMissing` they would collapse to zero-height bars instead of
  skipping). Each slot shows one full-width bar while the legend still names
  the three directions.
- The default direction colors are teal-green/red/blue rather than a pure
  green/red: green↔red is the classic red-green-blindness collision, and
  shifting the green toward teal keeps every pair distinguishable on light
  and dark surfaces. Override per direction with `colors`, and rename the
  series with `seriesTitles`.
- `base` sets the value the running total starts from and total bars span
  from (default 0). It comes back in `valueAxes` as the axis
  [`base`](/reference/valueAxes#valueAxes.base) — spread that fragment and
  the axis agrees with the bars, whatever the base is.
- Each row also carries `delta`, `cumulative` and `direction`, and the
  computed steps come back under `steps` — or call
  `computeWaterfallSteps(items, base)` alone for the math without the chart
  fragments.
- Each bar spans from the running total before the step to the total after
  it, so a bar crosses or sits below the base as soon as the running total
  does. For bars rooted at the base whose own values carry the sign, see
  [positive and negative values](/recipes/positive-negative).
