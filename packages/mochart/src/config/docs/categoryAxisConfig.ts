import getAxisDescriptions, { getTickLabelDescriptions, tickLabelDescription, getThresholdStepDescriptions, thresholdStepDescription } from './axisConfig';

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
        includeFirst: 'whether the first category always gets a tick, even when count and offset would skip it'
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
    tickStep: 'Chooses which ticks an axis shows by rule rather than by a list, so it keeps working as the data changes; explicit `ticks` take precedence over it. On an ordinal scale the candidates are the categories in order, or with a `period` on a date axis the first category of each period (a week starts on Monday; boundaries follow `dateUTC`), so a daily series with `period: "week"` gets a tick at each Monday whatever the holidays (a partial first week is a period of its own, so its first day gets one too; `offset: 1` skips it), and `count: 2` on top of that gives every second week. `count` and `offset` step through the candidates: `count: 5, offset: 3` shows the fourth category and every fifth after it. When more ticks survive the rule than fit, every k-th survivor is kept starting from the first, so thinned Mondays stay Mondays; `tickLabel.truncation` still decides whether crowded labels truncate or skip. On a linear date scale only `period` applies, placing the ticks at the period boundaries themselves; a linear number scale accepts only the defaults.',
    ticks: 'Replaces the automatic tick generation entirely: tick counts, intervals and the tick skipping that keeps labels from overlapping are ignored, so the configured ticks show even where they overlap. Each entry\'s `value` takes the same forms as `min` on a linear axis: a number when `type` is `number`, and either a millisecond timestamp or an ISO date string when `type` is `date`; on a `string` axis it is the category string. On an ordinal axis a tick shows at the category whose value matches (a date matches by instant, so the ISO and timestamp forms both find a `Date` category), or on an axis with a `keyProperty` at the category whose key matches, since a key is what makes a repeated value unique; a tick matching no category is hidden; on a linear axis it is placed on the scale, and a tick outside the current axis domain is hidden. Useful for labelling only some of many categories, e.g. every Monday of a daily date axis, where the generated ticks would be truncated or skipped at arbitrary categories.',
    thresholdStep: 'The steps follow the scale. On an ordinal axis they are the categories in order, or under a `period` on a date axis the first category of each one (weeks start on Monday, boundaries follow `dateUTC`), so `period: "week"` with `count: 2` bands every other week whatever the holidays, and no period with `count: 2` stripes alternate categories; a range covers whole slots from its candidate to the category before the next candidate. On a linear date axis the candidates are the period boundaries, a line sitting on the boundary and a range spanning to the next one; on a linear number axis they are the multiples of `interval`, anchored at 0, and with neither a period nor an interval a linear axis draws nothing. The stepped thresholds draw after the `thresholds` entries, carry no title, and a rule that would draw more than 500 shapes stops there.',
    thresholds: 'On a linear axis each entry\'s `value` (and `rangeValue`) takes the same forms as `min`: a number when `type` is `number`, and either a millisecond timestamp or an ISO date string when `type` is `date`. On an ordinal axis a value names a category, matched the way explicit `ticks` are (a date by instant, so the ISO and timestamp forms both find a `Date` category; the category string on a `string` axis; the key when the axis has a `keyProperty`): a line sits at the category\'s centre, and a range covers whole slots from the first named category\'s outer edge to the second\'s, so ranges over consecutive weeks tile without gaps. An entry naming no category is not drawn. A `rangeValue` turns an entry into a range: the band between the two values (in either order) is filled with the `style` fill members, or with the `pattern` or `gradient` named by id, and its two edges are drawn with the stroke members like lines (a stroke opacity of 0 leaves the fill alone); a line entry uses only the stroke members and ignores the fill members. Thresholds never extend the axis domain: a line outside it is not drawn, a range partly outside is clipped to it, and one wholly outside is not drawn. The title follows `side`: low or high of the whole range, or `inside` centred within it. A pattern\'s `"series"` colour keyword resolves to the range\'s `style.normal.fillColor`, the colour of whatever the pattern fills.'
  };
}
