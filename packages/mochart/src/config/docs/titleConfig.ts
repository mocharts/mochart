import { style, spacing } from './shared';

export default function getDescriptions() {
  return {
    text: 'the text to display in the title (use null for none)',
    position: 'the position of the title relative to the chart (top or bottom)',
    link: 'the link to create for the title (use null for none)',
    linkDisabled: 'whether to prevent default navigation behaviour when the link is clicked',
    truncationEnabled: 'whether to use text truncation when the title width exceeds the width of the chart',
    truncationText: 'the truncation text to append to the title when its width exceeds the width of the chart',
    truncationTooltipEnabled: 'whether a truncated title shows its full text as the browser’s native tooltip while a pointer rests on it',
    alignedToAxes: 'whether the title should be aligned between the axes (true) or the chart bounds (false)',
    align: 'the alignment for the title (left, center, right)',
    verticalAlign: 'the vertical alignment of the prefix/text/suffix within the title (top, middle, bottom)',
    verticalExpand: 'whether to expand the padding height of the prefix/text/suffix to match the max section height',
    margin: spacing('the margin (in pixels) for the top, right, bottom and left sides of the title'),
    padding: spacing('the padding (in pixels) for the top, right, bottom and left sides of the title'),
    textMargin: spacing('the margin (in pixels) for the top, right, bottom and left sides of the title text'),
    textPadding: spacing('the padding (in pixels) for the top, right, bottom and left sides of the title text'),
    backgroundStyle: style('the styles to apply to the title background (strokeColor, strokeOpacity, strokeWidth, fillColor, fillOpacity (use null for none))'),
    textBackgroundStyle: style('the styles to apply to the title text background (strokeColor, strokeOpacity, strokeWidth, fillColor, fillOpacity (use null for none))'),
    textStyle: style('the styles to apply to the title text (strokeColor, strokeOpacity, strokeWidth, fillColor, fillOpacity (use null for none), use "currentColor" to follow the host page\'s css color and theme)'),
    prefix: {
      description: 'the prefix box shown at the start of the title',
      properties: {
        text: 'the text to display in the box (use null for none)',
        margin: spacing('the margin (in pixels) for the top, right, bottom and left sides of the box'),
        padding: spacing('the padding (in pixels) for the top, right, bottom and left sides of the box'),
        backgroundStyle: style('the styles to apply to the box background (strokeColor, strokeOpacity, strokeWidth, fillColor, fillOpacity (use null for none))'),
        textStyle: style('the styles to apply to the box text (strokeColor, strokeOpacity, strokeWidth, fillColor, fillOpacity (use null for none), use "currentColor" to follow the host page\'s css color and theme)')
      }
    },
    suffix: {
      description: 'the suffix box shown at the end of the title',
      properties: {
        text: 'the text to display in the box (use null for none)',
        margin: spacing('the margin (in pixels) for the top, right, bottom and left sides of the box'),
        padding: spacing('the padding (in pixels) for the top, right, bottom and left sides of the box'),
        backgroundStyle: style('the styles to apply to the box background (strokeColor, strokeOpacity, strokeWidth, fillColor, fillOpacity (use null for none))'),
        textStyle: style('the styles to apply to the box text (strokeColor, strokeOpacity, strokeWidth, fillColor, fillOpacity (use null for none), use "currentColor" to follow the host page\'s css color and theme)')
      }
    }
  };
}
export function getDetails() {
  return {
    truncationTooltipEnabled: 'When `true`, a truncated title carries an svg `<title>` holding the full text, which browsers show as their native tooltip (not the chart `tooltip`) while a mouse or pen rests on it. Touch has no hover, so nothing shows there; the chart’s accessible name already uses the full text.'
  };
}
