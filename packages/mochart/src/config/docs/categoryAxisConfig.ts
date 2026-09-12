import getAxisDescriptions, { getTickLabelDescriptions, tickLabelDescription, getThresholdStepDescriptions, thresholdStepDescription, getThresholdMemberDetails, thresholdStyleDetails, thresholdDomainDetails } from './axisConfig';

export default function getDescriptions() {
  return {
    ...getAxisDescriptions(),
    property: 'the property to retrieve from the data provider for the category values',
    keyProperty: 'the property to retrieve from the data provider for the category keys, when the category values may repeat (use null for none)',
    type: 'the type of the category values (number, date, string)',
    scale: 'the scale to use for the category values (ordinal, linear)',
    dateUTC: 'whether dates should be treated as UTC (true) or local (false)',
    valueLabel: 'the label to show before a category value in the tooltip (use null for none)',
    valueFormat: 'the d3 format string (d3-format for number, d3-time-format for date) to be applied to the category value when displayed in the tooltip (use null for none, use "auto" to derive from data)',
    valuePrefix: 'the text to prefix category values with when showing them in the tooltip (use null for none)',
    valueSuffix: 'the text to append category values with when showing them in the tooltip (use null for none)',
    minCategoryValueExtent: 'the minimum extent (in pixels) of each category slot; for a non-inverted bar chart this is a minimum bar width',
    categoryPaddingFraction: {
      description: 'the padding fractions (0 - 1) of the category extent for all category values (outer) and grouped series (inner)',
      properties: {
        inner: 'the fraction (0 - 1) of a category value\'s extent to leave as space between the series drawn inside it',
        outer: 'the fraction (0 - 1) to trim from each category value\'s extent, leaving space between neighbouring category values'
      }
    },
    categoryCountPadding: 'the extra count to be added to the category value count when dividing the category extent for displaying category values',
    ticks: {
      description: 'the explicit ticks to show on the axis in place of the generated ones, each placing label text at a category value (use null for none)',
      properties: {
        value: 'the category to place the tick at, named by its value (the category string on a string axis, a number on a number axis, a millisecond timestamp or ISO date string on a date axis) or, on an ordinal axis with a keyProperty, by its key',
        label: 'the text of the tick label (leave it out to format the value with tickLabel.format)'
      }
    },
    thresholdStep: {
      description: thresholdStepDescription,
      properties: {
        ...getThresholdStepDescriptions(),
        period: 'the calendar period the thresholds step by on a date axis (day, week, month, year; use null for none)',
        interval: 'the axis value distance the thresholds step by on a linear number axis (use null for none)'
      }
    },
    tickStep: {
      description: 'the step between the ticks shown along the axis: every count-th category, or the first category of each period on a date axis',
      properties: {
        count: 'every count-th category gets a tick ("auto" keeps as many as fit without overlapping)',
        offset: 'the number of categories skipped before the first tick',
        period: 'the calendar period the ticks step by on a date axis (day, week, month, year; use null for none)',
        includeFirst: 'whether the first category always gets a tick, even when count and offset would skip it',
        minorFormat: 'the d3 format string (d3-format for number, d3-time-format for date) applied to the categories between the step\'s ticks on an ordinal axis, labelling them as minor ticks when the labels fit a category slot (use null for none)'
      }
    },
    tickLabel: {
      description: tickLabelDescription,
      properties: {
        ...getTickLabelDescriptions(),
        format: 'the d3 format string (d3-format for number, d3-time-format for date) to be applied to the category values when displayed in axis tick labels (use null for none, use "auto" to derive from data)',
        truncation: {
          description: 'the truncation applied to the axis tick labels when they would overlap each other',
          properties: {
            enabled: 'whether or not to use text truncation (true) when the axis tick labels would overlap each other instead of skipping ticks (false)',
            text: 'the truncation text to append when text is truncated',
            tooltipEnabled: 'whether truncated text shows its full string as the browser’s native tooltip while a pointer rests on it',
            minLength: 'the minimum length (in pixels) to allow tick label text perpendicular to the axis, applied when maxFraction would allow less',
            maxFraction: 'the maximum fraction (0 - 1) of the plot bounds to allow any tick label text to occupy when they are perpendicular to the axis'
          }
        }
      }
    }
  };
}
export function getDetails() {
  return {
    tickLabel: { properties: { truncation: { properties: { tooltipEnabled: 'When `true`, a truncated tick label carries an svg `<title>` holding the full text, which browsers show as their native tooltip (not the chart `tooltip`) while a mouse or pen rests on it. Touch has no hover, so nothing shows there; assistive tech already gets the full text through `aria-label`.' } } } },
    title: { properties: { truncation: { properties: { tooltipEnabled: 'When `true`, a truncated axis title carries an svg `<title>` holding the full text, which browsers show as their native tooltip (not the chart `tooltip`) while a mouse or pen rests on it. Touch has no hover, so nothing shows there; the axis group is already named from the full title.' } } } },
    property: 'The chart reads this property from each entry of the data provider to get the category value: the values must match `type`, they position a linear axis, and they are what tick labels and the tooltip show. They must be unique unless `keyProperty` is set. It is required — the only category axis property without a default.',
    type: 'How category values are interpreted: `string` for labels, `number` for numeric values, and `date` for date values (`dateUTC` controls their timezone handling). The type drives parsing, tick label formatting, and which `scale` options make sense.',
    scale: '`ordinal` places the categories at evenly spaced positions in data order regardless of their values; `linear` positions `number`/`date` category values proportionally along the axis, so uneven spacing in the data shows as uneven spacing in the chart.',
    keyProperty: 'When set, this property’s values (strings or numbers, one per category) identify the categories instead of the category values themselves: they must be unique, and they are what animation, focus and filtering match categories by across data changes. Use it when the category values would otherwise repeat — a label keyed by an id, or a wall-clock date whose real instants repeat.',
    min: 'The form the bound takes follows `type` on a linear axis: a number when `type` is `number`, and either a millisecond timestamp or an ISO date string (`"2020-01-01"`) when `type` is `date` — the two forms `thresholds[].value` takes. An ordinal axis places its categories in data order, so it accepts only `"auto"`.',
    max: 'The form the bound takes follows `type` on a linear axis: a number when `type` is `number`, and either a millisecond timestamp or an ISO date string (`"2020-01-01"`) when `type` is `date` — the two forms `thresholds[].value` takes. An ordinal axis places its categories in data order, so it accepts only `"auto"`.',
    softMin: 'Takes the same forms as `min` — a number, or a timestamp or ISO date string on a date axis — but only applies while no category value falls below it, so real data still expands the domain. An ordinal axis accepts only `null`.',
    softMax: 'Takes the same forms as `max` — a number, or a timestamp or ISO date string on a date axis — but only applies while no category value rises above it, so real data still expands the domain. An ordinal axis accepts only `null`.',
    tickStep: {
      description: 'Chooses the ticks by rule rather than by a list, so the choice holds as the data changes; explicit `ticks` take precedence. The candidates are the categories in order, or under a `period` the first category of each period, and `count` and `offset` step through them. On a linear date scale only `period` applies, placing the ticks at the period boundaries themselves; a linear number scale accepts only the defaults.',
      properties: {
        period: 'A week starts on Monday and the boundaries follow `dateUTC`, so a daily series with `"week"` gets a tick at each week\'s first trading day whatever the holidays. A partial first week is a period of its own, so its first category gets a tick too; `offset: 1` skips it.',
        count: 'Counts through the candidates, the categories or the period starts: `count: 5, offset: 3` shows the fourth category and every fifth after it, and `period: "week"` with `count: 2` gives every second week. When more ticks survive the rule than fit, every k-th survivor is kept starting from the first, so thinned Mondays stay Mondays; `tickLabel.truncation` still decides whether crowded labels truncate or skip.',
        offset: 'Counted in candidates, so under a `period` an offset of 1 skips the first period rather than the first category.',
        minorFormat: 'The categories between the rule\'s ticks are minor ticks, and their tick marks, grid lines and labels carry the `mochart-axis-minor-tick-mark`, `mochart-axis-minor-grid-line` and `mochart-axis-minor-tick-label` classes whether or not they are labelled. With a format (a d3 time format on a date axis, a number format on a number axis; a string axis takes only `null`) they are labelled in it while the rule\'s own ticks keep `tickLabel.format`, so a weekly rule can show `Jun 08` at each Monday and `Tue` to `Fri` between. The minor labels show only when the widest of them, plus `minTickSpacing`, fits inside one category slot; when they do not fit they all hide together, and whether they show never changes which of the rule\'s ticks are shown.'
      }
    },
    ticks: {
      description: 'Replaces the automatic tick generation entirely: tick counts, intervals and the tick skipping that keeps labels apart are ignored, so the configured ticks show even where they overlap. Useful for labelling only some of many categories, e.g. every Monday of a daily date axis, where the generated ticks would be truncated or skipped at arbitrary categories.',
      properties: {
        value: 'Takes the same forms as `min` on a linear axis: a number when `type` is `number`, and either a millisecond timestamp or an ISO date string when `type` is `date`; on a `string` axis it is the category string. On an ordinal axis the tick shows at the category whose value matches (a date matches by instant, so the ISO and timestamp forms both find a `Date` category), or with a `keyProperty` at the category whose key matches, since the key is what makes a repeated value unique; a tick matching no category is hidden. On a linear axis the tick is placed on the scale, and one outside the current axis domain is hidden.'
      }
    },
    thresholdStep: {
      description: 'The steps follow the scale: the categories or period starts on an ordinal axis, the period boundaries on a linear date axis, the multiples of `interval` on a linear number axis, and with neither a period nor an interval a linear axis draws nothing. The stepped thresholds draw after the `thresholds` entries, carry no title, and a rule that would draw more than 500 shapes stops there.',
      properties: {
        period: 'Weeks start on Monday and the boundaries follow `dateUTC`. On an ordinal axis the steps are the first category of each period, so `"week"` with `count: 2` bands every other week whatever the holidays; on a linear date axis they are the period boundaries themselves.',
        count: 'With no period every category of an ordinal axis is a step, so `count: 2` stripes alternate categories.',
        range: 'On an ordinal axis a range covers whole slots from its step to the category before the next step; on a linear axis it spans from the step to the next one. A line sits at the step itself.'
      }
    },
    thresholds: {
      description: 'A line at a category or axis value, or with a `rangeValue` a band between two. ' + thresholdStyleDetails + ' ' + thresholdDomainDetails,
      properties: {
        ...getThresholdMemberDetails(),
        value: 'On a linear axis it takes the same forms as `min`: a number when `type` is `number`, and either a millisecond timestamp or an ISO date string when `type` is `date`. On an ordinal axis it names a category, matched the way explicit `ticks` are (a date by instant, so the ISO and timestamp forms both find a `Date` category; the category string on a `string` axis; the key when the axis has a `keyProperty`), and a line sits at the category\'s centre. An entry naming no category is not drawn.',
        rangeValue: getThresholdMemberDetails().rangeValue + ' On an ordinal axis the band covers whole slots from the first named category\'s outer edge to the second\'s, so ranges over consecutive weeks tile without gaps.'
      }
    }
  };
}
