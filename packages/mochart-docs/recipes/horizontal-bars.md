# Horizontal charts

Set [`plot.inverted`](/reference/plot#plot.inverted) and
the chart swaps orientation: categories run down the side and values extend
horizontally. Everything else — stacking, grouping, thresholds, animation —
works unchanged.

<script setup>
import * as horizontal from '../examples/horizontal'
</script>

<LiveChart :config="horizontal.config" :data="horizontal.data" :alt-data="horizontal.altData" demo="capped-inverted" />

<<< @/examples/horizontal.ts

## How it works

- Axis positions follow the inversion: each axis's
  [`side`](/reference/valueAxes#valueAxes.side) picks the start (top/left) or
  end (bottom/right) edge, so the category axis lands on the left and the
  value axis on top by default; set `side: 'end'` on the value axis to move
  it below the plot.
- Long category labels usually fit better on a horizontal chart — combine with
  the category axis
  [`tickLabel.truncation`](/reference/categoryAxis#categoryAxis.tickLabel.truncation)
  settings when they still overflow.
- The staged animation phases are orientation-aware; axis expansion grows
  the value domain to the right instead of upward.
