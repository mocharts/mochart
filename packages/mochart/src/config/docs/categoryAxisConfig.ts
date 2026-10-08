import getAxisDescriptions, { getTickLabelDescriptions, getTickLabelDetails, getMinorTickLabelDescriptions, getMinorTickLabelDetails, tickLabelDescription, minorTickLabelDescription, minorTickLabelIntro, majorNote, getTickStepDescriptions, tickStepDescription, tickStepMinorDetails, stepCountOffsetDetails, getThresholdStepDescriptions, thresholdStepDescription, getThresholdDescriptions, thresholdsDescription, getThresholdMemberDetails, thresholdStyleDetails, thresholdDomainDetails, thresholdStepMinSpacingDetails, thresholdStepPatternDetails, thresholdLogDetails } from './axisConfig.js';

export default function getDescriptions() {
  return {
    ...getAxisDescriptions(),
    property: 'the property to retrieve from the data provider for the category values',
    keyProperty: 'the property to retrieve from the data provider for the category keys, when the category values may repeat (use null for none)',
    type: 'the type of the category values (number, date, string)',
    scale: 'the scale to use for the category values: ordinal for any type, linear for number and date values, log for number values',
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
    categoryCountPadding: 'the extra slot count added to the number of category slots when dividing the category extent among them (one slot per category on an ordinal axis, one per categoryValueInterval on a linear or log axis)',
    categoryValueInterval: 'the axis value distance one category slot covers on a linear scale: a number in axis values, or on a date axis a millisecond count or one of second, minute, hour, day, week (use "auto" for the smallest gap between neighbouring categories, which on a log axis, where only "auto" is accepted, is the smallest ratio between them)',
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
        interval: 'the distance the thresholds step by: a number, in axis values on a linear number axis or in milliseconds on a linear date axis, or a calendar period (second, minute, hour, day, week, month, year) on a date axis (use null for none, as a log axis must)'
      }
    },
    thresholds: {
      description: thresholdsDescription,
      properties: {
        ...getThresholdDescriptions(),
        value: 'the axis value the threshold sits at: on an ordinal axis a category (or its key, with a keyProperty), on a linear or log axis a number, or a millisecond timestamp or ISO date string when type is date'
      }
    },
    tickStep: {
      description: tickStepDescription,
      properties: {
        ...getTickStepDescriptions(),
        interval: 'the distance between the ticks: a number, in axis values on a linear number axis or in milliseconds on a linear date axis, or a calendar period (second, minute, hour, day, week, month, year) on a date axis (use null to keep the ticks the axis picks, as a log axis must)',
        minorInterval: 'the distance between the minor ticks placed between the ticks on a linear date axis, in the form interval takes: a number of milliseconds smaller than a number interval, or a calendar period (second, minute, hour, day, week, month, year) shorter than a period interval (use null for none)',
        includeFirst: 'whether the first category always gets a tick, even when count and offset would skip it (ordinal scale only; a linear or log axis accepts only false)'
      }
    },
    tickLabel: {
      description: tickLabelDescription,
      properties: {
        ...getTickLabelDescriptions(),
        format: 'the d3 format string (d3-format for number, d3-time-format for date) to be applied to the category values when displayed in axis tick labels (use null for none, use "auto" to derive the format from the ticks: on a number axis an SI-prefixed number whose precision follows the tick spacing, or on a log axis the magnitude of each tick, in exponent form beyond the SI prefixes; there a format that leaves its precision open takes 3 significant digits, trimmed)',
        truncation: {
          description: 'the truncation applied to the axis tick labels when they would overlap each other',
          properties: {
            enabled: 'whether or not to use text truncation (true) when the axis tick labels would overlap each other instead of skipping ticks (false)',
            text: 'the truncation text to append when text is truncated',
            tooltipEnabled: 'whether truncated text shows its full string as the browser\'s native tooltip while a pointer rests on it',
            minLength: 'the minimum length (in pixels) to allow tick label text perpendicular to the axis, applied when maxFraction would allow less',
            maxFraction: 'the maximum fraction (0 - 1) of the plot bounds to allow any tick label text to occupy when they are perpendicular to the axis'
          }
        }
      }
    },
    minorTickLabel: {
      description: minorTickLabelDescription,
      properties: {
        ...getMinorTickLabelDescriptions(),
        format: 'the d3 format string (d3-format for number, d3-time-format for date) to be applied to the category values when displayed in minor tick labels (use null for none, use "auto" to derive from data)' + majorNote('tickLabel.format'),
        truncation: {
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
    scale: '`ordinal` places the categories at evenly spaced positions in data order regardless of their values; `linear` positions `number`/`date` category values proportionally along the axis, so uneven spacing in the data shows as uneven spacing in the chart; `log` positions `number` category values by ratio, so 1 to 10 takes the same length as 100 to 1000, for log-log plots such as a frequency response. A log axis has no position for 0 or a negative value, so category values at or below 0 are a data error; it rejects bar series, whose widths are a fixed distance in values, and takes no offsets, `minTickInterval` or step interval for the same reason. Its ticks sit at the powers of 10 and, where they fit, their 2 and 5 or 2 to 9 multiples, with the rest as minor ticks. A date axis cannot be log, since a date has no natural zero; elapsed time on a log axis is a number, such as days since an event. A pie chart\'s category axis accepts `"ordinal"` or `"linear"`, not `"log"`.',
    keyProperty: 'When set, this property\'s values (strings or numbers, one per category) identify the categories instead of the category values themselves: they must be unique, and they are what animation, focus and filtering match categories by across data changes. Use it when the category values would otherwise repeat, such as a label keyed by an id, or a wall-clock date whose real instants repeat.',
    categoryValueInterval: 'The slot decides how much room a category takes: a bar spans one slot less the outer padding fraction, grouped series share one slot, and `categoryCountPadding` adds slots to the divided extent. With `"auto"` the slot is the smallest gap between neighbouring category values, so evenly spaced data fills the axis the way an ordinal axis does and a missing category shows as an empty slot; with one category the slot is the whole domain. Set it when the data spacing is not the slot you want: `"day"` keeps daily bars a day wide when one day carries two samples, and a value smaller than the spacing draws narrower bars with space between them. A value wider than the spacing overlaps the bars. An ordinal axis has one category per slot, so there it must stay `"auto"`. A log axis must stay `"auto"` too: its slot is the smallest ratio between neighbouring category values, so values a fixed ratio apart (1, 10, 100, or frequencies an octave apart) keep half a slot at each end of the axis, as evenly spaced values do on a linear axis.',
    min: 'The form the bound takes follows `type` on a linear axis: a number when `type` is `number`, and either a millisecond timestamp or an ISO date string (`"2020-01-01"`) when `type` is `date` (the two forms `thresholds[].value` takes). On a log axis it is a number above 0. An ordinal axis places its categories in data order, so it accepts only `"auto"`.',
    max: 'The form the bound takes follows `type` on a linear axis: a number when `type` is `number`, and either a millisecond timestamp or an ISO date string (`"2020-01-01"`) when `type` is `date` (the two forms `thresholds[].value` takes). On a log axis it is a number above 0. An ordinal axis places its categories in data order, so it accepts only `"auto"`.',
    softMin: 'Takes the same forms as `min` (a number, above 0 on a log axis, or a timestamp or ISO date string on a date axis) but only applies while no category value falls below it, so real data still expands the domain. An ordinal axis accepts only `null`.',
    softMax: 'Takes the same forms as `max` (a number, above 0 on a log axis, or a timestamp or ISO date string on a date axis) but only applies while no category value rises above it, so real data still expands the domain. An ordinal axis accepts only `null`.',
    tickStep: {
      description: 'Chooses the ticks by rule rather than by a list, so the choice holds as the data changes; explicit `ticks` take precedence. On an ordinal axis the candidates are the categories in order, or with a period as the `interval` the first category of each period, `count` and `offset` step through them, and the categories between the ticks are minor ticks. On a linear axis `interval` places the ticks at the multiples of a number, in axis values on a number axis and in milliseconds on a date axis, or on the boundaries of a period on a date axis; `count` and `offset` keep every count-th of them counted from a fixed starting point, and `minorInterval` (date axis) or `minorSteps` (number axis) places minor ticks between them; without an interval the axis keeps the ticks it picks. A log axis takes no interval, since equal distances in values take unequal lengths there, so it always keeps the ticks it picks. The minor tick marks, grid lines and labels carry the `mochart-axis-minor-tick-mark`, `mochart-axis-minor-grid-line` and `mochart-axis-minor-tick-label` classes, and `minorTickLabel`, `minorTickMark` and `minorGridLine` say how they are drawn.',
      properties: {
        interval: 'A number places a tick at every multiple of it inside the axis domain, so the ticks stay put as the data moves the domain. On a number axis the number is in axis values and the multiples are counted from 0. On a linear date axis it is in milliseconds and the multiples are counted from the epoch, 1 January 1970 00:00 UTC, or from local midnight of that day when `dateUTC` is false, so `12 * 60 * 60 * 1000` places a tick at every midnight and noon. The multiples keep a fixed length, so with `dateUTC` false a daylight saving change moves them an hour against the local clock, which a period does not. Setting it never changes the automatic min and max of the axis, it only chooses where the ticks go. On a number axis a `tickLabel.format` without a precision of its own, `"auto"` included, names the ticks exactly: the precision follows the spacing of the ticks drawn, so an interval of 0.25 reads 0.25 and a `minorSteps` of 4 on an interval of 1 reads 0.25 too. When more ticks survive than fit, every k-th survivor is kept from the first, and a tick thinned away stays a hidden tick: its minor ticks are kept, and it never becomes one. A period steps by the calendar: a week starts on Monday and the boundaries follow `dateUTC`, so a daily series with `"week"` gets a tick at each week\'s first trading day whatever the holidays. A partial first week is a period of its own, so its first category gets a tick too; `offset: 1` skips it. On a linear date axis the ticks sit on the period boundaries themselves. An ordinal date axis takes only a period, since its ticks are categories rather than positions a number of milliseconds could step through.',
        minorInterval: 'Takes the form `interval` takes, so mixing a number and a period is a validation error. With a period `interval` it must be a shorter period: a week inside a month, a day inside a week, or an hour inside a day. With a number `interval` it must be a smaller number of milliseconds, counted from the same origin as the ticks, and need not divide `interval` evenly: `{ interval: 6 * 60 * 60 * 1000, minorInterval: 60 * 60 * 1000 }` gives a minor tick every hour between ticks six hours apart. A minor tick on a tick the step keeps is dropped, and one closer to a tick than `minorInterval` is hidden with its tick mark and grid line: a tick inside a minor period hides the minor ticks at both ends of that period, such as the Mondays either side of the 1st of a month, and a tick on a minor boundary hides none.',
        count: 'Counts through the candidates, the categories or the period starts: `count: 5, offset: 3` shows the fourth category and every fifth after it, and `interval: "week"` with `count: 2` gives every second week. When more ticks survive the rule than fit, every k-th survivor is kept starting from the first, so thinned Mondays stay Mondays; `tickLabel.truncation` still decides whether crowded labels truncate or skip. ' + tickStepMinorDetails.count,
        offset: 'Counted in candidates, so with a period as the `interval` an offset of 1 skips the first period rather than the first category. ' + tickStepMinorDetails.offset,
        minorSteps: tickStepMinorDetails.minorSteps,
        minSpacing: tickStepMinorDetails.minSpacing
      }
    },
    tickLabel: {
      properties: {
        ...getTickLabelDetails(),
        truncation: { properties: { tooltipEnabled: 'When `true`, a truncated tick label carries an svg `<title>` holding the full text, which browsers show as their native tooltip (not the chart `tooltip`) while a mouse or pen rests on it. Touch has no hover, so nothing shows there; assistive tech already gets the full text through `aria-label`.' } }
      }
    },
    minorTickLabel: {
      description: minorTickLabelIntro,
      properties: {
        ...getMinorTickLabelDetails(),
        truncation: { description: 'Truncating the minor labels never shortens the non-minor labels, whose truncation counts only their own ticks.', properties: { tooltipEnabled: 'When `true`, a truncated minor tick label carries an svg `<title>` holding the full text, which browsers show as their native tooltip (not the chart `tooltip`) while a mouse or pen rests on it.' } }
      }
    },
    ticks: {
      description: 'Replaces the automatic tick generation entirely: tick counts, intervals and the tick skipping that keeps labels apart are ignored, so the configured ticks show even where they overlap, except that the entries marked `minor` follow the minor label fit rule. Useful for naming chosen categories with label text of their own; for a regular pattern such as one tick a week, use `tickStep`. Two entries naming the same category (compared the way a tick finds its category: by instant on a date axis, by key with a `keyProperty`, otherwise by value) are a validation error.',
      properties: {
        value: 'Takes the same forms as `min` on a linear or log axis: a number when `type` is `number`, and either a millisecond timestamp or an ISO date string when `type` is `date`; on a `string` axis it is the category string. On an ordinal axis the tick shows at the category whose value matches (a date matches by instant, so the ISO and timestamp forms both find a `Date` category), or with a `keyProperty` at the category whose key matches, since the key is what makes a repeated value unique; a tick matching no category is hidden. On a linear or log axis the tick is placed on the scale, and one outside the current axis domain is hidden.',
        minor: 'A minor entry is drawn with the `minorTickLabel`, `minorTickMark` and `minorGridLine` settings, and its label shows only when every minor label fits beside its neighbours; an entry with a `label` keeps it whatever `minorTickLabel.format` says.'
      }
    },
    thresholdStep: {
      description: 'The steps follow the scale and `interval`: on an ordinal axis the categories, so `count: 2` stripes alternate categories, or with a period as the `interval` the first category of each period; on a linear date axis the boundaries of a period `interval` or the multiples of a number `interval` in milliseconds; on a linear number axis the multiples of the `interval` number; and on a linear axis with no interval, or a log axis, which never takes one, nothing is drawn. A linear scale counts its periods from a fixed calendar origin and its multiples from 0, or on a date axis from the epoch (local midnight of the epoch day when `dateUTC` is false), so the same steps keep their shapes as the data moves the domain. The stepped thresholds draw after the `thresholds` entries and carry no title; on a linear axis `minSpacing` keeps a rule from flooding the axis.',
      properties: {
        minSpacing: thresholdStepMinSpacingDetails,
        pattern: thresholdStepPatternDetails,
        interval: 'A number steps by its multiples: in axis values counted from 0 on a number axis, and in milliseconds counted from the epoch on a linear date axis, or from local midnight of the epoch day when `dateUTC` is false, so `90 * 60 * 1000` with `count: 2` draws a range over every other 90 minutes. The multiples keep a fixed length, so with `dateUTC` false a daylight saving change moves them an hour against the local clock, which a period does not. A period steps by the calendar: weeks start on Monday and the boundaries follow `dateUTC`. On an ordinal axis the steps are the first category of each period, so `"week"` with `count: 2` draws a range over every other week whatever the holidays; on a linear date axis they are the period boundaries themselves. An ordinal date axis takes only a period.',
        count: stepCountOffsetDetails,
        offset: stepCountOffsetDetails,
        range: 'On an ordinal axis a range covers whole slots from its step to the category before the next candidate step; on a linear axis it spans from the step to the next one. A line sits at the step itself.'
      }
    },
    thresholds: {
      description: 'A line at a category or axis value, or with a `rangeValue` a range between two. ' + thresholdStyleDetails + ' ' + thresholdDomainDetails + ' ' + thresholdLogDetails,
      properties: {
        ...getThresholdMemberDetails(),
        value: 'On a linear or log axis it takes the same forms as `min`: a number when `type` is `number`, and either a millisecond timestamp or an ISO date string when `type` is `date`. On an ordinal axis it names a category, matched the way explicit `ticks` are (a date by instant, so the ISO and timestamp forms both find a `Date` category; the category string on a `string` axis; the key when the axis has a `keyProperty`), and a line sits at the category\'s center. An entry naming no category is not drawn.',
        rangeValue: getThresholdMemberDetails().rangeValue + ' On an ordinal axis the range covers whole slots, from the outer edge of the lower positioned of the two named categories to the outer edge of the higher, so ranges over consecutive weeks tile without gaps; a range with either end naming a category the data does not hold is not drawn, since an ordinal axis has no position to clip it to.'
      }
    }
  };
}
