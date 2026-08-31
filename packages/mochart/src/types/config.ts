import type {
  Auto, Align, TooltipValueAlign, AxisSide, MissingValueMode, VerticalAlign, Anchor, Position, Scale, DataType, RendererType, ThresholdTitleSide,
  CurveType, CapType, LabelPosition, ColorMode, ColorInterpolation, MarkerShape, MarkerSizeScale, PatternType,
  ChartType, PieLabelType, PieTooltipValueType, DomainChange
} from '../config/core/constants';
import type { MarginPadding, InnerOuter } from './geometry';

/**
 * A CSS color string, or one of the palette color modes
 * ('series' | 'seriesIndex' | 'categoryIndex'); the focused and defocused
 * states of a style additionally accept 'same' (see StyleStates).
 * The `string & {}` keeps ColorMode literals in autocomplete while still
 * accepting arbitrary color strings.
 */
export type SeriesColor = Exclude<ColorMode, 'same'> | (string & {});

/** A browser-rendered SVG color, or `"series"` to use the owning series' normal base fill color. */
export type PatternColor = 'series' | (string & {});

/**
 * The stroke half of a style: everything needed to draw an outline (or a bare
 * line, which has no fill). `S` widens the geometry members (width, dash) in
 * the focused/defocused states, where `'same'` means "inherit the normal
 * state's value"; it is `never` for a plain single-state style.
 */
export interface StrokeStyle<C = string, S = never> {
  /**
   * The color of the stroke (outline): use null to leave the svg stroke
   * attribute unset so that css can supply it, "none" to switch the stroke off,
   * or "currentColor" to follow the host page's css color.
   */
  strokeColor: C | null;
  /**
   * The opacity (0 - 1) of the stroke, or null to leave the svg stroke-opacity
   * attribute unset.
   */
  strokeOpacity: number | null;
  /**
   * The width (in pixels) of the stroke, or null to leave the svg stroke-width
   * attribute unset.
   */
  strokeWidth: number | null | S;
  /**
   * The dash array pattern of the stroke (e.g. "5, 5"), or null for a solid
   * stroke.
   */
  strokeDashArray?: string | null | S;
}

/**
 * A style applied through css rather than svg attributes, so it has no
 * strokeDashArray: the tooltip renders its background as a css border.
 */
export type CssStyle = Omit<Style, 'strokeDashArray'>;

/**
 * A full style: a stroke plus a fill, for shapes that have an interior
 * (backgrounds, bars, markers, text).
 */
export interface Style<C = string, S = never> extends StrokeStyle<C, S> {
  /**
   * The color of the fill: use null to leave the svg fill attribute unset so
   * that css can supply it, "none" to switch the fill off, or "currentColor" to
   * follow the host page's css color.
   */
  fillColor: C | null;
  /**
   * The opacity (0 - 1) of the fill, or null to leave the svg fill-opacity
   * attribute unset.
   */
  fillOpacity: number | null;
}

/**
 * One focus state of a stroke style. Unlike a plain `StrokeStyle`, a style
 * state always writes its color and opacity attributes — so a host-css stroke
 * cannot bleed onto chart chrome and focus animation can interpolate — which
 * is why the colors and opacities are never null. Width and dash array stay
 * nullable.
 */
export interface StrokeStyleState<C = string, S = never> {
  /**
   * The color of the stroke (outline): use "none" to switch the stroke off, or
   * "currentColor" to follow the host page's css color.
   */
  strokeColor: C;
  /** The opacity (0 - 1) of the stroke. */
  strokeOpacity: number;
  /**
   * The width (in pixels) of the stroke, or null to leave the svg stroke-width
   * attribute unset.
   */
  strokeWidth: number | null | S;
  /**
   * The dash array pattern of the stroke (e.g. "5, 5"), or null for a solid
   * stroke.
   */
  strokeDashArray?: string | null | S;
}

/**
 * One focus state of a full style: a stroke plus a fill, for shapes that have
 * an interior (bars, markers, text). Like the stroke half, the fill color and
 * opacity are never null.
 */
export interface StyleState<C = string, S = never> extends StrokeStyleState<C, S> {
  /**
   * The color of the fill: use "none" to switch the fill off, or "currentColor"
   * to follow the host page's css color.
   */
  fillColor: C;
  /** The opacity (0 - 1) of the fill. */
  fillOpacity: number;
}

/**
 * A line style in each of its three focus states. `'same'` in the focused /
 * defocused states means "inherit the normal state's value" — for the colors
 * and also for the stroke width and dash array.
 */
export interface StrokeStyleStates<C = string> {
  normal: StrokeStyleState<C>;
  focused: StrokeStyleState<C | 'same', 'same'>;
  defocused: StrokeStyleState<C | 'same', 'same'>;
}

/**
 * A full style in each of its three focus states. `'same'` in the focused /
 * defocused states means "inherit the normal state's value" — for the colors
 * and also for the stroke width and dash array.
 */
export interface StyleStates<C = string> {
  normal: StyleState<C>;
  focused: StyleState<C | 'same', 'same'>;
  defocused: StyleState<C | 'same', 'same'>;
}

export interface AccessibilityConfig {
  /**
   * Whether the chart exposes keyboard navigation and screen-reader semantics.
   *
   * When `true`, the chart is keyboard- and screen-reader-accessible: the plot
   * area is a tab stop that opens and steps the tooltip (with the values spoken
   * through a hidden live region), legend items and interactive pie slices are
   * roving tab stops, and the svg carries roles, labels and `aria-hidden`
   * markers for assistive tech. Set to `false` to render the chart without any
   * of these attributes or key handlers — for example when the host page
   * provides its own accessible alternative. `respectReducedMotion` is not
   * gated by this switch.
   *
   * @default true
   */
  enabled: boolean;
  /**
   * Whether the chart is hidden from assistive tech and keyboard navigation,
   * for purely decorative charts.
   *
   * Set to `true` for a purely decorative chart — for example a sparkline that
   * repeats a value already shown as text. The chart’s container is marked
   * `aria-hidden` so screen readers skip it entirely, and every keyboard tab
   * stop (plot area, legend items, pie slices, tooltip rows and controls) is
   * removed, so keyboard users cannot land on content assistive tech cannot
   * see. Overrides `enabled`; `respectReducedMotion` is not gated by this
   * switch.
   *
   * @default false
   */
  hidden: boolean;
  /**
   * Whether to respect the user’s reduced-motion system preference.
   *
   * When `true` and the user’s system requests reduced motion (the
   * `prefers-reduced-motion: reduce` accessibility setting, for users sensitive
   * to movement), the chart behaves as if `animation.enabled` were `false`:
   * config, data, and focus changes apply instantly. The preference is watched
   * live, so changing the system setting takes effect without re-creating the
   * chart. Set to `false` to animate regardless of the preference. Independent
   * of `enabled`.
   *
   * @default true
   */
  respectReducedMotion: boolean;
  /**
   * The minimum size (in pixels) of the click targets the chart lays out
   * itself.
   *
   * The floor for the chart chrome a pointer can click: legend item boxes, the
   * tooltip controls’ buttons, and interactive tooltip rows are laid out at
   * least this many pixels in each direction the chart controls. The default of
   * `24` is the WCAG 2.5.8 minimum, which these targets otherwise miss at
   * ordinary font sizes — a legend item is about 22px tall at a 16px host font,
   * and they sit one pixel apart, so a mis-hit filters the series next to it.
   * The floor applies to a target only while clicking it does something
   * (`legend.filterOnClick` / `focusOnClick`, the tooltip controls, the
   * tooltip’s click config), so a legend nothing responds to stays compact, and
   * it is not gated by `enabled` or `hidden`: it is about pointers and touch,
   * not assistive tech. Series shapes — bars, markers, pie slices — are
   * deliberately not padded: their size is the data, and growing their hit area
   * would change which value the pointer lands on. Set to `0` to lay every
   * target out at its content size.
   *
   * @default 24
   */
  minTargetSize: number;
  /**
   * The screen-reader name for the chart when the title has no text.
   *
   * The accessible name of the chart svg when `title.text` is unset; a set
   * title always wins. Replace to localize the announced name.
   *
   * @default "Chart"
   */
  chartLabel: string;
  /**
   * The role description screen readers announce for the chart.
   *
   * Announced by screen readers in place of the generic "group" role, e.g.
   * "Monthly sales, chart". Replace to localize it, as required for
   * `aria-roledescription` values.
   *
   * @default "chart"
   */
  chartRoleDescription: string;
  /**
   * The screen-reader label for the keyboard-focusable plot area.
   *
   * The accessible name of the plot-area tab stop that keyboard users activate
   * to open and step the tooltip. Replace to localize it.
   *
   * @default "Chart values"
   */
  plotLabel: string;
  /**
   * The screen-reader label for the group of keyboard-reachable series or pie
   * slices.
   *
   * The accessible name of the group that contains the keyboard-reachable
   * series — cartesian series or pie slices, whichever the chart draws. Like
   * the legend group, it is present only while the series are roving tab stops,
   * which is when clicking a series does something (`series.focusOnClick`, or
   * an `onSeriesClick`/`onSliceClick` callback). Replace to localize it.
   *
   * @default "Chart series"
   */
  seriesLabel: string;
  /**
   * The screen-reader name for the category axis group when the axis has no
   * title.
   *
   * The accessible name of the group that wraps the category axis’ tick labels,
   * used when `categoryAxis.title` is unset; a set title always wins, and it is
   * the untruncated title even when the drawn one is ellipsised. The group is
   * what tells a screen reader which axis the run of tick labels belongs to, so
   * the labels read as a scale instead of as loose numbers. Replace to localize
   * it.
   *
   * @default "Category axis"
   */
  categoryAxisLabel: string;
  /**
   * The screen-reader name for a value axis group when the axis has no title.
   *
   * The accessible name of the group that wraps a value axis’ tick labels, used
   * when that axis’ `title` is unset; a set title always wins, and it is the
   * untruncated title even when the drawn one is ellipsised. Every untitled
   * value axis gets this same name, so give the axes titles when a chart has
   * more than one and the distinction matters. Replace to localize it.
   *
   * @default "Value axis"
   */
  valueAxisLabel: string;
  /**
   * The screen-reader label for the legend.
   *
   * The accessible name of the legend group that contains the
   * keyboard-reachable legend items. Replace to localize it.
   *
   * @default "Legend"
   */
  legendLabel: string;
  /**
   * The screen-reader label for the group of keyboard-reachable tooltip rows.
   *
   * The accessible name of the group that contains an open tooltip’s
   * keyboard-reachable rows. Present only while the rows are roving tab stops,
   * which is when clicking a row does something (the tooltip controls’ current
   * mode, or `tooltip.focusCategoryOnClick` / `focusSeriesOnClick` /
   * `filterSeriesOnClick`). Replace to localize it.
   *
   * @default "Tooltip values"
   */
  tooltipLabel: string;
  /**
   * The label for the tooltip controls’ previous-category button (aria-label
   * and hover title).
   *
   * The accessible name and hover title of the ‹ button shown when
   * `tooltip.showControls` is on; the button itself shows only the glyph.
   * Replace to localize it.
   *
   * @default "Previous category"
   */
  tooltipPreviousLabel: string;
  /**
   * The label for the tooltip controls’ next-category button (aria-label and
   * hover title).
   *
   * The accessible name and hover title of the › button shown when
   * `tooltip.showControls` is on; the button itself shows only the glyph.
   * Replace to localize it.
   *
   * @default "Next category"
   */
  tooltipNextLabel: string;
}

export interface AnimationConfig {
  /**
   * Whether all animation should be enabled or disabled.
   *
   * The master switch for staged animation. When `false`, config and data
   * changes apply instantly. When `true`, each update plays up to three
   * sequential phases — axis expansion, value change, axis contraction —
   * skipping phases it does not need, and each phase’s duration scales with the
   * size of its change (small updates play faster than the configured maximum).
   * Width/height changes re-layout the chart instantly either way. The user’s
   * reduced-motion preference can also disable animation — see
   * `accessibility.respectReducedMotion`.
   *
   * @default true
   */
  enabled: boolean;
  /**
   * How value axis domain changes animate relative to value changes: staged,
   * combined, or auto.
   *
   * `'staged'` always plays the union phases: value axes expand to cover both
   * the old and new domains, values tween, then axes contract. `'combined'`
   * interpolates every changed value axis domain together with the value
   * changes in a single phase. `'auto'` (the default) combines only when a
   * domain translates — the old and new domains barely overlap, as with flat
   * data changing level — and stages everything else. Combined domain changes
   * are paced by `valueChangeDuration`; `expansionDuration` and
   * `contractionDuration` do not apply to them.
   *
   * @default "auto"
   */
  valueDomainChange: DomainChange;
  /**
   * How category axis domain changes animate relative to value changes: staged,
   * combined, or auto.
   *
   * The category axis counterpart of `valueDomainChange`, with the same modes.
   * The default is `'staged'` rather than `'auto'`: a category domain change
   * usually also changes the category set (a sliding time window), and the
   * staged union — zoom out over both windows, tween, zoom in — shows where the
   * data moved, where a combined slide draws entering and leaving points
   * connected mid-flight. Set `'auto'` to slide barely-overlapping windows
   * during the value phase instead, or `'combined'` to merge every category
   * domain change into it.
   *
   * @default "staged"
   */
  categoryDomainChange: DomainChange;
  /**
   * The maximum duration (in milliseconds) for the initial animation when chart
   * data is first loaded.
   *
   * Duration (in milliseconds) of the first render animation when the chart
   * mounts with data, and of the replay after a structural config change
   * rebuilds the chart.
   *
   * @default 1000
   */
  initialDuration: number;
  /**
   * The maximum duration (in milliseconds) for the axis expansion animation
   * phase when new data is added to the chart.
   *
   * Duration (in milliseconds) of the axis expansion phase, which plays first
   * when an update needs larger axis domains (new categories or larger values)
   * so incoming data has room to land.
   *
   * @default 1000
   */
  expansionDuration: number;
  /**
   * The maximum duration (in milliseconds) for the value change animation phase
   * when data in the chart changes.
   *
   * Duration (in milliseconds) of the value change phase, which tweens values
   * to their new positions and also plays category transitions (categories
   * added/removed/reordered) and series transitions (series added, removed, or
   * filtered via the legend).
   *
   * @default 1000
   */
  valueChangeDuration: number;
  /**
   * The maximum duration (in milliseconds) for the axis contraction animation
   * phase when data is removed from the chart.
   *
   * Duration (in milliseconds) of the axis contraction phase, which plays last
   * when the settled data needs smaller axis domains.
   *
   * @default 1000
   */
  contractionDuration: number;
  /**
   * The duration (in milliseconds) of the transition when focus moves to or
   * from a series or category value.
   *
   * Duration (in milliseconds) of focus transitions — the emphasis change
   * between focused/defocused styling when a series or category gains or loses
   * focus via hover, click, or the legend.
   *
   * @default 1000
   */
  focusDuration: number;
}

export interface ChartConfig {
  /**
   * The type of chart to render: an x/y plot with axes (xy) or a pie/donut
   * chart (pie).
   *
   * @default "xy"
   */
  type: ChartType;
  /**
   * The margin (in pixels) for the top, right, bottom and left sides of the
   * chart.
   *
   * @default { top: 2, right: 2, bottom: 2, left: 2 }
   */
  margin: MarginPadding;
  /**
   * The padding (in pixels) for the top, right, bottom and left sides of the
   * chart.
   *
   * @default { top: 3, right: 3, bottom: 3, left: 3 }
   */
  padding: MarginPadding;
  /**
   * The styles to apply to the chart background (strokeColor, strokeOpacity,
   * strokeWidth, fillColor, fillOpacity (use null for none)).
   *
   * @default { strokeColor: "currentColor", strokeOpacity: 0, strokeWidth: null, strokeDashArray: null, fillColor: null, fillOpacity: 0 }
   */
  backgroundStyle: Style;
}

export interface PlotConfig {
  /**
   * Whether the category axis should be left to right (false) or top to bottom
   * (true).
   *
   * @default false
   */
  inverted: boolean;
  /**
   * The margin (in pixels) for the top, right, bottom and left sides of the
   * plot.
   *
   * @default { top: 0, right: 0, bottom: 0, left: 0 }
   */
  margin: MarginPadding;
  /**
   * The padding (in pixels) for the top, right, bottom and left sides of the
   * plot.
   *
   * @default { top: 0, right: 0, bottom: 0, left: 0 }
   */
  padding: MarginPadding;
  /**
   * How far (in pixels) the series may overflow each side of the plot before
   * being clipped; the sides are screen sides, so with inverted set the value
   * axis runs left/right.
   *
   * @default { top: 0, right: 0, bottom: 0, left: 0 }
   */
  clipOverflow: MarginPadding;
  /**
   * The styles to apply to the plot background (strokeColor, strokeOpacity,
   * strokeWidth, fillColor, fillOpacity (use null for none)).
   *
   * @default { strokeColor: "currentColor", strokeOpacity: 0, strokeWidth: null, strokeDashArray: null, fillColor: null, fillOpacity: 0 }
   */
  backgroundStyle: Style;
}

export interface ClipIndicatorHatchConfig {
  /** The distance (in pixels) between neighbouring hatch lines. */
  spacing: number;
  /**
   * The thickness (in pixels) of each hatch line; at or above spacing the hatch
   * closes up into a flat fill.
   */
  lineWidth: number;
}

export interface ClipIndicatorConfig {
  /**
   * Whether to mark the plot edges that have data hidden behind them, which
   * happens when an axis min or max excludes some of the values.
   *
   * Default:
   * - `false` — when chart.type is pie
   * - `true` — when chart.type is xy
   */
  visible: boolean;
  /**
   * The depth (in pixels) of the clip indicator band (use "auto" to size it
   * from the label plus labelPadding on both sides).
   *
   * @default "auto"
   */
  size: number | Auto;
  /**
   * The space (in pixels) between the clip indicator label and the edges of its
   * band, which also determines the band depth when size is "auto".
   *
   * @default 2
   */
  labelPadding: number;
  /**
   * The text shown in the clip indicator band, and the band's accessible name
   * (use null for no label; the band is still shown).
   *
   * @default "Clipped"
   */
  label: string | null;
  /**
   * The styles to apply to the clip indicator label (strokeColor,
   * strokeOpacity, strokeWidth, fillColor, fillOpacity (use null for none)).
   *
   * @default { strokeColor: null, strokeOpacity: 0, strokeWidth: null, strokeDashArray: null, fillColor: "currentColor", fillOpacity: 0.7 }
   */
  textStyle: Style;
  /**
   * The styles to apply to the clip indicator band, whose fillColor draws the
   * hatch when one is set (strokeColor, strokeOpacity, strokeWidth, fillColor,
   * fillOpacity (use null for none)).
   *
   * Default:
   * - `{ strokeColor: "currentColor", strokeOpacity: 0.4, strokeWidth: 1,
   *   strokeDashArray: null, fillColor: "currentColor", fillOpacity: 0.4 }` —
   *   when hatch is set
   * - `{ strokeColor: null, strokeOpacity: 0, strokeWidth: null,
   *   strokeDashArray: null, fillColor: "currentColor", fillOpacity: 0.15 }` —
   *   when hatch is null
   */
  style: Style;
  /**
   * The diagonal hatch filling the clip indicator band (use null for a flat
   * fill instead).
   *
   * @default { spacing: 6, lineWidth: 2 }
   */
  hatch: ClipIndicatorHatchConfig | null;
  /**
   * Whether the clip indicator should be shown in front (true) or behind
   * (false) the series shapes.
   *
   * @default true
   */
  front: boolean;
}

/** The labels drawn on the pie slices. */
export interface PieLabelConfig {
  /**
   * Whether labels should be shown on the slices.
   *
   * @default false
   */
  visible: boolean;
  /**
   * The content of the slice labels: the slice value (value), the slice
   * percentage of the total (percent), the series title (title), or a
   * combination of two of them (valuePercent for "value (percent)",
   * percentValue for "percent (value)", titleValue for "title: value",
   * titlePercent for "title: percent").
   *
   * @default "percent"
   */
  type: PieLabelType;
  /**
   * The d3 format specifier used to format the value part of the slice labels
   * (use auto to derive a format).
   *
   * @default "auto"
   */
  valueFormat: string | Auto;
  /**
   * The d3 format specifier used to format the percent part of the slice labels
   * (use auto to derive a format).
   *
   * @default "auto"
   */
  percentFormat: string | Auto;
  /**
   * The radial position of the slice labels as a fraction (0 to 1) between the
   * inner radius and the outer radius.
   *
   * @default 0.5
   */
  radiusFraction: number;
  /**
   * Hide the label of any slice whose value is smaller than this fraction (0 to
   * 1) of the slice total.
   *
   * @default 0.05
   */
  minFraction: number;
  /**
   * Whether percent slice labels (and the minFraction threshold) renormalize
   * against the unfiltered slices (true) or always use every slice's share of
   * the full total (false).
   *
   * @default true
   */
  adjustForFiltering: boolean;
}

/** The values shown in the tooltip for the pie slices. */
export interface PieTooltipConfig {
  /**
   * The content of the tooltip value for each slice: the slice value (value),
   * the slice percentage of the total (percent) or a combination of both
   * (valuePercent for "value (percent)", percentValue for "percent (value)");
   * the value part is formatted by the series valueFormat, valuePrefix and
   * valueSuffix, and the percent part renormalizes against the unfiltered
   * slices unless the top-level tooltip.adjustForFiltering is false.
   *
   * @default "value"
   */
  valueType: PieTooltipValueType;
  /**
   * The d3 format specifier used to format the percent part of the tooltip
   * values (use auto to derive a format).
   *
   * @default "auto"
   */
  percentFormat: string | Auto;
}

/** The text label shown at the center of the pie. */
export interface PieCenterLabelConfig {
  /**
   * The text to show at the center of the pie (use null for none).
   *
   * @default null
   */
  text: string | null;
  /**
   * The styles to apply to the center label text (strokeColor, strokeOpacity,
   * strokeWidth, fillColor, fillOpacity (use null for none), use "currentColor"
   * to follow the host page's css color and theme).
   *
   * @default { strokeColor: null, strokeOpacity: null, strokeWidth: null, strokeDashArray: null, fillColor: "currentColor", fillOpacity: null }
   */
  textStyle: Style;
}

/** The total of the slice values shown at the center of the pie. */
export interface PieCenterTotalConfig {
  /**
   * Whether the total of the slice values should be shown at the center of the
   * pie.
   *
   * @default false
   */
  visible: boolean;
  /**
   * The d3 format specifier used to format the center total (use auto to derive
   * a format).
   *
   * @default "auto"
   */
  format: string | Auto;
  /**
   * The styles to apply to the center total text (strokeColor, strokeOpacity,
   * strokeWidth, fillColor, fillOpacity (use null for none), use "currentColor"
   * to follow the host page's css color and theme).
   *
   * @default { strokeColor: null, strokeOpacity: null, strokeWidth: null, strokeDashArray: null, fillColor: "currentColor", fillOpacity: null }
   */
  textStyle: Style;
  /**
   * Whether the center total counts only the unfiltered slices (true) or always
   * shows the full total (false).
   *
   * @default true
   */
  adjustForFiltering: boolean;
}

export interface PieConfig {
  /**
   * The inner radius of the slices as a fraction (0 to 1) of the outer radius
   * (use a value greater than 0 for a donut chart).
   *
   * @default 0
   */
  innerRadiusFraction: number;
  /**
   * The outer radius of the slices as a fraction (0 to 1) of the largest radius
   * that fits within the plot.
   *
   * @default 1
   */
  outerRadiusFraction: number;
  /**
   * The angle (in degrees, clockwise from the top) at which the first slice
   * starts.
   *
   * @default 0
   */
  startAngle: number;
  /**
   * The angle (in degrees, clockwise from the top) at which the last slice ends
   * (use startAngle -90 and endAngle 90 for a half/gauge pie).
   *
   * @default ${startAngle} + 360
   */
  endAngle: number;
  /**
   * The angle (in degrees) of the gap between adjacent slices.
   *
   * @default 0
   */
  padAngle: number;
  /**
   * The corner radius (in pixels) applied to the slice corners.
   *
   * @default 0
   */
  cornerRadius: number;
  /**
   * Offset the focused slice away from the center by this fraction (0 to 1) of
   * the outer radius (an exploded slice); the layout reserves this room, so the
   * slices shrink by the same fraction rather than leaving the plot when
   * exploded.
   *
   * @default 0
   */
  focusOffsetFraction: number;
  /**
   * The labels drawn on the slices.
   *
   * @default { visible: false, type: "percent", valueFormat: "auto", percentFormat: "auto", radiusFraction: 0.5, minFraction: 0.05, adjustForFiltering: true }
   */
  label: PieLabelConfig;
  /**
   * The values shown in the tooltip for the slices.
   *
   * @default { valueType: "value", percentFormat: "auto" }
   */
  tooltip: PieTooltipConfig;
  /**
   * The text label shown at the center of the pie (most useful for donut and
   * gauge charts).
   *
   * @default { text: null, textStyle: { … } }
   */
  centerLabel: PieCenterLabelConfig;
  /**
   * The total of the slice values shown at the center of the pie.
   *
   * @default { visible: false, textStyle: { … }, format: "auto", adjustForFiltering: true }
   */
  centerTotal: PieCenterTotalConfig;
  /**
   * Offset the center label and total horizontally by this fraction (-1 to 1)
   * of the outer radius (positive moves right).
   *
   * @default 0
   */
  centerOffsetXFraction: number;
  /**
   * Offset the center label and total vertically by this fraction (-1 to 1) of
   * the outer radius (positive moves down; e.g. use a negative value to lift
   * them into a gauge's hole).
   *
   * @default 0
   */
  centerOffsetYFraction: number;
}

export interface ColorPalette {
  /**
   * The colors to use for strokes, taken by series or category index and
   * wrapping around when there are more series than colors.
   */
  strokeColors: string[];
  /**
   * The colors to use for fills, taken by series or category index and wrapping
   * around when there are more series than colors.
   */
  fillColors: string[];
}

/**
 * A color palette in each of the three focus states. Unlike a style, a palette
 * entry is never `'same'`: the states hold whole arrays, so each one names its
 * own colors.
 */
export interface ColorPaletteStates {
  /** The palette to use while nothing has focus. */
  normal: ColorPalette;
  /** The palette to use for the focused shapes. */
  focused: ColorPalette;
  /** The palette to use for the defocused shapes. */
  defocused: ColorPalette;
}

export interface ColorPaletteConfig {
  /**
   * The color palettes to use for series shapes that are colored by series or
   * category index.
   *
   * The fallback coloring for series that do not set explicit colors: each
   * series takes the palette entry for its series index (or its category index,
   * for series configured to color by category index). The focused/defocused
   * variants apply while another element has focus. The built-in arrays use
   * Paul Tol's <a href="https://sronpersonalpages.nl/~pault/">Bright
   * qualitative color scheme</a>, designed to be color-blind safe.
   *
   * @default { normal: { … }, focused: { … }, defocused: { … } }
   */
  shape: ColorPaletteStates;
  /**
   * The color palettes to use for series markers that are colored by series or
   * category index.
   *
   * @default { normal: { … }, focused: { … }, defocused: { … } }
   */
  marker: ColorPaletteStates;
  /**
   * The color palettes to use for series labels that are colored by series or
   * category index.
   *
   * @default { normal: { … }, focused: { … }, defocused: { … } }
   */
  label: ColorPaletteStates;
  /**
   * The color palettes to use for series error bars that are colored by series
   * or category index.
   *
   * @default { normal: { … }, focused: { … }, defocused: { … } }
   */
  errorBar: ColorPaletteStates;
}

/** One kind of crosshair line: the lines drawn for the focused category, or for the focused series. */
export interface CrosshairLineConfig {
  /**
   * Whether or not these crosshair lines should be shown.
   *
   * @default true
   */
  visible: boolean;
  /**
   * The style of these crosshair lines.
   *
   * @default { strokeColor: "currentColor", strokeOpacity: 0.3, strokeWidth: 3, strokeDashArray: "10, 5" }
   */
  style: StrokeStyle;
}

export interface CrosshairConfig {
  /**
   * Whether or not crosshairs should be shown when a category or series is
   * focused.
   *
   * @default true
   */
  visible: boolean;
  /**
   * Whether to change the focused category as the crosshairs are shown or
   * hidden, and as the pointer moves when the tooltip's followPointer is on.
   *
   * @default true
   */
  applyFocus: boolean;
  /**
   * The crosshair lines shown for the focused category.
   *
   * @default { visible: true, style: { … } }
   */
  categoryLine: CrosshairLineConfig;
  /**
   * The crosshair lines shown for the focused series.
   *
   * @default { visible: true, style: { … } }
   */
  seriesLine: CrosshairLineConfig;
  /**
   * Whether to show the crosshair lines for sections where they are overlapped
   * by the tooltip.
   *
   * @default false
   */
  showBehindTooltip: boolean;
}

/** The truncation applied to text that would overflow the space available to it. */
export interface TruncationConfig {
  /**
   * Whether to use text truncation when the title width exceeds the width of
   * the chart.
   *
   * In the legend: whether to use text truncation when a legend item width
   * exceeds the width of the chart. In an axis title: whether to apply text
   * truncation to the contents of the axis title when it would overflow the
   * axis bounds. In the category axis tick labels: whether or not to use text
   * truncation (true) when the axis tick labels would overlap each other
   * instead of skipping ticks (false).
   *
   * Default: `true`, and in the category axis tick labels `false` when type is
   * not string.
   */
  enabled: boolean;
  /**
   * The truncation text to append when text is truncated.
   *
   * @default "…"
   */
  text: string;
  /**
   * Whether truncated text shows its full string as the browser’s native
   * tooltip while a pointer rests on it.
   *
   * When `true`, a truncated title carries an svg `<title>` holding the full
   * text, which browsers show as their native tooltip (not the chart `tooltip`)
   * while a mouse or pen rests on it. Touch has no hover, so nothing shows
   * there; the chart’s accessible name already uses the full text.
   *
   * @default true
   */
  tooltipEnabled: boolean;
}

/** A prefix or suffix box beside the title text: its text, spacing and styles. */
export interface TitleAffixConfig {
  /** The text to display in the box (use null for none). */
  text: string | null;
  /**
   * The margin (in pixels) for the top, right, bottom and left sides of the
   * box.
   */
  margin: MarginPadding;
  /**
   * The padding (in pixels) for the top, right, bottom and left sides of the
   * box.
   */
  padding: MarginPadding;
  /**
   * The styles to apply to the box background (strokeColor, strokeOpacity,
   * strokeWidth, fillColor, fillOpacity (use null for none)).
   */
  backgroundStyle: Style;
  /**
   * The styles to apply to the box text (strokeColor, strokeOpacity,
   * strokeWidth, fillColor, fillOpacity (use null for none), use "currentColor"
   * to follow the host page's css color and theme).
   */
  textStyle: Style;
}

export interface TitleConfig {
  /**
   * The text to display in the title (use null for none).
   *
   * @default null
   */
  text: string | null;
  /**
   * The position of the title relative to the chart (top or bottom).
   *
   * @default "top"
   */
  position: Position;
  /**
   * The prefix box shown at the start of the title.
   *
   * @default { text: null, margin: { … }, padding: { … }, backgroundStyle: { … }, textStyle: { … } }
   */
  prefix: TitleAffixConfig;
  /**
   * The suffix box shown at the end of the title.
   *
   * @default { text: null, margin: { … }, padding: { … }, backgroundStyle: { … }, textStyle: { … } }
   */
  suffix: TitleAffixConfig;
  /**
   * The link to create for the title (use null for none).
   *
   * @default null
   */
  link: string | null;
  /**
   * Whether to prevent default navigation behaviour when the link is clicked.
   *
   * @default false
   */
  linkDisabled: boolean;
  /**
   * The truncation applied to the title when its width exceeds the width of the
   * chart.
   *
   * @default { enabled: true, text: "…", tooltipEnabled: true }
   */
  truncation: TruncationConfig;
  /**
   * Whether the title should be aligned between the axes (true) or the chart
   * bounds (false).
   *
   * @default true
   */
  alignedToAxes: boolean;
  /**
   * The alignment for the title (left, center, right).
   *
   * @default "center"
   */
  align: Align;
  /**
   * The vertical alignment of the prefix/text/suffix within the title (top,
   * middle, bottom).
   *
   * @default "middle"
   */
  verticalAlign: VerticalAlign;
  /**
   * Whether to expand the padding height of the prefix/text/suffix to match the
   * max section height.
   *
   * @default false
   */
  verticalExpand: boolean;
  /**
   * The margin (in pixels) for the top, right, bottom and left sides of the
   * title.
   *
   * @default { top: 0, right: 0, bottom: 5, left: 0 }
   */
  margin: MarginPadding;
  /**
   * The padding (in pixels) for the top, right, bottom and left sides of the
   * title.
   *
   * @default { top: 0, right: 0, bottom: 5, left: 0 }
   */
  padding: MarginPadding;
  /**
   * The margin (in pixels) for the top, right, bottom and left sides of the
   * title text.
   *
   * @default { top: 0, right: 0, bottom: 0, left: 0 }
   */
  textMargin: MarginPadding;
  /**
   * The padding (in pixels) for the top, right, bottom and left sides of the
   * title text.
   *
   * @default { top: 0, right: 0, bottom: 0, left: 0 }
   */
  textPadding: MarginPadding;
  /**
   * The styles to apply to the title background (strokeColor, strokeOpacity,
   * strokeWidth, fillColor, fillOpacity (use null for none)).
   *
   * @default { strokeColor: "currentColor", strokeOpacity: 0, strokeWidth: null, strokeDashArray: null, fillColor: null, fillOpacity: 0 }
   */
  backgroundStyle: Style;
  /**
   * The styles to apply to the title text background (strokeColor,
   * strokeOpacity, strokeWidth, fillColor, fillOpacity (use null for none)).
   *
   * @default { strokeColor: "currentColor", strokeOpacity: 0, strokeWidth: null, strokeDashArray: null, fillColor: null, fillOpacity: 0 }
   */
  textBackgroundStyle: Style;
  /**
   * The styles to apply to the title text (strokeColor, strokeOpacity,
   * strokeWidth, fillColor, fillOpacity (use null for none), use "currentColor"
   * to follow the host page's css color and theme).
   *
   * @default { strokeColor: "none", strokeOpacity: null, strokeWidth: 0, strokeDashArray: null, fillColor: "currentColor", fillOpacity: null }
   */
  textStyle: Style;
}

/** The border drawn around a series icon: always written, so no member is null. */
export interface SeriesIconBorderStyle {
  /**
   * The color of the border drawn around series icons: use "none" to switch the
   * border off, or "currentColor" to follow the host page's css color.
   *
   * @default "currentColor"
   */
  strokeColor: string;
  /**
   * The opacity (0 - 1) of the border drawn around series icons.
   *
   * @default 0.65
   */
  strokeOpacity: number;
  /**
   * The width (in pixels) of the border drawn around series icons.
   *
   * @default 1
   */
  strokeWidth: number;
}

/**
 * The series icons shown beside series titles, the `icon` group of both the
 * legend and the tooltip.
 *
 * Both sections show the same icons and take the same values for them, so the
 * shape is declared once here and used by each: the two surfaces cannot drift
 * apart. Only the prose differs between them (a legend icon sizes itself
 * against the measured legend text, a tooltip icon against the inherited font
 * size), so each section keeps its own descriptions.
 */
export interface SeriesIconConfig {
  /**
   * Whether to show series colors next to series titles in the legend.
   *
   * In tooltip: whether to show series colors next to series titles in the
   * tooltip.
   *
   * @default true
   */
  showColors: boolean;
  /**
   * Whether to show the series marker shape next to series titles in the
   * legend.
   *
   * In tooltip: whether to show the series marker shape next to series titles
   * in the tooltip.
   *
   * @default true
   */
  showShapes: boolean;
  /**
   * Whether to show placeholder icons next to the series titles in the legend.
   *
   * In tooltip: whether to show placeholder icons next to the series titles in
   * the tooltip.
   *
   * @default true
   */
  showPlaceholders: boolean;
  /**
   * The width and height (in pixels) of the series icons, or "auto" to match
   * the legend text font size.
   *
   * In tooltip: the width and height (in pixels) of the series icons, or "auto"
   * to match the inherited font size.
   *
   * @default "auto"
   */
  size: number | Auto;
  /**
   * The horizontal space (in pixels) to show between series icons and titles.
   *
   * @default 4
   */
  spacing: number;
  /**
   * The border drawn around series icons.
   *
   * @default { strokeColor: "currentColor", strokeOpacity: 0.65, strokeWidth: 1 }
   */
  borderStyle: SeriesIconBorderStyle;
  /**
   * The color to use for the series icon when the corresponding series is
   * filtered.
   *
   * @default 'rgba(255,255,255,0)'
   */
  filteredColor: string;
  /**
   * The color to use for the placeholder series icons when the corresponding
   * series is not filtered.
   *
   * @default 'rgba(0,0,0,0.5)'
   */
  unfilteredColor: string;
}

/** One legend item: the box around a series icon and title. */
export interface LegendItemConfig {
  /**
   * The margin (in pixels) for the top, right, bottom and left sides of the
   * legend items.
   *
   * @default { top: 1, right: 1, bottom: 1, left: 1 }
   */
  margin: MarginPadding;
  /**
   * The padding (in pixels) for the top, right, bottom and left sides of the
   * legend items.
   *
   * @default { top: 1, right: 1, bottom: 1, left: 1 }
   */
  padding: MarginPadding;
  /**
   * The styles to apply to the legend item backgrounds (strokeColor,
   * strokeOpacity, strokeWidth, fillColor, fillOpacity (use null for none)).
   *
   * @default { strokeColor: "currentColor", strokeOpacity: 0, strokeWidth: null, strokeDashArray: null, fillColor: null, fillOpacity: 0 }
   */
  backgroundStyle: Style;
  /**
   * The styles to apply to the legend item text (strokeColor, strokeOpacity,
   * strokeWidth, fillColor, fillOpacity (use null for none), use "currentColor"
   * to follow the host page's css color and theme).
   *
   * @default { strokeColor: "none", strokeOpacity: null, strokeWidth: 0, strokeDashArray: null, fillColor: "currentColor", fillOpacity: null }
   */
  textStyle: Style;
}

export interface LegendConfig {
  /**
   * Whether the legend should be visible.
   *
   * Default:
   * - `true` — when series.length is > 1
   * - `false` — when series.length is <= 1
   */
  visible: boolean;
  /**
   * The position of the legend relative to the chart (top or bottom).
   *
   * @default "bottom"
   */
  position: Position;
  /**
   * The truncation applied to legend item text when its width exceeds the width
   * of the chart.
   *
   * @default { enabled: true, text: "…", tooltipEnabled: true }
   */
  truncation: TruncationConfig;
  /**
   * Whether the legend should be aligned between the axes (true) or the chart
   * bounds (false).
   *
   * @default true
   */
  alignedToAxes: boolean;
  /**
   * The alignment for the legend (left, center, right).
   *
   * @default "center"
   */
  align: Align;
  /**
   * The margin (in pixels) for the top, right, bottom and left sides of the
   * legend.
   *
   * @default { top: 5, right: 0, bottom: 0, left: 0 }
   */
  margin: MarginPadding;
  /**
   * The padding (in pixels) for the top, right, bottom and left sides of the
   * legend.
   *
   * @default { top: 0, right: 0, bottom: 0, left: 0 }
   */
  padding: MarginPadding;
  /**
   * The styles to apply to the legend background (strokeColor, strokeOpacity,
   * strokeWidth, fillColor, fillOpacity (use null for none)).
   *
   * @default { strokeColor: "currentColor", strokeOpacity: 0, strokeWidth: null, strokeDashArray: null, fillColor: null, fillOpacity: 0 }
   */
  backgroundStyle: Style;
  /**
   * The series icons shown next to the series titles in the legend.
   *
   * @default { showColors: true, showShapes: true, showPlaceholders: true, size: "auto", spacing: 4, borderStyle: { … }, filteredColor: "rgba(255,255,255,0)", unfilteredColor: "rgba(0,0,0,0.5)" }
   */
  icon: SeriesIconConfig;
  /**
   * The legend items, each a series icon and title in its own box.
   *
   * @default { margin: { … }, padding: { … }, backgroundStyle: { … }, textStyle: { … } }
   */
  item: LegendItemConfig;
  /**
   * Whether to strike through the item text of filtered series.
   *
   * When `true`, the item text of a series that has been filtered out of the
   * chart is drawn with a line through it, so the legend shows at a glance
   * which series are filtered. The strike-through covers the item text only,
   * never its color icon — the icon already says the same thing by going
   * hollow.
   *
   * @default false
   */
  strikeThroughFiltered: boolean;
  /**
   * Whether to focus a series when the pointer hovers over the series icon or
   * title.
   *
   * When `true`, hovering a legend item focuses its series: the series gets its
   * focused styling and every other series gets its defocused styling.
   * `onFocus` reports focus changes.
   *
   * @default true
   */
  focusOnHover: boolean;
  /**
   * Whether to focus a series when the series icon or title is clicked.
   *
   * When `true`, clicking a legend item focuses its series (see
   * `focusOnHover`). Combine with `filterOnClick` deliberately — with both
   * enabled a click filters and focuses.
   *
   * @default false
   */
  focusOnClick: boolean;
  /**
   * Whether to filter a series when the series icon or title is clicked.
   *
   * When `true`, clicking a legend item toggles its series out of (and back
   * into) the chart, playing the staged series transition; the item stays in
   * the legend so it can be restored. `onSeriesFilter` reports every change.
   *
   * @default true
   */
  filterOnClick: boolean;
}

/** The css drop shadow cast by the tooltip box. */
export interface TooltipDropShadowConfig {
  /**
   * The color of the drop shadow effect used for the tooltip.
   *
   * @default 'rgba(0,0,0,0.3)'
   */
  color: string;
  /**
   * The x offset (in pixels) of the drop shadow effect used for the tooltip.
   *
   * @default 0
   */
  offsetX: number;
  /**
   * The y offset (in pixels) of the drop shadow effect used for the tooltip.
   *
   * @default 5
   */
  offsetY: number;
  /**
   * The blur radius (in pixels) of the drop shadow effect used for the tooltip.
   *
   * @default 10
   */
  blurRadius: number;
}

export interface TooltipConfig {
  /**
   * Whether or not to show the tooltip.
   *
   * @default true
   */
  visible: boolean;
  /**
   * Whether to change the focused category as the tooltip is shown or hidden,
   * and as it tracks the pointer when followPointer is on.
   *
   * @default true
   */
  applyFocus: boolean;
  /**
   * Whether the tooltip should be centered at the closest category value (true)
   * or at the click/tap position (false).
   *
   * Default:
   * - `false` — when chart.type is pie
   * - `true` — when chart.type is xy
   */
  snapToCategory: boolean;
  /**
   * Whether the tooltip should track the mouse position in the chart drawing
   * area.
   *
   * @default false
   */
  followPointer: boolean;
  /**
   * Whether to hide the tooltip when the user clicks/taps within it.
   *
   * @default true
   */
  closeOnClick: boolean;
  /**
   * Whether series should be filtered when the user clicks/taps on them in the
   * tooltip.
   *
   * @default false
   */
  filterSeriesOnClick: boolean;
  /**
   * Whether category values should be focused when the user clicks/taps on them
   * in the tooltip.
   *
   * @default false
   */
  focusCategoryOnClick: boolean;
  /**
   * Whether series should be focused when the user clicks/taps on them in the
   * tooltip.
   *
   * @default false
   */
  focusSeriesOnClick: boolean;
  /**
   * Whether category values should be focused when the user hovers the pointer
   * over them in the tooltip.
   *
   * @default false
   */
  focusCategoryOnHover: boolean;
  /**
   * Whether series should be focused when the user hovers the pointer over them
   * in the tooltip.
   *
   * Ignored while `showControls` is on — there the controls’ mode decides: a
   * row’s series focuses on hover while filter mode is active.
   *
   * @default false
   */
  focusSeriesOnHover: boolean;
  /**
   * Whether the category value should be shown as the first line of the
   * tooltip.
   *
   * Default:
   * - `false` — when chart.type is pie
   * - `true` — when chart.type is xy
   */
  showCategory: boolean;
  /**
   * Whether the focus/filter controls should be shown at the top of the
   * tooltip.
   *
   * When `true`, a control strip renders above the tooltip lines: ‹ and ›
   * buttons step the shown category, and a mode button toggles what clicking a
   * tooltip row does. In filter mode (the initial mode) a series row toggles
   * its series out of the chart like a legend click (`filterable` permitting),
   * and hovering a series row focuses its series like hovering its legend item;
   * in focus mode a row click pins focus on its series or category. With the
   * controls shown, the mode decides click and series-hover behavior — the
   * `focus…OnClick` / `filterSeriesOnClick` / `focusSeriesOnHover` settings are
   * not consulted (`focusCategoryOnHover` still is). The mode button shows the
   * active mode via `filterModeText` / `focusModeText`, and the step buttons
   * are labeled for assistive tech by `accessibility.tooltipPreviousLabel` /
   * `tooltipNextLabel`.
   *
   * @default false
   */
  showControls: boolean;
  /**
   * The text shown on the tooltip controls’ mode button while filter mode is
   * active.
   *
   * The visible text of the mode button while clicking a series row filters its
   * series. Replace to localize it.
   *
   * @default "Filter"
   */
  filterModeText: string;
  /**
   * The text shown on the tooltip controls’ mode button while focus mode is
   * active.
   *
   * The visible text of the mode button while clicking a row focuses its series
   * or category. Replace to localize it.
   *
   * @default "Focus"
   */
  focusModeText: string;
  /**
   * Whether to keep the tooltip within the series drawing area (true) or allow
   * it to overlap the axes (false).
   *
   * @default false
   */
  keepInside: boolean;
  /**
   * The padding (in pixels) for the top, right, bottom and left sides of the
   * tooltip.
   *
   * @default { top: 2, right: 2, bottom: 2, left: 2 }
   */
  padding: MarginPadding;
  /**
   * The space (in pixels) between each line of the tooltip.
   *
   * @default 3
   */
  lineSpacing: number;
  /**
   * The horizontal alignment of the values shown in the tooltip (left, right):
   * left runs the label and value together as one piece of text, right floats
   * the values to the far edge.
   *
   * @default "right"
   */
  valueAlign: TooltipValueAlign;
  /**
   * The styles to apply to the tooltip box (strokeColor, strokeOpacity,
   * strokeWidth, fillColor, fillOpacity (use null for none)).
   *
   * @default { strokeColor: "rgba(0,0,0,0.3)", strokeOpacity: null, strokeWidth: 2, fillColor: "rgba(255,255,255,0.9)", fillOpacity: null }
   */
  backgroundStyle: CssStyle;
  /**
   * The radius (in pixels) of the corners of the tooltip.
   *
   * @default 4
   */
  cornerRadius: number;
  /**
   * The series icons shown next to the series titles in the tooltip.
   *
   * @default { showColors: true, showShapes: true, showPlaceholders: true, size: "auto", spacing: 4, borderStyle: { … }, filteredColor: "rgba(255,255,255,0)", unfilteredColor: "rgba(0,0,0,0.5)" }
   */
  icon: SeriesIconConfig;
  /**
   * The drop shadow effect cast by the tooltip.
   *
   * @default { color: "rgba(0,0,0,0.3)", offsetX: 0, offsetY: 5, blurRadius: 10 }
   */
  dropShadow: TooltipDropShadowConfig;
  /**
   * Whether to strike through the label text of filtered series.
   *
   * When `true`, the label of a series that has been filtered out of the chart
   * is drawn with a line through it. The strike-through covers the label only,
   * so the value beside it stays legible — except when `valueAlign` is
   * `'left'`, where the label and the value are one piece of text and both are
   * struck.
   *
   * @default false
   */
  strikeThroughFiltered: boolean;
  /**
   * Whether to adjust the series values when series filtering changes.
   *
   * @default true
   */
  adjustForFiltering: boolean;
  /**
   * Whether to adjust the width of the tooltip when the series values change
   * due to filtering changes.
   *
   * @default false
   */
  adjustSizeForFiltering: boolean;
  /**
   * Whether to show series that have been filtered out of the chart in the
   * tooltip.
   *
   * @default true
   */
  showFiltered: boolean;
  /**
   * Whether to show series that do not have defined values in the tooltip.
   *
   * @default true
   */
  showMissingValues: boolean;
  /**
   * The text to show for series that have been filtered (use null for none).
   *
   * @default null
   */
  filteredValueText: string | null;
  /**
   * The character to show in place of each digit of a series value that has
   * been filtered (use null for none).
   *
   * @default "-"
   */
  filteredValueCharacter: string | null;
  /**
   * The text to show for series that do not have defined values.
   *
   * @default "N/A"
   */
  missingValueText: string;
  /**
   * The text to use when joining the values for a series that has more than one
   * value.
   *
   * @default " - "
   */
  rangeValueSeparator: string;
}

/**
 * The title label beside a threshold line. Members left out fall back to the
 * documented defaults.
 */
export interface ThresholdTitleConfig {
  /**
   * The title text shown beside the line (use null for none).
   *
   * @default null
   */
  text?: string | null;
  /**
   * Which value side of the line the title sits on ("low" for smaller values,
   * "high" for larger).
   *
   * @default "high"
   */
  side?: ThresholdTitleSide;
  /**
   * Whether the title flips to the other side of the line when its own side has
   * no room, instead of being clamped inside the plot over the line.
   *
   * @default true
   */
  snapToValue?: boolean;
  /**
   * The margin (in pixels) of the threshold title, relative to its orientation.
   *
   * @default { top: 0, right: 0, bottom: 0, left: 0 }
   */
  margin?: MarginPadding;
  /**
   * The padding (in pixels) of the threshold title, relative to its
   * orientation.
   *
   * @default { top: 0, right: 0, bottom: 0, left: 0 }
   */
  padding?: MarginPadding;
  /**
   * The style of the threshold title text.
   *
   * @default { normal: { … }, focused: { … }, defocused: { … } }
   */
  textStyle?: DeepPartial<StyleStates>;
  /**
   * The styles to apply to the threshold title background.
   *
   * @default { strokeColor: "currentColor", strokeOpacity: 0, strokeWidth: null, strokeDashArray: null, fillColor: null, fillOpacity: 0 }
   */
  backgroundStyle?: Partial<Style>;
}

/**
 * One threshold line on an axis: a reference value drawn as a line across the
 * plot, with an optional title label beside it. Entries are whole objects (the
 * `thresholds` array replaces its default wholesale); members left out fall
 * back to the documented defaults.
 */
export interface ThresholdConfig {
  /**
   * The axis value to draw the threshold line at (on a date category axis, a
   * millisecond timestamp or ISO date string); thresholds never extend the axis
   * domain, and a value outside it is not drawn.
   */
  value: number | string;
  /**
   * Whether the line is drawn in front of (true) or behind (false) the series
   * shapes.
   *
   * @default true
   */
  front?: boolean;
  /**
   * The style of the threshold line.
   *
   * @default { normal: { … }, focused: { … }, defocused: { … } }
   */
  style?: DeepPartial<StrokeStyleStates>;
  /**
   * The title label shown beside the threshold line.
   *
   * @default { text: null, side: "high", snapToValue: true, margin: { … }, padding: { … }, textStyle: { … }, backgroundStyle: { … } }
   */
  title?: ThresholdTitleConfig;
}

/** The line drawn along the length of an axis. */
export interface AxisLineConfig {
  /**
   * Whether to show a line along the length of the axis.
   *
   * @default true
   */
  visible: boolean;
  /**
   * Whether the axis line should be shown in front (true) or behind (false) the
   * series shapes.
   *
   * @default false
   */
  front: boolean;
  /**
   * The margin (in pixels) between the line shown along the axis and the inner
   * boundary of the axis.
   *
   * @default 0
   */
  marginInner: number;
  /**
   * The style of the line shown along the axis.
   *
   * @default { normal: { … }, focused: { … }, defocused: { … } }
   */
  style: StrokeStyleStates;
}

/** The band an axis draws over its focused series domain or category value. */
export interface AxisFocusRangeConfig {
  /**
   * Whether to show the focus range on the axis when it has a focused series
   * domain or category value.
   *
   * Category axis default: `false`.
   * Value axis default: `true`.
   */
  visible: boolean;
  /**
   * Whether the focus range should be shown in front (true) or behind (false)
   * the series shapes.
   *
   * @default false
   */
  front: boolean;
  /**
   * Whether to show the focus range only over tick labels (false) or over both
   * tick labels and title (true).
   *
   * @default false
   */
  applyToTitle: boolean;
  /**
   * The style of the focus range.
   *
   * @default { strokeColor: "currentColor", strokeOpacity: 0.2, strokeWidth: 1, strokeDashArray: null, fillColor: "currentColor", fillOpacity: 0.12 }
   */
  style: StyleState;
}

/** The tick marks an axis draws at its focused series domain or category value. */
export interface AxisFocusTickMarkConfig {
  /**
   * Whether to show lines perpendicular to the axis showing the focused series
   * domain or category value.
   *
   * Category axis default: `true`.
   * Value axis default: `false`.
   */
  visible: boolean;
  /**
   * Whether the focus tick marks should be shown in front (true) or behind
   * (false) the series shapes.
   *
   * @default false
   */
  front: boolean;
  /**
   * The length (in pixels) of the focus tick mark line(s).
   *
   * @default 9
   */
  size: number;
  /**
   * The margin (in pixels) to show between the inside of the axis and the focus
   * tick mark line(s).
   *
   * @default 3
   */
  marginInner: number;
  /**
   * The style of the focus tick mark line(s).
   *
   * @default { strokeColor: "currentColor", strokeOpacity: 1, strokeWidth: 3, strokeDashArray: null }
   */
  style: StrokeStyleState;
}

/** The grid lines an axis draws across the plot at each tick. */
export interface AxisGridLineConfig {
  /**
   * Whether to show grid lines perpendicular to each tick on the axis.
   *
   * @default false
   */
  visible: boolean;
  /**
   * Whether the axis grid lines should be shown in front (true) or behind
   * (false) the series shapes.
   *
   * @default false
   */
  front: boolean;
  /**
   * The style of the axis grid lines.
   *
   * @default { normal: { … }, focused: { … }, defocused: { … } }
   */
  style: StrokeStyleStates;
}

/** The tick marks an axis draws at each tick value. */
export interface AxisTickMarkConfig {
  /**
   * Whether to show lines perpendicular to each tick value along the axis.
   *
   * @default true
   */
  visible: boolean;
  /**
   * Whether the axis tick marks should be shown in front (true) or behind
   * (false) the series shapes.
   *
   * @default false
   */
  front: boolean;
  /**
   * The length (in pixels) of the axis tick mark lines.
   *
   * @default 3
   */
  size: number;
  /**
   * The margin (in pixels) to show between the inside of the axis and the axis
   * tick mark lines.
   *
   * @default 0
   */
  marginInner: number;
  /**
   * The style of the axis tick mark lines.
   *
   * @default { normal: { … }, focused: { … }, defocused: { … } }
   */
  style: StrokeStyleStates;
}

/** The tick labels of an axis, shared by the category axis and the value axes. */
export interface AxisTickLabelConfig {
  /**
   * Whether the axis tick labels should be shown in front (true) or behind
   * (false) the series shapes.
   *
   * @default false
   */
  front: boolean;
  /**
   * The anchor to use for all axis tick labels (start, end, middle) (use "auto"
   * to determine automatically).
   *
   * @default "auto"
   */
  anchor: Anchor | Auto;
  /**
   * The styles to apply to the axis tick label background (strokeColor,
   * strokeOpacity, strokeWidth, fillColor, fillOpacity (use null for none)).
   *
   * @default { strokeColor: "currentColor", strokeOpacity: 0, strokeWidth: null, strokeDashArray: null, fillColor: null, fillOpacity: 0 }
   */
  backgroundStyle: Style;
  /**
   * The space (in pixels) perpendicular to the axis direction to allocate for
   * the tick labels (use "auto" to derive from the font size).
   *
   * @default "auto"
   */
  size: number | Auto;
  /**
   * The margin (in pixels) to show between the tick labels and the inside of
   * the axis.
   *
   * @default 2
   */
  marginInner: number;
  /**
   * The margin (in pixels) to show between the tick labels and the outside of
   * the axis.
   *
   * @default 1
   */
  marginOuter: number;
  /**
   * The padding (in pixels) to show between the tick labels and the inside of
   * the axis.
   *
   * @default 5
   */
  paddingInner: number;
  /**
   * The padding (in pixels) to show between the tick labels and the outside of
   * the axis.
   *
   * @default 5
   */
  paddingOuter: number;
  /**
   * The d3 format string (d3-format for number, d3-time-format for date) to be
   * applied to the category values when displayed in axis tick labels (use null
   * for none, use "auto" to derive from data).
   *
   * @default "auto"
   */
  format: string | Auto | null;
  /**
   * The string to prefix to the text of each axis tick label (use null for
   * none).
   *
   * @default null
   */
  prefix: string | null;
  /**
   * The string to append to the text of each axis tick label (use null for
   * none).
   *
   * @default null
   */
  suffix: string | null;
  /**
   * The rotation (in degrees, -90 to 90) to apply to each axis tick label.
   *
   * @default 0
   */
  rotation: number;
  /**
   * The style of the axis tick label text.
   *
   * @default { normal: { … }, focused: { … }, defocused: { … } }
   */
  textStyle: StyleStates;
}

/** The axis tick label truncation, adding the limits on the space a label may take. */
export interface TickLabelTruncationConfig extends TruncationConfig {
  /**
   * The minimum length (in pixels) to allow tick label text perpendicular to
   * the axis, applied when maxFraction would allow less.
   *
   * @default 0
   */
  minLength: number;
  /**
   * The maximum fraction (0 - 1) of the plot bounds to allow any tick label
   * text to occupy when they are perpendicular to the axis.
   *
   * @default 0.2
   */
  maxFraction: number;
}

/** The category axis tick labels, adding the truncation applied when they would overlap. */
export interface CategoryAxisTickLabelConfig extends AxisTickLabelConfig {
  /**
   * The truncation applied to the axis tick labels when they would overlap each
   * other.
   *
   * @default { text: "…", tooltipEnabled: true, minLength: 0, maxFraction: 0.2 }
   */
  truncation: TickLabelTruncationConfig;
}

/** The value axis tick labels, adding the filtering adjustment of their bounds. */
export interface ValueAxisTickLabelConfig extends AxisTickLabelConfig {
  /**
   * Whether to adjust the size of the axis tick label bounds as series
   * belonging to it are filtered.
   *
   * @default false
   */
  adjustSizeForFiltering: boolean;
}

/** The title shown alongside an axis. */
export interface AxisTitleConfig {
  /**
   * The title text to be shown alongside the axis (use null for no title).
   *
   * @default null
   */
  text: string | null;
  /**
   * Whether the axis title should be shown in front (true) or behind (false)
   * the series shapes.
   *
   * @default false
   */
  front: boolean;
  /**
   * The styles to apply to the axis title background (strokeColor,
   * strokeOpacity, strokeWidth, fillColor, fillOpacity (use null for none)).
   *
   * @default { strokeColor: "currentColor", strokeOpacity: 0, strokeWidth: null, strokeDashArray: null, fillColor: null, fillOpacity: 0 }
   */
  backgroundStyle: Style;
  /**
   * The truncation applied to the axis title when it would overflow the axis
   * bounds.
   *
   * @default { enabled: true, text: "…", tooltipEnabled: true }
   */
  truncation: TruncationConfig;
  /**
   * The space (in pixels) perpendicular to the axis direction to allocate for
   * the axis title (use "auto" to derive from the font size).
   *
   * @default "auto"
   */
  size: number | Auto;
  /**
   * The margin (in pixels) to show between the axis title and the inside of the
   * axis.
   *
   * @default 2
   */
  marginInner: number;
  /**
   * The margin (in pixels) to show between the axis title and the outside of
   * the axis.
   *
   * @default 2
   */
  marginOuter: number;
  /**
   * The padding (in pixels) to show between the axis title and the inside of
   * the axis.
   *
   * @default 3
   */
  paddingInner: number;
  /**
   * The padding (in pixels) to show between the axis title and the outside of
   * the axis.
   *
   * @default 3
   */
  paddingOuter: number;
  /**
   * The style of the axis title text.
   *
   * @default { normal: { … }, focused: { … }, defocused: { … } }
   */
  textStyle: StyleStates;
}

/** The line a value axis draws along its base value. */
export interface AxisBaseLineConfig {
  /**
   * Whether to show a line along the base of the axis.
   *
   * @default true
   */
  visible: boolean;
  /**
   * Whether the base line should be shown in front (true) or behind (false) the
   * series shapes.
   *
   * @default false
   */
  front: boolean;
  /**
   * The style of the line shown along the base of the axis.
   *
   * @default { normal: { … }, focused: { … }, defocused: { … } }
   */
  style: StrokeStyleStates;
}

/** Shared properties of the category axis and value axes (config/defaults/axisConfig.ts). */
export interface AxisConfigBase {
  /**
   * The line drawn along the length of the axis.
   *
   * @default { visible: true, front: false, marginInner: 0, style: { … } }
   */
  axisLine: AxisLineConfig;
  /**
   * The styles to apply to the axis background (strokeColor, strokeOpacity,
   * strokeWidth, fillColor, fillOpacity (use null for none)).
   *
   * @default { strokeColor: "currentColor", strokeOpacity: 0, strokeWidth: null, strokeDashArray: null, fillColor: null, fillOpacity: 0 }
   */
  backgroundStyle: Style;
  /**
   * Whether the axis background should be shown in front (true) or behind
   * (false) the series shapes.
   *
   * @default false
   */
  backgroundFront: boolean;
  /**
   * Whether the axis is placed at the start (top/left) or end (bottom/right) of
   * the chart.
   *
   * Category axis defaults:
   * - `"start"` — when plot.inverted is true
   * - `"end"` — when plot.inverted is false
   * Value axis default: `"start"`.
   */
  side: AxisSide;
  /**
   * Whether the axis runs in the opposite direction, so its minimum is drawn
   * where its maximum normally would be (an ordinal category axis reverses its
   * category order).
   *
   * @default false
   */
  reversed: boolean;
  /**
   * Whether the axis should consume space in the layout (false) or not (true).
   *
   * @default false
   */
  collapsed: boolean;
  /**
   * The band drawn over the axis at its focused series domain or category
   * value.
   *
   * Category axis default: `{ visible: false, front: false, applyToTitle:
   * false, style: { … } }`.
   * Value axis default: `{ visible: true, front: false, applyToTitle: false,
   * style: { … } }`.
   */
  focusRange: AxisFocusRangeConfig;
  /**
   * The tick marks drawn perpendicular to the axis at its focused series domain
   * or category value.
   *
   * Category axis default: `{ visible: true, front: false, size: 9,
   * marginInner: 3, style: { … } }`.
   * Value axis default: `{ visible: false, front: false, size: 9, marginInner:
   * 3, style: { … } }`.
   */
  focusTickMark: AxisFocusTickMarkConfig;
  /**
   * The grid lines drawn across the plot at each tick on the axis.
   *
   * @default { visible: false, front: false, style: { … } }
   */
  gridLine: AxisGridLineConfig;
  /**
   * The inner (closest to chart) margin (in pixels) of the axis.
   *
   * @default 0
   */
  marginInner: number;
  /**
   * The outer (furthest from chart) margin (in pixels) of the axis.
   *
   * @default 1
   */
  marginOuter: number;
  /**
   * The forced maximum value for the axis: a number, or a date on a date
   * category axis (use "auto" to compute from the values); must be >= min
   * unless either is "auto" (set reversed to run the axis backwards).
   *
   * The form the bound takes follows `type` on a linear axis: a number when
   * `type` is `number`, and either a millisecond timestamp or an ISO date
   * string (`"2020-01-01"`) when `type` is `date` — the two forms
   * `thresholds[].value` takes. An ordinal axis places its categories in data
   * order, so it accepts only `"auto"`.
   *
   * @default "auto"
   */
  max: number | string | Auto;
  /**
   * The numeric offset to apply to the maximum value of the axis.
   *
   * @default 0
   */
  maxOffset: number;
  /**
   * The maximum number of ticks to show along the length of the axis (use 0 to
   * disable the maximum).
   *
   * Category axis defaults:
   * - `10` — when scale is linear
   * - `0` — when scale is ordinal
   * Value axis default: `10`.
   */
  maxTickCount: number;
  /**
   * The forced minimum value for the axis: a number, or a date on a date
   * category axis (use "auto" to compute from the values); must be <= max
   * unless either is "auto" (set reversed to run the axis backwards).
   *
   * The form the bound takes follows `type` on a linear axis: a number when
   * `type` is `number`, and either a millisecond timestamp or an ISO date
   * string (`"2020-01-01"`) when `type` is `date` — the two forms
   * `thresholds[].value` takes. An ordinal axis places its categories in data
   * order, so it accepts only `"auto"`.
   *
   * @default "auto"
   */
  min: number | string | Auto;
  /**
   * The numeric offset to apply to the minimum value of the axis.
   *
   * @default 0
   */
  minOffset: number;
  /**
   * The minimum space (in pixels) to allow between the bounds of any tick label
   * text.
   *
   * Category axis defaults:
   * - `12` — when scale is linear
   * - `4` — when scale is ordinal
   * Value axis default: `12`.
   */
  minTickSpacing: number;
  /**
   * The minimum value interval to use between any two consecutive tick label
   * values.
   *
   * @default 0
   */
  minTickInterval: number;
  /**
   * The inner (closest to chart) padding (in pixels) of the axis.
   *
   * @default 0
   */
  paddingInner: number;
  /**
   * The outer (furthest from chart) padding (in pixels) of the axis.
   *
   * @default 1
   */
  paddingOuter: number;
  /**
   * The minimum value for the axis to cover while no data value is less than
   * it, taking the same forms as min (use null to disable).
   *
   * Takes the same forms as `min` — a number, or a timestamp or ISO date string
   * on a date axis — but only applies while no category value falls below it,
   * so real data still expands the domain. An ordinal axis accepts only `null`.
   *
   * @default null
   */
  softMin: number | string | null;
  /**
   * The maximum value for the axis to cover while no data value is greater than
   * it, taking the same forms as max (use null to disable).
   *
   * Takes the same forms as `max` — a number, or a timestamp or ISO date string
   * on a date axis — but only applies while no category value rises above it,
   * so real data still expands the domain. An ordinal axis accepts only `null`.
   *
   * @default null
   */
  softMax: number | string | null;
  /**
   * The threshold lines to draw on the axis, each an object drawing a reference
   * line across the plot at an axis value (the array replaces the default
   * wholesale).
   *
   * An ordinal axis places its categories at evenly spaced positions rather
   * than on a value scale, so there is no position to place a threshold at — it
   * accepts only an empty array. On a linear axis each entry's `value` takes
   * the same forms as `min`: a number when `type` is `number`, and either a
   * millisecond timestamp or an ISO date string when `type` is `date`.
   *
   * @default []
   */
  thresholds: ThresholdConfig[];
  /**
   * The number of ticks to show along the length of the axis (use "auto" to
   * derive the tick count from the data).
   *
   * @default "auto"
   */
  tickCount: number | Auto;
  /**
   * The labels shown at each tick along the axis.
   *
   * Category axis default: `{ front: false, anchor: "auto", backgroundStyle: {
   * … }, size: "auto", marginInner: 2, marginOuter: 1, paddingInner: 5,
   * paddingOuter: 5, format: "auto", prefix: null, suffix: null, rotation: 0,
   * textStyle: { … }, truncation: { … } }`.
   * Value axis default: `{ front: false, anchor: "auto", backgroundStyle: { …
   * }, size: "auto", marginInner: 2, marginOuter: 1, paddingInner: 5,
   * paddingOuter: 5, format: "auto", prefix: null, suffix: null, rotation: 0,
   * textStyle: { … }, adjustSizeForFiltering: false }`.
   */
  tickLabel: AxisTickLabelConfig;
  /**
   * The tick marks drawn perpendicular to the axis at each tick value.
   *
   * @default { visible: true, front: false, size: 3, marginInner: 0, style: { … } }
   */
  tickMark: AxisTickMarkConfig;
  /**
   * The title shown alongside the axis.
   *
   * @default { text: null, front: false, backgroundStyle: { … }, truncation: { … }, size: "auto", marginInner: 2, marginOuter: 2, paddingInner: 3, paddingOuter: 3, textStyle: { … } }
   */
  title: AxisTitleConfig;
  /**
   * Whether the axis should be visible (its line, tick marks, tick labels and
   * title). Its grid, base and threshold lines are controlled by their own
   * visibility properties, and can remain visible when the axis is hidden.
   *
   * Category axis defaults:
   * - `false` — when chart.type is pie
   * - `true` — when chart.type is xy
   * Value axis defaults:
   * - `false` — when chart.type is pie
   * - `true` — when chart.type is xy
   */
  visible: boolean;
}

export interface CategoryAxisConfig extends AxisConfigBase {
  /**
   * The property to retrieve from the data provider for the category values.
   *
   * The chart reads this property from each entry of the data provider to get
   * the category value: the values must match `type`, they position a linear
   * axis, and they are what tick labels and the tooltip show. They must be
   * unique unless `keyProperty` is set. It is required — the only category axis
   * property without a default.
   */
  property?: string;
  /**
   * Whether dates should be treated as UTC (true) or local (false).
   *
   * @default true
   */
  dateUTC: boolean;
  /**
   * The property to retrieve from the data provider for the category keys, when
   * the category values may repeat (use null for none).
   *
   * When set, this property’s values (strings or numbers, one per category)
   * identify the categories instead of the category values themselves: they
   * must be unique, and they are what animation, focus and filtering match
   * categories by across data changes. Use it when the category values would
   * otherwise repeat — a label keyed by an id, or a wall-clock date whose real
   * instants repeat.
   *
   * @default null
   */
  keyProperty: string | null;
  /**
   * The padding fractions (0 - 1) of the category extent for all category
   * values (outer) and grouped series (inner).
   *
   * @default { inner: 0.1, outer: 0.1 }
   */
  categoryPaddingFraction: InnerOuter;
  /**
   * The extra count to be added to the category value count when dividing the
   * category extent for displaying category values.
   *
   * @default 1
   */
  categoryCountPadding: number;
  /**
   * The minimum extent (in pixels) of each category slot; for a non-inverted
   * bar chart this is a minimum bar width.
   *
   * @default 1
   */
  minCategoryValueExtent: number;
  /**
   * The scale to use for the category values (ordinal, linear).
   *
   * `ordinal` places the categories at evenly spaced positions in data order
   * regardless of their values; `linear` positions `number`/`date` category
   * values proportionally along the axis, so uneven spacing in the data shows
   * as uneven spacing in the chart.
   *
   * @default "ordinal"
   */
  scale: Scale;
  /**
   * The labels shown at each tick along the axis.
   *
   * @default { front: false, anchor: "auto", backgroundStyle: { … }, size: "auto", marginInner: 2, marginOuter: 1, paddingInner: 5, paddingOuter: 5, format: "auto", prefix: null, suffix: null, rotation: 0, textStyle: { … }, truncation: { … } }
   */
  tickLabel: CategoryAxisTickLabelConfig;
  /**
   * The type of the category values (number, date, string).
   *
   * How category values are interpreted: `string` for labels, `number` for
   * numeric values, and `date` for date values (`dateUTC` controls their
   * timezone handling). The type drives parsing, tick label formatting, and
   * which `scale` options make sense.
   *
   * @default "string"
   */
  type: DataType;
  /**
   * The d3 format string (d3-format for number, d3-time-format for date) to be
   * applied to the category value when displayed in the tooltip (use null for
   * none, use "auto" to derive from data).
   *
   * @default "auto"
   */
  valueFormat: string | Auto | null;
  /**
   * The label to show before a category value in the tooltip (use null for
   * none).
   *
   * @default null
   */
  valueLabel: string | null;
  /**
   * The text to prefix category values with when showing them in the tooltip
   * (use null for none).
   *
   * @default null
   */
  valuePrefix: string | null;
  /**
   * The text to append category values with when showing them in the tooltip
   * (use null for none).
   *
   * @default null
   */
  valueSuffix: string | null;
}

export interface ValueAxisTick {
  /** The axis value to place the tick at. */
  value: number;
  /**
   * The text of the tick label (leave it out to format the value with
   * tickLabel.format).
   */
  label?: string;
}

export interface ValueAxisConfig extends AxisConfigBase {
  /**
   * Whether to ignore this value axis and treat it as though it were not
   * specified.
   *
   * @default false
   */
  ignore: boolean;
  /**
   * The unique identifier for the value axis so it can be referenced by series
   * that belong to it.
   *
   * Referenced by `series[].axis` (and `seriesStacks[].axis`) to assign series
   * to this axis. With a single axis the ids can be omitted everywhere.
   *
   * @default VA${index}
   */
  id: string;
  /**
   * The unique integer order of the value axis controlling its order of
   * appearance.
   *
   * @default ${index}
   */
  order: number;
  /**
   * Whether to adjust the domain of the axis as series belonging to it are
   * filtered.
   *
   * @default false
   */
  adjustForFiltering: boolean;
  /**
   * The labels shown at each tick along the axis.
   *
   * @default { front: false, anchor: "auto", backgroundStyle: { … }, size: "auto", marginInner: 2, marginOuter: 1, paddingInner: 5, paddingOuter: 5, format: "auto", prefix: null, suffix: null, rotation: 0, textStyle: { … }, adjustSizeForFiltering: false }
   */
  tickLabel: ValueAxisTickLabelConfig;
  /**
   * Whether the axis should be visible when all series belonging to it are
   * filtered.
   *
   * @default true
   */
  visibleWhenAllFiltered: boolean;
  /**
   * The numeric base value of the axis, used for animation and relative
   * positioning for shapes (use null for none).
   *
   * The value shapes are measured from: bars and areas grow from it,
   * `missingValueMode: 'base'` puts missing values on it, and shapes animate
   * from it when series enter or leave. With mixed positive/negative data it
   * separates the two directions. When left unspecified, un-ranged bar and area
   * series use the minimum end of the axis, and other series use `min` when it
   * is set, otherwise the smallest value in the data.
   *
   * Default:
   * - `0` — when chart.type is pie
   * - `0` — value axis has stacks
   * - `null` — value axis has no stacks
   */
  base: number | null;
  /**
   * The line drawn along the base value of the axis.
   *
   * @default { visible: true, front: false, style: { … } }
   */
  baseLine: AxisBaseLineConfig;
  /**
   * Whether the value axis should be focused whenever the user hovers the
   * pointer over a part of it in the chart.
   *
   * @default true
   */
  focusOnHover: boolean;
  /**
   * Whether the value axis should be focused whenever the user clicks/taps a
   * part of it in the chart.
   *
   * @default false
   */
  focusOnClick: boolean;
  // the four bounds are numbers only here: the date-string form the base type allows is a category-axis form
  /**
   * The forced maximum value for the axis: a number, or a date on a date
   * category axis (use "auto" to compute from the values); must be >= min
   * unless either is "auto" (set reversed to run the axis backwards).
   *
   * With `"auto"` the maximum is computed from the data (including stacking) on
   * every update, and changes animate through the staged axis
   * expansion/contraction phases. Set a number to pin the bound instead. Values
   * outside of the defined range are clipped rather than allowed to overflow
   * the plot area of the chart.
   *
   * @default "auto"
   */
  max: number | Auto;
  /**
   * The forced minimum value for the axis: a number, or a date on a date
   * category axis (use "auto" to compute from the values); must be <= max
   * unless either is "auto" (set reversed to run the axis backwards).
   *
   * With `"auto"` the minimum is computed from the data (including stacking) on
   * every update, and changes animate through the staged axis
   * expansion/contraction phases. Set a number to pin the bound instead. Values
   * outside of the defined range are clipped rather than allowed to overflow
   * the plot area of the chart.
   *
   * @default "auto"
   */
  min: number | Auto;
  /**
   * The maximum value for the axis to cover while no data value is greater than
   * it, taking the same forms as max (use null to disable).
   *
   * An upper bound that only applies while no data value is above it — the axis
   * covers at least this value, but real data larger than it still expands the
   * domain. Unlike `max`, it never clips data.
   *
   * @default null
   */
  softMax: number | null;
  /**
   * The minimum value for the axis to cover while no data value is less than
   * it, taking the same forms as min (use null to disable).
   *
   * A lower bound that only applies while no data value is below it — the axis
   * covers at least this value, but real data smaller than it still expands the
   * domain. Unlike `min`, it never clips data.
   *
   * @default null
   */
  softMin: number | null;
  /**
   * The margin, as a fraction (0 or greater) of the domain of the axis, to use
   * at the maximum extent of the axis (only applied if max is "auto" and max
   * value is not equal base).
   *
   * The margin is relative to the pre-margin domain, so values above 1 are
   * allowed and confine the data to a band of the plot: a margin of 4 leaves
   * the data in the bottom fifth — how the candlestick/OHLC volume pane
   * reserves the upper plot for the price axis.
   *
   * @default 0.05
   */
  maxMarginFraction: number;
  /**
   * The margin, as a fraction (0 or greater) of the domain of the axis, to use
   * at the minimum extent of the axis (only applied if min is "auto" and min
   * value is not equal base).
   *
   * The margin is relative to the pre-margin domain, so values above 1 are
   * allowed and confine the data to a band of the plot: a price axis with
   * margin 1/3 keeps its data in the top three quarters, leaving the bottom for
   * a volume pane.
   *
   * @default 0.05
   */
  minMarginFraction: number;
  /**
   * The scale of the value axis, must be linear.
   *
   * @default "linear"
   */
  scale: 'linear';
  /**
   * The explicit ticks to show on the axis in place of the generated ones, each
   * placing label text at an axis value (use null for none).
   *
   * Replaces the automatic tick generation entirely: tick counts, intervals and
   * domain-edge ticks are ignored. Useful for naming fixed positions, e.g.
   * heatmap row bands or threshold levels. Ticks outside the current axis
   * domain are hidden.
   *
   * @default null
   */
  ticks: ValueAxisTick[] | null;
  /**
   * The type of the value axis, must be number.
   *
   * @default "number"
   */
  type: 'number';
  /**
   * Whether to show the axis as focused when any series belonging to it is
   * focused.
   *
   * @default true
   */
  useSeriesFocus: boolean;
}

export interface SeriesCurve {
  /** The d3-shape curve to interpolate the series shape with. */
  type: CurveType;
  /**
   * The tension value (0 - 1) for the cardinal curve type or the alpha value
   * for catmullRom, or undefined to use the curve's own default (the other
   * curve types take no param).
   */
  param?: number;
}

/** The two curve types with a tension/alpha configurator; the rest take no `param`. */
export type ParamCurveType = 'cardinal' | 'catmullRom';

/** `param` is only accepted on the two types that read it; `SeriesCurve` documents both members. */
export type SeriesCurveOption =
  | (Omit<SeriesCurve, 'type' | 'param'> & { type: ParamCurveType; param?: number })
  | (Omit<SeriesCurve, 'type' | 'param'> & { type: Exclude<CurveType, ParamCurveType>; param?: never });

/**
 * The two-sided half of a series color scale: a data threshold plus the color
 * ramps either side of it. `value` is a data value, not a color, which is why
 * it lives here rather than as a `colorBase` colour alongside `min` / `max`.
 */
export interface SeriesColorScaleBase {
  /**
   * The base value to use for color interpolation, allowing 2 distinct sets of
   * min & max colors for interpolation (use null for none).
   */
  value: number | null;
  /**
   * The minimum color to use when interpolating the series shape color with a
   * color property value that is above the base value (use null for none).
   */
  aboveMin: string | null;
  /**
   * The maximum color to use when interpolating the series shape color with a
   * color property value that is above the base value (use null for none).
   */
  aboveMax: string | null;
  /**
   * The minimum color to use when interpolating the series shape color with a
   * color property value that is below the base value (use null for none).
   */
  belowMin: string | null;
  /**
   * The maximum color to use when interpolating the series shape color with a
   * color property value that is below the base value (use null for none).
   */
  belowMax: string | null;
}


/**
 * The color ramp a series' `colorProperty` values are mapped through: the color
 * space to interpolate in, and either a single `min`/`max` ramp or, when
 * `base.value` is set, a ramp either side of that threshold.
 *
 * These colors are handed to d3 scale ranges, so unlike a style's colors they
 * must be real colors — `'currentColor'` would interpolate to `NaN`.
 */
export interface SeriesColorScale {
  /**
   * The type of d3 color interpolation to apply when using a color property
   * (rgb, hsl, lab, hcl) (use null for none).
   */
  interpolation: ColorInterpolation | null;
  /**
   * The minimum color to use when interpolating the series shape color with a
   * color property (use null for none).
   */
  min: string | null;
  /**
   * The maximum color to use when interpolating the series shape color with a
   * color property (use null for none).
   */
  max: string | null;
  /**
   * The color drawn for a value whose color property value is missing (use null
   * to fall back to the series style colors).
   */
  missing: string | null;
  /**
   * The data threshold that splits the color ramp in two, and the two ramps
   * either side of it.
   */
  base: SeriesColorScaleBase;
}

/** The bars a `bar` renderer series draws: their width and placement within the layout slot, and their minimum extent. */
export interface SeriesBarConfig {
  /**
   * The fraction (0 - 1) of the bar layout slot width to use when drawing bars
   * in the series.
   *
   * Only affects the `bar` renderer. Narrows each bar within its layout slot
   * (the full category slot, or the series’ sub-slot when grouped), so a narrow
   * bar can overlay a full-width one from another series — e.g. a candlestick
   * wick behind its body, or a bullet-chart measure over its backing range. The
   * narrowed bar is centered by default; `alignFraction` moves it within the
   * slot.
   *
   * @default 1
   */
  widthFraction: number;
  /**
   * The fraction (0 - 1) of the slot width freed by widthFraction placed before
   * each bar in the series (0 aligns with the slot start, 0.5 centers, 1 aligns
   * with the slot end).
   *
   * Only affects the `bar` renderer, and only when `widthFraction` is less than
   * 1. Lets narrowed bars from different series share one slot side by side —
   * e.g. the left open tick and right close tick of an OHLC bar.
   *
   * @default 0.5
   */
  alignFraction: number;
  /**
   * The minimum extent (in pixels) of each bar in the series along the value
   * direction.
   *
   * Only affects the `bar` renderer. A bar whose two ends resolve to (nearly)
   * the same position — e.g. a ranged bar whose `property` and `rangeProperty`
   * values are equal — is expanded to this extent, centered on its position, so
   * it stays visible as a tick mark: e.g. the open/close ticks of an OHLC bar,
   * or a candlestick doji body. At the default `0` such a bar — including a
   * plain bar whose value equals the axis base — draws nothing and has no hit
   * area.
   *
   * @default 0
   */
  minExtent: number;
}

/** The decorative cap drawn on the value end of a bar series' bars. */
export interface SeriesCapConfig {
  /**
   * The size of the cap (in pixels) to use when drawing caps on a bar series.
   *
   * @default 5
   */
  size: number;
  /**
   * The type (point, curve, round, use null for none) of cap to use when
   * drawing caps on a bar series.
   *
   * Draws a decorative cap on the value end of each bar in the series; `size`
   * controls its extent. To cap only the outside of a stacked bar, see
   * `onlyStackOuter` and `seriesStacks[].outerCap.type`.
   *
   * @default null
   */
  type: CapType | null;
  /**
   * Whether to expand the base of caps on a bar series when the size of the cap
   * is greater than the extent of the bar.
   *
   * @default true
   */
  expand: boolean;
  /**
   * Whether to only show the cap on bars in the series when they are an outer
   * series of a stack.
   *
   * @default false
   */
  onlyStackOuter: boolean;
}

/** The error bars (whiskers) a series draws from its `errorLowProperty` / `errorHighProperty` bounds. */
export interface SeriesErrorBarConfig {
  /**
   * The full width (in pixels) of the horizontal caps drawn at the ends of the
   * series error bars (use 0 to hide the caps).
   *
   * The caps are the horizontal ticks at the whisker ends. On a `bar` renderer
   * series the cap width is clamped to the bar layout slot so caps never
   * overlap a neighbouring bar; use `0` to draw plain whiskers without caps.
   *
   * @default 6
   */
  capSize: number;
  /**
   * The style of the series error bars.
   *
   * @default { normal: { … }, focused: { … }, defocused: { … } }
   */
  style: StrokeStyleStates<SeriesColor>;
}

/** The label placement applied only to series values on one side of the axis base; "auto" falls back to the plain label setting. */
export interface SeriesLabelBaseSideConfig {
  /**
   * The position (inside, center, outside) applied only to series values on
   * this side of the base value (use "auto" to inherit position).
   *
   * @default "auto"
   */
  position: LabelPosition | Auto;
  /**
   * The series position offset (in pixels) to apply to all series label
   * positions on this side of the base value (use "auto" to derive from the
   * label offset: as it is above the base, negated below it).
   *
   * @default "auto"
   */
  offset: number | Auto;
  /**
   * The minPositionFraction bound applied only to series values on this side of
   * the base value (use "auto" to inherit minPositionFraction, null for none).
   *
   * @default "auto"
   */
  minPositionFraction: number | Auto | null;
  /**
   * The maxPositionFraction bound applied only to series values on this side of
   * the base value (use "auto" to inherit maxPositionFraction, null for none).
   *
   * @default "auto"
   */
  maxPositionFraction: number | Auto | null;
}

/** The labels a series draws next to its shapes from `labelProperty`. */
export interface SeriesLabelConfig {
  /**
   * The d3 format string to be applied to the series label values (use null for
   * none, use "auto" to derive from data).
   *
   * @default "auto"
   */
  format: string | Auto | null;
  /**
   * The text to prefix series label values with when drawing them on the plot
   * (use null for none).
   *
   * @default null
   */
  prefix: string | null;
  /**
   * The text to append series label values with when drawing them on the plot
   * (use null for none).
   *
   * @default null
   */
  suffix: string | null;
  /**
   * The style of the series label values.
   *
   * @default { normal: { … }, focused: { … }, defocused: { … } }
   */
  textStyle: StyleStates<SeriesColor>;
  /**
   * Where to place the series labels relative to the value end of the series
   * shape (inside, center, outside).
   *
   * @default "center"
   */
  position: LabelPosition;
  /**
   * The series position offset (in pixels) to apply to all series label
   * positions.
   *
   * @default 0
   */
  offset: number;
  /**
   * The minimum position fraction (0 - 1) from the domain minimum for which
   * series labels should be shown, measured outward from the base instead when
   * the value axis has one (use null for none).
   *
   * @default null
   */
  minPositionFraction: number | null;
  /**
   * The maximum position fraction (0 - 1) from the domain maximum for which
   * series labels should be shown (use null for none).
   *
   * @default null
   */
  maxPositionFraction: number | null;
  /**
   * Hide the label of any value whose shape spans less than this fraction (0 -
   * 1) of the axis domain (use null for none).
   *
   * @default null
   */
  minRangeFraction: number | null;
  /**
   * The label placement applied only to series values above the base value
   * ("auto" falls back to the plain label setting).
   *
   * @default { minPositionFraction: "auto", maxPositionFraction: "auto", offset: "auto", position: "auto" }
   */
  aboveBase: SeriesLabelBaseSideConfig;
  /**
   * The label placement applied only to series values below the base value
   * ("auto" falls back to the plain label setting).
   *
   * @default { minPositionFraction: "auto", maxPositionFraction: "auto", offset: "auto", position: "auto" }
   */
  belowBase: SeriesLabelBaseSideConfig;
}

/** The markers a series draws at each value. */
export interface SeriesMarkerConfig {
  /**
   * The shape to use when drawing the series marker (circle, cross, diamond,
   * square, star, triangle, wye) (use null for none).
   *
   * Default:
   * - `null` — when renderer is bar
   * - `"circle"` — when renderer is line
   * - `"circle"` — when renderer is area
   * - `"circle"` — when renderer is none
   */
  shape: MarkerShape | null;
  /**
   * The marker size (in pixels); with a markerProperty it is the size of the
   * largest value, and the markers scale down from it toward minSize.
   *
   * Without a `markerProperty` every marker is drawn at exactly this size, and
   * `minSize` is not used. With one, the series value with the largest marker
   * property value gets this size and the others scale down toward `minSize` by
   * `sizeScale`, so `size` is the top of the range and `minSize` the bottom —
   * there is no separate maximum.
   *
   * @default 6
   */
  size: number;
  /**
   * The minimum marker size (in pixels) that a marker scaled by a marker
   * property value shrinks to (ignored without a markerProperty).
   *
   * Only used with a `markerProperty`: the size the smallest marker property
   * value scales down to; the largest takes `size`.
   *
   * @default 1
   */
  minSize: number;
  /**
   * The scale used to interpolate marker sizes from marker property values
   * ("sqrt" scales the marker area with the value, "linear" scales its
   * diameter).
   *
   * @default "sqrt"
   */
  sizeScale: MarkerSizeScale;
  /**
   * The style of the series marker.
   *
   * @default { normal: { … }, focused: { … }, defocused: { … } }
   */
  style: StyleStates<SeriesColor>;
  /**
   * Whether to still show a marker at missing values (most useful with
   * missingValueMode "base", which gives the marker a position).
   *
   * @default false
   */
  showForMissingValues: boolean;
}

export interface SeriesConfig {
  /**
   * The unique identifier for the series.
   *
   * @default S${index}
   */
  id: string;
  /**
   * The unique integer order of the series controlling its order of appearance.
   *
   * @default ${index}
   */
  order: number;
  /**
   * The property to retrieve from the data provider for the series values.
   *
   * The chart reads this property from each category of the data provider to
   * get the series value — it is the only series property without a default, so
   * every series must set it. The values retrieved for this property must be
   * numbers; `null`, `undefined` or `NaN` reads as a missing value. Use
   * `getDataErrors` to check a dataset against the configured properties.
   */
  property?: string;
  /**
   * The property to retrieve from the data provider for the secondary series
   * values (use null for none).
   *
   * The values retrieved for this property must be numbers, like `property`.
   * When set, the series shape spans from the `rangeProperty` value to the
   * `property` value instead of starting at the axis base — producing floating
   * bars, a banded (low/high) area, or a pair of lines with the `line`
   * renderer.
   *
   * @default null
   */
  rangeProperty: string | null;
  /**
   * The property to retrieve from the data provider for the absolute lower
   * error bound values used to draw error bars (use null for none).
   *
   * The values retrieved for this property must be numbers, like `property`.
   * The bounds are absolute values in value axis units, not deltas from the
   * series value, and they join the value axis domain so the whiskers never
   * clip. Either bound can be used alone for a one-sided error bar; a category
   * whose bound is undefined just omits that side of the whisker. Error bars
   * draw on `bar`, `line`, `area` and `none` renderer series (centered on each
   * bar — including grouped sub-slot bars — or on each point), but not on
   * stacked series, where absolute bounds have no meaning against the
   * cumulative stack position.
   *
   * @default null
   */
  errorLowProperty: string | null;
  /**
   * The property to retrieve from the data provider for the absolute upper
   * error bound values used to draw error bars (use null for none).
   *
   * See `errorLowProperty` — the same rules apply to the upper bound.
   *
   * @default null
   */
  errorHighProperty: string | null;
  /**
   * The property to retrieve from the data provider for the marker size values
   * (use null for none).
   *
   * The values retrieved for this property must be numbers, like `property`; a
   * missing value draws no marker for that category.
   *
   * @default null
   */
  markerProperty: string | null;
  /**
   * The property to retrieve from the data provider for the series label values
   * (use null for none).
   *
   * The values retrieved for this property must be numbers, like `property` —
   * formatted by `label.format`, not label text; a missing value draws no label
   * for that category.
   *
   * @default null
   */
  labelProperty: string | null;
  /**
   * The property to retrieve from the data provider for the values shown for
   * the series in the tooltip in place of the series values (use null for
   * none).
   *
   * The values retrieved for this property must be numbers, like `property`,
   * formatted by the series `valueFormat`; a missing value shows the tooltip's
   * missing-value text for that category.
   *
   * @default null
   */
  tooltipProperty: string | null;
  /**
   * The property to retrieve from the data provider for the series color values
   * (use null for none, to color by style instead).
   *
   * The values retrieved for this property must be numbers, like `property`,
   * mapped through `colorScale`; a missing value takes `colorScale.missing`.
   *
   * @default null
   */
  colorProperty: string | null;
  /**
   * Whether a series data property absent from the data provider is read as
   * all-missing values instead of a data error.
   *
   * Covers every data property the series names — `property`, `rangeProperty`,
   * `errorLowProperty`, `errorHighProperty`, `markerProperty`, `labelProperty`,
   * `tooltipProperty` and `colorProperty`. Kept `false` by default so a
   * misspelled property name is still reported by `getDataErrors`; enable it
   * for a series that may genuinely have no data behind it, which then draws
   * nothing but keeps its legend and tooltip entries. A property that is
   * present but has the wrong number of values is still an error.
   *
   * @default false
   */
  allowAbsentDataProperties: boolean;
  /**
   * The color ramp the series color values are mapped through.
   *
   * Default:
   * - `null` — when chart type is not xy or renderer is not bar
   * - `the members below` — when chart type is xy and renderer is bar
   */
  colorScale: SeriesColorScale | null;
  /**
   * The unique identifier of the value axis that the series belongs to.
   *
   * Assigns the series to the value axis in `valueAxes` whose `id` matches.
   * With a single configured axis this can be omitted — it defaults to that
   * axis id.
   *
   * @default sole axis id
   */
  axis?: string;
  /**
   * The unique identifier of the series stack that the series belongs to (use
   * null for none).
   *
   * Series sharing the same stack id (an `id` from `seriesStacks`) are drawn
   * stacked on one another and animate as a single unit, so the stack stays
   * gapless mid-transition. All series of a stack must share the same `axis`
   * and the same `group` (or all be ungrouped) — a stack cannot span groups,
   * since each group lays its stacks out in its own sub-slots. Defaults to the
   * sole stack id when exactly one stack is configured; use `null` to opt a
   * series out.
   *
   * @default sole stack id
   */
  stack: string | null;
  /**
   * The unique identifier of the series group that the series belongs to (use
   * null for none).
   *
   * Series sharing the same group id (an `id` from `seriesGroups`) are laid out
   * side by side within each category slot — grouped/clustered bars. Series in
   * the group that also share a `stack` share one sub-slot, so stacks placed in
   * the same group become side-by-side stacked columns. Defaults to the sole
   * group id when exactly one series group is configured; use `null` to opt a
   * series out.
   *
   * @default sole group id
   */
  group: string | null;
  /**
   * The unique id of the gradient config used to fill an area or bar series, or
   * a pie slice (use null for none; cannot be combined with pattern or
   * colorProperty).
   *
   * Default:
   * - `sole gradient id` — when chart type is pie or renderer is area or bar,
   *   colorProperty is null, and no shapeStyle fillColor is categoryIndex
   */
  gradient: string | null;
  /**
   * The unique id of the pattern config used to fill an area or bar series, or
   * a pie slice (use null for none; cannot be combined with gradient).
   *
   * Default:
   * - `sole pattern id` — when chart type is pie or renderer is area or bar
   */
  pattern: string | null;
  /**
   * Whether to ignore this series and treat it as though it were not specified.
   *
   * @default false
   */
  ignore: boolean;
  /**
   * The shape renderer to use when drawing the series shape (line, area, bar,
   * none).
   *
   * `bar` draws a rectangle per category value, `line` connects the values with
   * a path, `area` fills between the value line and the value axis `base` — or,
   * when no base is set, the minimum end of the axis — and `none` draws no
   * shape. Different series in the same chart can use different renderers, e.g.
   * bars with a line overlay.
   *
   * @default "line"
   */
  renderer: RendererType;
  /**
   * Whether to treat a value as missing when either of property or
   * rangeProperty is undefined, instead of collapsing to the defined one.
   *
   * Only affects series with a `rangeProperty` (stacked series are unaffected).
   * By default a category with just one of `property`/`rangeProperty` undefined
   * keeps a zero-extent span collapsed at the defined value, so ranged areas
   * stay connected through it. When `true` such categories count as missing
   * instead, following the configured `missingValueMode` treatment.
   *
   * @default false
   */
  partialRangeIsMissing: boolean;
  /**
   * What to draw at a category whose value is missing: break the shape at the
   * gap (break), connect the neighbouring defined values (connect), or draw the
   * point at the value axis base value (base).
   *
   * With `"connect"`, lines and areas bridge missing categories directly
   * between the neighbouring defined values; with `"base"` the point is drawn
   * at the value axis base value; the default `"break"` leaves a gap in the
   * shape. For a series with a `rangeProperty`, a category counts as missing
   * only when both properties are undefined — see `partialRangeIsMissing`.
   *
   * @default "break"
   */
  missingValueMode: MissingValueMode;

  /**
   * Whether to animate leading/trailing series position values from their
   * adjacent values (true) or from the base value (false).
   *
   * Default:
   * - `false` — when renderer is bar
   * - `true` — when renderer is line
   * - `true` — when renderer is area
   * - `false` — when renderer is none
   */
  animateBaseFromAdjacent: boolean;
  /**
   * The d3 curve type and param to use when drawing the series shape.
   *
   * Only affects the `line` and `area` renderers. `type` selects the d3-shape
   * curve (`linear`, `monotoneX`, `natural`, `step`, `cardinal`, `catmullRom`,
   * …) and `param` sets the tension of a `cardinal` curve or the alpha of a
   * `catmullRom` one — the only two types with a configurator, so the others
   * reject it.
   *
   * @default { type: "linear" }
   */
  curve: SeriesCurveOption;
  /**
   * The bars drawn by a bar renderer series: their width and placement within
   * the layout slot, and their minimum extent.
   *
   * @default { widthFraction: 1, alignFraction: 0.5, minExtent: 0 }
   */
  bar: SeriesBarConfig;
  /**
   * The decorative cap drawn on the value end of each bar in a bar series.
   *
   * @default { size: 5, type: null, expand: true, onlyStackOuter: false }
   */
  cap: SeriesCapConfig;
  /**
   * The error bars drawn from the series errorLowProperty and errorHighProperty
   * bounds.
   *
   * @default { capSize: 6, style: { … } }
   */
  errorBar: SeriesErrorBarConfig;
  /**
   * The label to show before a series value in the tooltip (null falls back to
   * useTitleForValueLabel, it does not mean no label).
   *
   * @default null
   */
  valueLabel: string | null;
  /**
   * The d3 format string to be applied to the series value when displayed in
   * the tooltip (use null for none, use "auto" to derive from data ("auto" will
   * use the value axis tick label format if it is set)).
   *
   * A d3-format specifier applied to the value shown in the tooltip, e.g.
   * `".1f"` or `",.0f"`. `"auto"` derives a format from the data, preferring
   * the value axis `tickLabel.format` when that is set.
   *
   * @default "auto"
   */
  valueFormat: string | Auto | null;
  /**
   * The text to prefix series values with when showing them in the tooltip (use
   * null for none).
   *
   * @default null
   */
  valuePrefix: string | null;
  /**
   * The text to append series values with when showing them in the tooltip (use
   * null for none).
   *
   * @default null
   */
  valueSuffix: string | null;
  /**
   * Whether to use the title value for the valueLabel value when the valueLabel
   * is not set.
   *
   * @default true
   */
  useTitleForValueLabel: boolean;
  /**
   * The title to display for the series in the legend (use null for none).
   *
   * @default null
   */
  title: string | null;
  /**
   * The labels drawn next to the series shapes from the labelProperty values.
   *
   * @default { format: "auto", prefix: null, suffix: null, textStyle: { … }, minPositionFraction: null, maxPositionFraction: null, minRangeFraction: null, offset: 0, position: "center", aboveBase: { … }, belowBase: { … } }
   */
  label: SeriesLabelConfig;
  /**
   * The style of the series shape.
   *
   * @default { normal: { … }, focused: { … }, defocused: { … } }
   */
  shapeStyle: StyleStates<Exclude<SeriesColor, 'series'>>;
  /**
   * The markers drawn at each series value.
   *
   * @default { minSize: 1, showForMissingValues: false, size: 6, sizeScale: "sqrt", style: { … } }
   */
  marker: SeriesMarkerConfig;
  /**
   * Whether to show the series in the legend.
   *
   * Default:
   * - `false` — when followSeries is not null
   * - `true` — when followSeries is null
   */
  showInLegend: boolean;
  /**
   * Whether to show the series in the tooltip.
   *
   * @default true
   */
  showInTooltip: boolean;
  /**
   * Whether to show the series color as an icon next to the series title in the
   * legend.
   *
   * Default:
   * - `false` — when shapeStyle.normal.strokeColor or
   *   shapeStyle.normal.fillColor is categoryIndex
   * - `true` — when neither shapeStyle.normal.strokeColor nor
   *   shapeStyle.normal.fillColor is categoryIndex
   */
  showColorInLegend: boolean;
  /**
   * Whether to show the series color as an icon next to the series title in the
   * tooltip.
   *
   * Default:
   * - `false` — when shapeStyle.normal.strokeColor or
   *   shapeStyle.normal.fillColor is categoryIndex
   * - `true` — when neither shapeStyle.normal.strokeColor nor
   *   shapeStyle.normal.fillColor is categoryIndex
   */
  showColorInTooltip: boolean;
  /**
   * Whether or not the series can be filtered out of the chart via the legend
   * or tooltip (no effect when `followSeries` is set: the followed series’
   * `filterable` decides).
   *
   * @default true
   */
  filterable: boolean;
  /**
   * The unique identifier of another series whose legend filtering and focus
   * this series follows (use null for none).
   *
   * When the referenced series is toggled out of (or back into) the chart via
   * the legend, this series follows it, and it shares the referenced series’
   * focus state both ways: focusing the leader highlights this series too, and
   * focus interactions on this series target the leader. For companion series
   * that visually belong to a legend series — e.g. a candlestick wick following
   * its body — so filtering or focusing treats the whole mark as one. It has no
   * focus or filter state of its own for either: `focusedSeriesId` and the
   * `filteredSeriesIds` keys should be ids of series that do not set
   * `followSeries`, and this series’ own id has no effect there. It is kept out
   * of the legend by default (`showInLegend`), since its item could only repeat
   * the followed series’ own.
   *
   * @default null
   */
  followSeries: string | null;
  /**
   * Whether the series should be focused whenever the user hovers the pointer
   * over a part of it in the chart.
   *
   * @default false
   */
  focusOnHover: boolean;
  /**
   * Whether the series should be focused whenever the user clicks/taps a part
   * of it in the chart.
   *
   * @default false
   */
  focusOnClick: boolean;
  /**
   * Whether the category should be focused whenever the user hovers the pointer
   * over a category of the series in the chart.
   *
   * @default false
   */
  focusCategoryOnHover: boolean;
  /**
   * Whether the category should be focused whenever the user clicks/taps a
   * category of the series in the chart.
   *
   * @default false
   */
  focusCategoryOnClick: boolean;
  /**
   * Whether to show the pointer cursor when the user mouses over the series
   * shapes in the chart.
   *
   * Sets `cursor: pointer` on the series’ shapes (bars, markers, labels and
   * line/area paths — or its pie slices), advertising that clicking does
   * something. Typically paired with the `onSeriesClick`/`onSliceClick`
   * callbacks or `focusOnClick`, which make the shapes clickable but leave the
   * cursor unchanged by default.
   *
   * @default false
   */
  showPointer: boolean;
  /**
   * Whether to show the series as focused when the value axis it belongs to is
   * focused.
   *
   * @default true
   */
  useAxisFocus: boolean;
}

/** The cap drawn on the outer end of a stack, on the series that are its outer series. */
export interface SeriesStackOuterCapConfig {
  /**
   * The size of the cap (in pixels) for series that are an outer series of the
   * stack.
   *
   * @default 5
   */
  size: number;
  /**
   * The type (point, curve, round, use null for none) of cap for series that
   * are an outer series of the stack.
   *
   * Caps only the outer end of the whole stack rather than every segment; pairs
   * with `series[].cap.onlyStackOuter`.
   *
   * @default null
   */
  type: CapType | null;
  /**
   * Whether to expand the base of caps for series that are an outer series of
   * the stack when the size of the cap is greater than the extent of the bar.
   *
   * @default true
   */
  expand: boolean;
}

export interface SeriesStackConfig {
  /**
   * Whether to ignore this series stack and treat it as though it were not
   * specified.
   *
   * @default false
   */
  ignore: boolean;
  /**
   * The unique identifier for the series stack so it can be referenced by
   * series that belong to it.
   *
   * Referenced by `series[].stack` to place series in this stack. Stacked
   * series draw on top of one another and animate as a single gapless unit —
   * each segment’s baseline follows the tweened top of the segment below it
   * throughout a transition.
   *
   * @default SS${index}
   */
  id: string;
  /**
   * The unique identifier of the value axis that the series stack belongs to.
   *
   * @default sole axis id
   */
  axis?: string;
  /**
   * The cap drawn on the outer end of the stack, on the series that are its
   * outer series.
   *
   * @default { size: 5, type: null, expand: true }
   */
  outerCap: SeriesStackOuterCapConfig;
}

export interface SeriesGroupConfig {
  /**
   * Whether to ignore this series group and treat it as though it were not
   * specified.
   *
   * @default false
   */
  ignore: boolean;
  /**
   * The unique identifier for the series group so it can be referenced by
   * series that belong to it.
   *
   * @default SG${index}
   */
  id: string;
}

export interface GradientStop {
  /**
   * The position of the stop, as a fraction (0 - 1) of the length of the
   * gradient.
   */
  offset: number;
  /** The color of the stop. */
  color: string;
  /** The opacity (0 - 1) of the stop. */
  opacity: number;
}

export interface LinearGradientConfig {
  /**
   * Whether to ignore this linear gradient and treat it as though it were not
   * specified.
   *
   * @default false
   */
  ignore: boolean;
  /**
   * The unique identifier for the gradient so that it can be referenced for
   * use.
   *
   * @default LG${index}
   */
  id: string;
  /**
   * The x1 start position of the svg linear gradient, as a fraction (0 - 1) of
   * the shape bounds.
   *
   * @default 0
   */
  x1: number;
  /**
   * The x2 end position of the svg linear gradient, as a fraction (0 - 1) of
   * the shape bounds.
   *
   * @default 1
   */
  x2: number;
  /**
   * The y1 start position of the svg linear gradient, as a fraction (0 - 1) of
   * the shape bounds.
   *
   * @default 0
   */
  y1: number;
  /**
   * The y2 end position of the svg linear gradient, as a fraction (0 - 1) of
   * the shape bounds.
   *
   * @default 1
   */
  y2: number;
  /**
   * The rotation (in degrees, -360 to 360) applied to the svg linear gradient.
   *
   * @default 0
   */
  rotation: number;
  /**
   * The list of svg gradient stops, each placing a color at a position along
   * the gradient (at least one stop must be given).
   */
  stops?: GradientStop[];
}

export interface RadialGradientConfig {
  /**
   * Whether to ignore this radial gradient and treat it as though it were not
   * specified.
   *
   * @default false
   */
  ignore: boolean;
  /**
   * The unique identifier for the gradient so that it can be referenced for
   * use.
   *
   * @default RG${index}
   */
  id: string;
  /**
   * The cx center x position of the svg radial gradient, as a fraction (0 - 1)
   * of the shape bounds.
   *
   * @default 0.5
   */
  cx: number;
  /**
   * The cy center y position of the svg radial gradient, as a fraction (0 - 1)
   * of the shape bounds.
   *
   * @default 0.5
   */
  cy: number;
  /**
   * The fx focal x position of the svg radial gradient, as a fraction (0 - 1)
   * of the shape bounds.
   *
   * @default 0.5
   */
  fx: number;
  /**
   * The fy focal y position of the svg radial gradient, as a fraction (0 - 1)
   * of the shape bounds.
   *
   * @default 0.5
   */
  fy: number;
  /**
   * The r radius of the svg radial gradient, as a fraction (0 - 1) of the shape
   * bounds.
   *
   * @default 0.5
   */
  r: number;
  /**
   * The rotation (in degrees, -360 to 360) applied to the svg radial gradient.
   *
   * @default 0
   */
  rotation: number;
  /**
   * The list of svg gradient stops, each placing a color at a position along
   * the gradient (at least one stop must be given).
   */
  stops?: GradientStop[];
}

/** A fully defaulted built-in SVG pattern definition. */
export interface PatternConfig {
  /**
   * Whether to ignore this pattern and treat it as though it were not
   * specified.
   *
   * @default false
   */
  ignore: boolean;
  /**
   * The unique identifier for the pattern so that it can be referenced for use.
   *
   * @default P${index}
   */
  id: string;
  /** The built-in pattern type (lines, crosshatch, or dots). */
  type: PatternType;
  /**
   * The screen-space distance (in pixels) between repeated pattern marks.
   *
   * @default 8
   */
  spacing: number;
  /**
   * The color of the pattern marks: use "series" for the owning series color or
   * "currentColor" to follow the host page CSS color.
   *
   * @default "series"
   */
  foregroundColor: PatternColor;
  /**
   * The opacity (0 - 1) of the pattern marks.
   *
   * @default 1
   */
  foregroundOpacity: number;
  /**
   * The color behind the pattern marks: use "series" for the owning series
   * color, "currentColor" to follow the host page CSS color, or null for a
   * transparent background.
   *
   * @default null
   */
  backgroundColor: PatternColor | null;
  /**
   * The opacity (0 - 1) of the pattern background when backgroundColor is not
   * null.
   *
   * @default 1
   */
  backgroundOpacity: number;
  /**
   * The clockwise rotation (in degrees, -360 to 360) of a lines or crosshatch
   * pattern.
   *
   * Default:
   * - `45` — when type is lines or crosshatch
   */
  rotation?: number;
  /**
   * The width (in pixels) of the strokes in a lines or crosshatch pattern.
   *
   * Default:
   * - `2` — when type is lines or crosshatch
   */
  lineWidth?: number;
  /**
   * The radius (in pixels) of each dot in a dots pattern.
   *
   * Default:
   * - `2` — when type is dots
   */
  radius?: number;
}

type PatternInputConfigBase = Omit<PatternConfig, 'type' | 'rotation' | 'lineWidth' | 'radius'>;

export type PatternInputConfig =
  | (PatternInputConfigBase & { type: 'lines'; rotation: number; lineWidth: number; radius?: never })
  | (PatternInputConfigBase & { type: 'crosshatch'; rotation: number; lineWidth: number; radius?: never })
  | (PatternInputConfigBase & { type: 'dots'; radius: number; rotation?: never; lineWidth?: never });

/** Properties that can be shared by every built-in pattern type. */
export type PatternDefaultsConfig = Pick<PatternConfig,
  'spacing' | 'foregroundColor' | 'foregroundOpacity' | 'backgroundColor' | 'backgroundOpacity'>;

export interface ConfigValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export type ConfigDiagnosticSeverity = 'error' | 'warning';

export interface ConfigDiagnostic {
  path: (string | number)[];
  severity: ConfigDiagnosticSeverity;
  message: string;
  /** The offending key names (capped) when the message reports invalid properties. */
  invalidProperties?: string[];
  source: 'mochart';
}

export interface DetailedConfigValidation extends ConfigValidation {
  diagnostics: ConfigDiagnostic[];
}

/** The fully built config returned by buildMochartConfig (all defaults applied). */
export interface MochartConfig {
  /**
   * An optional identifier for the config (any value; the chart only compares
   * it — a changed id resets the chart)
   */
  id?: unknown;
  /** Carried through from the input config when it supplied one; defaults never add it. */
  version?: string;
  /** Configure the chart accessibility features and screen-reader labels */
  accessibility: AccessibilityConfig;
  /** Configure the chart animation settings */
  animation: AnimationConfig;
  /** Configure general settings of the chart */
  chart: ChartConfig;
  /** Configure the color palettes to use for collections of series */
  colorPalette: ColorPaletteConfig;
  /**
   * Configure the band marking plot edges that have data hidden behind them
   * (applies when chart.type is xy)
   */
  clipIndicator: ClipIndicatorConfig;
  /**
   * Configure the crosshair styling and behavior when a category and/or series
   * is focused (applies when chart.type is xy)
   */
  crosshair: CrosshairConfig;
  /** Configure the chart category axis content and styling */
  categoryAxis: CategoryAxisConfig;
  /** Configure the chart legend which itemizes the series */
  legend: LegendConfig;
  /** Configure linear gradients to be applied to series */
  linearGradients: LinearGradientConfig[];
  /** Configure built-in patterns to be applied to series fills */
  patterns: PatternConfig[];
  /**
   * Configure the pie/donut slice geometry and slice labels (applies when
   * chart.type is pie)
   */
  pie: PieConfig;
  /** Configure the chart plot content and styling */
  plot: PlotConfig;
  /** Configure radial gradients to be applied to series */
  radialGradients: RadialGradientConfig[];
  /** Configure the chart value axes content and styling */
  valueAxes: ValueAxisConfig[];
  /** Configure the chart series */
  series: SeriesConfig[];
  /** Configure the grouping of series */
  seriesGroups: SeriesGroupConfig[];
  /** Configure the stacking of series */
  seriesStacks: SeriesStackConfig[];
  /** Configure the chart title */
  title: TitleConfig;
  /** Configure the chart tooltip styling and behavior */
  tooltip: TooltipConfig;
  /** The validation result attached when the config was built: the valid flag, plus any error and warning messages. */
  validation: ConfigValidation;
}

type OneOrMany<T> = T | T[];

/** Everything a config value can be that is a value rather than a structure. */
type ConfigLeaf = string | number | boolean | bigint | symbol | null | undefined;

/**
 * `Partial`, applied all the way down: a nested config object may be given with
 * only the members that differ from the default, because the config machinery
 * deep-merges each layer.
 *
 * Arrays are left alone rather than becoming arrays of partials — a `stops` or
 * `ticks` array replaces the default wholesale, so its entries are whole
 * entries. Primitives are left alone too, which is what keeps `SeriesColor`'s
 * `ColorMode | (string & {})` from being mangled into `{}`.
 */
export type DeepPartial<T> =
  T extends ConfigLeaf ? T :
  T extends (...args: any[]) => any ? T :
  T extends readonly any[] ? T :
  T extends object ? { [K in keyof T]?: DeepPartial<T[K]> } :
  T;

/** `DeepPartial` for a discriminated entry: nothing supplies the `type` discriminator, so it stays required. */
type DeepPartialEntry<T> = T extends { type: unknown } ? DeepPartial<T> & Pick<T, 'type'> : never;

/** The user-facing config accepted by buildMochartConfig, before defaults are applied. */
export interface MochartInputConfig {
  /**
   * An optional identifier for the config (any value; the chart only compares
   * it — a changed id resets the chart)
   */
  id?: unknown;
  /**
   * The config format version. Optional: when omitted the config is read as
   * the current format. Include it in configs you store or share, so future
   * releases can migrate them deterministically.
   */
  version?: string;
  /** Configure the chart accessibility features and screen-reader labels */
  accessibility?: DeepPartial<AccessibilityConfig>;
  /** Configure the chart animation settings */
  animation?: DeepPartial<AnimationConfig>;
  /** Configure general settings of the chart */
  chart?: DeepPartial<ChartConfig>;
  /** Configure the color palettes to use for collections of series */
  colorPalette?: DeepPartial<ColorPaletteConfig>;
  /**
   * Configure the band marking plot edges that have data hidden behind them
   * (applies when chart.type is xy)
   */
  clipIndicator?: DeepPartial<ClipIndicatorConfig>;
  /**
   * Configure the crosshair styling and behavior when a category and/or series
   * is focused (applies when chart.type is xy)
   */
  crosshair?: DeepPartial<CrosshairConfig>;
  /** Configure the chart category axis content and styling */
  categoryAxis?: DeepPartial<CategoryAxisConfig>;
  /** Configure the chart legend which itemizes the series */
  legend?: DeepPartial<LegendConfig>;
  /**
   * Configure the pie/donut slice geometry and slice labels (applies when
   * chart.type is pie)
   */
  pie?: DeepPartial<PieConfig>;
  /** Configure the chart plot content and styling */
  plot?: DeepPartial<PlotConfig>;
  /** Configure the chart title */
  title?: DeepPartial<TitleConfig>;
  /** Configure the chart tooltip styling and behavior */
  tooltip?: DeepPartial<TooltipConfig>;
  /** Configure linear gradients to be applied to series */
  linearGradients?: OneOrMany<DeepPartial<LinearGradientConfig>>;
  /** Configure common properties for all linear gradients */
  linearGradientDefaults?: DeepPartial<LinearGradientConfig>;
  /** Configure radial gradients to be applied to series */
  radialGradients?: OneOrMany<DeepPartial<RadialGradientConfig>>;
  /** Configure common properties for all radial gradients */
  radialGradientDefaults?: DeepPartial<RadialGradientConfig>;
  /** Configure built-in patterns to be applied to series fills */
  patterns?: OneOrMany<DeepPartialEntry<PatternInputConfig>>;
  /** Configure common properties for all patterns */
  patternDefaults?: DeepPartial<PatternDefaultsConfig>;
  /** Configure the chart value axes content and styling */
  valueAxes?: OneOrMany<DeepPartial<ValueAxisConfig>>;
  /** Configure common properties for all value axes */
  valueAxisDefaults?: DeepPartial<ValueAxisConfig>;
  /** Configure the chart series */
  series?: OneOrMany<DeepPartial<SeriesConfig>>;
  /** Configure common properties for all series */
  seriesDefaults?: DeepPartial<SeriesConfig>;
  /** Configure the grouping of series */
  seriesGroups?: OneOrMany<DeepPartial<SeriesGroupConfig>>;
  /** Configure common properties for all series groups */
  seriesGroupDefaults?: DeepPartial<SeriesGroupConfig>;
  /** Configure the stacking of series */
  seriesStacks?: OneOrMany<DeepPartial<SeriesStackConfig>>;
  /** Configure common properties for all series stacks */
  seriesStackDefaults?: DeepPartial<SeriesStackConfig>;
}
