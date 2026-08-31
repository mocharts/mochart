export const CONFIG_VERSION = '1.0.0';

export const AUTO = 'auto';
export const NONE = null;

export const TOP = 'top';
export const RIGHT = 'right';
export const BOTTOM = 'bottom';
export const LEFT = 'left';

// the four keys of both a margin and a padding
export const TOP_RIGHT_BOTTOM_LEFT = [TOP, RIGHT, BOTTOM, LEFT];

export const ELLIPSIS = '\u2026'; // or '...' ?

export const ALIGN_LEFT = 'left';
export const ALIGN_CENTER = 'center';
export const ALIGN_RIGHT = 'right';

export const ALIGNS = [
  ALIGN_LEFT, ALIGN_CENTER, ALIGN_RIGHT
];

// the tooltip values are aligned to one edge of the tooltip; there is no centered layout
export const TOOLTIP_VALUE_ALIGNS = [
  ALIGN_LEFT, ALIGN_RIGHT
];

export const VERTICAL_ALIGN_TOP = 'top';
export const VERTICAL_ALIGN_MIDDLE = 'middle';
export const VERTICAL_ALIGN_BOTTOM = 'bottom';

export const VERTICAL_ALIGNS = [
  VERTICAL_ALIGN_TOP, VERTICAL_ALIGN_MIDDLE, VERTICAL_ALIGN_BOTTOM
];

export const ANCHOR_START = 'start';
export const ANCHOR_END = 'end';
export const ANCHOR_MIDDLE = 'middle';

export const ANCHORS = [
  ANCHOR_START, ANCHOR_END, ANCHOR_MIDDLE
];

export const POSITION_TOP = 'top';
export const POSITION_BOTTOM = 'bottom';

export const POSITIONS = [
  POSITION_TOP, POSITION_BOTTOM
];

export const MISSING_VALUE_MODE_BREAK = 'break';
export const MISSING_VALUE_MODE_CONNECT = 'connect';
export const MISSING_VALUE_MODE_BASE = 'base';

export const MISSING_VALUE_MODES = [
  MISSING_VALUE_MODE_BREAK, MISSING_VALUE_MODE_CONNECT, MISSING_VALUE_MODE_BASE
];

export const DOMAIN_CHANGE_COMBINED = 'combined';
export const DOMAIN_CHANGE_STAGED = 'staged';

export const DOMAIN_CHANGES = [
  AUTO, DOMAIN_CHANGE_COMBINED, DOMAIN_CHANGE_STAGED
];

export const EASING_LINEAR = 'linear';
export const EASING_CUBIC_IN = 'cubicIn';
export const EASING_CUBIC_OUT = 'cubicOut';
export const EASING_CUBIC_IN_OUT = 'cubicInOut';

export const EASINGS = [
  EASING_LINEAR, EASING_CUBIC_IN, EASING_CUBIC_OUT, EASING_CUBIC_IN_OUT
];

export const SIDE_START = 'start';
export const SIDE_END = 'end';

export const SIDES = [
  SIDE_START, SIDE_END
];

export const TITLE_SIDE_LOW = 'low';
export const TITLE_SIDE_HIGH = 'high';

export const THRESHOLD_TITLE_SIDES = [
  TITLE_SIDE_LOW, TITLE_SIDE_HIGH
];

export const CHART_TYPE_XY = 'xy';
export const CHART_TYPE_PIE = 'pie';

export const CHART_TYPES = [
  CHART_TYPE_XY, CHART_TYPE_PIE
];

export const PIE_LABEL_TYPE_VALUE = 'value';
export const PIE_LABEL_TYPE_PERCENT = 'percent';
export const PIE_LABEL_TYPE_TITLE = 'title';
export const PIE_LABEL_TYPE_VALUE_PERCENT = 'valuePercent';
export const PIE_LABEL_TYPE_PERCENT_VALUE = 'percentValue';
export const PIE_LABEL_TYPE_TITLE_VALUE = 'titleValue';
export const PIE_LABEL_TYPE_TITLE_PERCENT = 'titlePercent';

export const PIE_LABEL_TYPES: PieLabelType[] = [
  PIE_LABEL_TYPE_VALUE, PIE_LABEL_TYPE_PERCENT, PIE_LABEL_TYPE_TITLE, PIE_LABEL_TYPE_VALUE_PERCENT,
  PIE_LABEL_TYPE_PERCENT_VALUE, PIE_LABEL_TYPE_TITLE_VALUE, PIE_LABEL_TYPE_TITLE_PERCENT
];

// No title variants: a tooltip row already renders the series title as its label.
export const PIE_TOOLTIP_VALUE_TYPE_VALUE = 'value';
export const PIE_TOOLTIP_VALUE_TYPE_PERCENT = 'percent';
export const PIE_TOOLTIP_VALUE_TYPE_VALUE_PERCENT = 'valuePercent';
export const PIE_TOOLTIP_VALUE_TYPE_PERCENT_VALUE = 'percentValue';

export const PIE_TOOLTIP_VALUE_TYPES: PieTooltipValueType[] = [
  PIE_TOOLTIP_VALUE_TYPE_VALUE, PIE_TOOLTIP_VALUE_TYPE_PERCENT, PIE_TOOLTIP_VALUE_TYPE_VALUE_PERCENT, PIE_TOOLTIP_VALUE_TYPE_PERCENT_VALUE
];

export const SCALE_ORDINAL = 'ordinal';
export const SCALE_LINEAR = 'linear';


export const TYPE_STRING = 'string';
export const TYPE_NUMBER = 'number';
export const TYPE_DATE = 'date';


export const RENDERER_BAR = 'bar';
export const RENDERER_LINE = 'line';
export const RENDERER_AREA = 'area';
export const RENDERER_NONE = 'none';

export const RENDERERS = [
  RENDERER_BAR, RENDERER_LINE, RENDERER_AREA, RENDERER_NONE
];

export const PATTERN_TYPE_LINES = 'lines';
export const PATTERN_TYPE_CROSSHATCH = 'crosshatch';
export const PATTERN_TYPE_DOTS = 'dots';

export const PATTERN_TYPES = [
  PATTERN_TYPE_LINES, PATTERN_TYPE_CROSSHATCH, PATTERN_TYPE_DOTS
];

export const CURVE_TYPE_LINEAR = 'linear';
export const CURVE_TYPE_MONOTONE_X = 'monotoneX';
export const CURVE_TYPE_MONOTONE_Y = 'monotoneY';
export const CURVE_TYPE_BASIS = 'basis';
export const CURVE_TYPE_CARDINAL = 'cardinal';
export const CURVE_TYPE_CATMULL_ROM = 'catmullRom';
export const CURVE_TYPE_NATURAL = 'natural';
export const CURVE_TYPE_STEP = 'step';
export const CURVE_TYPE_STEP_BEFORE = 'stepBefore';
export const CURVE_TYPE_STEP_AFTER = 'stepAfter';

export const CURVE_TYPES = [
  CURVE_TYPE_LINEAR, CURVE_TYPE_MONOTONE_X, CURVE_TYPE_MONOTONE_Y, CURVE_TYPE_BASIS, CURVE_TYPE_CARDINAL,
  CURVE_TYPE_CATMULL_ROM, CURVE_TYPE_NATURAL, CURVE_TYPE_STEP, CURVE_TYPE_STEP_BEFORE, CURVE_TYPE_STEP_AFTER
];

export const CAP_TYPE_POINT = 'point';
export const CAP_TYPE_CURVE = 'curve';
export const CAP_TYPE_ROUND = 'round';

export const CAP_TYPES = [
  CAP_TYPE_POINT, CAP_TYPE_CURVE, CAP_TYPE_ROUND
];

export const LABEL_POSITION_INSIDE = 'inside';
export const LABEL_POSITION_CENTER = 'center';
export const LABEL_POSITION_OUTSIDE = 'outside';

export const LABEL_POSITIONS = [
  LABEL_POSITION_INSIDE, LABEL_POSITION_CENTER, LABEL_POSITION_OUTSIDE
];

export const STYLE_STATE_NORMAL = 'normal';
export const STYLE_STATE_FOCUSED = 'focused';
export const STYLE_STATE_DEFOCUSED = 'defocused';
export const STYLE_STATES = [
  STYLE_STATE_NORMAL, STYLE_STATE_FOCUSED, STYLE_STATE_DEFOCUSED
] as const;

export const STYLE_SAME = 'same';

export const COLOR_SERIES = 'series'
export const COLOR_SERIES_INDEX = 'seriesIndex';
export const COLOR_CATEGORY_INDEX ='categoryIndex';

// Deliberately not in the ColorMode union: unlike the modes above (resolved by utils/SeriesColors), this is
// the svg/css keyword, written to the dom as is so the browser resolves it against the host page's css color.
export const COLOR_CURRENT = 'currentColor';


export const COLOR_INTERPOLATION_RGB = 'rgb';
export const COLOR_INTERPOLATION_HSL = 'hsl';
export const COLOR_INTERPOLATION_LAB = 'lab';
export const COLOR_INTERPOLATION_HCL = 'hcl';

export const COLOR_INTERPOLATIONS = [
  COLOR_INTERPOLATION_RGB, COLOR_INTERPOLATION_HSL, COLOR_INTERPOLATION_LAB, COLOR_INTERPOLATION_HCL
];

export const MARKER_SHAPE_CIRCLE = 'circle';
export const MARKER_SHAPE_CROSS = 'cross';
export const MARKER_SHAPE_DIAMOND = 'diamond';
export const MARKER_SHAPE_SQUARE = 'square';
export const MARKER_SHAPE_STAR = 'star';
export const MARKER_SHAPE_TRIANGLE = 'triangle';
export const MARKER_SHAPE_WYE = 'wye';

export const MARKER_SHAPES = [
  MARKER_SHAPE_CIRCLE, MARKER_SHAPE_CROSS, MARKER_SHAPE_DIAMOND, MARKER_SHAPE_SQUARE,
  MARKER_SHAPE_STAR, MARKER_SHAPE_TRIANGLE, MARKER_SHAPE_WYE
];

export const MARKER_SIZE_SCALE_SQRT = 'sqrt';
export const MARKER_SIZE_SCALE_LINEAR = 'linear';

export const MARKER_SIZE_SCALES = [MARKER_SIZE_SCALE_SQRT, MARKER_SIZE_SCALE_LINEAR];
// Literal union types derived from the constant values above.
export type Auto = typeof AUTO;

export type Align = typeof ALIGN_LEFT | typeof ALIGN_CENTER | typeof ALIGN_RIGHT;
export type TooltipValueAlign = typeof ALIGN_LEFT | typeof ALIGN_RIGHT;
export type VerticalAlign = typeof VERTICAL_ALIGN_TOP | typeof VERTICAL_ALIGN_MIDDLE | typeof VERTICAL_ALIGN_BOTTOM;
export type Anchor = typeof ANCHOR_START | typeof ANCHOR_END | typeof ANCHOR_MIDDLE;
export type Position = typeof POSITION_TOP | typeof POSITION_BOTTOM;
export type MissingValueMode = typeof MISSING_VALUE_MODE_BREAK | typeof MISSING_VALUE_MODE_CONNECT | typeof MISSING_VALUE_MODE_BASE;
export type DomainChange = typeof AUTO | typeof DOMAIN_CHANGE_COMBINED | typeof DOMAIN_CHANGE_STAGED;
export type AnimationEasing = typeof EASING_LINEAR | typeof EASING_CUBIC_IN | typeof EASING_CUBIC_OUT | typeof EASING_CUBIC_IN_OUT;
export type AxisSide = typeof SIDE_START | typeof SIDE_END;
export type ThresholdTitleSide = typeof TITLE_SIDE_LOW | typeof TITLE_SIDE_HIGH;
export type ChartType = typeof CHART_TYPE_XY | typeof CHART_TYPE_PIE;
export type PieLabelType =
  typeof PIE_LABEL_TYPE_VALUE | typeof PIE_LABEL_TYPE_PERCENT | typeof PIE_LABEL_TYPE_TITLE |
  typeof PIE_LABEL_TYPE_VALUE_PERCENT | typeof PIE_LABEL_TYPE_PERCENT_VALUE |
  typeof PIE_LABEL_TYPE_TITLE_VALUE | typeof PIE_LABEL_TYPE_TITLE_PERCENT;
export type PieTooltipValueType =
  typeof PIE_TOOLTIP_VALUE_TYPE_VALUE | typeof PIE_TOOLTIP_VALUE_TYPE_PERCENT |
  typeof PIE_TOOLTIP_VALUE_TYPE_VALUE_PERCENT | typeof PIE_TOOLTIP_VALUE_TYPE_PERCENT_VALUE;
export type Scale = typeof SCALE_ORDINAL | typeof SCALE_LINEAR;
export type DataType = typeof TYPE_STRING | typeof TYPE_NUMBER | typeof TYPE_DATE;
export type RendererType = typeof RENDERER_BAR | typeof RENDERER_LINE | typeof RENDERER_AREA | typeof RENDERER_NONE;
export type PatternType = typeof PATTERN_TYPE_LINES | typeof PATTERN_TYPE_CROSSHATCH | typeof PATTERN_TYPE_DOTS;
export type CurveType =
  typeof CURVE_TYPE_LINEAR | typeof CURVE_TYPE_MONOTONE_X | typeof CURVE_TYPE_MONOTONE_Y | typeof CURVE_TYPE_BASIS |
  typeof CURVE_TYPE_CARDINAL | typeof CURVE_TYPE_CATMULL_ROM | typeof CURVE_TYPE_NATURAL | typeof CURVE_TYPE_STEP |
  typeof CURVE_TYPE_STEP_BEFORE | typeof CURVE_TYPE_STEP_AFTER;
export type CapType = typeof CAP_TYPE_POINT | typeof CAP_TYPE_CURVE | typeof CAP_TYPE_ROUND;
export type LabelPosition = typeof LABEL_POSITION_INSIDE | typeof LABEL_POSITION_CENTER | typeof LABEL_POSITION_OUTSIDE;
export type ColorMode = typeof COLOR_SERIES | typeof STYLE_SAME | typeof COLOR_SERIES_INDEX | typeof COLOR_CATEGORY_INDEX;
export type ColorInterpolation =
  typeof COLOR_INTERPOLATION_RGB | typeof COLOR_INTERPOLATION_HSL | typeof COLOR_INTERPOLATION_LAB | typeof COLOR_INTERPOLATION_HCL;
export type MarkerShape =
  typeof MARKER_SHAPE_CIRCLE | typeof MARKER_SHAPE_CROSS | typeof MARKER_SHAPE_DIAMOND | typeof MARKER_SHAPE_SQUARE |
  typeof MARKER_SHAPE_STAR | typeof MARKER_SHAPE_TRIANGLE | typeof MARKER_SHAPE_WYE;
export type MarkerSizeScale = typeof MARKER_SIZE_SCALE_SQRT | typeof MARKER_SIZE_SCALE_LINEAR;
