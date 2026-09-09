# Layout and spacing

A chart is a stack of boxes. The [`chart`](/reference/chart) box holds
everything the chart draws; inside it the title, the legend and the
[`plot`](/reference/plot) each take a full-width row, and the plot holds the
axes and the series. Every one of those boxes is spaced the same way: a
`margin` outside it, a `padding` inside it, and a `backgroundStyle` filling
the box between the two.

<script setup>
import * as spacing from '../examples/spacing'
</script>

<LiveChart :config="spacing.config" :data="spacing.data" />

<<< @/examples/spacing.ts

Both backgrounds are set here so the boxes show: the outer one is the chart,
the inner one the plot.

## Margins, paddings and backgrounds

A `margin` and a `padding` are both objects of four pixel counts, one per
side: `top`, `right`, `bottom` and `left`. Neither takes a negative number,
and you set only the sides you want to change, since the rest keep their
defaults. `padding: { top: 8 }` moves the top edge alone.

The background is drawn between the two: it fills the box inside the margin,
and the padding lies inside the background, between its edge and the box's
contents. Widening the padding therefore grows the background around the
same contents, while widening the margin shrinks the background and pushes
the neighbouring parts away from it. The [legend](/recipes/legend), the
[title](/recipes/title) and the [axes](/recipes/tick-labels) all space
themselves this way.

Every `backgroundStyle` starts fully transparent, with stroke and fill
opacities of `0`, so a box shows only once you set them. The [theming
guide](/guide/theming) covers what the style properties do and how
`currentColor` follows the host page.

## The chart box

The chart fills the element it is mounted in; nothing in the config changes
that size, it only divides it up.

- [`chart.margin`](/reference/chart#chart.margin) (2px on each side) is the
  gap between the edge of the chart and its background.
- [`chart.padding`](/reference/chart#chart.padding) (3px on each side) sits
  inside that background, between its edge and the title, legend and plot.

Because the chart box is the outermost one, its padding is also what keeps a
stroke drawn at the very edge of the plot from being cut off. The
[sparkline preset](/recipes/sparklines) collapses every other margin but
leaves a chart padding for exactly that reason.

## Title, legend and plot rows

The title and the legend each take the height they need, and the plot gets
whatever height is left. Both take a `position` of `top` or `bottom`
([`title.position`](/reference/title#title.position),
[`legend.position`](/reference/legend#legend.position)), and the title comes
before the legend in either case: with both at the top the order down the
chart is title, legend, plot; with both at the bottom it is plot, title,
legend. The plot is what gives way when the chart is short, down to no
height at all.

Where each row sits along its width is its own setting.
[The title recipe](/recipes/title#placing-the-title) and
[the legend recipe](/recipes/legend#how-it-works) cover `align` and
`alignedToAxes`.

## The plot box

The plot box spans the full width inside the chart's padding, and the height
the title and legend leave it. Its
[`margin`](/reference/plot#plot.margin) and
[`padding`](/reference/plot#plot.padding) are `0` on every side by default.

- [`plot.margin`](/reference/plot#plot.margin) insets the plot background
  from the chart's padding, which is how you set a gap between the plot and
  the title or legend above it.
- [`plot.padding`](/reference/plot#plot.padding) sits inside the background,
  between its edge and the axes.
- [`plot.backgroundStyle`](/reference/plot#plot.backgroundStyle) fills the
  box inside the margin, so it covers the axis bands, with their tick labels
  and titles, as well as the series area.

The axes are laid out inside the plot's padded box, and the series area is
what they leave. Each axis then spaces its own parts with the `marginInner` /
`marginOuter` and `paddingInner` / `paddingOuter` pairs described in
[tick labels](/recipes/tick-labels#how-it-works). Series drawn at the very
edge of that area are clipped, and
[`plot.clipOverflow`](/reference/plot#plot.clipOverflow) can let them past
the edge, as [axis bounds](/recipes/axis-bounds) shows.

With [`plot.inverted`](/reference/plot#plot.inverted) set, the margin and
padding sides stay screen sides: `left` is the left of the chart whichever
axis runs there.
