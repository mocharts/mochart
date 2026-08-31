import { style, spacing } from './shared';
import { getDescriptions as getSeriesIconDescriptions } from './seriesIconConfig';

export default function getDescriptions() {
  return {
    visible: 'whether the legend should be visible',
    position: 'the position of the legend relative to the chart (top or bottom)',
    truncation: {
      description: 'the truncation applied to legend item text when its width exceeds the width of the chart',
      properties: {
        enabled: 'whether to use text truncation when a legend item width exceeds the width of the chart',
        text: 'the truncation text to append when text is truncated',
        tooltipEnabled: 'whether truncated text shows its full string as the browser’s native tooltip while a pointer rests on it'
      }
    },
    alignedToAxes: 'whether the legend should be aligned between the axes (true) or the chart bounds (false)',
    align: 'the alignment for the legend (left, center, right)',
    margin: spacing('the margin (in pixels) for the top, right, bottom and left sides of the legend'),
    padding: spacing('the padding (in pixels) for the top, right, bottom and left sides of the legend'),
    backgroundStyle: style('the styles to apply to the legend background (strokeColor, strokeOpacity, strokeWidth, fillColor, fillOpacity (use null for none))'),
    item: {
      description: 'the legend items, each a series icon and title in its own box',
      properties: {
        margin: spacing('the margin (in pixels) for the top, right, bottom and left sides of the legend items'),
        padding: spacing('the padding (in pixels) for the top, right, bottom and left sides of the legend items'),
        backgroundStyle: style('the styles to apply to the legend item backgrounds (strokeColor, strokeOpacity, strokeWidth, fillColor, fillOpacity (use null for none))'),
        textStyle: style('the styles to apply to the legend item text (strokeColor, strokeOpacity, strokeWidth, fillColor, fillOpacity (use null for none), use "currentColor" to follow the host page\'s css color and theme)')
      }
    },
    icon: {
      description: 'the series icons shown next to the series titles in the legend',
      properties: getSeriesIconDescriptions('legend', 'the legend text font size')
    },
    strikeThroughFiltered: 'whether to strike through the item text of filtered series',
    focusOnHover: 'whether to focus a series when the pointer hovers over the series icon or title',
    focusOnClick: 'whether to focus a series when the series icon or title is clicked',
    filterOnClick: 'whether to filter a series when the series icon or title is clicked'
  };
}
export function getDetails() {
  return {
    truncation: { properties: { tooltipEnabled: 'When `true`, a truncated legend item carries an svg `<title>` holding the full text, which browsers show as their native tooltip (not the chart `tooltip`) while a mouse or pen rests on it. Touch has no hover, so nothing shows there; a keyboard-reachable item is already named from the full series title.' } },
    strikeThroughFiltered: 'When `true`, the item text of a series that has been filtered out of the chart is drawn with a line through it, so the legend shows at a glance which series are filtered. The strike-through covers the item text only, never its color icon — the icon already says the same thing by going hollow.',
    filterOnClick: 'When `true`, clicking a legend item toggles its series out of (and back into) the chart, playing the staged series transition; the item stays in the legend so it can be restored. `onSeriesFilter` reports every change.',
    focusOnHover: 'When `true`, hovering a legend item focuses its series: the series gets its focused styling and every other series gets its defocused styling. `onFocus` reports focus changes.',
    focusOnClick: 'When `true`, clicking a legend item focuses its series (see `focusOnHover`). Combine with `filterOnClick` deliberately — with both enabled a click filters and focuses.'
  };
}
