# Stacked bars

Series stack when they share a stack id from
[`seriesStacks`](/reference/seriesStacks). With exactly one stack
configured, every series joins it automatically — declaring the stack is the
only wiring needed.

<script setup>
import * as stackedBars from '../examples/stackedBars'
</script>

<LiveChart :config="stackedBars.config" :data="stackedBars.data" :alt-data="stackedBars.altData" demo="stacked" />

Animate the data and watch the stack move as one unit: each segment's
baseline follows the tweened top of the segment below it, so the stack never
shows gaps mid-transition (see
[staged animation](/guide/staged-animation#gapless-stacked-animation)).

<<< @/examples/stackedBars.ts

## Variations

- Opt a series out of the stack with
  [`stack: null`](/reference/series#series.stack) — handy for
  overlaying a line on stacked bars.
- A stack belongs to one value axis
  ([`seriesStacks[].axis`](/reference/seriesStacks#seriesStacks.axis),
  defaulting to the sole axis); a series whose `axis` differs from its
  stack's is a validation error. Several stacks can sit on
  [different axes](/recipes/dual-axes).
- Likewise a stack cannot span [series groups](/recipes/grouped-series): all
  its series must share one [`group`](/reference/series#series.group) (or all
  be ungrouped), otherwise its members would land in different sub-slots.
- Cap only the outer end of the whole stack with
  [`outerCap.type`](/reference/seriesStacks#seriesStacks.outerCap.type)
  — see the [bar caps recipe](/recipes/bar-caps#capping-a-stack).
- Side-by-side (grouped) bars instead of stacked: declare a
  [`seriesGroups`](/reference/seriesGroups) entry rather than a
  stack — series default into a sole group the same way.
- Series with negative values stack downward from the same zero base —
  see [positive and negative values](/recipes/positive-negative#stacking-mixed-signs).
