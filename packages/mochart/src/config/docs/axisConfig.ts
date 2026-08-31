import { style, spacing, styleStateDescriptions } from './shared';
import type { DescriptionMap, NestedDescription } from './shared';

const strokeMembers = ['strokeColor', 'strokeOpacity', 'strokeWidth', 'strokeDashArray'];
const lineMembers = ['strokeColor', 'strokeOpacity', 'strokeWidth', 'strokeDashArray'];

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
    textStyle: styleStates('the style of the axis tick label text', ['strokeColor', 'strokeOpacity', 'strokeWidth', 'strokeDashArray', 'fillColor', 'fillOpacity'])
  };
}

export const tickLabelDescription = 'the labels shown at each tick along the axis';

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
      description: 'the threshold lines to draw on the axis, each an object drawing a reference line across the plot at an axis value (the array replaces the default wholesale)',
      properties: {
        value: 'the axis value to draw the threshold line at (on a date category axis, a millisecond timestamp or ISO date string); thresholds never extend the axis domain, and a value outside it is not drawn',
        front: 'whether the line is drawn in front of (true) or behind (false) the series shapes',
        style: styleStates('the style of the threshold line', lineMembers),
        title: {
          description: 'the title label shown beside the threshold line',
          properties: {
            text: 'the title text shown beside the line (use null for none)',
            side: 'which value side of the line the title sits on ("low" for smaller values, "high" for larger)',
            snapToValue: 'whether the title flips to the other side of the line when its own side has no room, instead of being clamped inside the plot over the line',
            margin: spacing('the margin (in pixels) of the threshold title, relative to its orientation'),
            padding: spacing('the padding (in pixels) of the threshold title, relative to its orientation'),
            textStyle: styleStates('the style of the threshold title text', ['strokeColor', 'strokeOpacity', 'strokeWidth', 'strokeDashArray', 'fillColor', 'fillOpacity']),
            backgroundStyle: style('the styles to apply to the threshold title background')
          }
        }
      }
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
        truncationEnabled: 'whether to apply text truncation to the contents of the axis title when it would overflow the axis bounds',
        truncationText: 'the truncation text to append to the axis title when its length exceeds the bounds of the axis',
        truncationTooltipEnabled: 'whether a truncated axis title shows its full text as the browser’s native tooltip while a pointer rests on it',
        size: 'the space (in pixels) perpendicular to the axis direction to allocate for the axis title (use "auto" to derive from the font size)',
        marginInner: 'the margin (in pixels) to show between the axis title and the inside of the axis',
        marginOuter: 'the margin (in pixels) to show between the axis title and the outside of the axis',
        paddingInner: 'the padding (in pixels) to show between the axis title and the inside of the axis',
        paddingOuter: 'the padding (in pixels) to show between the axis title and the outside of the axis',
        textStyle: styleStates('the style of the axis title text', ['strokeColor', 'strokeOpacity', 'strokeWidth', 'strokeDashArray', 'fillColor', 'fillOpacity'])
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
