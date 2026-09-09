# Sparklines

The `createSparklineConfig` helper turns any chart config into a sparkline
preset — axes, legend, tooltip, crosshair and point markers hidden and
margins collapsed — leaving only the plotted shapes for tiny inline charts.

<script setup>
import * as sparkline from '../examples/sparkline'
</script>

<LiveChart :config="sparkline.config" :data="sparkline.data" :height="56" showcase="sparkline" />

<<< @/examples/sparkline.ts

## How it works

- `createSparklineConfig(config, options)` returns a new config; it only
  fills in defaults, so any value set on the passed config wins. To bring one
  piece back, set it explicitly: `legend: { visible: true }` survives the
  preset untouched. The value axes are hidden through
  [`valueAxisDefaults`](/reference/valueAxes), so it works whether or not
  the config declares any; their
  [base line](/reference/valueAxes#valueAxes.baseLine), which draws in the
  plot rather than the axis band, is switched off there too.
- `interactive: true` keeps the tooltip and crosshair enabled for sparklines
  large enough to host them; `padding` (default 2px) is set as the chart
  [`padding`](/reference/chart#chart.padding) and keeps strokes at the data
  extremes from clipping against the chart edges.
- Point markers are hidden by nulling
  [`marker.shape`](/reference/series#series.marker.shape) through
  `seriesDefaults`, so line series render as a bare stroke.
- The sparkline is still a regular chart — size it by mounting it small (this
  page uses a 56px-tall host; table cells around 150×32 work well) and it
  renders any series type. A win/loss strip is two `bar` series with
  [`missingValueMode: 'connect'`](/reference/series#series.missingValueMode), one
  property per direction, on an axis fixed to `min: -1, max: 1` — the same
  one-property-per-direction trick the [waterfall](/recipes/waterfall) uses.
