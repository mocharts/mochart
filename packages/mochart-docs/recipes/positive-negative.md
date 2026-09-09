# Positive and negative values

Values below zero need one thing decided: where bars grow from. Pin
[`base`](/reference/valueAxes#valueAxes.base) to `0` and
everything else — bar direction, label placement, caps, stacking — follows
the sign on its own.

<script setup>
import * as posNeg from '../examples/posNeg'
import * as posNegStacked from '../examples/posNegStacked'
</script>

<LiveChart :config="posNeg.config" :data="posNeg.data" demo="picket-pos-neg" />

<<< @/examples/posNeg.ts

## How it works

- Without stacks, [`base`](/reference/valueAxes#valueAxes.base)
  defaults to `null` — the axis domain minimum — so mixed-sign bars would all
  grow upward from the most negative value. `base: 0` makes bars grow out of
  zero in both directions, and the divide is marked by the default base line
  ([`baseLine.visible`](/reference/valueAxes#valueAxes.baseLine.visible),
  styled with
  [`baseLine.style`](/reference/valueAxes#valueAxes.baseLine.style)).
- The domain fits the data on both sides. When the values might sit all on
  one side, [`softMin`](/reference/valueAxes#valueAxes.softMin) /
  [`softMax`](/reference/valueAxes#valueAxes.softMax) `0` hold
  zero in view without ever clipping data — unlike
  [`min`](/reference/valueAxes#valueAxes.min)/[`max`](/reference/valueAxes#valueAxes.max),
  which clip (see [axis bounds](/recipes/axis-bounds)).
- Labels flip with the sign: an `outside`
  [`label.position`](/reference/series#series.label.position) sits
  above positive bars and below negative ones automatically. Each side can be
  tuned separately through [`label.aboveBase`](/reference/series#series.label.aboveBase) /
  [`label.belowBase`](/reference/series#series.label.belowBase) —
  [position](/reference/series#series.label.aboveBase.position),
  [offset](/reference/series#series.label.aboveBase.offset), and
  [min](/reference/series#series.label.aboveBase.minPositionFraction)/[max](/reference/series#series.label.aboveBase.maxPositionFraction)
  position bounds — whose `auto` defaults follow the shared settings (the
  below-base offset mirrors `label.offset`).
- The sign carries through the other bar features:
  [caps](/recipes/bar-caps) point downward on negative bars, and
  [`colorScale.base.value: 0`](/recipes/color-by-value#diverging-around-a-base)
  colors gains and losses from two different ramps.

## Stacking mixed signs

<LiveChart :config="posNegStacked.config" :data="posNegStacked.data" demo="stacked" />

<<< @/examples/posNegStacked.ts

- Each sign accumulates separately from zero: a category's positive segments
  stack upward while its negative segments stack downward, so inflows and
  outflows read as two piles growing out of zero. An axis with stacks defaults
  its `base` to `0` — no pinning needed.
- Filtering a series in the legend re-stacks its own side and leaves the
  other untouched.
- The stack's [outer caps](/recipes/bar-caps#capping-a-stack)
  apply per sign — the topmost positive segment and the bottommost negative
  one each get one.
- To show the net total across both piles, overlay a line series opted out of
  the stack with
  [`stack: null`](/reference/series#series.stack) (see
  [stacked bars](/recipes/stacked-bars)); for a running total
  that crosses zero step by step, that's the
  [waterfall](/recipes/waterfall).
