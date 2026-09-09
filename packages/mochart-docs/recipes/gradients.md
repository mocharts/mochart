# Gradients

Series fills can use SVG gradients: declare them in
[`linearGradients`](/reference/linearGradients) (or
[`radialGradients`](/reference/radialGradients)) and point a
series at one with
[`gradient`](/reference/series#series.gradient). As with
[stacks](/recipes/stacked-bars) and [groups](/recipes/grouped-series), a
sole configured gradient is applied automatically — to every `area`/`bar`
series (or pie slice) that sets neither a `colorProperty` nor a
`categoryIndex` fill, provided no [patterns](/recipes/patterns) are
configured. With several gradients, or any patterns, select the gradient by
id.

<script setup>
import * as gradients from '../examples/gradients'
</script>

<LiveChart :config="gradients.config" :data="gradients.data" demo="gradients" />

<<< @/examples/gradients.ts

## How it works

- The gradient vector runs from `x1`/`y1` to `x2`/`y2` in 0–1 shape
  coordinates — `0,0 → 0,1` is a top-to-bottom fade (the default is the
  diagonal `0,0 → 1,1`). Add
  [`rotation`](/reference/linearGradients#linearGradients.rotation)
  to angle it.
- Each stop sets `offset` (0–1 along the vector), `color`, and `opacity`;
  `stops` is the one property without a default.
- Radial gradients take `cx`/`cy`/`r` (circle) and `fx`/`fy` (focal point)
  instead of a vector.
- Shared values for several gradients can go in `linearGradientDefaults` /
  `radialGradientDefaults`, like every list section
  (see [the config model](/guide/config-model#shared-defaults-sections)).
- Gradients are positional — the fade follows the shape, not the data. For
  color driven by data values, see [color by value](/recipes/color-by-value).
- In an XY chart, a series can use a gradient only when its `renderer` is
  `area` or `bar`; pie slices can use one whatever the series renderer. A
  series cannot combine `gradient` with `colorProperty` or `pattern`, and a
  series whose `shapeStyle` fill color is
  [`categoryIndex`](/guide/theming#series-color-palettes) in any state cannot
  set one either, because that fill already varies per category. Set
  `gradient: null` to opt a series out of an automatically applied sole
  gradient.
- Legend and tooltip swatches reproduce the gradient.
