import { style } from './shared';

export default function getDescriptions() {
  return {
    innerRadiusFraction: 'the inner radius of the slices as a fraction (0 to 1) of the outer radius (use a value greater than 0 for a donut chart)',
    outerRadiusFraction: 'the outer radius of the slices as a fraction (0 to 1) of the largest radius that fits within the plot',
    startAngle: 'the angle (in degrees, clockwise from the top) at which the first slice starts',
    endAngle: 'the angle (in degrees, clockwise from the top) at which the last slice ends (use startAngle -90 and endAngle 90 for a half/gauge pie)',
    padAngle: 'the angle (in degrees) of the gap between adjacent slices',
    cornerRadius: 'the corner radius (in pixels) applied to the slice corners',
    focusOffsetFraction: 'offset the focused slice away from the center by this fraction (0 to 1) of the outer radius (an exploded slice); the layout reserves this room, so the slices shrink by the same fraction rather than leaving the plot when exploded',
    label: {
      description: 'the labels drawn on the slices',
      properties: {
        visible: 'whether labels should be shown on the slices',
        type: 'the content of the slice labels: the slice value (value), the slice percentage of the total (percent), the series title (title), or a combination of two of them (valuePercent for "value (percent)", percentValue for "percent (value)", titleValue for "title: value", titlePercent for "title: percent")',
        valueFormat: 'the d3 format specifier used to format the value part of the slice labels (use auto to derive a format)',
        percentFormat: 'the d3 format specifier used to format the percent part of the slice labels (use auto to derive a format)',
        radiusFraction: 'the radial position of the slice labels as a fraction (0 to 1) between the inner radius and the outer radius',
        minFraction: 'hide the label of any slice whose value is smaller than this fraction (0 to 1) of the slice total',
        adjustForFiltering: 'whether percent slice labels (and the minFraction threshold) renormalize against the unfiltered slices (true) or always use every slice\'s share of the full total (false)'
      }
    },
    tooltip: {
      description: 'the values shown in the tooltip for the slices',
      properties: {
        valueType: 'the content of the tooltip value for each slice: the slice value (value), the slice percentage of the total (percent) or a combination of both (valuePercent for "value (percent)", percentValue for "percent (value)"); the value part is formatted by the series valueFormat, valuePrefix and valueSuffix, and the percent part renormalizes against the unfiltered slices unless the top-level tooltip.adjustForFiltering is false',
        percentFormat: 'the d3 format specifier used to format the percent part of the tooltip values (use auto to derive a format)'
      }
    },
    centerLabel: {
      description: 'the text label shown at the center of the pie (most useful for donut and gauge charts)',
      properties: {
        text: 'the text to show at the center of the pie (use null for none)',
        textStyle: style('the styles to apply to the center label text (strokeColor, strokeOpacity, strokeWidth, fillColor, fillOpacity (use null for none), use "currentColor" to follow the host page\'s css color and theme)')
      }
    },
    centerTotal: {
      description: 'the total of the slice values shown at the center of the pie',
      properties: {
        visible: 'whether the total of the slice values should be shown at the center of the pie',
        format: 'the d3 format specifier used to format the center total (use auto to derive a format)',
        textStyle: style('the styles to apply to the center total text (strokeColor, strokeOpacity, strokeWidth, fillColor, fillOpacity (use null for none), use "currentColor" to follow the host page\'s css color and theme)'),
        adjustForFiltering: 'whether the center total counts only the unfiltered slices (true) or always shows the full total (false)'
      }
    },
    centerOffsetXFraction: 'offset the center label and total horizontally by this fraction (-1 to 1) of the outer radius (positive moves right)',
    centerOffsetYFraction: 'offset the center label and total vertically by this fraction (-1 to 1) of the outer radius (positive moves down; e.g. use a negative value to lift them into a gauge\'s hole)'
  };
}
