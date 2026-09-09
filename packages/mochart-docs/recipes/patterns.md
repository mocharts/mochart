# Patterns

Series fills can use the built-in `lines`, `crosshatch`, and `dots` SVG
patterns. Declare them in [`patterns`](/reference/patterns) and point a series
at one with [`pattern`](/reference/series#series.pattern). A sole configured
pattern is applied automatically to every `area`/`bar` series (or pie slice)
when no gradients are configured; with several patterns, or any gradients,
select the pattern by id.

<script setup>
import * as patterns from '../examples/patterns'
</script>

<LiveChart :config="patterns.config" :data="patterns.data" demo="patterns" />

<<< @/examples/patterns.ts

## How it works

- Patterns are measured in screen pixels, so their marks stay the same size
  across differently sized bars, areas, and pie slices. Markers stay solid —
  at marker size a pattern is unreadable.
- In an XY chart, a series can use a pattern only when its `renderer` is
  `area` or `bar`; pie slices can use one whatever the series renderer.
- `spacing`, the foreground/background colors and their opacities are common
  to every type. Lines and crosshatches add `rotation` and `lineWidth`; dots add
  `radius`.
- `foregroundColor: "series"` or `backgroundColor: "series"` resolves to the
  owning series' normal fill color. `"currentColor"` follows the CSS `color`
  the chart inherits. A `null` background is transparent (the default).
- Only the common properties can go in `patternDefaults`; `type`, `id`,
  `ignore`, `rotation`, `lineWidth`, and `radius` belong on individual entries.
- A series cannot use both `pattern` and `gradient`. Set `pattern: null` to
  opt a series out of an automatically applied sole pattern.
- With [`colorProperty`](/recipes/color-by-value), the pattern replaces the
  per-category fill while the per-category stroke color still applies. Legend and tooltip
  swatches reproduce the pattern.
