# Dual value axes

Give each unit its own axis: declare two entries in
[`valueAxes`](/reference/valueAxes) and point each series at
one via [`axis`](/reference/series#series.axis). Here revenue
bars scale against the left axis while conversion rate draws as a line
against its own percent-formatted axis on the right.

<script setup>
import * as dualAxes from '../examples/dualAxes'
</script>

<LiveChart :config="dualAxes.config" :data="dualAxes.data" demo="axis-multiple" />

<<< @/examples/dualAxes.ts

## How it works

- Each axis gets an [`id`](/reference/valueAxes#valueAxes.id);
  series reference it with `axis`. With a single axis none of this is needed —
  ids matter only when there are several.
- [`side: 'end'`](/reference/valueAxes#valueAxes.side)
  moves the second axis to the end side (right, for vertical charts).
- [`tickLabel.format: '.0%'`](/reference/valueAxes#valueAxes.tickLabel.format)
  is a d3-format string; the series' own
  [`valueFormat`](/reference/series#series.valueFormat) formats
  the tooltip value independently.
- Mixing renderers per series (bars + line here) needs no extra
  configuration — set each series'
  [`renderer`](/reference/series#series.renderer).
