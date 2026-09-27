import getAxisDescriptions, { axisStyleStatesDescription, axisStrokeMembers, getTickLabelDescriptions, getTickLabelDetails, tickLabelDescription, minorTickLabelIntro, majorNote, tickStepDescription, getTickStepDescriptions, thresholdStepDescription, getThresholdStepDescriptions, tickStepMinorDetails, valueTickStepDetails, valueStepCountOffsetDetails, getThresholdMemberDetails, thresholdStyleDetails, thresholdDomainDetails, thresholdStepMinSpacingDetails, thresholdStepPatternDetails, thresholdLogDetails } from './axisConfig.js';

export default function getDescriptions() {
  return {
    ...getAxisDescriptions(),
    id: 'the unique identifier for the value axis so it can be referenced by series that belong to it',
    ignore: 'whether to ignore this value axis and treat it as though it were not specified',
    type: 'the type of the value axis, must be number',
    scale: 'how the axis places values: linear spaces them by difference, log by ratio, so each power of 10 takes the same length',
    order: 'the unique integer order of the value axis controlling its order of appearance',
    base: 'the numeric base value of the axis, used for animation and relative positioning for shapes (use null for none; above 0 on a log axis)',
    baseLine: {
      description: 'the line drawn along the base value of the axis',
      properties: {
        visible: 'whether to show a line along the base of the axis',
        front: 'whether the base line should be shown in front (true) or behind (false) the series shapes',
        style: axisStyleStatesDescription('the style of the line shown along the base of the axis', axisStrokeMembers)
      }
    },
    adjustForFiltering: 'whether to adjust the domain of the axis as series belonging to it are filtered',
    thresholdStep: {
      description: thresholdStepDescription,
      properties: {
        ...getThresholdStepDescriptions(),
        offset: 'the number of steps skipped before the first threshold; it shifts which multiples are kept, counted from 0'
      }
    },
    tickStep: {
      description: tickStepDescription,
      properties: {
        ...getTickStepDescriptions(),
        offset: 'the number of steps skipped before the first tick; it shifts which multiples are kept, counted from 0'
      }
    },
    visibleWhenAllFiltered: 'whether the axis should be visible when all series belonging to it are filtered',
    tickLabel: {
      description: tickLabelDescription,
      properties: {
        ...getTickLabelDescriptions(),
        format: 'the d3 format string to be applied to the series values when displayed in axis tick labels (use null for none, use "auto" for an SI-prefixed number whose precision follows the tick spacing, or on a log axis the magnitude of each tick, in exponent form beyond the SI prefixes; there a format that leaves its precision open takes 3 significant digits, trimmed)',
        minorFormat: 'the d3 format string to be applied to the series values when displayed in minor tick labels (use null for none, use "auto" to derive from data)' + majorNote('tickLabel.format'),
        adjustSizeForFiltering: 'whether to adjust the size of the axis tick label bounds as series belonging to it are filtered (applies to the minor tick labels too)'
      }
    },
    ticks: {
      description: 'the explicit ticks to show on the axis in place of the generated ones, each placing label text at an axis value (use null for none)',
      properties: {
        value: 'the axis value to place the tick at (above 0 on a log axis)',
        label: 'the text of the tick label (leave it out to format the value with tickLabel.format)',
        minor: 'whether the tick is a minor tick, drawn and labeled with the minor tick settings (leave it out for a regular tick)'
      }
    },
    maxMarginFraction: 'the margin, as a fraction (0 or greater) of the length the data takes along the axis, to use at the maximum extent of the axis (only applied if max is "auto" and max value is not equal base)',
    minMarginFraction: 'the margin, as a fraction (0 or greater) of the length the data takes along the axis, to use at the minimum extent of the axis (only applied if min is "auto" and min value is not equal base)',
    focusOnHover: 'whether the value axis should be focused while the user hovers the pointer over a part of it in the chart',
    focusOnClick: 'whether a click/tap on a part of the value axis should pin the focus on it, so it stays focused after the pointer leaves (a second click releases it)',
    useSeriesFocus: 'whether to show the axis as focused when any series belonging to it is focused',
  };
}
export function getDetails() {
  return {
    title: { properties: { truncation: { properties: { tooltipEnabled: 'When `true`, a truncated axis title carries an svg `<title>` holding the full text, which browsers show as their native tooltip (not the chart `tooltip`) while a mouse or pen rests on it. Touch has no hover, so nothing shows there; the axis group is already named from the full title.' } } } },
    id: 'Referenced by `series[].axis` (and `seriesStacks[].axis`) to assign series to this axis. With a single axis the ids can be omitted everywhere.',
    min: 'With `"auto"` the minimum is computed from the data (including stacking) on every update, and changes animate through the staged axis expansion/contraction phases. Set a number to pin the bound instead; on a log axis it must be above 0. Values outside of the defined range are clipped rather than allowed to overflow the plot area of the chart.',
    max: 'With `"auto"` the maximum is computed from the data (including stacking) on every update, and changes animate through the staged axis expansion/contraction phases. Set a number to pin the bound instead; on a log axis it must be above 0. Values outside of the defined range are clipped rather than allowed to overflow the plot area of the chart.',
    softMin: 'A lower bound that only applies while no data value is below it: the axis covers at least this value, but real data smaller than it still expands the domain. Unlike `min`, it never clips data. On a log axis it must be above 0.',
    softMax: 'An upper bound that only applies while no data value is above it: the axis covers at least this value, but real data larger than it still expands the domain. Unlike `max`, it never clips data. On a log axis it must be above 0.',
    scale: 'A log axis reads data spanning several orders of magnitude: 1 to 10 takes the same length as 100 to 1000, and a doubling is the same length anywhere. It has no position for 0 or a negative value, so the chart handles those by which value they are, and tooltips and labels still show the value itself. A series value at or below 0 is left out of the domain and drawn as missing, following the series `missingValueMode`, and the chart logs a console warning naming the series. An error bar end at or below 0, or the lower end of a range whose other end is above 0, is drawn past the minimum end of the axis and cut off at the plot edge, and the clip indicator shows it; a range with both ends at or below 0 is missing. Ticks sit at the powers of 10, every second, fifth or tenth one when they do not all fit, with the 2 and 5 multiples, or every multiple from 2 to 9, added when the powers are too few and they fit; the multiples and skipped powers that are not ticks are minor ticks, and between two neighbouring powers of 10 the ticks are the multiples that lie there, or linear ones on an axis with room for more. Values and the domain animate in the same terms, so a value moving from 1 to 1000 is halfway up the axis at 31.6. A log axis cannot hold a series stack, since a stack starts at 0, and it takes no `tickStep` or `thresholdStep` interval, no offsets and no `minTickInterval`, since each of those is a fixed distance in values. A pie chart accepts only `"linear"`. Switching the scale restarts the chart without a transition.',
    base: 'The value shapes are measured from: bars and areas grow from it, `missingValueMode: \'base\'` puts missing values on it, and shapes animate from it when series enter or leave. With mixed positive/negative data it separates the two directions. When left unspecified, un-ranged bar and area series use the minimum end of the axis, and other series use `min` when it is set, otherwise the smallest value in the data. On a log axis it must be above 0, and a base such as 1 grows ratios above it up and ratios below it down, with a doubling and a halving the same length.',
    tickStep: {
      description: 'Chooses the ticks by rule rather than by a list, so the choice holds as the data changes; explicit `ticks` take precedence. An `interval` places the ticks on its multiples, `count` and `offset` keep every count-th of them counted from 0, and `minorSteps` places minor ticks between them; without an interval the axis keeps the ticks it picks. A log axis takes no interval, since equal distances in values take unequal lengths there, so it always keeps the ticks it picks. The minor tick marks, grid lines and labels carry the `mochart-axis-minor-tick-mark`, `mochart-axis-minor-grid-line` and `mochart-axis-minor-tick-label` classes, and the `tickLabel`, `tickMark` and `gridLine` minor settings say how they are drawn.',
      properties: {
        interval: tickStepMinorDetails.interval,
        count: 'When more ticks survive the rule than fit, every k-th survivor is kept starting from the first. ' + valueTickStepDetails.count,
        offset: valueTickStepDetails.offset,
        minorSteps: tickStepMinorDetails.minorSteps,
        minSpacing: tickStepMinorDetails.minSpacing
      }
    },
    tickLabel: {
      description: minorTickLabelIntro,
      properties: getTickLabelDetails()
    },
    thresholdStep: {
      description: 'The steps are the multiples of `interval`, anchored at 0, from the last one at or below the axis minimum, so a range already under way at the domain edge is drawn clipped rather than left out; with no interval nothing is drawn, and a log axis takes no interval. The ranges follow the domain as it changes, draw after the `thresholds` entries and carry no title; `minSpacing` keeps a rule from flooding the axis.',
      properties: {
        minSpacing: thresholdStepMinSpacingDetails,
        pattern: thresholdStepPatternDetails,
        count: valueStepCountOffsetDetails,
        offset: valueStepCountOffsetDetails,
        range: '`interval: 10` with `count: 2` draws ranges over 0 to 10, 20 to 30 and so on; with `range: false` a line sits at each multiple instead.'
      }
    },
    thresholds: {
      description: 'A line at an axis value, or with a `rangeValue` a range between two. ' + thresholdStyleDetails + ' ' + thresholdDomainDetails + ' ' + thresholdLogDetails,
      properties: getThresholdMemberDetails()
    },
    ticks: {
      description: 'Replaces the automatic tick generation entirely: tick counts, intervals and domain-edge ticks are ignored, except that the entries marked `minor` follow the minor label fit rule. Useful for naming fixed positions, e.g. heatmap row bands or threshold levels. Ticks outside the current axis domain are hidden, and two entries with the same value are a validation error.',
      properties: {
        minor: 'A minor entry is drawn with the `tickLabel`, `tickMark` and `gridLine` minor settings, and its label shows only when every minor label fits beside its neighbours; an entry with a `label` keeps it whatever `minorFormat` says.'
      }
    },
    maxMarginFraction: 'The margin is relative to the pre-margin domain, so values above 1 are allowed and confine the data to a band of the plot: a margin of 4 leaves the data in the bottom fifth, which is how the candlestick/OHLC volume pane reserves the upper plot for the price axis. On a log axis the margin is taken from the logs of the domain, so it is the same share of the axis length as on a linear one.',
    minMarginFraction: 'The margin is relative to the pre-margin domain, so values above 1 are allowed and confine the data to a band of the plot: a price axis with margin 1/3 keeps its data in the top three quarters, leaving the bottom for a volume pane. On a log axis the margin is taken from the logs of the domain, so it is the same share of the axis length as on a linear one.'
  };
}
