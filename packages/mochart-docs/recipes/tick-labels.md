# Tick labels

[`categoryAxis.tickLabel`](/reference/categoryAxis#categoryAxis.tickLabel)
controls the text drawn at each tick of the category axis: how it reads
([`format`](/reference/categoryAxis#categoryAxis.tickLabel.format)), which way
it faces ([`rotation`](/reference/categoryAxis#categoryAxis.tickLabel.rotation),
[`anchor`](/reference/categoryAxis#categoryAxis.tickLabel.anchor)) and what
happens when the labels need more room than the axis has. There are two ways
out of that: cut the labels short, or draw fewer of them. Which one the axis
takes depends on
[`truncation.enabled`](/reference/categoryAxis#categoryAxis.tickLabel.truncation.enabled)
and on whether the labels run along the axis or across it.

Value axes take the same `tickLabel` settings apart from the truncation ones
(see [`valueAxes.tickLabel`](/reference/valueAxes#valueAxes.tickLabel)).

<script setup>
import * as tickLabels from '../examples/tickLabels'
import * as tickLabelsDense from '../examples/tickLabelsDense'
</script>

<LiveChart :config="tickLabels.config" :data="tickLabels.data" demo="ticks-rotated" />

<<< @/examples/tickLabels.ts

## How it works

- [`rotation`](/reference/categoryAxis#categoryAxis.tickLabel.rotation) turns
  each label by -90° to 90°. On a horizontal axis the labels count as
  perpendicular to the axis once the rotation reaches 20° either way; on a
  vertical axis (a [horizontal bar chart](/recipes/horizontal-bars)) flat
  labels are already perpendicular, and only a rotation past 70° lays them
  along the axis. Perpendicular labels take up their text height along the
  axis instead of their width, so more ticks fit.
- [`truncation.enabled`](/reference/categoryAxis#categoryAxis.tickLabel.truncation.enabled)
  defaults to `true` on a `string` axis and `false` on `number` and `date`
  axes. When it is on, a label that does not fit is cut and
  [`truncation.text`](/reference/categoryAxis#categoryAxis.tickLabel.truncation.text)
  is appended. The room a label gets depends on its direction: a label
  running along the axis is clipped to the width of its category slot, so
  every category keeps a label; a perpendicular label may occupy up to
  [`truncation.maxFraction`](/reference/categoryAxis#categoryAxis.tickLabel.truncation.maxFraction)
  of the plot bounds (the plot height for a horizontal axis, its width for a
  vertical one), and never less than
  [`truncation.minLength`](/reference/categoryAxis#categoryAxis.tickLabel.truncation.minLength)
  pixels — that floor is what keeps the labels above legible on a short
  chart.
- [`truncation.tooltipEnabled`](/reference/categoryAxis#categoryAxis.tickLabel.truncation.tooltipEnabled)
  (on by default) gives each truncated label an svg `<title>` holding its full
  text, which browsers show as their native tooltip while a mouse or pen
  rests on the label. Touch has no hover, so nothing shows there; screen
  readers already get the full text through `aria-label`.
- With truncation off, nothing is cut: the axis drops ticks until the
  remaining labels fit, as in the [next example](#fewer-ticks-instead).
- [`anchor`](/reference/categoryAxis#categoryAxis.tickLabel.anchor) sets
  which end of the text sits on the tick. The default `auto` centres labels
  that run along the axis and, for perpendicular ones, anchors the end
  nearest the axis — a `-45°` label ends at its tick and reads up towards it,
  a `45°` one starts there and reads away. Set `start`, `middle` or `end` to
  override.
- [`format`](/reference/categoryAxis#categoryAxis.tickLabel.format) is a
  [d3-format](https://d3js.org/d3-format) string for `number` axes or a
  [d3-time-format](https://d3js.org/d3-time-format) one for `date` axes;
  `auto` derives a format from the data and `null` shows the raw value.
- [`size`](/reference/categoryAxis#categoryAxis.tickLabel.size) is the space
  reserved for the labels across the axis, `auto` measuring the rotated text.
  A fixed number keeps the plot the same height as the labels change.
- [`textStyle`](/reference/categoryAxis#categoryAxis.tickLabel.textStyle)
  styles the text in its `normal`, `focused` and `defocused`
  [states](/guide/config-model#styles-and-focus-states); the default
  `currentColor` fill follows the host page's colour.
- The [`marginInner`](/reference/categoryAxis#categoryAxis.tickLabel.marginInner)
  / [`paddingInner`](/reference/categoryAxis#categoryAxis.tickLabel.paddingInner)
  pair spaces the labels from the plot side of the axis, and
  [`marginOuter`](/reference/categoryAxis#categoryAxis.tickLabel.marginOuter)
  / [`paddingOuter`](/reference/categoryAxis#categoryAxis.tickLabel.paddingOuter)
  from the title side. Padding sits inside the label's
  [`backgroundStyle`](/reference/categoryAxis#categoryAxis.tickLabel.backgroundStyle)
  box, margin outside it.

## Fewer ticks instead

When the labels are not truncated, the axis decides how many ticks it can
show and hides the rest at a regular interval, so the labels that remain are
drawn in full.

<LiveChart :config="tickLabelsDense.config" :data="tickLabelsDense.data" demo="tick-prune" />

<<< @/examples/tickLabelsDense.ts

- [`tickCount`](/reference/categoryAxis#categoryAxis.tickCount) defaults to
  `auto`: the axis divides its length by one label's extent along it (the
  widest label's width when flat, the text height when perpendicular) plus
  [`minTickSpacing`](/reference/categoryAxis#categoryAxis.minTickSpacing),
  and keeps that many ticks. On an ordinal axis it keeps every nth category
  to get down to the count; on a linear axis it asks the scale for that many
  ticks. A number replaces the calculation outright.
- [`maxTickCount`](/reference/categoryAxis#categoryAxis.maxTickCount) caps the
  computed count — 10 on a linear axis, uncapped (`0`) on an ordinal one — so
  the eight ticks above are the cap, not the fit. On a linear axis
  [`minTickInterval`](/reference/categoryAxis#categoryAxis.minTickInterval)
  also stops ticks landing closer together than a given value.
- Rotation and truncation fit into the same count: a `string` axis with
  truncation on works out the count from the shortest label truncation can
  produce, which is why it keeps every category, and a rotated axis fits
  more ticks because each takes less room along the axis.
