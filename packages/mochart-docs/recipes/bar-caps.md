# Bar caps

[`cap.type`](/reference/series#series.cap.type) draws a decorative
cap on the value end of every bar in a series — the quickest way to the
popular rounded-bar look, with two more shapes beside it.

<script setup>
import * as barCaps from '../examples/barCaps'
import * as barCapsStacked from '../examples/barCapsStacked'
</script>

<LiveChart :config="barCaps.config" :data="barCaps.data" demo="capped" />

<<< @/examples/barCaps.ts

## How it works

- `cap.type` picks the shape: `round` rounds the bar's end corners, `curve`
  bulges a quadratic dome, `point` rises to a triangular peak; `null` (the
  default) leaves the end flat.
  [`cap.size`](/reference/series#series.cap.size) sets the cap's
  extent in pixels.
- The cap is part of the bar's shape, drawn at the value end and pointing the
  bar's way — negative bars cap downward, and on an
  [inverted chart](/recipes/horizontal-bars) the caps sit on the
  bars' side ends. Fills, [gradients](/recipes/gradients) and
  [per-row colors](/recipes/color-by-value) apply to the cap like
  the rest of the bar.
- A bar can be shorter than its cap.
  [`cap.expand`](/reference/series#series.cap.expand) chooses how the cap
  fits. With `true` (the default) the cap keeps the full bar width and is
  flattened to the bar's height. With `false` the cap keeps its shape and is
  scaled down instead, so a short bar becomes a small centered dome or peak.
  The Capped demo in the gallery draws every shape both ways over an axis
  pinned well past the data, so the two are easy to compare.

## Capping a stack

On stacked bars, capping every segment looks broken — usually only the
stack's outer end should be capped. Declare the cap on the stack instead of
the series:

<LiveChart :config="barCapsStacked.config" :data="barCapsStacked.data" demo="stacked" />

<<< @/examples/barCapsStacked.ts

- [`outerCap.type`](/reference/seriesStacks#seriesStacks.outerCap.type)
  (with
  [`outerCap.size`](/reference/seriesStacks#seriesStacks.outerCap.size) and
  [`outerCap.expand`](/reference/seriesStacks#seriesStacks.outerCap.expand))
  caps whichever series is the stack's outer segment at each category — no
  per-series cap config needed. Filter the top series in the legend and the
  cap moves to the segment that becomes outermost.
- A stack mixing positive and negative values gets an outer cap on each end:
  the topmost positive segment and the bottommost negative one.
- A series that sets its *own* `cap.type` keeps it even in a stack; add
  [`cap.onlyStackOuter`](/reference/series#series.cap.onlyStackOuter)
  to draw that cap only where the series is the outer segment — for a cap
  that should differ from the stack-level one.

Grouped bars need no special handling — each series caps its own bars, as in
the first example.
