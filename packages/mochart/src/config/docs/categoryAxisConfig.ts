import getAxisDescriptions, { getTickLabelDescriptions, getTickLabelDetails, tickLabelDescription, minorTickLabelIntro, majorNote, getTickStepDescriptions, tickStepDescription, tickStepMinorDetails, stepCountOffsetDetails, getThresholdStepDescriptions, thresholdStepDescription, getThresholdDescriptions, thresholdsDescription, getThresholdMemberDetails, thresholdStyleDetails, thresholdDomainDetails, thresholdStepMinSpacingDetails, thresholdStepPatternDetails } from './axisConfig.js';

export default function getDescriptions() {
  return {
    ...getAxisDescriptions(),
    property: 'the property to retrieve from the data provider for the category values',
    keyProperty: 'the property to retrieve from the data provider for the category keys, when the category values may repeat (use null for none)',
    type: 'the type of the category values (number, date, string)',
    scale: 'the scale to use for the category values (ordinal, linear)',
    dateUTC: 'whether dates should be treated as UTC (true) or local (false)',
    valueLabel: 'the label to show before a category value in the tooltip (use null or an empty string for none)',
    valueFormat: 'the d3 format string (d3-format for number, d3-time-format for date) to be applied to the category value when displayed in the tooltip (use null for none, use "auto" to derive from data)',
    valuePrefix: 'the text to prefix category values with when showing them in the tooltip (use null or an empty string for none)',
    valueSuffix: 'the text to append category values with when showing them in the tooltip (use null or an empty string for none)',
    minCategoryValueExtent: 'the minimum extent (in pixels) of each category slot; for a non-inverted bar chart this is a minimum bar width',
    categoryPaddingFraction: {
      description: 'the padding fractions (0 - 1) of the category extent for all category values (outer) and grouped series (inner)',
      properties: {
        inner: 'the fraction (0 - 1) of a category value\'s extent to leave as space between the series drawn inside it',
        outer: 'the fraction (0 - 1) to trim from each category value\'s extent, leaving space between neighbouring category values'
      }
    },
    categoryCountPadding: 'the extra slot count added to the number of category slots when dividing the category extent among them (one slot per category on an ordinal axis, one per categoryValueInterval on a linear axis)',
    categoryValueInterval: 'the axis value distance one category slot covers on a linear scale: a number in axis values, or on a date axis a millisecond count or one of second, minute, hour, day, week (use "auto" for the smallest gap between neighbouring categories)',
    ticks: {
      description: 'the explicit ticks to show on the axis in place of the generated ones, each placing label text at a category value (use null for none)',
      properties: {
        value: 'the category to place the tick at, named by its value (the category string on a string axis, a number on a number axis, a millisecond timestamp or ISO date string on a date axis) or, on an ordinal axis with a keyProperty, by its key',
        label: 'the text of the tick label (leave it out to format the value with tickLabel.format)',
        minor: 'whether the tick is a minor tick, drawn and labeled with the minor tick settings (leave it out for a regular tick)'
      }
    },
    thresholdStep: {
      description: thresholdStepDescription,
      properties: {
        ...getThresholdStepDescriptions(),
        period: 'the calendar period the thresholds step by on a date axis (second, minute, hour, day, week, month, year; use null for none)'
      }
    },
    thresholds: {
      description: thresholdsDescription,
      properties: {
        ...getThresholdDescriptions(),
        value: 'the axis value the threshold sits at: on an ordinal axis a category (or its key, with a keyProperty), on a linear axis a number, or a millisecond timestamp or ISO date string when type is date'
      }
    },
    tickStep: {
      description: tickStepDescription,
      properties: {
        ...getTickStepDescriptions(),
        period: 'the calendar period the ticks step by on a date axis (second, minute, hour, day, week, month, year; use null for none)',
        minorPeriod: 'the calendar period of the minor ticks placed between the period ticks on a linear date axis (second, minute, hour, day, week, month, year, shorter than period; use null for none)',
        includeFirst: 'whether the first category always gets a tick, even when count and offset would skip it (ordinal scale only; a linear axis accepts only false)'
      }
    },
    tickLabel: {
      description: tickLabelDescription,
      properties: {
        ...getTickLabelDescriptions(),
        format: 'the d3 format string (d3-format for number, d3-time-format for date) to be applied to the category values when displayed in axis tick labels (use null for none, use "auto" to derive the format from the ticks: on a number axis an SI-prefixed number whose precision follows the tick spacing)',
        minorFormat: 'the d3 format string (d3-format for number, d3-time-format for date) to be applied to the category values when displayed in minor tick labels (use null for none, use "auto" to derive from data)' + majorNote('tickLabel.format'),
        truncation: {
          description: 'the truncation applied to the axis tick labels when they would overlap each other',
          properties: {
            enabled: 'whether or not to use text truncation (true) when the axis tick labels would overlap each other instead of skipping ticks (false)',
            text: 'the truncation text to append when text is truncated',
            tooltipEnabled: 'whether truncated text shows its full string as the browser\'s native tooltip while a pointer rests on it',
            minLength: 'the minimum length (in pixels) to allow tick label text perpendicular to the axis, applied when maxFraction would allow less',
            maxFraction: 'the maximum fraction (0 - 1) of the plot bounds to allow any tick label text to occupy when they are perpendicular to the axis'
          }
        },
        minorTruncation: {
          description: 'the truncation applied to the minor tick labels when they would overlap each other',
          properties: {
            enabled: 'whether or not to use text truncation (true) when the minor tick labels would overlap each other instead of hiding them (false)' + majorNote('tickLabel.truncation.enabled'),
            text: 'the truncation text to append when minor tick label text is truncated',
            tooltipEnabled: 'whether truncated minor tick label text shows its full string as the browser\'s native tooltip while a pointer rests on it' + majorNote('tickLabel.truncation.tooltipEnabled'),
            minLength: 'the minimum length (in pixels) to allow minor tick label text perpendicular to the axis, applied when maxFraction would allow less' + majorNote('tickLabel.truncation.minLength'),
            maxFraction: 'the maximum fraction (0 - 1) of the plot bounds to allow any minor tick label text to occupy when they are perpendicular to the axis' + majorNote('tickLabel.truncation.maxFraction')
          }
        }
      }
    }
  };
}
export function getDetails() {
  return {
    title: { properties: { truncation: { properties: { tooltipEnabled: 'When `true`, a truncated axis title carries an svg `<title>` holding the full text, which browsers show as their native tooltip (not the chart `tooltip`) while a mouse or pen rests on it. Touch has no hover, so nothing shows there; the axis group is already named from the full title.' } } } },
    property: 'The chart reads this property from each entry of the data provider to get the category value: the values must match `type`, they position a linear axis, and they are what tick labels and the tooltip show. They must be unique unless `keyProperty` is set. It is required: the only category axis property without a default.',
    type: 'How category values are interpreted: `string` for labels, `number` for numeric values, and `date` for date values (`dateUTC` controls their timezone handling). The type drives parsing, tick label formatting, and which `scale` options make sense.',
    scale: '`ordinal` places the categories at evenly spaced positions in data order regardless of their values; `linear` positions `number`/`date` category values proportionally along the axis, so uneven spacing in the data shows as uneven spacing in the chart.',
    keyProperty: 'When set, this property\'s values (strings or numbers, one per category) identify the categories instead of the category values themselves: they must be unique, and they are what animation, focus and filtering match categories by across data changes. Use it when the category values would otherwise repeat, such as a label keyed by an id, or a wall-clock date whose real instants repeat.',
    categoryValueInterval: 'The slot decides how much room a category takes: a bar spans one slot less the outer padding fraction, grouped series share one slot, and `categoryCountPadding` adds slots to the divided extent. With `"auto"` the slot is the smallest gap between neighbouring category values, so evenly spaced data fills the axis the way an ordinal axis does and a missing category shows as an empty slot; with one category the slot is the whole domain. Set it when the data spacing is not the slot you want: `"day"` keeps daily bars a day wide when one day carries two samples, and a value smaller than the spacing draws narrower bars with space between them. A value wider than the spacing overlaps the bars. An ordinal axis has one category per slot, so there it must stay `"auto"`.',
    min: 'The form the bound takes follows `type` on a linear axis: a number when `type` is `number`, and either a millisecond timestamp or an ISO date string (`"2020-01-01"`) when `type` is `date` (the two forms `thresholds[].value` takes). An ordinal axis places its categories in data order, so it accepts only `"auto"`.',
    max: 'The form the bound takes follows `type` on a linear axis: a number when `type` is `number`, and either a millisecond timestamp or an ISO date string (`"2020-01-01"`) when `type` is `date` (the two forms `thresholds[].value` takes). An ordinal axis places its categories in data order, so it accepts only `"auto"`.',
    softMin: 'Takes the same forms as `min` (a number, or a timestamp or ISO date string on a date axis) but only applies while no category value falls below it, so real data still expands the domain. An ordinal axis accepts only `null`.',
    softMax: 'Takes the same forms as `max` (a number, or a timestamp or ISO date string on a date axis) but only applies while no category value rises above it, so real data still expands the domain. An ordinal axis accepts only `null`.',
    tickStep: {
      description: 'Chooses the ticks by rule rather than by a list, so the choice holds as the data changes; explicit `ticks` take precedence. On an ordinal axis the candidates are the categories in order, or under a `period` the first category of each period, `count` and `offset` step through them, and the categories between the ticks are minor ticks. On a linear axis a `period` (date) or `interval` (number) places the ticks on the period boundaries or the multiples of the interval, `count` and `offset` keep every count-th of them counted from a fixed starting point, and `minorPeriod` or `minorSteps` places minor ticks between them; without a period or interval the axis keeps the ticks it picks. The minor tick marks, grid lines and labels carry the `mochart-axis-minor-tick-mark`, `mochart-axis-minor-grid-line` and `mochart-axis-minor-tick-label` classes, and the `tickLabel`, `tickMark` and `gridLine` minor settings say how they are drawn.',
      properties: {
        period: 'A week starts on Monday and the boundaries follow `dateUTC`, so a daily series with `"week"` gets a tick at each week\'s first trading day whatever the holidays. A partial first week is a period of its own, so its first category gets a tick too; `offset: 1` skips it. On a linear date axis the ticks sit on the period boundaries themselves.',
        minorPeriod: 'Needs a `period`, and must be a shorter period than it: a week inside a month, a day inside a week, or an hour inside a day. A minor tick on a tick the step keeps is dropped, and a tick inside a minor period hides the minor ticks at both ends of that period, such as the Mondays either side of the 1st of a month, with their tick marks and grid lines; a tick on a minor boundary hides none.',
        count: 'Counts through the candidates, the categories or the period starts: `count: 5, offset: 3` shows the fourth category and every fifth after it, and `period: "week"` with `count: 2` gives every second week. When more ticks survive the rule than fit, every k-th survivor is kept starting from the first, so thinned Mondays stay Mondays; `tickLabel.truncation` still decides whether crowded labels truncate or skip. ' + tickStepMinorDetails.count,
        offset: 'Counted in candidates, so under a `period` an offset of 1 skips the first period rather than the first category. ' + tickStepMinorDetails.offset,
        interval: tickStepMinorDetails.interval,
        minorSteps: tickStepMinorDetails.minorSteps,
        minSpacing: tickStepMinorDetails.minSpacing
      }
    },
    tickLabel: {
      description: minorTickLabelIntro,
      properties: {
        ...getTickLabelDetails(),
        truncation: { properties: { tooltipEnabled: 'When `true`, a truncated tick label carries an svg `<title>` holding the full text, which browsers show as their native tooltip (not the chart `tooltip`) while a mouse or pen rests on it. Touch has no hover, so nothing shows there; assistive tech already gets the full text through `aria-label`.' } },
        minorTruncation: { description: 'Truncating the minor labels never shortens the non-minor labels, whose truncation counts only their own ticks.' , properties: { tooltipEnabled: 'When `true`, a truncated minor tick label carries an svg `<title>` holding the full text, which browsers show as their native tooltip (not the chart `tooltip`) while a mouse or pen rests on it.' } }
      }
    },
    ticks: {
      description: 'Replaces the automatic tick generation entirely: tick counts, intervals and the tick skipping that keeps labels apart are ignored, so the configured ticks show even where they overlap, except that the entries marked `minor` follow the minor label fit rule. Useful for labeling only some of many categories, e.g. every Monday of a daily date axis, where the generated ticks would be truncated or skipped at arbitrary categories. Two entries naming the same category (compared the way a tick finds its category: by instant on a date axis, by key with a `keyProperty`, otherwise by value) are a validation error.',
      properties: {
        value: 'Takes the same forms as `min` on a linear axis: a number when `type` is `number`, and either a millisecond timestamp or an ISO date string when `type` is `date`; on a `string` axis it is the category string. On an ordinal axis the tick shows at the category whose value matches (a date matches by instant, so the ISO and timestamp forms both find a `Date` category), or with a `keyProperty` at the category whose key matches, since the key is what makes a repeated value unique; a tick matching no category is hidden. On a linear axis the tick is placed on the scale, and one outside the current axis domain is hidden.',
        minor: 'A minor entry is drawn with the `tickLabel`, `tickMark` and `gridLine` minor settings, and its label shows only when every minor label fits beside its neighbours; an entry with a `label` keeps it whatever `minorFormat` says.'
      }
    },
    thresholdStep: {
      description: 'The steps follow the scale: on an ordinal axis the categories, so `count: 2` stripes alternate categories, or under a `period` the first category of each period; on a linear date axis the period boundaries; on a linear number axis the multiples of `interval`; and with neither a period nor an interval a linear axis draws nothing. A linear scale counts its periods from a fixed calendar origin and its multiples from 0, so the same steps keep their shapes as the data moves the domain. The stepped thresholds draw after the `thresholds` entries and carry no title; on a linear axis `minSpacing` keeps a rule from flooding the axis.',
      properties: {
        minSpacing: thresholdStepMinSpacingDetails,
        pattern: thresholdStepPatternDetails,
        period: 'Weeks start on Monday and the boundaries follow `dateUTC`. On an ordinal axis the steps are the first category of each period, so `"week"` with `count: 2` draws a range over every other week whatever the holidays; on a linear date axis they are the period boundaries themselves.',
        count: stepCountOffsetDetails,
        offset: stepCountOffsetDetails,
        range: 'On an ordinal axis a range covers whole slots from its step to the category before the next candidate step; on a linear axis it spans from the step to the next one. A line sits at the step itself.'
      }
    },
    thresholds: {
      description: 'A line at a category or axis value, or with a `rangeValue` a range between two. ' + thresholdStyleDetails + ' ' + thresholdDomainDetails,
      properties: {
        ...getThresholdMemberDetails(),
        value: 'On a linear axis it takes the same forms as `min`: a number when `type` is `number`, and either a millisecond timestamp or an ISO date string when `type` is `date`. On an ordinal axis it names a category, matched the way explicit `ticks` are (a date by instant, so the ISO and timestamp forms both find a `Date` category; the category string on a `string` axis; the key when the axis has a `keyProperty`), and a line sits at the category\'s center. An entry naming no category is not drawn.',
        rangeValue: getThresholdMemberDetails().rangeValue + ' On an ordinal axis the range covers whole slots, from the outer edge of the lower positioned of the two named categories to the outer edge of the higher, so ranges over consecutive weeks tile without gaps; a range with either end naming a category the data does not hold is not drawn, since an ordinal axis has no position to clip it to.'
      }
    }
  };
}
