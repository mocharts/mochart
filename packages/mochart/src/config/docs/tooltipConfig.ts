import { spacing } from './shared';
import type { NestedDescription } from './shared';
import { getDescriptions as getSeriesIconDescriptions } from './seriesIconConfig';

// Not the shared style prose: the tooltip is html, so an opacity is composited into its color rather
// than written as a separate svg attribute.
const backgroundStyle: NestedDescription = {
  description: 'the styles to apply to the tooltip box (strokeColor, strokeOpacity, strokeWidth, fillColor, fillOpacity (use null for none))',
  properties: {
    strokeColor: 'the color of the border around the tooltip (use null for none)',
    strokeOpacity: 'the opacity (0 - 1) to composite into the border color, or null to use the color exactly as written',
    strokeWidth: 'the width (in pixels) of the border around the tooltip (use null for none)',
    fillColor: 'the background color for the interior of the tooltip (use null for none)',
    fillOpacity: 'the opacity (0 - 1) to composite into the background color, or null to use the color exactly as written'
  }
};

export default function getDescriptions() {
  return {
    visible: 'whether or not to show the tooltip',
    applyFocus: 'whether to change the focused category as the tooltip is shown or hidden, and as it tracks the pointer when followPointer is on',
    snapToCategory: 'whether the tooltip should be centered at the closest category value (true) or at the click/tap position (false)',
    followPointer: 'whether the tooltip should track the mouse position in the chart drawing area',
    closeOnClick: 'whether to hide the tooltip when the user clicks/taps within it',
    filterSeriesOnClick: 'whether series should be filtered when the user clicks/taps on them in the tooltip',
    focusCategoryOnClick: 'whether category values should be focused when the user clicks/taps on them in the tooltip',
    focusSeriesOnClick: 'whether series should be focused when the user clicks/taps on them in the tooltip',
    focusCategoryOnHover: 'whether category values should be focused when the user hovers the pointer over them in the tooltip',
    focusSeriesOnHover: 'whether series should be focused when the user hovers the pointer over them in the tooltip',
    showCategory: 'whether the category value should be shown as the first line of the tooltip',
    showControls: 'whether the focus/filter controls should be shown at the top of the tooltip',
    filterModeText: 'the text shown on the tooltip controls’ mode button while filter mode is active',
    focusModeText: 'the text shown on the tooltip controls’ mode button while focus mode is active',
    keepInside: 'whether to keep the tooltip within the series drawing area (true) or allow it to overlap the axes (false)',
    padding: spacing('the padding (in pixels) for the top, right, bottom and left sides of the tooltip'),
    lineSpacing: 'the space (in pixels) between each line of the tooltip',
    valueAlign: 'the horizontal alignment of the values shown in the tooltip (left, right): left runs the label and value together as one piece of text, right floats the values to the far edge',
    backgroundStyle,
    cornerRadius: 'the radius (in pixels) of the corners of the tooltip',
    dropShadow: {
      description: 'the drop shadow effect cast by the tooltip',
      properties: {
        color: 'the color of the drop shadow effect used for the tooltip',
        offsetX: 'the x offset (in pixels) of the drop shadow effect used for the tooltip',
        offsetY: 'the y offset (in pixels) of the drop shadow effect used for the tooltip',
        blurRadius: 'the blur radius (in pixels) of the drop shadow effect used for the tooltip'
      }
    },
    icon: {
      description: 'the series icons shown next to the series titles in the tooltip',
      properties: getSeriesIconDescriptions('tooltip', 'the inherited font size')
    },
    strikeThroughFiltered: 'whether to strike through the label text of filtered series',
    adjustForFiltering: 'whether to adjust the series values when series filtering changes',
    adjustSizeForFiltering: 'whether to adjust the width of the tooltip when the series values change due to filtering changes',
    showFiltered: 'whether to show series that have been filtered out of the chart in the tooltip',
    showMissingValues: 'whether to show series that do not have defined values in the tooltip',
    missingValueText: 'the text to show for series that do not have defined values',
    filteredValueText: 'the text to show for series that have been filtered (use null for none)',
    filteredValueCharacter: 'the character to show in place of each digit of a series value that has been filtered (use null for none)',
    rangeValueSeparator: 'the text to use when joining the values for a series that has more than one value'
  };
}

export function getDetails() {
  return {
    showControls: 'When `true`, a control strip renders above the tooltip lines: ‹ and › buttons step the shown category, and a mode button toggles what clicking a tooltip row does. In filter mode (the initial mode) a series row toggles its series out of the chart like a legend click (`filterable` permitting), and hovering a series row focuses its series like hovering its legend item; in focus mode a row click pins focus on its series or category. With the controls shown, the mode decides click and series-hover behavior — the `focus…OnClick` / `filterSeriesOnClick` / `focusSeriesOnHover` settings are not consulted (`focusCategoryOnHover` still is). The mode button shows the active mode via `filterModeText` / `focusModeText`, and the step buttons are labeled for assistive tech by `accessibility.tooltipPreviousLabel` / `tooltipNextLabel`.',
    focusSeriesOnHover: 'Ignored while `showControls` is on — there the controls’ mode decides: a row’s series focuses on hover while filter mode is active.',
    filterModeText: 'The visible text of the mode button while clicking a series row filters its series. Replace to localize it.',
    focusModeText: 'The visible text of the mode button while clicking a row focuses its series or category. Replace to localize it.',
    strikeThroughFiltered: 'When `true`, the label of a series that has been filtered out of the chart is drawn with a line through it. The strike-through covers the label only, so the value beside it stays legible — except when `valueAlign` is `\'left\'`, where the label and the value are one piece of text and both are struck.'
  };
}
