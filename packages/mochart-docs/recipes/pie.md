# Pie and donut

Setting [`chart.type`](/reference/chart#chart.type) to `'pie'` renders the
series as pie slices instead of an x/y plot. The `createPie` helper builds
the pieces from labelled values: every slice is its own series, so the
legend, focus and filtering behave exactly like the other chart types.

<script setup>
import * as pie from '../examples/pie'
import * as donut from '../examples/donut'
import * as gauge from '../examples/gauge'
</script>

<LiveChart :config="pie.config" :data="pie.data" demo="pie" />

<<< @/examples/pie.ts

## How it works

- `createPie(items, options)` returns config *fragments* like the other
  chart-type helpers — `chart` (setting the type), `pie`, `categoryAxis`
  (naming the single category property) and one `series` entry per slice —
  plus the `data`, the clamped `total` and each slice's `fractions`. The data
  is a single row: `{ category: 'all', slice0: 420, slice1: 210, ... }`
  (`categoryValue` renames `'all'`). `computePieFractions(values)` returns
  just the total and fractions.
- **Slices are series.** Hovering a legend entry focuses its slice and
  clicking one filters it — the remaining slices grow to fill the circle,
  animated with the usual [`animation`](/reference/animation) timing. To
  focus from the slice itself, set the series'
  [`focusOnHover`](/reference/series#series.focusOnHover) or
  [`focusOnClick`](/reference/series#series.focusOnClick); an `onSliceClick`
  callback reports slice clicks (see
  [Interaction](/guide/interaction#callbacks)). Slice colors come from the
  [`colorPalette`](/reference/colorPalette) by series index, or from an
  explicit per-item `color`.
- On first load the pie sweeps in from the start angle over
  [`animation.initialDuration`](/reference/animation#animation.initialDuration)
  (slice labels appear once the sweep settles). Setting
  [`focusOffsetFraction`](/reference/pie#pie.focusOffsetFraction) "explodes"
  the focused slice away from the center, animated by the focus tween — try
  hovering the legend on the donut below.
- Clicking the chart opens the tooltip with one row per slice. In pie mode
  [`tooltip.snapToCategory`](/reference/tooltip#tooltip.snapToCategory)
  defaults to `false`, so the tooltip anchors at the click point, and
  [`tooltip.showCategory`](/reference/tooltip#tooltip.showCategory) defaults
  to `false` — a pie has a single category, so its value would head every
  tooltip. Set `showCategory: true` with a meaningful `categoryValue` if you
  want that line back.
- The category and value axes still exist structurally (the category
  property and value domains feed the data model and animations) but default
  to [`visible: false`](/reference/categoryAxis#categoryAxis.visible) in pie
  mode. The crosshair does not apply.
- Values must be non-negative: `createPie` clamps negatives to 0, and a
  zero-value slice simply doesn't render. Only the first data row is
  rendered.

## Donut and slice labels

An inner radius via
[`pie.innerRadiusFraction`](/reference/pie#pie.innerRadiusFraction) turns
the pie into a donut — the helper's `donut` shorthand sets it to `0.6`, and
its own `innerRadiusFraction` option picks the exact value — and
[`pie.label.visible`](/reference/pie#pie.label.visible) puts value, percent or
title labels on the slices.

<LiveChart :config="donut.config" :data="donut.data" demo="donut" />

<<< @/examples/donut.ts

- [`label.type`](/reference/pie#pie.label.type) picks the label content: a
  single part (`'value'`, `'percent'` — the default — or `'title'`) or a
  combination — `'valuePercent'` for `420 (45%)`, `'percentValue'` for
  `45% (420)`, `'titleValue'` for `Subscriptions: 420` and `'titlePercent'`
  for `Subscriptions: 45%`.
  [`label.valueFormat`](/reference/pie#pie.label.valueFormat) and
  [`label.percentFormat`](/reference/pie#pie.label.percentFormat) format the
  two numeric parts independently (percent parts format the fraction, so
  specifiers like `'.1%'` apply).
  [`label.radiusFraction`](/reference/pie#pie.label.radiusFraction) places the
  labels between the inner and outer radius (default 0.5, midway), and
  slices thinner than [`label.minFraction`](/reference/pie#pie.label.minFraction)
  hide their labels. Label colors reuse the per-series
  [`label.textStyle`](/reference/series#series.label.textStyle) — each slice
  is a series, so a slice's label is styled by its own series entry.
- When slices are filtered via the legend, percent labels renormalize
  against the remaining slices — set
  [`label.adjustForFiltering`](/reference/pie#pie.label.adjustForFiltering)
  to `false` to keep every slice's share of the full total instead.
- [`tooltip.valueType`](/reference/pie#pie.tooltip.valueType) does the same for the
  tooltip rows: `'value'` (the default), `'percent'`, or the `'valuePercent'`
  / `'percentValue'` combinations. The value part keeps its per-series
  formatting ([`valueFormat`](/reference/series#series.valueFormat),
  `valuePrefix`, `valueSuffix`) — the helper's `valueFormat` option stamps
  one format onto every slice's series; the percent part is formatted by
  [`tooltip.percentFormat`](/reference/pie#pie.tooltip.percentFormat). The
  helper's `tooltipValueType` option forwards straight to it.
- Tooltip percentages are computed from the same slice shares as the labels,
  so they renormalize as slices are filtered — set
  [`tooltip.adjustForFiltering`](/reference/tooltip#tooltip.adjustForFiltering)
  to `false` to keep every slice's share of the full total (the tooltip
  equivalent of `label.adjustForFiltering`). A filtered slice's own row shows
  the usual
  [`filteredValueCharacter`](/reference/tooltip#tooltip.filteredValueCharacter)
  placeholder in place of both parts.
- Geometry knobs: [`startAngle`](/reference/pie#pie.startAngle) rotates the
  first slice's starting edge, [`padAngle`](/reference/pie#pie.padAngle)
  opens a gap between slices, [`cornerRadius`](/reference/pie#pie.cornerRadius)
  rounds the slice corners, and
  [`outerRadiusFraction`](/reference/pie#pie.outerRadiusFraction) shrinks
  the pie inside the plot.

## Half pies and gauges

[`endAngle`](/reference/pie#pie.endAngle) defaults to `startAngle + 360` (a
full circle, so rotating with `startAngle` alone never truncates the pie);
setting it explicitly confines the slices to a partial span. With
`startAngle: -90` and `endAngle: 90` the pie becomes a half-donut gauge — an
`endAngle` *smaller* than `startAngle` runs counterclockwise.

<LiveChart :config="gauge.config" :data="gauge.data" demo="gauge" />

<<< @/examples/gauge.ts

- [`centerLabel`](/reference/pie#pie.centerLabel) puts a text line at the
  circle center, and [`centerTotal.visible`](/reference/pie#pie.centerTotal.visible)
  adds the live total of the unfiltered slice values, formatted by
  [`centerTotal.format`](/reference/pie#pie.centerTotal.format) — it counts
  along with value tweens and filtering (click a legend entry). Set
  [`centerTotal.adjustForFiltering`](/reference/pie#pie.centerTotal.adjustForFiltering)
  to `false` to keep the full total while slices are filtered.
- The center content sits at the circle center (the gauge pivot);
  [`centerOffsetXFraction`](/reference/pie#pie.centerOffsetXFraction) and
  [`centerOffsetYFraction`](/reference/pie#pie.centerOffsetYFraction) nudge
  it by fractions of the outer radius — the example's `-0.25` lifts it into
  the hole.
- The center text is styled by
  [`centerLabel.textStyle`](/reference/pie#pie.centerLabel.textStyle) and
  [`centerTotal.textStyle`](/reference/pie#pie.centerTotal.textStyle), both
  defaulting to `fillColor: 'currentColor'` so the text follows the host
  page's CSS `color`. It can also be restyled directly: CSS wins over the
  presentation attribute, so targeting `.mochart-pie-center text` works (the
  demo dark theme does exactly this).
- The layout fits the *configured span's* bounding box into the plot, so a
  half pie uses the space its missing half would waste (and the radius grows
  accordingly) instead of staying centered in an empty square. The span
  comes from the config, so the fit holds still while values animate.
