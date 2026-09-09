# Curves

[`curve`](/reference/series#series.curve) selects the d3-shape curve that
interpolates a series between its points. It affects the `line` and `area`
renderers only; the default is `linear` — straight segments.

<script setup>
import * as curves from '../examples/curves'
import * as curvesStep from '../examples/curvesStep'
</script>

<LiveChart :config="curves.config" :data="curves.data" demo="curved" />

<<< @/examples/curves.ts

## How it works

- [`curve.type`](/reference/series#series.curve.type) picks from `linear`,
  `monotoneX`, `monotoneY`, `basis`, `cardinal`, `catmullRom`, `natural`,
  `step`, `stepBefore` and `stepAfter`.
- `monotoneX` is the safe smoothing choice: it passes through every point and
  never overshoots the data. `natural`, `cardinal` and `catmullRom` are
  rounder but can swing past the extremes (or below the axis); `basis`
  smooths hardest and stops passing through the points entirely.
- [`curve.param`](/reference/series#series.curve.param) feeds the two curve
  types that take a configurator — `cardinal`'s tension and `catmullRom`'s
  alpha, e.g. `{ type: 'cardinal', param: 0.8 }`. The other types ignore it,
  and leaving it unset uses the curve's own default.
- Markers stay at the true data values whatever the curve draws — keep the
  default circles on a raw series to show the measurements against a smoothed
  line, or turn them off with
  [`marker.shape: null`](/reference/series#series.marker.shape) as the
  smoothed series above does. Tooltips and the crosshair read the data too,
  never the interpolated path.

## Step charts

The three `step` variants hold values between points instead of connecting
them — the right reading for state that persists until the next observation.

<LiveChart :config="curvesStep.config" :data="curvesStep.data" demo="curved" />

<<< @/examples/curvesStep.ts

- `stepAfter` holds each value until the next point, `stepBefore` jumps at
  the previous one, and `step` switches midway between the two.
- Pair a step curve with the `area` renderer for quantities like inventory,
  capacity or headcount; on a [date axis](/recipes/date-axis) the flats span
  the real time between readings.
