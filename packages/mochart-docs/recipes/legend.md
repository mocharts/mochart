# Legend

The [`legend`](/reference/legend) lists the series with their icons, and is
where series get filtered in and out of the chart. Its config covers where it
sits ([`position`](/reference/legend#legend.position),
[`align`](/reference/legend#legend.align),
[`alignedToAxes`](/reference/legend#legend.alignedToAxes)), how it is drawn
([`backgroundStyle`](/reference/legend#legend.backgroundStyle),
[`item`](/reference/legend#legend.item), [`icon`](/reference/legend#legend.icon))
and what clicking and hovering its items do.

<script setup>
import * as legend from '../examples/legend'
import * as legendSingle from '../examples/legendSingle'
</script>

<LiveChart :config="legend.config" :data="legend.data" demo="truncated-text" />

<<< @/examples/legend.ts

## How it works

- [`position`](/reference/legend#legend.position) puts the legend above
  (`top`) or below (`bottom`, the default) the plot, and
  [`align`](/reference/legend#legend.align) places it `left`, `center` or
  `right` within its row.
  [`alignedToAxes`](/reference/legend#legend.alignedToAxes) chooses what that
  row is: the plot width between the axes (`true`, the default) or the full
  chart width (`false`), which is why the legend above lines up with the
  chart edge rather than the value axis. Items that do not fit the row wrap
  onto further rows.
- [`visible`](/reference/legend#legend.visible) defaults to `true` only
  above one series — a single-series chart has to set it, as the [next
  example](#a-single-series-key) does.
- [`margin`](/reference/legend#legend.margin) and
  [`padding`](/reference/legend#legend.padding) space the legend as a whole
  from the title and plot; [`backgroundStyle`](/reference/legend#legend.backgroundStyle)
  fills and outlines the padded box (the margin lies outside it). Its default
  stroke and fill opacities are `0`, so set them to make the box show.
- [`item`](/reference/legend#legend.item) styles each series entry the same
  way: [`item.margin`](/reference/legend#legend.item.margin) and
  [`item.padding`](/reference/legend#legend.item.padding) around the icon and
  title, [`item.backgroundStyle`](/reference/legend#legend.item.backgroundStyle)
  behind them and [`item.textStyle`](/reference/legend#legend.item.textStyle)
  for the title text, which follows the host page's colour through
  `currentColor` by default. The padded item box is also the click target.
- [`icon`](/reference/legend#legend.icon) configures the swatch:
  [`size`](/reference/legend#legend.icon.size) (`auto` matches the text
  height), [`spacing`](/reference/legend#legend.icon.spacing) to the title,
  [`borderStyle`](/reference/legend#legend.icon.borderStyle), and whether it
  shows the series [colour](/reference/legend#legend.icon.showColors), its
  [marker shape](/reference/legend#legend.icon.showShapes) or a
  [placeholder](/reference/legend#legend.icon.showPlaceholders) in
  [`unfilteredColor`](/reference/legend#legend.icon.unfilteredColor) /
  [`filteredColor`](/reference/legend#legend.icon.filteredColor).
- [`truncation.enabled`](/reference/legend#legend.truncation.enabled) (on by
  default) cuts a title that is wider than the legend has room for and
  appends [`truncation.text`](/reference/legend#legend.truncation.text).
- Clicking an item [filters](/guide/interaction#legend-filtering) its series out
  and back in while [`filterOnClick`](/reference/legend#legend.filterOnClick)
  is on (the default); a filtered item's icon switches to
  [`icon.filteredColor`](/reference/legend#legend.icon.filteredColor)
  (transparent by default), and
  [`strikeThroughFiltered`](/reference/legend#legend.strikeThroughFiltered)
  strikes its title through as well. Hovering an item
  [focuses](/guide/interaction#focus) its series while
  [`focusOnHover`](/reference/legend#legend.focusOnHover) is on (the default),
  and [`focusOnClick`](/reference/legend#legend.focusOnClick) — off by
  default — makes a click do the same, which is what touch users need since
  a tap never counts as a hover.

## A single-series key

With one series there is nothing to filter or focus against, so this legend
is a plain key: shown explicitly, and with all three interactions switched
off so its item does not respond to the pointer.

<LiveChart :config="legendSingle.config" :data="legendSingle.data" demo="truncated-text" />

<<< @/examples/legendSingle.ts

- Setting [`visible: true`](/reference/legend#legend.visible) is what makes
  the legend appear here; leaving it unset hides it whenever the chart has
  one series.
- With [`filterOnClick`](/reference/legend#legend.filterOnClick),
  [`focusOnClick`](/reference/legend#legend.focusOnClick) and
  [`focusOnHover`](/reference/legend#legend.focusOnHover) all `false` the
  item is inert, and the legend leaves the
  [keyboard tab order](/guide/accessibility) as well.
- The default `bottom` position and `alignedToAxes: true` line the legend up
  with the plot, so `align: 'left'` starts it under the value axis edge.
