import { style, spacing, font } from './shared';

export default function getDescriptions() {
  return {
    type: 'the type of chart to render: an x/y plot with axes (xy) or a pie/donut chart (pie)',
    margin: spacing('the margin (in pixels) for the top, right, bottom and left sides of the chart'),
    padding: spacing('the padding (in pixels) for the top, right, bottom and left sides of the chart'),
    backgroundStyle: style('the styles to apply to the chart background (strokeColor, strokeOpacity, strokeWidth, fillColor, fillOpacity (use null for none))'),
    font: font('the font of every text the chart draws, used for each member a part\'s own font leaves null (family, size, weight, style (use null to leave a member to css))')
  };
}

export function getDetails() {
  return {
    font: 'Each text part (the title, legend items, tick labels, axis titles, threshold titles, series labels, the pie center, the clip indicator label and the tooltip) has a `font` of its own with the same four members. A member is resolved per text element: the part\'s own value when it is not `null`, otherwise this chart-wide value, otherwise nothing. Resolved members are written as an inline style on the text element itself (`font-family`, `font-size`, `font-weight`, `font-style`), so a configured value wins over any host page css rule; a member left `null` in both places writes nothing and stays with css. Text is measured after the font is written, so a larger size reserves more space in the layout. A `size` number is written in pixels; a string is written as given, so relative sizes (`\'0.85em\'`, `\'120%\'`, `\'larger\'`) resolve against the text\'s css font size as the browser sees it.'
  };
}
