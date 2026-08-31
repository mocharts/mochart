# Staged animation

Most charting libraries tween every element straight to its final position in
a single step, which makes updates that change both the data and the axis
domains hard to follow. mochart instead splits each update into sequential
phases, so only one kind of change is in motion at a time.

<script setup>
import * as animation from '../examples/animation'
import * as valueDomain from '../examples/animation-value-domain'
import * as categoryDomain from '../examples/animation-category-domain'
</script>

Watch the phases — the alternate dataset adds categories *and* raises the
maximum, so the axes expand first, then values change, and on the way back
values change before the axes contract:

<LiveChart :config="animation.config" :data="animation.data" :alt-data="animation.altData" />

## The three phases

1. **Axis expansion** — if the new data needs more room (new categories, larger
   values), the axis domains grow first and the existing shapes reflow into
   the wider domains, so incoming data has a place to land.
2. **Value change** — values tween to their new positions. This phase also
   plays **category transitions** (categories added, removed, or reordered are
   merged into one display sequence so old and new categories animate coherently)
   and **series transitions** (series added, removed, or filtered via the
   legend).
3. **Axis contraction** — once the values settle, the axis domains collapse
   to fit the remaining data.

Phases that a given update doesn't need are skipped, and each phase's
duration scales with the size of its change, so small updates stay snappy
while large ones use the full configured duration.

## Combining phases

Staging has a cost: when an update changes both a domain and the values, the
phases play back to back, and for some updates the expand-to-union round trip
is mostly invented motion. The clearest case is flat data changing level —
say every value moving from 3 to 5. The single mark sits at the midline
before *and* after, so the staged animation expands the axis, moves the
value, and contracts again only to land on a pixel-identical frame; nothing
changed but the tick labels. Two properties control when the chart instead
interpolates a changed domain *together* with the values, in one phase:

- [`valueDomainChange`](/reference/animation#animation.valueDomainChange) for
  the value axes, default `'auto'`
- [`categoryDomainChange`](/reference/animation#animation.categoryDomainChange)
  for the category axis, default `'staged'`

Each takes the same three modes:

| Mode | Behavior |
| --- | --- |
| `'staged'` | always play the union phases: expand over both domains, tween values, contract |
| `'combined'` | interpolate every changed domain of that axis kind together with the value changes |
| `'auto'` | combine only *translations* — the old and new domains barely overlap, as with flat data changing level or a window sliding more than half its width — and stage everything else |

Combined domain changes are paced by `valueChangeDuration`;
`expansionDuration` and `contractionDuration` do not apply to them. The two
properties are independent, so a chart can combine its value-axis changes
while keeping category changes staged.

### Value axes

The same update under both modes — the maximum jumps well past the old
domain. Staged, the axis expands first (every bar shrinks in place), then the
values move. Combined, the domain grows with the values in one motion: the
bar that defines the new maximum rides the top of the plot while the tick
labels restate what it's worth:

<LiveChart :config="valueDomain.config" :data="valueDomain.data" :alt-data="valueDomain.altData" />

<LiveChart :config="valueDomain.combinedConfig" :data="valueDomain.data" :alt-data="valueDomain.altData" />

The `'auto'` default sits between the two: overlapping changes like this one
stage, but a *translation* — flat data changing level, where the staged round
trip communicates nothing — interpolates directly, holding the marks still
while the tick labels slide.

### The category axis

A sliding date window is the category-axis translation: the window moves
forward by more than half its width. The `'staged'` default zooms out over
both windows, tweens, and zooms back in — extra motion, but the wide view
shows where the data went. With `'auto'`, the window slides continuously
during the value phase: entering points come in through one plot edge while
leaving points exit the other, at their true dates throughout:

<LiveChart :config="categoryDomain.config" :data="categoryDomain.data" :alt-data="categoryDomain.altData" />

<LiveChart :config="categoryDomain.slideConfig" :data="categoryDomain.data" :alt-data="categoryDomain.altData" />

The defaults differ deliberately. A value-domain translation animates cleanly
— nothing moves but the ticks — so `'auto'` is the value-axis default. A
category-domain change usually also changes the *category set*, and the
sliding presentation draws entering and leaving points connected mid-flight
(a line series bridges the gap between the leaving and entering runs), so the
category axis defaults to the calmer `'staged'` and the slide is one config
line away.

## Gapless stacked animation

Stacked series animate as a single unit: throughout a transition, each
segment's baseline is derived from the tweened top of the segment below it,
rather than each segment tweening independently toward its final position.
The stack therefore stays contiguous for the whole animation — no gaps or
overlaps between segments — even while series are being added to or removed
from the stack. Try it in the [stacked bars recipe](/recipes/stacked-bars).

## Structural config changes rebuild the chart

Config edits go through the same pipeline. A non-structural edit is applied
to the existing chart: whatever it changes in the chart's data — an axis
bound, for instance — animates through the phases above, and settings that
leave the data alone (titles, colours, tooltip and legend options) simply
redraw. Some edits change what the chart *is*, and those structural changes
cannot be applied to the existing chart at all — it is rebuilt and plays its
opening animation again, paced by
[`initialDuration`](/reference/animation#animation.initialDuration).

An edit counts as structural when it changes any of:

- the config's validity or its `id`
- [`chart.type`](/reference/chart#chart.type)
- the category axis
  [`property`](/reference/categoryAxis#categoryAxis.property),
  [`keyProperty`](/reference/categoryAxis#categoryAxis.keyProperty),
  [`type`](/reference/categoryAxis#categoryAxis.type),
  [`scale`](/reference/categoryAxis#categoryAxis.scale) or
  [`dateUTC`](/reference/categoryAxis#categoryAxis.dateUTC)
- the number or ids of value axes or series stacks, or which axis a stack
  belongs to
- the number of series, or for any series its `id`,
  [`property`](/reference/series#series.property),
  [`rangeProperty`](/reference/series#series.rangeProperty),
  [`errorLowProperty`](/reference/series#series.errorLowProperty),
  [`errorHighProperty`](/reference/series#series.errorHighProperty),
  [`markerProperty`](/reference/series#series.markerProperty),
  [`colorProperty`](/reference/series#series.colorProperty),
  [`labelProperty`](/reference/series#series.labelProperty),
  [`tooltipProperty`](/reference/series#series.tooltipProperty),
  [`axis`](/reference/series#series.axis),
  [`stack`](/reference/series#series.stack) or
  [`group`](/reference/series#series.group)

Everything else is applied to the existing chart without a rebuild.

This is about editing the config. Switching a series off by clicking the
legend is filtering, not a config change, and it animates like a data change.

`hasConfigStructureChange(oldConfig, newConfig)` — comparing two enhanced
configs — is exported if you need to know in advance whether an edit you are
about to apply will rebuild.

## Tuning

Nearly all knobs live in [`animation`](/reference/animation):

| Property | Controls |
| --- | --- |
| [`enabled`](/reference/animation#animation.enabled) | master switch — `false` applies every update instantly |
| [`valueDomainChange`](/reference/animation#animation.valueDomainChange) | staged vs combined value-axis domain changes (see [Combining phases](#combining-phases)) |
| [`categoryDomainChange`](/reference/animation#animation.categoryDomainChange) | staged vs combined category-axis domain changes |
| [`initialDuration`](/reference/animation#animation.initialDuration) | the first render when the chart mounts or after a structural config change |
| [`expansionDuration`](/reference/animation#animation.expansionDuration) | the axis expansion phase |
| [`valueChangeDuration`](/reference/animation#animation.valueChangeDuration) | the value change phase (incl. category/series transitions and combined domain changes) |
| [`contractionDuration`](/reference/animation#animation.contractionDuration) | the axis contraction phase |
| [`easing`](/reference/animation#animation.easing) | how the data animation phases are paced |
| [`focusDuration`](/reference/animation#animation.focusDuration) | hover/click focus emphasis transitions |
| [`focusEasing`](/reference/animation#animation.focusEasing) | how focus transitions are paced |

Durations are in milliseconds and are the *maximum* for the phase — smaller
changes complete proportionally faster. On an axis running `0` to `100` with
`valueChangeDuration: 1000`, a bar growing the full height of the axis takes
1000 ms, one going from `50` to `100` takes 500 ms, and one going from `95` to
`100` takes 50 ms.

Both easing properties take `'linear'` or one of six families (sine, quad,
cubic, quint, elastic and bounce), each as In (starts slow), Out (starts
fast) and InOut variants: `'quintOut'`, `'elasticInOut'` and so on. sine
through quint accelerate progressively more sharply. elastic approaches
its target with a decaying oscillation and bounce lands in diminishing
bounces; eased progress is clamped at the target, so no easing overshoots
past it.
`easing` paces each data animation phase on its own and defaults to
`'sineInOut'`, which accelerates in and decelerates out gently. `focusEasing` paces
focus transitions and defaults to `'cubicOut'`, which starts fast so hover
feedback reads as immediate even when focus moves quickly between series
or categories.

The one knob that lives on the series instead:
[`animateBaseFromAdjacent`](/reference/series#series.animateBaseFromAdjacent)
picks whether a series' leading/trailing values animate from their adjacent
values (`true`) or from the base value (`false`).

## Reduced motion

When the user's system requests reduced motion (the `prefers-reduced-motion:
reduce` accessibility setting), the chart applies every update instantly, as
if [`animation.enabled`](/reference/animation#animation.enabled) were `false`.
The preference is watched live — flipping the OS setting takes effect
immediately, without re-creating the chart. Set
[`accessibility.respectReducedMotion`](/reference/accessibility#accessibility.respectReducedMotion)
to `false` to keep animating regardless of the preference.
