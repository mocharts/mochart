import { style, spacing, font, styleStateDescriptions } from './shared';
import type { DescriptionMap, NestedDescription } from './shared';

const strokeMembers = ['strokeColor', 'strokeOpacity', 'strokeWidth', 'strokeDashArray'];
const lineMembers = ['strokeColor', 'strokeOpacity', 'strokeWidth', 'strokeDashArray'];
const fillLineMembers = [...lineMembers, 'fillColor', 'fillOpacity'];

const sameNote = ', or "same" to use the color of the normal state';
const sameValueNote = ', or "same" to use the value of the normal state';
const sameMembers = new Set(['strokeColor', 'fillColor', 'strokeWidth', 'strokeDashArray']);

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
    front: 'whether the axis tick labels should be shown in front (true) or behind (false) the series shapes',
    backgroundStyle: style('the styles to apply to the axis tick label background (strokeColor, strokeOpacity, strokeWidth, fillColor, fillOpacity (use null for none))'),
    size: 'the space (in pixels) perpendicular to the axis direction to allocate for the tick labels (use "auto" to derive from the font size)',
    marginInner: 'the margin (in pixels) to show between the tick labels and the inside of the axis',
    marginOuter: 'the margin (in pixels) to show between the tick labels and the outside of the axis',
    paddingInner: 'the padding (in pixels) to show between the tick labels and the inside of the axis',
    paddingOuter: 'the padding (in pixels) to show between the tick labels and the outside of the axis',
    prefix: 'the string to prefix to the text of each axis tick label (use null for none)',
    suffix: 'the string to append to the text of each axis tick label (use null for none)',
    rotation: 'the rotation (in degrees, -90 to 90) to apply to each axis tick label',
    anchor: 'the anchor to use for all axis tick labels (start, end, middle) (use "auto" to determine automatically)',
    textStyle: styleStates('the style of the axis tick label text', ['strokeColor', 'strokeOpacity', 'strokeWidth', 'strokeDashArray', 'fillColor', 'fillOpacity']),
    font: font('the font of the axis tick label text (family, size, weight, style), each member falling back to chart.font when null')
  };
}

export const tickLabelDescription = 'the labels shown at each tick along the axis';

export const thresholdStepDescription = 'threshold lines or ranges repeated along the axis by rule';

/** The thresholdStep members both axes share; each axis adds the members that place its steps. */
export function getThresholdStepDescriptions(): DescriptionMap {
  return {
    visible: 'whether to draw the stepped thresholds',
    interval: 'the axis value distance the thresholds step by on a number scale (use null for none)',
    count: 'every count-th step gets a threshold (2 draws every other one)',
    offset: 'the number of steps skipped before the first threshold',
    range: 'whether each threshold is a range spanning its step (true) or a line at its start (false)',
    front: 'whether the stepped thresholds are drawn in front of (true) or behind (false) the series shapes',
    style: styleStates('the style of the stepped thresholds: the stroke members draw a line or the edges of a range, the fill members fill a range and are ignored on a line', fillLineMembers),
    pattern: 'the unique id of the pattern config filling the stepped ranges (use null for none; cannot be combined with gradient)',
    gradient: 'the unique id of the gradient config filling the stepped ranges (use null for none; cannot be combined with pattern)'
  };
}

export const thresholdStyleDetails = 'A line entry uses only the `style` stroke members; the fill members, `pattern` and `gradient` apply to ranges.';
export const thresholdDomainDetails = 'Thresholds never extend the axis domain: a line outside it is not drawn, a range partly outside is clipped to it, and one wholly outside is not drawn.';

/** The details of the threshold members both axes share; each axis adds the value forms its scale takes. */
export function getThresholdMemberDetails(): DescriptionMap {
  return {
    rangeValue: 'Turns the entry into a range: the band between the two values (in either order) is filled with the `style` fill members, or with the `pattern` or `gradient` named by id, and its two edges are drawn with the stroke members like lines (a stroke opacity of 0 leaves the fill alone).',
    pattern: 'The pattern\'s `"series"` colour keyword resolves to the range\'s `style.normal.fillColor`, the colour of whatever the pattern fills.',
    title: { properties: { side: 'On a line, the side of the line the title sits on, by axis value. On a range, low or high of the whole band, or `inside` centred within it; `inside` is an error on a line.' } }
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
        visible: 'whether to show grid lines perpendicular to each tick on the axis',
        front: 'whether the axis grid lines should be shown in front (true) or behind (false) the series shapes',
        style: styleStates('the style of the axis grid lines', strokeMembers)
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
      description: 'the thresholds to draw across the plot: a line at an axis value, or a range between two',
      properties: {
        value: 'the axis value of the threshold: a category value (or its key, on an ordinal axis with a keyProperty), a timestamp or ISO date string on a date axis',
        rangeValue: 'the second value of a threshold range (use null for a line)',
        front: 'whether the threshold is drawn in front of (true) or behind (false) the series shapes',
        style: styleStates('the style of the threshold: the stroke members draw a line or the edges of a range, the fill members fill a range and are ignored on a line', fillLineMembers),
        pattern: 'the unique id of the pattern config filling a threshold range (use null for none; cannot be combined with gradient)',
        gradient: 'the unique id of the gradient config filling a threshold range (use null for none; cannot be combined with pattern)',
        title: {
          description: 'the title label shown beside the threshold',
          properties: {
            text: 'the title text shown beside the threshold (use null for none)',
            side: 'the value side of the threshold the title sits on ("low", "high", or "inside" a range)',
            align: 'where the title sits along the threshold ("start", "middle", "end", or "auto" for the axis side)',
            snapToValue: 'whether the title flips to the other side of the line when its own side has no room, instead of being clamped inside the plot over the line',
            margin: spacing('the margin (in pixels) of the threshold title, relative to its orientation'),
            padding: spacing('the padding (in pixels) of the threshold title, relative to its orientation'),
            textStyle: styleStates('the style of the threshold title text', ['strokeColor', 'strokeOpacity', 'strokeWidth', 'strokeDashArray', 'fillColor', 'fillOpacity']),
            font: font('the font of the threshold title text (family, size, weight, style), each member falling back to chart.font when null'),
            backgroundStyle: style('the styles to apply to the threshold title background')
          }
        }
      }
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
        visible: 'whether to show lines perpendicular to each tick value along the axis',
        front: 'whether the axis tick marks should be shown in front (true) or behind (false) the series shapes',
        size: 'the length (in pixels) of the axis tick mark lines',
        marginInner: 'the margin (in pixels) to show between the inside of the axis and the axis tick mark lines',
        style: styleStates('the style of the axis tick mark lines', strokeMembers)
      }
    },

    title: {
      description: 'the title shown alongside the axis',
      properties: {
        text: 'the title text to be shown alongside the axis (use null for no title)',
        front: 'whether the axis title should be shown in front (true) or behind (false) the series shapes',
        backgroundStyle: style('the styles to apply to the axis title background (strokeColor, strokeOpacity, strokeWidth, fillColor, fillOpacity (use null for none))'),
        truncation: {
          description: 'the truncation applied to the axis title when it would overflow the axis bounds',
          properties: {
            enabled: 'whether to apply text truncation to the contents of the axis title when it would overflow the axis bounds',
            text: 'the truncation text to append when text is truncated',
            tooltipEnabled: 'whether truncated text shows its full string as the browser’s native tooltip while a pointer rests on it'
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
    minOffset: 'the numeric offset to apply to the minimum value of the axis',
    maxOffset: 'the numeric offset to apply to the maximum value of the axis',

    visible: 'whether the axis should be visible (its line, tick marks, tick labels and title). Its grid, base and threshold lines are controlled by their own visibility properties, and can remain visible when the axis is hidden',
  };
}

export { styleStates as axisStyleStatesDescription, strokeMembers as axisStrokeMembers };
