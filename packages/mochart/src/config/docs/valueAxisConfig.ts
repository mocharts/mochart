import getAxisDescriptions, { axisStyleStatesDescription, axisStrokeMembers, getTickLabelDescriptions, tickLabelDescription } from './axisConfig';

export default function getDescriptions() {
  return {
    ...getAxisDescriptions(),
    id: 'the unique identifier for the value axis so it can be referenced by series that belong to it',
    ignore: 'whether to ignore this value axis and treat it as though it were not specified',
    type: 'the type of the value axis, must be number',
    scale: 'the scale of the value axis, must be linear',
    order: 'the unique integer order of the value axis controlling its order of appearance',
    base: 'the numeric base value of the axis, used for animation and relative positioning for shapes (use null for none)',
    baseLine: {
      description: 'the line drawn along the base value of the axis',
      properties: {
        visible: 'whether to show a line along the base of the axis',
        front: 'whether the base line should be shown in front (true) or behind (false) the series shapes',
        style: axisStyleStatesDescription('the style of the line shown along the base of the axis', axisStrokeMembers)
      }
    },
    adjustForFiltering: 'whether to adjust the domain of the axis as series belonging to it are filtered',
    visibleWhenAllFiltered: 'whether the axis should be visible when all series belonging to it are filtered',
    tickLabel: {
      description: tickLabelDescription,
      properties: {
        ...getTickLabelDescriptions(),
        format: 'the d3 format string to be applied to the series values when displayed in axis tick labels (use null for none, use "auto" to derive from data)',
        adjustSizeForFiltering: 'whether to adjust the size of the axis tick label bounds as series belonging to it are filtered'
      }
    },
    ticks: {
      description: 'the explicit ticks to show on the axis in place of the generated ones, each placing label text at an axis value (use null for none)',
      properties: {
        value: 'the axis value to place the tick at',
        label: 'the text of the tick label (leave it out to format the value with tickLabel.format)'
      }
    },
    maxMarginFraction: 'the margin, as a fraction (0 or greater) of the domain of the axis, to use at the maximum extent of the axis (only applied if max is "auto" and max value is not equal base)',
    minMarginFraction: 'the margin, as a fraction (0 or greater) of the domain of the axis, to use at the minimum extent of the axis (only applied if min is "auto" and min value is not equal base)',
    focusOnHover: 'whether the value axis should be focused whenever the user hovers the pointer over a part of it in the chart',
    focusOnClick: 'whether the value axis should be focused whenever the user clicks/taps a part of it in the chart',
    useSeriesFocus: 'whether to show the axis as focused when any series belonging to it is focused',
  };
}
export function getDetails() {
  return {
    id: 'Referenced by `series[].axis` (and `seriesStacks[].axis`) to assign series to this axis. With a single axis the ids can be omitted everywhere.',
    min: 'With `"auto"` the minimum is computed from the data (including stacking) on every update, and changes animate through the staged axis expansion/contraction phases. Set a number to pin the bound instead. Values outside of the defined range are clipped rather than allowed to overflow the plot area of the chart.',
    max: 'With `"auto"` the maximum is computed from the data (including stacking) on every update, and changes animate through the staged axis expansion/contraction phases. Set a number to pin the bound instead. Values outside of the defined range are clipped rather than allowed to overflow the plot area of the chart.',
    softMin: 'A lower bound that only applies while no data value is below it — the axis covers at least this value, but real data smaller than it still expands the domain. Unlike `min`, it never clips data.',
    softMax: 'An upper bound that only applies while no data value is above it — the axis covers at least this value, but real data larger than it still expands the domain. Unlike `max`, it never clips data.',
    base: 'The value shapes are measured from: bars and areas grow from it, `missingValueMode: \'base\'` puts missing values on it, and shapes animate from it when series enter or leave. With mixed positive/negative data it separates the two directions. When left unspecified, un-ranged bar and area series use the minimum end of the axis, and other series use `min` when it is set, otherwise the smallest value in the data.',
    ticks: 'Replaces the automatic tick generation entirely: tick counts, intervals and domain-edge ticks are ignored. Useful for naming fixed positions, e.g. heatmap row bands or threshold levels. Ticks outside the current axis domain are hidden.',
    maxMarginFraction: 'The margin is relative to the pre-margin domain, so values above 1 are allowed and confine the data to a band of the plot: a margin of 4 leaves the data in the bottom fifth — how the candlestick/OHLC volume pane reserves the upper plot for the price axis.',
    minMarginFraction: 'The margin is relative to the pre-margin domain, so values above 1 are allowed and confine the data to a band of the plot: a price axis with margin 1/3 keeps its data in the top three quarters, leaving the bottom for a volume pane.'
  };
}
