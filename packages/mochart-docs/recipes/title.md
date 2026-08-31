# Chart title

The [`title`](/reference/title) is a row of up to three text boxes, a
[`prefix`](/reference/title#title.prefix), the
[`text`](/reference/title#title.text) itself and a
[`suffix`](/reference/title#title.suffix), drawn above or below the plot.
Its config covers where that row sits
([`position`](/reference/title#title.position),
[`align`](/reference/title#title.align),
[`alignedToAxes`](/reference/title#title.alignedToAxes)), how the boxes are
spaced and filled ([`margin`](/reference/title#title.margin),
[`padding`](/reference/title#title.padding),
[`backgroundStyle`](/reference/title#title.backgroundStyle),
[`textStyle`](/reference/title#title.textStyle)), what happens when the text
is too wide for the chart, and whether the title is a link.

<script setup>
import * as title from '../examples/title'
import * as titleCaption from '../examples/titleCaption'
</script>

<LiveChart :config="title.config" :data="title.data" />

<<< @/examples/title.ts

## The three boxes

- [`text`](/reference/title#title.text) is the title itself, and `null`, the
  default, means no title: the row is not drawn and takes no height from the
  plot. The prefix and the suffix are drawn only when `text` is set.
- [`prefix`](/reference/title#title.prefix) and
  [`suffix`](/reference/title#title.suffix) each take their own
  [`text`](/reference/title#title.prefix.text),
  [`margin`](/reference/title#title.prefix.margin),
  [`padding`](/reference/title#title.prefix.padding),
  [`backgroundStyle`](/reference/title#title.prefix.backgroundStyle) and
  [`textStyle`](/reference/title#title.prefix.textStyle), which is what makes
  the badge and the grey note in the example above. They keep the width their
  text needs and sit either side of the title text on one line.
- The title's own [`margin`](/reference/title#title.margin),
  [`padding`](/reference/title#title.padding) and
  [`backgroundStyle`](/reference/title#title.backgroundStyle) wrap all three
  boxes together, in the way [layout and spacing](/guide/layout) describes:
  the background fills the box inside the margin, and the padding lies
  between that background and the text boxes. Both default to 5px on the
  bottom side only, which is the gap under a top-positioned title.
- [`textMargin`](/reference/title#title.textMargin),
  [`textPadding`](/reference/title#title.textPadding) and
  [`textBackgroundStyle`](/reference/title#title.textBackgroundStyle) do the
  same for the title text alone, inside that outer box: the darker panel
  behind the title above is that background.
- [`textStyle`](/reference/title#title.textStyle) colors the text and
  defaults to a `currentColor` fill, so the title follows the host page (see
  [theming](/guide/theming)). No config property sets the font: the text
  inherits the page's font and size, which you can override in CSS on
  `.mochart-title-text`, and the chart measures whatever it renders.

## Placing the title

- [`position`](/reference/title#title.position) puts the row above the plot
  (`top`, the default) or below it (`bottom`). It shares that row with the
  legend, and the title always comes first: with both at the bottom, the
  title sits directly under the plot and the legend below it.
- [`align`](/reference/title#title.align) places the row `left`, `center`
  (the default) or `right`, and
  [`alignedToAxes`](/reference/title#title.alignedToAxes) chooses what it is
  aligned within: the plot area between the axes (`true`, the default) or
  the full chart width (`false`). A title too wide for the space between the
  axes is aligned to the chart width instead, whatever `alignedToAxes` says.
- [`verticalAlign`](/reference/title#title.verticalAlign) settles the boxes
  against each other when they differ in height, putting a shorter one at the
  `top`, the `middle` (the default) or the `bottom` of the row.
- [`verticalExpand`](/reference/title#title.verticalExpand) changes that from
  a position into a stretch: with it on, each shorter box grows its padding
  until its padded box matches the tallest one, so the backgrounds share a
  height. That is why the badge in the example above is as tall as the title
  text. `verticalAlign` then decides where the added padding goes: under the
  text for `top`, split for `middle`, above it for `bottom`.

## When the title does not fit

[`truncationEnabled`](/reference/title#title.truncationEnabled) is on by
default: a title wider than the row it is aligned within is cut and
[`truncationText`](/reference/title#title.truncationText) (`…`) is appended.
Only the text section is cut. The prefix and the suffix keep their full
width, and if those two alone fill the row the text is dropped rather than
squeezed. Turning truncation off means nothing is cut, so a long title runs
past the edge of the chart.

Cutting the text changes only what is drawn. The chart's accessible name and
the name a clickable title is announced by both use the full text you set.

A pointer can still get at the full text:
[`truncationTooltipEnabled`](/reference/title#title.truncationTooltipEnabled)
(on by default) gives the truncated title an svg `<title>` holding the full text,
which browsers show as their native tooltip while a mouse or pen rests on
it. Touch has no hover, so nothing shows there.

## A caption under the chart

The same row makes a source note when it is moved below the plot, aligned to
the chart rather than the axes, and left without a background.

<LiveChart :config="titleCaption.config" :data="titleCaption.data" />

<<< @/examples/titleCaption.ts

- [`link`](/reference/title#title.link) wraps the title in a link to that
  URL, which the host page styles like any other link: the `currentColor`
  fill above is what picks up this site's link color. The link is
  keyboard-reachable on its own, which is why a linked title gets no
  `role="button"` even when `onTitleClick` is supplied (see
  [accessibility](/guide/accessibility#keyboard-map)).
- [`linkDisabled`](/reference/title#title.linkDisabled) keeps the link's
  semantics but stops the click from navigating, which is what you want when
  an [`onTitleClick`](/guide/interaction#callbacks) handler is doing the
  work. The example sets it so that clicking the caption here does not leave
  the docs.
- With no `link` at all, supplying `onTitleClick` makes the title a button
  instead: a tab stop named from the prefix, text and suffix, activated by
  <kbd>Enter</kbd> or <kbd>Space</kbd>.
