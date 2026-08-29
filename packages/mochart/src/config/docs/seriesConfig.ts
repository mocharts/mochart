import { styleStateDescriptions } from './shared';
import type { DescriptionMap, NestedDescription } from './shared';

const lineMembers = ['strokeColor', 'strokeOpacity', 'strokeWidth', 'strokeDashArray'];
const styleMembers = ['strokeColor', 'strokeOpacity', 'strokeWidth', 'strokeDashArray', 'fillColor', 'fillOpacity'];

const seriesNote = ', or "series" to use the color of the series shape';
const sameNote = ', or "same" to use the color of the normal state';
const paletteNote = ', or "seriesIndex" / "categoryIndex" to take the matching colorPalette color by series or category index';

function members(memberKeys: string[], element: string, allowSeries: boolean, allowSame: boolean): DescriptionMap {
  const descriptions: DescriptionMap = {};
  for (const member of memberKeys) {
    const description = styleStateDescriptions[member] as string;
    descriptions[member] = member.endsWith('Color')
      ? description + (allowSeries ? seriesNote : '') + (allowSame ? sameNote : '') + paletteNote.replace('colorPalette', 'colorPalette ' + element)
      : description;
  }
  return descriptions;
}

function styleStates(description: string, memberKeys: string[], element: string, allowSeries: boolean): NestedDescription {
  return {
    description,
    properties: {
      normal: { description: description + ', while the series is neither focused nor defocused', properties: members(memberKeys, element, allowSeries, false) },
      focused: { description: description + ', while the series is focused', properties: members(memberKeys, element, allowSeries, true) },
      defocused: { description: description + ', while the series is defocused', properties: members(memberKeys, element, allowSeries, true) }
    }
  };
}

export default function getDescriptions() {
  return {
    id: 'the unique identifier for the series',
    order: 'the unique integer order of the series controlling its order of appearance',
    axis: 'the unique identifier of the value axis that the series belongs to',
    stack: 'the unique identifier of the series stack that the series belongs to (use null for none)',
    group: 'the unique identifier of the series group that the series belongs to (use null for none)',
    property: 'the property to retrieve from the data provider for the series values',
    rangeProperty: 'the property to retrieve from the data provider for the secondary series values (use null for none)',
    errorLowProperty: 'the property to retrieve from the data provider for the absolute lower error bound values used to draw error bars (use null for none)',
    errorHighProperty: 'the property to retrieve from the data provider for the absolute upper error bound values used to draw error bars (use null for none)',
    markerProperty: 'the property to retrieve from the data provider for the marker size values (use null for none)',
    labelProperty: 'the property to retrieve from the data provider for the series label values (use null for none)',
    tooltipProperty: 'the property to retrieve from the data provider for the values shown for the series in the tooltip in place of the series values (use null for none)',
    colorProperty: 'the property to retrieve from the data provider for the series color values (use null for none, to color by style instead)',
    allowAbsentDataProperties: 'whether a series data property absent from the data provider is read as all-missing values instead of a data error',
    colorScale: {
      description: 'the color ramp the series color values are mapped through',
      properties: {
        interpolation: 'the type of d3 color interpolation to apply when using a color property (rgb, hsl, lab, hcl) (use null for none)',
        min: 'the minimum color to use when interpolating the series shape color with a color property (use null for none)',
        max: 'the maximum color to use when interpolating the series shape color with a color property (use null for none)',
        missing: 'the color drawn for a value whose color property value is missing (use null to fall back to the series style colors)',
        base: {
          description: 'the data threshold that splits the color ramp in two, and the two ramps either side of it',
          properties: {
            value: 'the base value to use for color interpolation, allowing 2 distinct sets of min & max colors for interpolation (use null for none)',
            aboveMin: 'the minimum color to use when interpolating the series shape color with a color property value that is above the base value (use null for none)',
            aboveMax: 'the maximum color to use when interpolating the series shape color with a color property value that is above the base value (use null for none)',
            belowMin: 'the minimum color to use when interpolating the series shape color with a color property value that is below the base value (use null for none)',
            belowMax: 'the maximum color to use when interpolating the series shape color with a color property value that is below the base value (use null for none)'
          }
        }
      }
    },
    ignore: 'whether to ignore this series and treat it as though it were not specified',
    renderer: 'the shape renderer to use when drawing the series shape (line, area, bar, none)',
    missingValueMode: 'what to draw at a category whose value is missing: break the shape at the gap (break), connect the neighbouring defined values (connect), or draw the point at the value axis base value (base)',
    partialRangeIsMissing: 'whether to treat a value as missing when either of property or rangeProperty is undefined, instead of collapsing to the defined one',
    curve: {
      description: 'the d3 curve type and param to use when drawing the series shape',
      properties: {
        type: 'the d3-shape curve to interpolate the series shape with',
        param: 'the tension/alpha value (0 - 1) passed to the curve types that take one, or undefined to use the curve\'s own default'
      }
    },
    bar: {
      description: 'the bars drawn by a bar renderer series: their width and placement within the layout slot, and their minimum extent',
      properties: {
        widthFraction: 'the fraction (0 - 1) of the bar layout slot width to use when drawing bars in the series',
        alignFraction: 'the fraction (0 - 1) of the slot width freed by widthFraction placed before each bar in the series (0 aligns with the slot start, 0.5 centers, 1 aligns with the slot end)',
        minExtent: 'the minimum extent (in pixels) of each bar in the series along the value direction'
      }
    },
    cap: {
      description: 'the decorative cap drawn on the value end of each bar in a bar series',
      properties: {
        size: 'the size of the cap (in pixels) to use when drawing caps on a bar series',
        type: 'the type (point, curve, round, use null for none) of cap to use when drawing caps on a bar series',
        expand: 'whether to expand the base of caps on a bar series when the size of the cap is greater than the extent of the bar',
        onlyStackOuter: 'whether to only show the cap on bars in the series when they are an outer series of a stack'
      }
    },
    errorBar: {
      description: 'the error bars drawn from the series errorLowProperty and errorHighProperty bounds',
      properties: {
        capSize: 'the full width (in pixels) of the horizontal caps drawn at the ends of the series error bars (use 0 to hide the caps)',
        style: styleStates('the style of the series error bars', lineMembers, 'errorBar', true)
      }
    },
    valueLabel: 'the label to show before a series value in the tooltip (null falls back to useTitleForValueLabel, it does not mean no label)',
    valueFormat: 'the d3 format string to be applied to the series value when displayed in the tooltip (use null for none, use "auto" to derive from data ("auto" will use the value axis tick label format if it is set))',
    valuePrefix: 'the text to prefix series values with when showing them in the tooltip (use null for none)',
    valueSuffix: 'the text to append series values with when showing them in the tooltip (use null for none)',
    useTitleForValueLabel: 'whether to use the title value for the valueLabel value when the valueLabel is not set',
    title: 'the title to display for the series in the legend (use null for none)',
    shapeStyle: styleStates('the style of the series shape', styleMembers, 'shape', false),
    label: {
      description: 'the labels drawn next to the series shapes from the labelProperty values',
      properties: {
        format: 'the d3 format string to be applied to the series label values (use null for none, use "auto" to derive from data)',
        prefix: 'the text to prefix series label values with when drawing them on the plot (use null for none)',
        suffix: 'the text to append series label values with when drawing them on the plot (use null for none)',
        textStyle: styleStates('the style of the series label values', styleMembers, 'label', true),
        minPositionFraction: 'the minimum position fraction (0 - 1) from the domain minimum for which series labels should be shown, measured outward from the base instead when the value axis has one (use null for none)',
        maxPositionFraction: 'the maximum position fraction (0 - 1) from the domain maximum for which series labels should be shown (use null for none)',
        minRangeFraction: 'hide the label of any value whose shape spans less than this fraction (0 - 1) of the axis domain (use null for none)',
        offset: 'the series position offset (in pixels) to apply to all series label positions',
        position: 'where to place the series labels relative to the value end of the series shape (inside, center, outside)',
        aboveBase: {
          description: 'the label placement applied only to series values above the base value ("auto" falls back to the plain label setting)',
          properties: {
            minPositionFraction: 'the minPositionFraction bound applied only to series values on this side of the base value (use "auto" to inherit minPositionFraction, null for none)',
            maxPositionFraction: 'the maxPositionFraction bound applied only to series values on this side of the base value (use "auto" to inherit maxPositionFraction, null for none)',
            offset: 'the series position offset (in pixels) to apply to all series label positions on this side of the base value (use "auto" to derive from the label offset: as it is above the base, negated below it)',
            position: 'the position (inside, center, outside) applied only to series values on this side of the base value (use "auto" to inherit position)'
          }
        },
        belowBase: {
          description: 'the label placement applied only to series values below the base value ("auto" falls back to the plain label setting)',
          properties: {
            minPositionFraction: 'the minPositionFraction bound applied only to series values on this side of the base value (use "auto" to inherit minPositionFraction, null for none)',
            maxPositionFraction: 'the maxPositionFraction bound applied only to series values on this side of the base value (use "auto" to inherit maxPositionFraction, null for none)',
            offset: 'the series position offset (in pixels) to apply to all series label positions on this side of the base value (use "auto" to derive from the label offset: as it is above the base, negated below it)',
            position: 'the position (inside, center, outside) applied only to series values on this side of the base value (use "auto" to inherit position)'
          }
        }
      }
    },
    gradient: 'the unique id of the gradient config used to fill an area or bar series, or a pie slice (use null for none; cannot be combined with pattern or colorProperty)',
    pattern: 'the unique id of the pattern config used to fill an area or bar series, or a pie slice (use null for none; cannot be combined with gradient)',
    marker: {
      description: 'the markers drawn at each series value',
      properties: {
        shape: 'the shape to use when drawing the series marker (circle, cross, diamond, square, star, triangle, wye) (use null for none)',
        size: 'the marker size (in pixels); with a markerProperty it is the size of the largest value, and the markers scale down from it toward minSize',
        minSize: 'the minimum marker size (in pixels) that a marker scaled by a marker property value shrinks to (ignored without a markerProperty)',
        sizeScale: 'the scale used to interpolate marker sizes from marker property values ("sqrt" scales the marker area with the value, "linear" scales its diameter)',
        style: styleStates('the style of the series marker', styleMembers, 'marker', true),
        showForMissingValues: 'whether to still show a marker at missing values (most useful with missingValueMode "base", which gives the marker a position)'
      }
    },
    showInLegend: 'whether to show the series in the legend',
    showInTooltip: 'whether to show the series in the tooltip',
    showColorInLegend: 'whether to show the series color as an icon next to the series title in the legend',
    showColorInTooltip: 'whether to show the series color as an icon next to the series title in the tooltip',
    filterable: 'whether or not the series can be filtered out of the chart via the legend or tooltip (no effect when `followSeries` is set: the followed series’ `filterable` decides)',
    followSeries: 'the unique identifier of another series whose legend filtering and focus this series follows (use null for none)',
    focusOnHover: 'whether the series should be focused whenever the user hovers the pointer over a part of it in the chart',
    focusOnClick: 'whether the series should be focused whenever the user clicks/taps a part of it in the chart',
    focusCategoryOnHover: 'whether the category should be focused whenever the user hovers the pointer over a category of the series in the chart',
    focusCategoryOnClick: 'whether the category should be focused whenever the user clicks/taps a category of the series in the chart',
    showPointer: 'whether to show the pointer cursor when the user mouses over the series shapes in the chart',
    useAxisFocus: 'whether to show the series as focused when the value axis it belongs to is focused',
    animateBaseFromAdjacent: 'whether to animate leading/trailing series position values from their adjacent values (true) or from the base value (false)'
  };
}
export function getDetails() {
  return {
    property: 'The chart reads this property from each category of the data provider to get the series value — it is the only series property without a default, so every series must set it. The values retrieved for this property must be numbers; `null`, `undefined` or `NaN` reads as a missing value. Use `getDataErrors` to check a dataset against the configured properties.',
    labelProperty: 'The values retrieved for this property must be numbers, like `property` — formatted by `label.format`, not label text; a missing value draws no label for that category.',
    markerProperty: 'The values retrieved for this property must be numbers, like `property`; a missing value draws no marker for that category.',
    tooltipProperty: 'The values retrieved for this property must be numbers, like `property`, formatted by the series `valueFormat`; a missing value shows the tooltip\'s missing-value text for that category.',
    colorProperty: 'The values retrieved for this property must be numbers, like `property`, mapped through `colorScale`; a missing value takes `colorScale.missing`.',
    renderer: '`bar` draws a rectangle per category value, `line` connects the values with a path, `area` fills between the value line and the value axis `base` — or, when no base is set, the minimum end of the axis — and `none` draws no shape. Different series in the same chart can use different renderers, e.g. bars with a line overlay.',
    rangeProperty: 'The values retrieved for this property must be numbers, like `property`. When set, the series shape spans from the `rangeProperty` value to the `property` value instead of starting at the axis base — producing floating bars, a banded (low/high) area, or a pair of lines with the `line` renderer.',
    errorLowProperty: 'The values retrieved for this property must be numbers, like `property`. The bounds are absolute values in value axis units, not deltas from the series value, and they join the value axis domain so the whiskers never clip. Either bound can be used alone for a one-sided error bar; a category whose bound is undefined just omits that side of the whisker. Error bars draw on `bar`, `line`, `area` and `none` renderer series (centered on each bar — including grouped sub-slot bars — or on each point), but not on stacked series, where absolute bounds have no meaning against the cumulative stack position.',
    errorHighProperty: 'See `errorLowProperty` — the same rules apply to the upper bound.',
    errorBar: { properties: { capSize: 'The caps are the horizontal ticks at the whisker ends. On a `bar` renderer series the cap width is clamped to the bar layout slot so caps never overlap a neighbouring bar; use `0` to draw plain whiskers without caps.' } },
    axis: 'Assigns the series to the value axis in `valueAxes` whose `id` matches. With a single configured axis this can be omitted — it defaults to that axis id.',
    stack: 'Series sharing the same stack id (an `id` from `seriesStacks`) are drawn stacked on one another and animate as a single unit, so the stack stays gapless mid-transition. All series of a stack must share the same `axis` and the same `group` (or all be ungrouped) — a stack cannot span groups, since each group lays its stacks out in its own sub-slots. Defaults to the sole stack id when exactly one stack is configured; use `null` to opt a series out.',
    group: 'Series sharing the same group id (an `id` from `seriesGroups`) are laid out side by side within each category slot — grouped/clustered bars. Series in the group that also share a `stack` share one sub-slot, so stacks placed in the same group become side-by-side stacked columns. Defaults to the sole group id when exactly one series group is configured; use `null` to opt a series out.',
    curve: 'Only affects the `line` and `area` renderers. `type` selects the d3-shape curve (`linear`, `monotoneX`, `natural`, `step`, `cardinal`, `catmullRom`, …) and `param` is passed to the curve’s tension/alpha configurator for the curve types that take one.',
    missingValueMode: 'With `"connect"`, lines and areas bridge missing categories directly between the neighbouring defined values; with `"base"` the point is drawn at the value axis base value; the default `"break"` leaves a gap in the shape. For a series with a `rangeProperty`, a category counts as missing only when both properties are undefined — see `partialRangeIsMissing`.',
    allowAbsentDataProperties: 'Covers every data property the series names — `property`, `rangeProperty`, `errorLowProperty`, `errorHighProperty`, `markerProperty`, `labelProperty`, `tooltipProperty` and `colorProperty`. Kept `false` by default so a misspelled property name is still reported by `getDataErrors`; enable it for a series that may genuinely have no data behind it, which then draws nothing but keeps its legend and tooltip entries. A property that is present but has the wrong number of values is still an error.',
    partialRangeIsMissing: 'Only affects series with a `rangeProperty` (stacked series are unaffected). By default a category with just one of `property`/`rangeProperty` undefined keeps a zero-extent span collapsed at the defined value, so ranged areas stay connected through it. When `true` such categories count as missing instead, following the configured `missingValueMode` treatment.',
    valueFormat: 'A d3-format specifier applied to the value shown in the tooltip, e.g. `".1f"` or `",.0f"`. `"auto"` derives a format from the data, preferring the value axis `tickLabel.format` when that is set.',
    cap: { properties: { type: 'Draws a decorative cap on the value end of each bar in the series; `size` controls its extent. To cap only the outside of a stacked bar, see `onlyStackOuter` and `seriesStacks[].outerCap.type`.' } },
    marker: { properties: {
      size: 'Without a `markerProperty` every marker is drawn at exactly this size, and `minSize` is not used. With one, the series value with the largest marker property value gets this size and the others scale down toward `minSize` by `sizeScale`, so `size` is the top of the range and `minSize` the bottom — there is no separate maximum.',
      minSize: 'Only used with a `markerProperty`: the size the smallest marker property value scales down to; the largest takes `size`.'
    } },
    bar: { properties: {
      widthFraction: 'Only affects the `bar` renderer. Narrows each bar within its layout slot (the full category slot, or the series’ sub-slot when grouped), so a narrow bar can overlay a full-width one from another series — e.g. a candlestick wick behind its body, or a bullet-chart measure over its backing range. The narrowed bar is centered by default; `alignFraction` moves it within the slot.',
      alignFraction: 'Only affects the `bar` renderer, and only when `widthFraction` is less than 1. Lets narrowed bars from different series share one slot side by side — e.g. the left open tick and right close tick of an OHLC bar.',
      minExtent: 'Only affects the `bar` renderer. A bar whose two ends resolve to (nearly) the same position — e.g. a ranged bar whose `property` and `rangeProperty` values are equal — is expanded to this extent, centered on its position, so it stays visible as a tick mark: e.g. the open/close ticks of an OHLC bar, or a candlestick doji body. At the default `0` such a bar — including a plain bar whose value equals the axis base — draws nothing and has no hit area.'
    } },
    followSeries: 'When the referenced series is toggled out of (or back into) the chart via the legend, this series follows it, and it shares the referenced series’ focus state both ways: focusing the leader highlights this series too, and focus interactions on this series target the leader. For companion series that visually belong to a legend series — e.g. a candlestick wick following its body — so filtering or focusing treats the whole mark as one. It has no focus or filter state of its own for either: `focusedSeriesId` and the `filteredSeriesIds` keys should be ids of series that do not set `followSeries`, and this series’ own id has no effect there. It is kept out of the legend by default (`showInLegend`), since its item could only repeat the followed series’ own.',
    showPointer: 'Sets `cursor: pointer` on the series’ shapes (bars, markers, labels and line/area paths — or its pie slices), advertising that clicking does something. Typically paired with the `onSeriesClick`/`onSliceClick` callbacks or `focusOnClick`, which make the shapes clickable but leave the cursor unchanged by default.'
  };
}
