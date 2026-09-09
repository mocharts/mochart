# Axis bounds

[`min`](/reference/valueAxes#valueAxes.min) and
[`max`](/reference/valueAxes#valueAxes.max) set an axis domain
outright. Values outside the range are clipped at the plot edge rather than
allowed to overflow, and a band marks each edge that is hiding something.

<script setup>
import * as axisBounds from '../examples/axisBounds'
import * as axisReversed from '../examples/axisReversed'
</script>

<LiveChart :config="axisBounds.config" :data="axisBounds.data" demo="clipped" />

<<< @/examples/axisBounds.ts

## How it works

- `min`/`max` are hard bounds: the domain becomes exactly the range given,
  whatever the data does. One outlier no longer flattens the rest of the
  series into a band at the bottom of the plot.
- A clipped mark keeps the part that is inside. The line above enters and
  leaves the top edge rather than vanishing for that category, so a hidden
  value never reads as missing data.
- To keep a value in view *without* ever clipping, use
  [`softMin`](/reference/valueAxes#valueAxes.softMin) /
  [`softMax`](/reference/valueAxes#valueAxes.softMax) instead. They
  extend the domain to the bound when the data does not already reach it, and
  give way when it does — see
  [positive and negative](/recipes/positive-negative) for holding
  zero in view that way.
- Both bounds default to `auto`, which fits the domain to the data (plus
  [`minMarginFraction`](/reference/valueAxes#valueAxes.minMarginFraction) /
  [`maxMarginFraction`](/reference/valueAxes#valueAxes.maxMarginFraction)).
  An `auto` end never clips on its own.
- [`minOffset`](/reference/valueAxes#valueAxes.minOffset) /
  [`maxOffset`](/reference/valueAxes#valueAxes.maxOffset) shift an `auto` end
  by a fixed amount once the data has been fitted, which is how you pad or
  tighten a domain without pinning it to a number. Shifting a bound inward
  hides data, so an offset end clips like an explicit one and gets the same
  indicator band. They apply only to an end left on `auto`.
- `min` must not be above `max` when both are set; the config is rejected
  otherwise. To run an axis backwards use `reversed`, below.
- The same properties exist on the
  [category axis](/reference/categoryAxis#categoryAxis.min), on any
  scale but `ordinal`, where they window a numeric or date range (a date bound
  is an ISO string or a millisecond timestamp).
- [`plot.clipOverflow`](/reference/plot#plot.clipOverflow) sets how
  far (in pixels) marks may spill past each edge before being cut. Raise it
  when a marker or a thick stroke sitting on the boundary is being shaved.

## Marking what is hidden

The band comes from the
[clip indicator](/reference/clipIndicator), which draws on every
plot edge with data behind it and needs no configuration to appear.

- [`label`](/reference/clipIndicator#clipIndicator.label) sets the
  text, which doubles as the band's accessible name and shows on hover. Set it
  to `null` for a band with no text.
- [`size`](/reference/clipIndicator#clipIndicator.size) is the band
  depth, defaulting to `auto` — the label height plus
  [`labelPadding`](/reference/clipIndicator#clipIndicator.labelPadding) on
  both sides.
- [`hatch`](/reference/clipIndicator#clipIndicator.hatch) sets the
  diagonal fill's `spacing` and `lineWidth`. Set it to `null` for a flat fill
  instead, which also lightens the
  [`style`](/reference/clipIndicator#clipIndicator.style) default,
  since a solid band at the hatched weight reads much heavier.
- Two axes clipping the same edge produce one band. Bands on neighbouring
  edges meet on a diagonal, so no corner is drawn twice.
- [`visible: false`](/reference/clipIndicator#clipIndicator.visible)
  turns the band off. Clipping itself still happens — the values are hidden
  either way, so leaving it on is what tells a reader they are.

## Reversing an axis

<LiveChart :config="axisReversed.config" :data="axisReversed.data" demo="clipped" />

<<< @/examples/axisReversed.ts

- [`reversed`](/reference/valueAxes#valueAxes.reversed) runs an axis
  backwards. `min` is still the lower bound — the flag changes which end of the
  plot that bound sits at, so a rank of `1` lands at the top.
- It works on every axis, including the
  [category axis](/reference/categoryAxis#categoryAxis.reversed) and
  ordinal scales, where it reverses the slot order.
- It composes with [`plot.inverted`](/reference/plot#plot.inverted),
  which is a different setting: `inverted` swaps which screen direction each
  axis runs along (see [horizontal charts](/recipes/horizontal-bars)),
  while `reversed` flips one axis end for end.
- Base lines, thresholds, ticks and stacking are unaffected — the domain still
  ascends, only its screen direction changes.
