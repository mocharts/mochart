import getAxisDescriptions, { getTickLabelDescriptions, tickLabelDescription } from './axisConfig';

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
    tickLabel: {
      description: tickLabelDescription,
      properties: {
        ...getTickLabelDescriptions(),
        format: 'the d3 format string (d3-format for number, d3-time-format for date) to be applied to the category values when displayed in axis tick labels (use null for none, use "auto" to derive from data)',
        truncationEnabled: 'whether or not to use text truncation (true) when the axis tick labels would overlap each other instead of skipping ticks (false)',
        truncationText: 'the truncation text to append to the axis tick label text when its content is truncated',
        truncationMinLength: 'the minimum length (in pixels) to allow tick label text perpendicular to the axis, applied when truncationMaxFraction would allow less',
        truncationMaxFraction: 'the maximum fraction (0 - 1) of the plot bounds to allow any tick label text to occupy when they are perpendicular to the axis'
      }
    }
  };
}
export function getDetails() {
  return {
    property: 'The chart reads this property from each entry of the data provider to get the category value: the values must match `type`, they position a linear axis, and they are what tick labels and the tooltip show. They must be unique unless `keyProperty` is set. It is required — the only category axis property without a default.',
    type: 'How category values are interpreted: `string` for labels, `number` for numeric values, and `date` for date values (`dateUTC` controls their timezone handling). The type drives parsing, tick label formatting, and which `scale` options make sense.',
    scale: '`ordinal` places the categories at evenly spaced positions in data order regardless of their values; `linear` positions `number`/`date` category values proportionally along the axis, so uneven spacing in the data shows as uneven spacing in the chart.',
    keyProperty: 'When set, this property’s values (strings or numbers, one per category) identify the categories instead of the category values themselves: they must be unique, and they are what animation, focus and filtering match categories by across data changes. Use it when the category values would otherwise repeat — a label keyed by an id, or a wall-clock date whose real instants repeat.',
    min: 'The form the bound takes follows `type` on a linear axis: a number when `type` is `number`, and either a millisecond timestamp or an ISO date string (`"2020-01-01"`) when `type` is `date` — the two forms `thresholds[].value` takes. An ordinal axis places its categories in data order, so it accepts only `"auto"`.',
    max: 'The form the bound takes follows `type` on a linear axis: a number when `type` is `number`, and either a millisecond timestamp or an ISO date string (`"2020-01-01"`) when `type` is `date` — the two forms `thresholds[].value` takes. An ordinal axis places its categories in data order, so it accepts only `"auto"`.',
    softMin: 'Takes the same forms as `min` — a number, or a timestamp or ISO date string on a date axis — but only applies while no category value falls below it, so real data still expands the domain. An ordinal axis accepts only `null`.',
    softMax: 'Takes the same forms as `max` — a number, or a timestamp or ISO date string on a date axis — but only applies while no category value rises above it, so real data still expands the domain. An ordinal axis accepts only `null`.',
    thresholds: 'An ordinal axis places its categories at evenly spaced positions rather than on a value scale, so there is no position to place a threshold at — it accepts only an empty array. On a linear axis each entry\'s `value` takes the same forms as `min`: a number when `type` is `number`, and either a millisecond timestamp or an ISO date string when `type` is `date`.'
  };
}
