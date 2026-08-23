# Candlestick

The `createCandlestick` helper turns OHLC (open/high/low/close) items into
candles: a direction-colored body spanning open→close, drawn over a thin
wick spanning low→high.

<script setup>
import * as candlestick from '../examples/candlestick'
import * as candlestickHollow from '../examples/candlestickHollow'
import * as candlestickVolume from '../examples/candlestickVolume'
</script>

<LiveChart :config="candlestick.config" :data="candlestick.data" demo="candlestick" />

<<< @/examples/candlestick.ts

## How it works

- Each item is `{ label, open, high, low, close }`. A candle is **up** when
  the close is at or above the open, **down** otherwise. Labels must be
  unique, every price must be a finite number, `high` may not be below
  `low`, and `open` and `close` must lie within them — the helper throws
  otherwise, so one bad tick can't blank the chart.
- The helper returns `{ candles, data, categoryAxis, series }`. The candles
  are four ordinary `bar` series — an up and a down body spanning from `open`
  via [`rangeProperty`](/reference/series#series.rangeProperty), and an up
  and a down wick spanning `low`→`high`, narrowed to a sliver of the slot
  with [`bar.widthFraction`](/reference/series#series.bar.widthFraction) and
  listed first so the bodies draw over them. Every row carries values for
  exactly one direction, and
  [`missingValueMode: 'connect'`](/reference/series#series.missingValueMode) with
  [`partialRangeIsMissing`](/reference/series#series.partialRangeIsMissing)
  keeps the other direction's series from rendering — the same trick as the
  [Waterfall](/recipes/waterfall).
- A doji (open equal to close) would have a zero-height body, so filled
  bodies set [`bar.minExtent`](/reference/series#series.bar.minExtent) to 2px
  and stay visible as a line.
- The category axis is ordinal, so non-trading days (weekends, holidays)
  simply don't exist on the axis instead of leaving gaps — `Jun 05` sits next
  to `Jun 08` above.
- The default direction colors are teal-green/red rather than a pure
  green/red: green↔red is the classic red-green-blindness collision, and
  shifting the green toward teal keeps the pair distinguishable on light and
  dark surfaces. Override per direction with `colors`, rename the legend
  entries with `seriesTitles`, and tune the widths with `wickWidthFraction`
  (default 0.15) / `bodyWidthFraction` (default 1).
- The tooltip shows two rows per candle: the body's `open – close` span under
  its direction title, and the wick's `low – high` span under `rangeTitle`
  (default "Range"). The wicks stay out of the legend but follow their body's
  legend filtering and focus via
  [`followSeries`](/reference/series#series.followSeries), so toggling a
  direction removes whole candles and focusing a direction highlights whole
  candles.
- Each row also carries the raw `open`/`high`/`low`/`close` plus `change`
  and `direction`, and the computed candles come back under `candles` — or
  call `computeCandlesticks(items)` alone for the math without the chart
  fragments.
- For the tick-bar style of the same data — a thin low/high line with open
  and close ticks instead of a body — see [OHLC bars](/recipes/ohlc).

## Hollow candles

Pass `hollow: true` to draw up candles as outlines — the classic
hollow-candle style where a filled body means down:

<LiveChart :config="candlestickHollow.config" :data="candlestickHollow.data" demo="candlestick-hollow" />

<<< @/examples/candlestickHollow.ts{18}

In hollow mode the low→high wick can't sit behind the body (it would show
through the hollow interior), so the helper splits it into segments that stop
at the body edges, and the original wick series turns shapeless — it keeps
the tooltip's single `low – high` range row and its focus/filter wiring, but
draws nothing. The up body outlines itself through
[`shapeStyle`](/reference/series#series.shapeStyle) — a stroke color and
width against `fillOpacity: 0`, pinned to 0 in the focused and defocused
states too so hovering thickens the outline rather than filling it — and its
legend and tooltip icons pick up the stroke color automatically. `colors`,
`seriesTitles` and the width options apply as in filled mode.

## Volume pane

Give the items a `volume` and pass `volume: true` (works with `hollow` too,
and with [OHLC bars](/recipes/ohlc)) to add the classic pane of
direction-colored volume bars along the bottom of the plot:

<LiveChart :config="candlestickVolume.config" :data="candlestickVolume.data" demo="candlestick" />

<<< @/examples/candlestickVolume.ts{19}

The pane is pure domain-margin geometry on a second value axis, so it adapts
to every data update: the result gains a `valueAxes` fragment with a `price`
axis whose enlarged
[`minMarginFraction`](/reference/valueAxes#valueAxes.minMarginFraction)
lifts the candles into the upper plot, and a hidden `volume` axis pinned at 0
whose [`maxMarginFraction`](/reference/valueAxes#valueAxes.maxMarginFraction)
confines the bars to the bottom band (margins above 1 are allowed for exactly
this banding). Spread that fragment into `valueAxes` as the example does.
Tune the split with `volume: { heightFraction, gapFraction }` (defaults 0.2
and 0.05; both are fractions below 1 and must sum to less than 1, or the call
throws), relabel the tooltip rows with `valueLabel` (default "Volume"), or
set `visible: true` on the volume axis fragment to show its scale. The volume
bars follow their direction series — toggling or focusing Up takes its volume
bars along — and stay out of the legend, with one volume row per day in the
tooltip.
