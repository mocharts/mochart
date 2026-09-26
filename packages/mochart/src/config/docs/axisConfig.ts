import { style, spacing, font, styleStateDescriptions, styleDescriptions, fontDescriptions } from './shared.js';
import type { DescriptionMap, NestedDescription } from './shared.js';

const strokeMembers = ['strokeColor', 'strokeOpacity', 'strokeWidth', 'strokeDashArray'];
const lineMembers = ['strokeColor', 'strokeOpacity', 'strokeWidth', 'strokeDashArray'];
const fillLineMembers = [...lineMembers, 'fillColor', 'fillOpacity'];

const sameNote = ', or "same" to use the color of the normal state';
const sameValueNote = ', or "same" to use the value of the normal state';
const sameMembers = new Set(['strokeColor', 'fillColor', 'strokeOpacity', 'fillOpacity', 'strokeWidth', 'strokeDashArray']);

function styleMembers(members: string[], allowSame: boolean): DescriptionMap {
  const descriptions: DescriptionMap = {};
  for (const member of members) {
    const description = styleStateDescriptions[member] as string;
    descriptions[member] = allowSame && sameMembers.has(member)
      ? description + (member.endsWith('Color') ? sameNote : sameValueNote)
      : description;
  }
  return descriptions;
}

function partialStyle(description: string, members: string[]): NestedDescription {
  return { description, properties: styleMembers(members, false) };
}

/** What "major" means in a minor tick setting, named after the non-minor setting it takes its value from. */
export function majorNote(majorPath: string): string {
  return ' ("major" uses the value of ' + majorPath + ')';
}

// The members of a minor tick style, each also taking "major" for the matching non-minor member
function minorStyleMembers(members: string[], allowSame: boolean, majorPath: string): DescriptionMap {
  const descriptions = styleMembers(members, allowSame);
  for (const member of members) {
    descriptions[member] = descriptions[member] + majorNote(majorPath + '.' + member);
  }
  return descriptions;
}

function minorStyleStates(description: string, members: string[], majorPath: string): NestedDescription {
  return {
    description,
    properties: {
      normal: { description: description + ', while the axis is neither focused nor defocused', properties: minorStyleMembers(members, false, majorPath + '.normal') },
      focused: { description: description + ', while the axis is focused', properties: minorStyleMembers(members, true, majorPath + '.focused') },
      defocused: { description: description + ', while the axis is defocused', properties: minorStyleMembers(members, true, majorPath + '.defocused') }
    }
  };
}

function minorStyle(description: string, majorPath: string): NestedDescription {
  const properties: DescriptionMap = {};
  for (const member of Object.keys(styleDescriptions)) {
    properties[member] = styleDescriptions[member] + majorNote(majorPath + '.' + member);
  }
  return { description, properties };
}

function minorFont(description: string, majorPath: string): NestedDescription {
  const properties: DescriptionMap = {};
  for (const member of Object.keys(fontDescriptions)) {
    properties[member] = fontDescriptions[member] + majorNote(majorPath + '.' + member);
  }
  return { description, properties };
}

function styleStates(description: string, members: string[]): NestedDescription {
  return {
    description,
    properties: {
      normal: { description: description + ', while the axis is neither focused nor defocused', properties: styleMembers(members, false) },
      focused: { description: description + ', while the axis is focused', properties: styleMembers(members, true) },
      defocused: { description: description + ', while the axis is defocused', properties: styleMembers(members, true) }
    }
  };
}

/** The tick label members shared by both axes; each axis adds its own (format, truncation, filtering). */
export function getTickLabelDescriptions(): DescriptionMap {
  return {
    visible: 'whether to show the axis tick labels (false hides the minor tick labels too)',
    front: 'whether the axis tick labels should be shown in front (true) or behind (false) the series shapes',
    backgroundStyle: style('the styles to apply to the axis tick label background (strokeColor, strokeOpacity, strokeWidth, fillColor, fillOpacity (use null for none))'),
    size: 'the space (in pixels) perpendicular to the axis direction to allocate for the tick labels (use "auto" to derive from the font size)',
    marginInner: 'the margin (in pixels) to show between the tick labels and the inside of the axis',
    marginOuter: 'the margin (in pixels) to show between the tick labels and the outside of the axis',
    paddingInner: 'the padding (in pixels) to show between the tick labels and the inside of the axis',
    paddingOuter: 'the padding (in pixels) to show between the tick labels and the outside of the axis',
    prefix: 'the string to prefix to the text of each axis tick label (use null or an empty string for none)',
    suffix: 'the string to append to the text of each axis tick label (use null or an empty string for none)',
    rotation: 'the rotation (in degrees, -90 to 90) to apply to each axis tick label',
    anchor: 'the anchor to use for all axis tick labels (start, end, middle) (use "auto" to determine automatically)',
    textStyle: styleStates('the style of the axis tick label text', ['strokeColor', 'strokeOpacity', 'strokeWidth', 'strokeDashArray', 'fillColor', 'fillOpacity']),
    font: font('the font of the axis tick label text (family, size, weight, style), each member falling back to chart.font when null'),
    minorVisible: 'whether to show the minor tick labels, the labels of the minor ticks a tickStep places between its ticks and of the ticks entries marked minor' + majorNote('tickLabel.visible'),
    minorFront: 'whether the minor tick labels should be shown in front (true) or behind (false) the series shapes' + majorNote('tickLabel.front'),
    minorBackgroundStyle: minorStyle('the styles to apply to the minor tick label background (strokeColor, strokeOpacity, strokeWidth, fillColor, fillOpacity (use null for none))', 'tickLabel.backgroundStyle'),
    minorSize: 'the space (in pixels) perpendicular to the axis direction to allocate for the minor tick labels (use "auto" to derive from the font size)' + majorNote('tickLabel.size'),
    minorMarginInner: 'the margin (in pixels) to show between the minor tick labels and the inside of the axis' + majorNote('tickLabel.marginInner'),
    minorMarginOuter: 'the margin (in pixels) to show between the minor tick labels and the outside of the axis' + majorNote('tickLabel.marginOuter'),
    minorPaddingInner: 'the padding (in pixels) to show between the minor tick labels and the inside of the axis' + majorNote('tickLabel.paddingInner'),
    minorPaddingOuter: 'the padding (in pixels) to show between the minor tick labels and the outside of the axis' + majorNote('tickLabel.paddingOuter'),
    minorPrefix: 'the string to prefix to the text of each minor tick label (use null or an empty string for none)',
    minorSuffix: 'the string to append to the text of each minor tick label (use null or an empty string for none)',
    minorRotation: 'the rotation (in degrees, -90 to 90) to apply to each minor tick label' + majorNote('tickLabel.rotation'),
    minorAnchor: 'the anchor to use for all minor tick labels (start, end, middle) (use "auto" to determine automatically)' + majorNote('tickLabel.anchor'),
    minorTextStyle: minorStyleStates('the style of the minor tick label text', ['strokeColor', 'strokeOpacity', 'strokeWidth', 'strokeDashArray', 'fillColor', 'fillOpacity'], 'tickLabel.textStyle'),
    minorFont: minorFont('the font of the minor tick label text (family, size, weight, style), each member taking the matching tickLabel.font member when "major" and falling back to chart.font when null', 'tickLabel.font')
  };
}

export const tickLabelDescription = 'the labels shown at each tick along the axis';

export const minorTickLabelIntro = 'A minor tick is one a `tickStep` places between its own ticks (the categories between an ordinal step\'s ticks, the `minorSteps` or `minorPeriod` ticks of a linear step) or a `ticks` entry marked `minor`. Every tick label setting has a minor version named "minor" followed by the setting name. Each defaults to `"major"`, which uses the value of the matching non-minor setting, except `minorPrefix` and `minorSuffix`, which default to null and take no `"major"`, and the `text` of the category axis `minorTruncation`, which is always a string of its own.';

/** The tick label details shared by both axes: what a minor tick is, how its labels fit, and the font size note. */
export function getTickLabelDetails(): DescriptionMap {
  return {
    visible: 'A label hidden here is not drawn and takes no room in the layout, and its ticks are no longer thinned to make the labels fit: under a `tickStep` rule the tick marks and grid lines are limited only by `tickStep.minSpacing`, and without one the axis still picks its tick count from `tickCount`, `maxTickCount`, `minTickSpacing` and `minTickInterval`. To keep hidden labels in the layout, leave them visible and set the opacities of every state of `textStyle` to 0 instead.',
    minorVisible: 'The default is `false` while `minorFormat` is `"major"` and `ticks` is unset, so a `tickStep` alone labels only its own ticks; setting a `minorFormat` or listing `ticks` turns it to `"major"`. Minor labels never change which non-minor labels show. A minor label shows only when every minor label fits beside its neighbours, minor or not, measured from the widest minor and non-minor labels plus `minTickSpacing`; when one does not fit they all hide, unless the category axis `minorTruncation` truncates them instead. Minor labels that do not fit hide their tick marks and grid lines with them; `false` here hides only the labels and takes them out of the layout, and `visible: false` hides the minor labels whatever this says.',
    minorFormat: '`"major"` is replaced with the value of `format` before any formatter is built, so it never reaches d3.',
    minorSize: 'The minor labels have a layout of their own: they are measured and placed from the minor settings, the axis reserves the larger of the two label totals (size, margins and paddings), the title sits after the larger one, and the minor labels get their own background box.',
    minorFont: { properties: { size: 'A relative size such as `"0.85em"` resolves against the font size the label inherits from the host page, as every font size in mochart does, not against `tickLabel.font.size` or `chart.font.size`: with `tickLabel.font.size` 16 on a page with a 12px font, `"0.85em"` gives minor labels 10.2px, not 13.6px.' } }
  };
}

export const thresholdsDescription = 'the thresholds to draw across the plot: a line at an axis value, or a range between two';

/** The thresholds entry members both axes share; the category axis adds the value forms its scale takes. */
export function getThresholdDescriptions(): DescriptionMap {
  return {
    value: 'the axis value the threshold sits at',
    rangeValue: 'the second value of a threshold range (use null for a line)',
    front: 'whether the threshold is drawn in front of (true) or behind (false) the series shapes',
    style: styleStates('the style of the threshold: the stroke members draw a line or the edges of a range, the fill members fill a range and are ignored on a line', fillLineMembers),
    pattern: 'the unique id of the pattern config filling a threshold range (use null for none; an unknown id is a validation error; cannot be combined with gradient)',
    gradient: 'the unique id of the gradient config filling a threshold range (use null for none; an unknown id is a validation error; cannot be combined with pattern)',
    title: {
      description: 'the title label shown beside the threshold',
      properties: {
        text: 'the title text shown beside the threshold (use null or an empty string for none)',
        side: 'the value side of the threshold the title sits on ("low", "high", or "inside" a range)',
        align: 'where the title sits along the threshold ("start", "middle", "end", or "auto" for the axis side)',
        snapToValue: 'whether the title flips to the other side of the threshold when its own side has no room, instead of being clamped inside the plot over it',
        margin: spacing('the margin (in pixels) of the threshold title, relative to its orientation'),
        padding: spacing('the padding (in pixels) of the threshold title, relative to its orientation'),
        textStyle: styleStates('the style of the threshold title text', ['strokeColor', 'strokeOpacity', 'strokeWidth', 'strokeDashArray', 'fillColor', 'fillOpacity']),
        font: font('the font of the threshold title text (family, size, weight, style), each member falling back to chart.font when null'),
        backgroundStyle: style('the styles to apply to the threshold title background')
      }
    }
  };
}

export const thresholdStepDescription = 'threshold lines or ranges repeated along the axis by rule';

export const tickStepDescription = 'the step between the ticks shown along the axis, with minor ticks between them';

export const stepCountDescription = 'every count-th step is kept (2 keeps every other one)';

/** The tickStep members both axes share; the category axis adds the members that place its steps on its scales. */
export function getTickStepDescriptions(): DescriptionMap {
  return {
    interval: 'the axis value distance between the ticks on a linear number scale (use null to keep the ticks the axis picks)',
    count: stepCountDescription + ' ("auto" keeps as many as fit without overlapping)',
    offset: 'the number of steps skipped before the first tick; on a linear scale it shifts which multiples or periods are kept, counted from 0 or the calendar origin',
    minorSteps: 'the number of even steps (at least 2) each interval is split into on a linear number scale, with a minor tick at each step between the ticks (use null for none)',
    minSpacing: 'the least distance (in pixels, at least 2) to allow between the ticks the step creates on a linear axis; minor ticks that would be closer are not created, and ticks that would be closer leave the axis to the ticks it picks (an ordinal axis accepts only 2)'
  };
}

/** The value axis versions of the count and offset details, naming only the interval since the axis has no period. */
export const valueTickStepDetails = {
  count: 'A number means the same in `tickStep` and `thresholdStep`: every count-th step. It needs an `interval` to count, and is counted from 0, so setting it without one is a validation error.',
  offset: 'It needs an `interval` to count, so setting it without one is a validation error, and it shifts which count-th multiple is kept, so setting it while `count` is `"auto"` (every multiple kept) is one too.'
};

export const tickStepMinorDetails = {
  interval: 'Places a tick at every multiple of the interval inside the axis domain, counted from 0, so the ticks stay put as the data moves the domain. Setting it never changes the automatic min and max of the axis, it only chooses where the ticks go. A `tickLabel.format` without a precision of its own, `"auto"` included, names the ticks exactly: the precision follows the spacing of the ticks drawn, so an interval of 0.25 reads 0.25 and a `minorSteps` of 4 on an interval of 1 reads 0.25 too. When more ticks survive than fit, every k-th survivor is kept from the first, and a tick thinned away stays a hidden tick: its minor ticks are kept, and it never becomes one.',
  count: 'A number means the same in `tickStep` and `thresholdStep`: every count-th step. On a linear axis it needs a `period` or `interval` to count, and is counted from a fixed starting point, so setting it without one is a validation error.',
  offset: 'On a linear axis it needs a `period` or `interval` to count, so setting it without one is a validation error, and it shifts which count-th step is kept, so setting it while `count` is `"auto"` (every step kept) is one too.',
  minorSteps: 'Splits `interval` itself, not the gap between the ticks that `count` keeps, and needs an `interval` to split. `{ interval: 10, count: 2, minorSteps: 5 }` gives ticks at 0, 20 and 40 and minor ticks every 2, including at 10 and 30: the steps `count` skips get a minor tick only where one of the even steps falls. A minor tick at a tick\'s position is dropped.',
  minSpacing: 'The ticks are counted before any is created, from the axis length and the number the step would create, so a step that would create thousands of ticks never builds them. When the minor ticks would be closer together than this, none are created; when the ticks themselves would be, the step creates none either and the axis uses the ticks it picks, as if `period` and `interval` were null. Both cases log a console warning naming the axis. Explicit `ticks` are never limited, and an ordinal axis cannot create more ticks than it has categories, so it accepts only the default.'
};

/** The thresholdStep members both axes share; each axis adds the members that place its steps. */
export function getThresholdStepDescriptions(): DescriptionMap {
  return {
    visible: 'whether to draw the stepped thresholds',
    interval: 'the axis value distance the thresholds step by on a number scale (use null for none)',
    count: stepCountDescription + ' as a threshold',
    offset: 'the number of steps skipped before the first threshold; on a linear scale it shifts which multiples or periods are kept, counted from 0 or the calendar origin',
    minSpacing: 'the least distance (in pixels, at least 2) to allow between the thresholds the rule draws on a linear axis; when they would be closer, none are drawn (an ordinal axis accepts only 2)',
    range: 'whether each threshold is a range spanning its step (true) or a line at its start (false)',
    front: 'whether the stepped thresholds are drawn in front of (true) or behind (false) the series shapes',
    style: styleStates('the style of the stepped thresholds: the stroke members draw a line or the edges of a range, the fill members fill a range and are ignored on a line', fillLineMembers),
    pattern: 'the unique id of the pattern config filling the stepped ranges (use null for none; an unknown id is a validation error; cannot be combined with gradient)',
    gradient: 'the unique id of the gradient config filling the stepped ranges (use null for none; an unknown id is a validation error; cannot be combined with pattern)'
  };
}

export const stepCountOffsetDetails = 'A number means the same in `tickStep` and `thresholdStep`: every count-th step. On a linear axis `count` and `offset` need a `period` or `interval` to count, so setting either without one is a validation error.';

/** The value axis has no period, so its count and offset details name only the interval. */
export const valueStepCountOffsetDetails = 'A number means the same in `tickStep` and `thresholdStep`: every count-th step. `count` and `offset` need an `interval` to count, so setting either without one is a validation error.';

export const thresholdStepMinSpacingDetails = 'The thresholds are counted before any is drawn, from the axis length and the number the rule would draw at its `count`, so a rule that would flood the axis never builds its shapes. When they would sit closer together than `minSpacing`, no stepped thresholds are drawn and a console warning names the axis. An ordinal axis never draws more thresholds than it has categories, so it accepts only the default.';

export const thresholdStepPatternDetails = 'The pattern\'s `"owner"` color keyword resolves to the step\'s `style.normal.fillColor`.';

export const thresholdStyleDetails = 'A line entry uses only the `style` stroke members; the fill members, `pattern` and `gradient` apply to ranges.';
export const thresholdDomainDetails = 'Thresholds never extend the axis domain: a line outside it is not drawn, a range partly outside is clipped to it, and one wholly outside is not drawn.';

/** The details of the threshold members both axes share; each axis adds the value forms its scale takes. */
export function getThresholdMemberDetails(): DescriptionMap {
  return {
    rangeValue: 'Turns the entry into a range: the space between the two values (in either order) is filled with the `style` fill members, or with the `pattern` or `gradient` named by id, and its two edges are drawn with the stroke members like lines (a stroke opacity of 0 leaves the fill alone).',
    pattern: 'The pattern\'s `"owner"` color keyword resolves to the range\'s `style.normal.fillColor`.',
    title: { properties: { side: 'On a line, the side of the line the title sits on, by axis value. On a range, `low` or `high` of the whole range, or `inside` centered within it; `inside` is an error on a line.' } }
  };
}

export default function getDescriptions() {
  return {
    axisLine: {
      description: 'the line drawn along the length of the axis',
      properties: {
        visible: 'whether to show a line along the length of the axis',
        front: 'whether the axis line should be shown in front (true) or behind (false) the series shapes',
        marginInner: 'the margin (in pixels) between the line shown along the axis and the inner boundary of the axis',
        style: styleStates('the style of the line shown along the axis', strokeMembers)
      }
    },

    backgroundStyle: style('the styles to apply to the axis background (strokeColor, strokeOpacity, strokeWidth, fillColor, fillOpacity (use null for none))'),
    backgroundFront: 'whether the axis background should be shown in front (true) or behind (false) the series shapes',

    side: 'whether the axis is placed at the start (top/left) or end (bottom/right) of the chart',
    reversed: 'whether the axis runs in the opposite direction, so its minimum is drawn where its maximum normally would be (an ordinal category axis reverses its category order)',

    collapsed: 'whether the axis should consume space in the layout (false) or not (true)',

    focusRange: {
      description: 'the band drawn over the axis at its focused series domain or category value',
      properties: {
        visible: 'whether to show the focus range on the axis when it has a focused series domain or category value',
        front: 'whether the focus range should be shown in front (true) or behind (false) the series shapes',
        applyToTitle: 'whether to show the focus range only over tick labels (false) or over both tick labels and title (true)',
        style: partialStyle('the style of the focus range', ['strokeColor', 'strokeOpacity', 'strokeWidth', 'strokeDashArray', 'fillColor', 'fillOpacity'])
      }
    },

    focusTickMark: {
      description: 'the tick marks drawn perpendicular to the axis at its focused series domain or category value',
      properties: {
        visible: 'whether to show lines perpendicular to the axis showing the focused series domain or category value',
        front: 'whether the focus tick marks should be shown in front (true) or behind (false) the series shapes',
        size: 'the length (in pixels) of the focus tick mark line(s)',
        marginInner: 'the margin (in pixels) to show between the inside of the axis and the focus tick mark line(s)',
        style: partialStyle('the style of the focus tick mark line(s)', lineMembers)
      }
    },

    gridLine: {
      description: 'the grid lines drawn across the plot at each tick on the axis',
      properties: {
        visible: 'whether to show grid lines perpendicular to each tick on the axis (false hides the minor grid lines too)',
        front: 'whether the axis grid lines should be shown in front (true) or behind (false) the series shapes',
        style: styleStates('the style of the axis grid lines', strokeMembers),
        minorVisible: 'whether to show grid lines perpendicular to each minor tick on the axis' + majorNote('gridLine.visible'),
        minorFront: 'whether the minor grid lines should be shown in front (true) or behind (false) the series shapes' + majorNote('gridLine.front'),
        minorStyle: minorStyleStates('the style of the minor grid lines', strokeMembers, 'gridLine.style')
      }
    },

    marginInner: 'the inner (closest to chart) margin (in pixels) of the axis',
    marginOuter: 'the outer (furthest from chart) margin (in pixels) of the axis',

    maxTickCount: 'the maximum number of ticks to show along the length of the axis (use 0 to disable the maximum)',

    minTickSpacing: 'the minimum space (in pixels) to allow between the bounds of any tick label text',
    minTickInterval: 'the minimum value interval to use between any two consecutive tick label values',

    paddingInner: 'the inner (closest to chart) padding (in pixels) of the axis',
    paddingOuter: 'the outer (furthest from chart) padding (in pixels) of the axis',


    thresholds: {
      description: thresholdsDescription,
      properties: getThresholdDescriptions()
    },
    thresholdStep: {
      description: thresholdStepDescription,
      properties: getThresholdStepDescriptions()
    },
    tickCount: 'the number of ticks to show along the length of the axis (use "auto" to derive the tick count from the data)',

    tickLabel: {
      description: tickLabelDescription,
      properties: getTickLabelDescriptions()
    },

    tickMark: {
      description: 'the tick marks drawn perpendicular to the axis at each tick value',
      properties: {
        visible: 'whether to show lines perpendicular to each tick value along the axis (false hides the minor tick marks too)',
        front: 'whether the axis tick marks should be shown in front (true) or behind (false) the series shapes',
        size: 'the length (in pixels) of the axis tick mark lines',
        marginInner: 'the margin (in pixels) to show between the inside of the axis and the axis tick mark lines',
        style: styleStates('the style of the axis tick mark lines', strokeMembers),
        minorVisible: 'whether to show lines perpendicular to each minor tick value along the axis' + majorNote('tickMark.visible'),
        minorFront: 'whether the minor tick marks should be shown in front (true) or behind (false) the series shapes' + majorNote('tickMark.front'),
        minorSize: 'the length (in pixels) of the minor tick mark lines' + majorNote('tickMark.size'),
        minorMarginInner: 'the margin (in pixels) to show between the inside of the axis and the minor tick mark lines' + majorNote('tickMark.marginInner'),
        minorStyle: minorStyleStates('the style of the minor tick mark lines', strokeMembers, 'tickMark.style')
      }
    },

    tickStep: {
      description: tickStepDescription,
      properties: getTickStepDescriptions()
    },

    title: {
      description: 'the title shown alongside the axis',
      properties: {
        text: 'the title text to be shown alongside the axis (use null or an empty string for no title)',
        front: 'whether the axis title should be shown in front (true) or behind (false) the series shapes',
        backgroundStyle: style('the styles to apply to the axis title background (strokeColor, strokeOpacity, strokeWidth, fillColor, fillOpacity (use null for none))'),
        truncation: {
          description: 'the truncation applied to the axis title when it would overflow the axis bounds',
          properties: {
            enabled: 'whether to apply text truncation to the contents of the axis title when it would overflow the axis bounds',
            text: 'the truncation text to append when text is truncated',
            tooltipEnabled: 'whether truncated text shows its full string as the browser\'s native tooltip while a pointer rests on it'
          }
        },
        size: 'the space (in pixels) perpendicular to the axis direction to allocate for the axis title (use "auto" to derive from the font size)',
        marginInner: 'the margin (in pixels) to show between the axis title and the inside of the axis',
        marginOuter: 'the margin (in pixels) to show between the axis title and the outside of the axis',
        paddingInner: 'the padding (in pixels) to show between the axis title and the inside of the axis',
        paddingOuter: 'the padding (in pixels) to show between the axis title and the outside of the axis',
        textStyle: styleStates('the style of the axis title text', ['strokeColor', 'strokeOpacity', 'strokeWidth', 'strokeDashArray', 'fillColor', 'fillOpacity']),
        font: font('the font of the axis title text (family, size, weight, style), each member falling back to chart.font when null')
      }
    },

    min: 'the forced minimum value for the axis: a number, or a date on a date category axis (use "auto" to compute from the values); must be <= max unless either is "auto" (set reversed to run the axis backwards)',
    max: 'the forced maximum value for the axis: a number, or a date on a date category axis (use "auto" to compute from the values); must be >= min unless either is "auto" (set reversed to run the axis backwards)',
    softMin: 'the minimum value for the axis to cover while no data value is less than it, taking the same forms as min (use null to disable)',
    softMax: 'the maximum value for the axis to cover while no data value is greater than it, taking the same forms as max (use null to disable)',
    minOffset: 'the offset to add to the minimum value of the axis while min is "auto" (no effect with a fixed min), in the axis\'s units: milliseconds on a date axis',
    maxOffset: 'the offset to add to the maximum value of the axis while max is "auto" (no effect with a fixed max), in the axis\'s units: milliseconds on a date axis',

    visible: 'whether the axis should be visible (its line, tick marks, tick labels and title). Its grid, base and threshold lines are controlled by their own visibility properties, and can remain visible when the axis is hidden',
  };
}

export { styleStates as axisStyleStatesDescription, strokeMembers as axisStrokeMembers };
