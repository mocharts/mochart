import { style } from './shared';

export default function getDescriptions() {
  return {
    visible: 'whether to mark the plot edges that have data hidden behind them, which happens when an axis min or max excludes some of the values',
    size: 'the depth (in pixels) of the clip indicator band (use "auto" to size it from the label plus labelPadding on both sides)',
    labelPadding: 'the space (in pixels) between the clip indicator label and the edges of its band, which also determines the band depth when size is "auto"',
    label: 'the text shown in the clip indicator band, and the band\'s accessible name (use null for no label; the band is still shown)',
    textStyle: style('the styles to apply to the clip indicator label (strokeColor, strokeOpacity, strokeWidth, fillColor, fillOpacity (use null for none))'),
    style: style('the styles to apply to the clip indicator band, whose fillColor draws the hatch when one is set (strokeColor, strokeOpacity, strokeWidth, fillColor, fillOpacity (use null for none))'),
    hatch: {
      description: 'the diagonal hatch filling the clip indicator band (use null for a flat fill instead)',
      properties: {
        spacing: 'the distance (in pixels) between neighbouring hatch lines',
        lineWidth: 'the thickness (in pixels) of each hatch line; at or above spacing the hatch closes up into a flat fill'
      }
    },
    front: 'whether the clip indicator should be shown in front (true) or behind (false) the series shapes'
  };
}
