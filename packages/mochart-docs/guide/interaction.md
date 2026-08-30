# Interaction

Charts respond to hover, click, and legend interaction out of the box, and
report everything through optional callback props. Every interaction on this
page also works from the keyboard — see [Accessibility](/guide/accessibility).

<script setup>
import * as interaction from '../examples/interaction'
import * as pie from '../examples/pie'
</script>

Hover a legend entry to focus its series, click the plot to pin the tooltip
and crosshair, and click legend entries to filter series in and out —
filtering plays the staged series transition:

<LiveChart :config="interaction.config" :data="interaction.data" />

## Focus

Hovering or clicking a series (per its
[`focusOnHover`](/reference/series#series.focusOnHover) /
[`focusOnClick`](/reference/series#series.focusOnClick) config, both off by
default) focuses it: the focused series is styled from the `focused` state of
its [styles](/guide/config-model#styles-and-focus-states) and every other
series from their `defocused` state, animated over
[`focusDuration`](/reference/animation#animation.focusDuration).
By default those states change only opacity and width — their colors are
`'same'`, meaning "keep the normal state's color". The legend drives the
same focus via
[`legend.focusOnHover`](/reference/legend#legend.focusOnHover) (on
by default) and
[`legend.focusOnClick`](/reference/legend#legend.focusOnClick). A series with
[`useAxisFocus`](/reference/series#series.useAxisFocus) shows as focused
whenever the value axis it belongs to is.

The `*OnHover` configs act on hovering pointers only — a mouse, a
trackpad, or a pen held over the chart. A touch tap never counts as a hover
(browsers emulate one right before the tap's click), so on touch screens a
tap does only what the matching `*OnClick` config says; give touch users
[`focusOnClick`](/reference/series#series.focusOnClick) or
[`legend.focusOnClick`](/reference/legend#legend.focusOnClick) where they
should be able to focus.

Category focus has knobs of its own: the series'
[`focusCategoryOnHover`](/reference/series#series.focusCategoryOnHover)
and [`focusCategoryOnClick`](/reference/series#series.focusCategoryOnClick)
focus the category the pointer is on. Those are off by default, but the
tooltip focuses its category anyway while
[`tooltip.applyFocus`](/reference/tooltip#tooltip.applyFocus) or
[`crosshair.applyFocus`](/reference/crosshair#crosshair.applyFocus) is set —
both on by default — so a plain plot click reports a focused category through
`onFocus`.

## Legend filtering

With [`legend.filterOnClick`](/reference/legend#legend.filterOnClick)
enabled, clicking a legend item toggles its series out of (and back into) the
chart. The item stays in the legend so the series can be restored, and the
removal/return animates as a series transition. Its color icon goes hollow to
mark it filtered; set
[`legend.strikeThroughFiltered`](/reference/legend#legend.strikeThroughFiltered)
to strike through the item text as well, and
[`tooltip.strikeThroughFiltered`](/reference/tooltip#tooltip.strikeThroughFiltered)
to do the same to the series' tooltip label. Both default to `false`.
Set [`filterable: false`](/reference/series#series.filterable) on a series
to exempt it from legend (and tooltip) filtering entirely, and
[`showColorInLegend: false`](/reference/series#series.showColorInLegend) to
drop the color icon from its legend item.

## Tooltip and crosshair

[`tooltip`](/reference/tooltip) and
[`crosshair`](/reference/crosshair) style the tooltip and
crosshair shown for the focused category. Per-series formatting of tooltip
values — label, prefix/suffix, d3-format string — lives on the series
([`valueLabel`](/reference/series#series.valueLabel),
[`valueFormat`](/reference/series#series.valueFormat), and
friends).

The tooltip can drive focus and filtering too, all off by default:
[`tooltip.focusCategoryOnHover`](/reference/tooltip#tooltip.focusCategoryOnHover)
and [`tooltip.focusCategoryOnClick`](/reference/tooltip#tooltip.focusCategoryOnClick)
focus the category value the pointer is on inside the tooltip;
[`focusSeriesOnHover`](/reference/tooltip#tooltip.focusSeriesOnHover),
[`focusSeriesOnClick`](/reference/tooltip#tooltip.focusSeriesOnClick) and
[`filterSeriesOnClick`](/reference/tooltip#tooltip.filterSeriesOnClick) do
the same for the series rows. Each series can also drop its color icon from
the tooltip rows with
[`showColorInTooltip: false`](/reference/series#series.showColorInTooltip).

### Tooltip controls

[`tooltip.showControls`](/reference/tooltip#tooltip.showControls) adds a
control strip above the tooltip's lines: ‹ and › buttons step the shown
category, and a mode button toggles what clicking a tooltip row does. In
filter mode (the initial mode) clicking a series row toggles its series out
of the chart, exactly like a legend click — respecting
[`filterable`](/reference/series#series.filterable) — and hovering a row
focuses its series the way hovering its legend item does; in focus mode
clicking a row pins focus on its series — or, on the category line, on the
category. With the controls shown, the mode decides row behavior and the
`focus…OnClick` / `filterSeriesOnClick` / `focusSeriesOnHover` settings
above are not consulted. The mode button shows the active mode via
[`tooltip.filterModeText`](/reference/tooltip#tooltip.filterModeText) /
[`tooltip.focusModeText`](/reference/tooltip#tooltip.focusModeText)
(`'Filter'` / `'Focus'` by default), and the step buttons take their
accessible labels from
[`accessibility.tooltipPreviousLabel`](/reference/accessibility#accessibility.tooltipPreviousLabel)
and
[`accessibility.tooltipNextLabel`](/reference/accessibility#accessibility.tooltipNextLabel).
The buttons and rows all work from the keyboard — see the
[keyboard map](/guide/accessibility#keyboard-map).

## Callbacks

All callbacks are optional props on either entry point:

```js
createDefaultChart(container, {
  config, data, width, height,
  onFocus: ({ focusedSeriesId, focusedCategoryIndex }) => { /* focus changed */ },
  onSeriesFilter: ({ filteredSeriesIds }) => { /* legend filtering changed */ },
  onChartClick: ({ categoryIndex, chartX, chartY }) => { /* plot area clicked */ },
  onSliceClick: ({ seriesId }) => { /* pie slice clicked */ },
  onSeriesClick: ({ seriesId, categoryIndex, nearestCategoryIndex }) => { /* bar/point/line clicked */ },
  onTitleClick: () => {}
});
```

- `onFocus(focus)` — the focused series/category/value axis changed (see
  [Focus](#focus): series and legend focus are opt-in, tooltip-driven category
  focus is on by default)
- `onSeriesFilter(filter)` — a legend click toggled a series in or out of
  the filtered set
- `onChartClick` / `onChartMouseEnter` / `onChartMouseMove` /
  `onChartMouseLeave` — plot-area pointer events with chart coordinates and
  the nearest category index
- `onSliceClick(payload)` — a slice of a [pie or donut](/recipes/pie) chart
  was clicked
- `onSeriesClick(payload)` — a cartesian series shape (bar, marker, label, or
  line/area path) was clicked; reports the series id, the shape's category
  index (`-1` for a whole-series path), and the category index nearest the
  pointer. Fires whether or not the series' `focusOnClick` config is set, and
  only on click — the cartesian counterpart of `onSliceClick`
- `onTitleClick()` — the chart title was clicked or activated from the
  keyboard. Supplying it makes the title a button — tab stop, `role="button"`,
  an accessible name from the title text, Enter and Space — unless
  [`title.link`](/reference/title#title.link) is set, where the anchor already
  provides that (see also `linkDisabled`)
- `onSeriesLayoutBoundsChange(bounds)` — the plot area was re-laid-out

The four pointer callbacks share one payload
([`ChartEventPayload`](/reference/callbacks#chartEventPayload): pointer
coordinates in three frames, plus the nearest category index).
[`onFocus`](/reference/callbacks#callbacks.onFocus) and
[`onSeriesFilter`](/reference/callbacks#callbacks.onSeriesFilter) each
receive the whole state rather than only what changed. Every callback and
every payload field is listed in
[Callbacks and payloads](/reference/callbacks).

Making a shape clickable doesn't change the mouse cursor. Set
[`showPointer`](/reference/series#series.showPointer) on a series (or
`seriesDefaults`, as the example below does) to give its shapes — including
pie slices — `cursor: pointer`, advertising that clicking does something.

Watch them fire — click a bar, hover a series, or toggle a legend entry;
the log records each event in order and follows the latest (scroll up for
older ones). One interaction often fires several: with `focusOnClick` set,
clicking a bar reports `onFocus` and `onSeriesClick` together.

<LiveChart :config="interaction.clicksConfig" :data="interaction.data" events />

Pie charts report slice clicks through `onSliceClick` instead:

<LiveChart :config="pie.config" :data="pie.data" demo="pie" events />

## Controlled focus and filtering

Focus and legend filtering are managed by the chart internally, but each
piece of that state has a matching input prop that takes over when it is set
(not `undefined`), overriding the internal state on every update. Pass back
what the callbacks report to keep several charts in sync:

- [`focusedCategoryIndex`](/reference/props#props.focusedCategoryIndex) (`-1` =
  none), [`focusedSeriesId`](/reference/props#props.focusedSeriesId) and
  [`focusedValueAxisId`](/reference/props#props.focusedValueAxisId)
  (`null` = none) — the controlled form of `onFocus`
- [`filteredSeriesIds`](/reference/props#props.filteredSeriesIds) — the
  controlled form of `onSeriesFilter`

`focusedSeriesId`, and every key of `filteredSeriesIds`, should be the id of a
series that does not set [`followSeries`](/reference/series#series.followSeries).
A series that follows another has no focus or filter state of its own — it takes
both from the series it follows — so its own id has no effect in either prop.
`onSeriesFilter` reports maps keyed the same way, so passing them straight back
keeps charts in sync.

```js
chart.update({
  focusedCategoryIndex: 2,
  focusedValueAxisId: 'VA0',
  focusedSeriesId: 'S0',
  filteredSeriesIds: { S1: true, S2: true }
});
```

```js
// mirror one chart's focus and filtering onto another
createChart(el, {
  ...props,
  onFocus: focus => other.update({
    focusedCategoryIndex: focus.focusedCategoryIndex,
    focusedValueAxisId: focus.focusedValueAxisId,
    focusedSeriesId: focus.focusedSeriesId
  }),
  onSeriesFilter: ({ filteredSeriesIds }) => other.update({ filteredSeriesIds })
});
```

Leave a prop `undefined` to let the chart keep managing that piece itself.
