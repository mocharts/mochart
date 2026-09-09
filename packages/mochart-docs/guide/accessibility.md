# Accessibility

Charts are keyboard-accessible and screen-reader labeled by default. The
plot area, legend, and interactive series are tab stops; the keyboard
drives the same tooltip, focus, and filtering as the mouse; and assistive
tech hears roles, names, and live value announcements instead of unlabeled
shapes. It works out of the box — the
[`accessibility`](/reference/accessibility) config section tunes it, localizes
its labels, or turns it off.

<script setup>
import * as a11y from '../examples/accessibility'
</script>

Try it: Tab to the plot area of this chart, press <kbd>Enter</kbd>, and step
through the categories with the arrow keys. Tab again to reach the legend
and filter a series with <kbd>Enter</kbd>:

<LiveChart :config="a11y.config" :data="a11y.data" />

This example's config names its own tab stops — a screen reader announces the
plot area as "Weekly signup values" and the legend as "Signup types":

```js
accessibility: {
  plotLabel: 'Weekly signup values',
  legendLabel: 'Signup types'
}
```

## Keyboard map

The plot area is a single tab stop whenever the
[`tooltip`](/reference/tooltip#tooltip.visible) or
[`crosshair`](/reference/crosshair#crosshair.visible) is enabled:

| Key | Action |
| --- | --- |
| <kbd>Enter</kbd> / <kbd>Space</kbd> | open the tooltip; press again to close |
| <kbd>←</kbd> <kbd>↑</kbd> <kbd>→</kbd> <kbd>↓</kbd> | step the shown category (opens the tooltip if closed) |
| <kbd>Home</kbd> / <kbd>End</kbd> | jump to the first / last category |
| <kbd>Esc</kbd> | close the tooltip |

Stepping stops at the first and last category rather than wrapping.
Reopening returns to the last category you were viewing. On single-category
charts (a pie or donut), the arrow keys are inert and
<kbd>Enter</kbd>/<kbd>Space</kbd> still toggles the tooltip.

The plot area is the only tab stop whose arrow keys step categories. Every
other one — legend items, tooltip rows, interactive series and pie slices — is
a group of items sharing a single tab stop, where the arrow keys move *between
the items* (again without wrapping), <kbd>Home</kbd>/<kbd>End</kbd> jump to
the first and last, and <kbd>Tab</kbd> leaves the group, following the usual
convention for composite widgets. <kbd>Esc</kbd> is the only key that crosses
between widgets: it closes an open tooltip from the plot area, from a series
or slice inside it, and from inside the tooltip itself.

With both the tooltip and the crosshair disabled, the chart has no keyboard
or screen-reader route to its values — the remaining tab stops filter and
focus series but never read numbers. If you disable both, provide the values
another way, such as a data table or text summary near the chart.

An open tooltip is part of the tab order. With
[`tooltip.showControls`](/reference/tooltip#tooltip.showControls) on, its
‹ / › / mode controls are ordinary buttons, each its own tab stop (the ends
report `aria-disabled` instead of dropping out of the tab order). The
tooltip's rows are keyboard-reachable whenever clicking them does something
— per the controls' current mode, or the
[`focusCategoryOnClick`](/reference/tooltip#tooltip.focusCategoryOnClick) /
[`focusSeriesOnClick`](/reference/tooltip#tooltip.focusSeriesOnClick) /
[`filterSeriesOnClick`](/reference/tooltip#tooltip.filterSeriesOnClick)
config. Like legend items they form a single tab stop with a roving focus:
arrows and <kbd>Home</kbd>/<kbd>End</kbd> move between rows,
<kbd>Enter</kbd>/<kbd>Space</kbd> acts exactly like a click, and a
keyboard-focused row highlights the same way a hovered one does.
<kbd>Esc</kbd> anywhere inside the tooltip closes it. Closing the tooltip
while keyboard focus is inside it — by <kbd>Esc</kbd>, a click inside it, or a
click on the plot — returns focus to the plot area rather than dropping it on
the page body.

Legend items are keyboard-reachable whenever clicking them does something
([`legend.filterOnClick`](/reference/legend#legend.filterOnClick) or
[`legend.focusOnClick`](/reference/legend#legend.focusOnClick)). They form a
single tab stop with a roving focus: <kbd>Tab</kbd> enters the legend, the
arrow keys and <kbd>Home</kbd>/<kbd>End</kbd> move between items, and
<kbd>Enter</kbd>/<kbd>Space</kbd> acts exactly like a click — filtering or
focusing the series. A keyboard-focused item highlights its series the same
way hovering it does (with
[`legend.focusOnHover`](/reference/legend#legend.focusOnHover), on by
default).

Pie and donut slices work the same way when they are interactive (the series
has [`focusOnClick`](/reference/series#series.focusOnClick) or the chart has
an `onSliceClick` callback): one tab stop, arrow keys moving between slices
in config order, and <kbd>Enter</kbd>/<kbd>Space</kbd> doing what clicking the
slice does — the focus toggle, `onSliceClick`, and toggling the tooltip — with
no pointer position invented for it. A pie has a single category, so the
tooltip a slice opens is the one covering that slice; there is nothing to
choose.

Cartesian series follow the same pattern when clicking them does something
(the series has [`focusOnClick`](/reference/series#series.focusOnClick) or
the chart has an `onSeriesClick` callback): one roving tab stop over the
series, arrow keys moving between them in config order, and
<kbd>Enter</kbd>/<kbd>Space</kbd> acting as a whole-series click —
`onSeriesClick` reports `categoryIndex: -1`, as a line or area path click
does. Follower series ([`followSeries`](/reference/series#series.followSeries))
stay pointer-only; their clicks belong to their leader, and a filtered series
drops out of the group. The
[interaction guide's callbacks example](/guide/interaction#callbacks)
doubles as a live keyboard demo: <kbd>Tab</kbd> to a series, press
<kbd>Enter</kbd>, and its event log shows the whole-series `onSeriesClick`
payload.

Unlike a slice, activating a cartesian series does **not** open the tooltip.
A cartesian series runs across every category, so there is no category the
keyboard could open it at — a mouse click has a pointer position to read one
from, and <kbd>Enter</kbd> does not. Read the values from the plot area
instead: it is the tab stop immediately before the series, so
<kbd>Shift</kbd>+<kbd>Tab</kbd> reaches it. <kbd>Esc</kbd> pressed on a series
still closes an open tooltip, and leaves focus on the series rather than
pulling it back to the plot area.

A title with an `onTitleClick` callback is a tab stop with `role="button"`,
named from the title text (with its prefix and suffix) and activated by
<kbd>Enter</kbd>/<kbd>Space</kbd>. A title with
[`title.link`](/reference/title#title.link) is a link instead, so it is
already keyboard-reachable and gets no second role.

A refresh can take the tab stop you are on away: data with no categories, or
an error, replaces the plot area and its tooltip with the
[no-data or error message](/guide/chart-states). Keyboard focus moves to that
message — where a screen reader reads it — instead of being dropped on the
page body, so <kbd>Tab</kbd> carries on from the chart rather than from the
top of the document. The message is not a tab stop of its own; when values
come back, the plot area is the stop again.

## What screen readers hear

The chart svg is a `role="group"` announced as a chart (via
`aria-roledescription`) and named from
[`title.text`](/reference/title#title.text); an untitled chart falls back to
[`accessibility.chartLabel`](/reference/accessibility#accessibility.chartLabel).
The geometry the chart draws — grid lines, axis lines, tick marks, bars,
markers, paths, the crosshair — carries no text and no role, so there is
nothing there for a screen reader to announce, and it lands on the meaningful
stops instead: the plot area button, the legend, and the tooltip.

Each set of roving tab stops is announced as a named group, so a screen
reader says what you have entered before it reads the first item: the legend
group is named from
[`accessibility.legendLabel`](/reference/accessibility#accessibility.legendLabel),
the interactive series or pie slices from
[`accessibility.seriesLabel`](/reference/accessibility#accessibility.seriesLabel),
and an open tooltip's rows from
[`accessibility.tooltipLabel`](/reference/accessibility#accessibility.tooltipLabel).
Each group appears only while its items are actually tab stops.

Keyboard navigation speaks. Opening or stepping the tooltip (from the plot
area or the tooltip's ‹ / › buttons) announces its content through a
visually-hidden polite live region — "Mon: Trial: 18, Paid: 6" — mirroring
exactly what the tooltip shows, including per-series value formatting; a held
arrow key announces only the category it settles on. The plot area reports
whether the tooltip is open through `aria-expanded`. Legend items whose click
filters, and tooltip series rows likewise, expose their filtered state as a
toggle-button `aria-pressed` (pressed means the series is shown); interactive
pie slices are named with their series title and current share.

## Reading the chart

A screen reader user who *reads* the chart rather than operating it gets its
text as well as its tab stops. The legend's series names and every axis tick
label are text in the reading order. The chart title is not: the svg is
already named from it, so reading the drawn text as well would say the title
twice in a row. A linked title keeps its text readable, because that text is
the link's name.

Tick labels are grouped so that a run of them arrives with the scale it
belongs to: each axis is a `role="group"` named for the axis, so the reading
is "Months, group, Jan, Feb" and "Revenue, group, 0, 5, 10, 15, 20" rather
than eleven loose numbers with no owner. The name is the axis'
[`title`](/reference/categoryAxis#categoryAxis.title) when it has one, and
otherwise
[`accessibility.categoryAxisLabel`](/reference/accessibility#accessibility.categoryAxisLabel)
or
[`accessibility.valueAxisLabel`](/reference/accessibility#accessibility.valueAxisLabel).
The group is also one object in a screen reader's object navigation, so the
whole scale can be skipped in a single move. Because the group carries the
axis name, the drawn axis title is not read a second time — and the name is
the untruncated title even when the drawn one is ellipsised. Give every axis
a title when a chart has more than one value axis: untitled ones all read
with the same default name.

A tick label the chart had to ellipsise to fit keeps its full text for
assistive tech through an `aria-label`, so "Really long value that should be…"
still reads in full. A tick label the chart suppressed to stop labels
overlapping is `aria-hidden`, as is the hidden width probe an ordinal axis
measures truncation against.

Pointer users get the full text another way. While
[`truncation.tooltipEnabled`](/reference/categoryAxis#categoryAxis.tickLabel.truncation.tooltipEnabled)
is on (the default), a truncated tick label also carries an svg `<title>`
holding its full text, which browsers show as their native tooltip when a
mouse or pen rests on the label; the chart title, the legend and the axis
titles have the same setting. It changes nothing for assistive tech, and
touch, which has no hover, never shows it.

Five kinds of text stay out of the reading order deliberately:

| Not read | Why |
| --- | --- |
| per-point data labels ([`series.labelProperty`](/reference/series#series.labelProperty)) | they are bare numbers that name neither their series nor their category, and mid-animation they are the interpolated in-between value rather than the datum. The tooltip's live region reads the settled values *with* their series and category names, which is the same information in a comprehensible order |
| threshold annotations ([`valueAxes.thresholds`](/reference/valueAxes#valueAxes.thresholds)) | they label a line drawn across the plot, and read out of that spatial context they say nothing about the data |
| the axis title, when the axis is announced using it | it would otherwise be read twice in a row |
| the chart title, when it is not a link | the svg is already named from it, so it would otherwise be read twice in a row; a linked title keeps its text because that text is the link's name |
| the pie center ([`pie.centerLabel`](/reference/pie#pie.centerLabel), [`pie.centerTotal`](/reference/pie#pie.centerTotal)) | it is decoration drawn inside the ring rather than a labelled value, and the total restates what the slices already add up to. When the center is the headline figure, put it in a heading beside the chart |

If you need the individual values readable rather than navigable, put a data
table or text summary beside the chart; that is also the answer when both the
tooltip and the crosshair are disabled.

## The focus ring

The visible keyboard focus ring ships in the optional stylesheet:

```js
import '@mochart/core/mochart.css';
```

It draws a 2px `currentColor` outline on the focused tab stop, only for
keyboard focus (`:focus-visible`) — mouse clicks stay ring-free — and inset
on the plot rect so it stays clear of the axis labels. Without the import,
charts fall back to the browser's default focus outline; keyboard access
itself works either way.

The ring rules are scoped to a `mochart-accessible` class that the chart
puts on its root element only while accessibility is active
([`enabled`](/reference/accessibility#accessibility.enabled) `true` and
[`hidden`](/reference/accessibility#accessibility.hidden) `false`) — so a
chart with accessibility disabled keeps browser-default outlines on its
native controls (the tooltip's buttons, a linked title) even with the
stylesheet imported.

A focus move the chart makes itself is also ringed, which `:focus-visible`
alone would miss: filtering the focused series from the legend, clicking a
tooltip row that then unmounts itself, closing the tooltip, and a refresh that
replaces the plot area with a message all hand focus to another element from a
pointer or data path. Those get the same outline (via a
`data-mochart-focus-restored` attribute the chart sets until the element
blurs), so focus is never invisible after the chart moves it.

## Click targets

The chart lays its own clickable chrome out to a minimum of 24 by 24 pixels —
the [WCAG 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum)
floor, which the same chrome misses at ordinary font sizes: a legend item is
about 22px tall at a 16px host font, and items sit a pixel apart, so a mis-hit
filters the series next to the one you aimed at. Three things take the floor:

| Target | How the floor applies |
| --- | --- |
| legend item boxes | the item box grows in both directions; the swatch and label stay vertically centered, and extra width lands after the label |
| the tooltip controls' ‹ / › / mode buttons | a minimum height, and the arrow ends widen to match |
| interactive tooltip rows | a minimum height; the extra space lands under the row text |

A target takes the floor only while clicking it does something — the legend's
[`filterOnClick`](/reference/legend#legend.filterOnClick) /
[`focusOnClick`](/reference/legend#legend.focusOnClick), the tooltip's
[`showControls`](/reference/tooltip#tooltip.showControls) and its click config
— so a legend nothing responds to stays compact. Change the floor with
[`accessibility.minTargetSize`](/reference/accessibility#accessibility.minTargetSize):
raise it (`44` is the common touch recommendation) or set `0` to lay every
target out at its content size. It is deliberately not gated by `enabled` or
`hidden`, because clicking and tapping work whatever those are set to.

Series shapes — bars, markers, pie slices — are left at the size their data
gives them. Padding a marker's hit area would change which value the pointer
lands on, which is worse than a small target and is why 2.5.8 exempts a
presentation that is essential; the plot area is one large target for the
tooltip in any case, and the keyboard reaches every category without aiming.
The same goes for anything you inject through the
[state factories](/guide/chart-states): its target sizes are yours.

## Color and visual encoding

The default series colors use Paul Tol's
[Bright qualitative color scheme](https://sronpersonalpages.nl/~pault/),
which was designed to remain distinguishable with common forms of
color-vision deficiency. The seven colors repeat when a chart has more than
seven series or color-indexed categories. See
[Colors, theming, and dark mode](/guide/theming#series-color-palettes) to view
the defaults or configure another palette.

A color-blind-safe palette is a useful baseline, not a guarantee that a chart
is accessible by color alone. It does not guarantee sufficient contrast
against every page background or between every pair of adjacent filled
shapes. Test configured colors against the chart's actual background, and
remember that changing the page theme does not change concrete series colors.
The W3C's
[Non-text Contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)
includes chart-specific examples for lines and adjacent pie slices.

When readers must identify a series or category, provide a visible cue in
addition to hue. Depending on the chart, that can be distinct
[`marker.shape`](/reference/series#series.marker.shape) values,
[`strokeDashArray`](/reference/series#series.shapeStyle.normal.strokeDashArray)
patterns on lines, [pattern fills](/recipes/patterns), direct labels, or an
adjacent data table or text summary. Tooltip and screen-reader announcements
make values available through other routes, but they do not replace the
visible non-color cue needed by sighted readers who cannot distinguish the
colors. This follows
[WCAG 2.2's Use of Color criterion](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html).

## Forced colors and High Contrast

In forced-colors modes (Windows High Contrast among them) the stylesheet
restores the tooltip control buttons to the system palette — `ButtonFace`,
`ButtonText`, `ButtonBorder`, `GrayText` at the disabled ends — and replaces
their hover and active tints, which are `color-mix` over `currentColor` and
flatten to nothing under forced colors, with `Highlight` fills. The focus
ring switches to `Highlight`.

Series fills and strokes are left as configured. They are SVG presentation
attributes from the palette, and forcing them to the system palette would
collapse every series to one color — worse than keeping hues the mode did not
ask about. A chart that has to stay readable there should carry a non-color
encoding as well: distinct
[`marker.shape`](/reference/series#series.marker.shape) values per series, or
`strokeDashArray` on lines.

## Reduced motion

When the user's system requests reduced motion, the chart applies every
update instantly instead of animating, and the preference is watched live.
This is on by default and controlled by
[`accessibility.respectReducedMotion`](/reference/accessibility#accessibility.respectReducedMotion)
— see [Reduced motion](/guide/staged-animation#reduced-motion) in the
animation guide.

## Localizing the labels

Every built-in accessibility string is a config key:

```js
const config = {
  // ...
  accessibility: {
    chartLabel: 'Diagramm',        // svg name when the title has no text
    chartRoleDescription: 'Diagramm',
    plotLabel: 'Diagrammwerte',    // the plot-area tab stop
    seriesLabel: 'Datenreihen',    // the interactive series / pie slices group
    categoryAxisLabel: 'Kategorienachse', // an untitled category axis' tick-label group
    valueAxisLabel: 'Werteachse',  // an untitled value axis' tick-label group
    legendLabel: 'Legende',        // the legend group
    tooltipLabel: 'Tooltip-Werte', // the tooltip rows group
    tooltipPreviousLabel: 'Vorherige Kategorie', // the tooltip controls' ‹ button
    tooltipNextLabel: 'Nächste Kategorie'        // … and its › button
  }
};
```

Series and category announcements are built from your data and titles, so
they need no extra translation. The one visible string in the set is the
[tooltip controls'](/guide/interaction#tooltip-controls) mode button, which
is chart UI rather than a screen-reader label — its words localize through
[`tooltip.filterModeText`](/reference/tooltip#tooltip.filterModeText) and
[`tooltip.focusModeText`](/reference/tooltip#tooltip.focusModeText).

## Turning it off

Set [`accessibility.enabled`](/reference/accessibility#accessibility.enabled)
to `false` to render the chart with none of the above — no plot, series,
legend, or tooltip-row tab stops, key handlers, roles, labels, `aria-hidden`
markers, or live region — for example when the host page provides its own
accessible alternative to the chart. Native controls (the tooltip's ‹ / › /
mode buttons, a linked title) stay focusable as any button or link would.
Pointer interactions are unaffected, and `respectReducedMotion` is
deliberately not gated by this switch.

## Decorative charts

`enabled: false` still leaves the chart's text content (title, axis and data
labels) exposed to screen readers. For a chart that is *purely decorative* —
say a sparkline repeating a value already shown as text — set
[`accessibility.hidden`](/reference/accessibility#accessibility.hidden) to
`true` instead. It overrides `enabled`: the chart's container is marked
`aria-hidden` so assistive tech skips it entirely, and every tab stop the
chart itself renders — series, slices, the plot, tooltip controls, legend
items, and a linked title — is removed with it, so keyboard users cannot land
on content screen readers cannot see. Content you inject through the
[state factories](/guide/chart-states) is yours to make non-focusable. Only do
this when the surrounding page already conveys what the chart shows.

## Exports

A downloaded SVG is a static image, so [exporting](/guide/export) removes
the interactive semantics — the tab stops and their `role`, `aria-label`,
`aria-expanded`, and `aria-pressed` attributes.

What the root svg gets depends on whether the chart has an accessible name
to carry. With accessibility enabled, the chart's own `aria-label` (its
title, or
[`chartLabel`](/reference/accessibility#accessibility.chartLabel)) is left in
place and the svg is marked `role="img"`, so the exported image is announced
by the chart's name. With
[`accessibility.enabled`](/reference/accessibility#accessibility.enabled)
`false` or
[`hidden`](/reference/accessibility#accessibility.hidden) `true` there is no
`aria-label` to keep, so the export is marked `aria-hidden="true"` instead —
an unnamed `role="img"` would be a worse result than the unroled svg it came
from. Add your own `aria-label`, `figcaption` or adjacent text where you
place the image if it needs a name in that case.
