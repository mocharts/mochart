import validators from './validators';
import { createStyleValidators, lineMembers, styleMembers } from './styleStateValidators';

import {
  AUTO, NONE, RENDERERS, CURVE_TYPES, CAP_TYPES, LABEL_POSITIONS, COLOR_INTERPOLATIONS, MARKER_SHAPES, MARKER_SIZE_SCALES,
  COLOR_SERIES, STYLE_SAME, COLOR_SERIES_INDEX, COLOR_CATEGORY_INDEX, MISSING_VALUE_MODES, RENDERER_AREA, RENDERER_BAR,
  CURVE_TYPE_CARDINAL, CURVE_TYPE_CATMULL_ROM
} from '../core/constants';
import type { DeepPartial, SeriesConfig } from '../../types/config';
import type { Validator } from '@mochart/movalid';

type ColorCondition = { colorProperty?: SeriesConfig['colorProperty'], colorScale?: DeepPartial<SeriesConfig['colorScale']> };
type StackCondition = Pick<SeriesConfig, 'stack'>;
type GradientCondition = Pick<SeriesConfig, 'gradient'>;
type RendererCondition = Pick<SeriesConfig, 'renderer'>;
type ColorRendererCondition = RendererCondition & { colorScale?: DeepPartial<SeriesConfig['colorScale']> | null };
type PatternCondition = Pick<SeriesConfig, 'renderer' | 'gradient'>;
type ShapeFillCondition = { shapeStyle?: DeepPartial<SeriesConfig['shapeStyle']> };
type CurveCondition = { curve?: DeepPartial<SeriesConfig['curve']> };

function seriesColor(allowSeries: boolean, allowSame: boolean): Validator {
  const keywords: string[] = [];
  if (allowSeries) keywords.push(COLOR_SERIES);
  if (allowSame) keywords.push(STYLE_SAME);
  keywords.push(COLOR_SERIES_INDEX, COLOR_CATEGORY_INDEX);
  return validators.svgColor().orOneOf(keywords);
}

// shapeStyle defines the series colour itself, so it cannot reference it with 'series'
const seriesStyle = createStyleValidators(allowSame => seriesColor(true, allowSame));
const ownStyle = createStyleValidators(allowSame => seriesColor(false, allowSame));

const stackSuffix = 'when stack is not ' + NONE;
const stackNoneSuffix = 'when stack is ' + NONE;

const colorPropertySuffix = 'when colorProperty is not ' + NONE;
const colorPropertyNoneSuffix = 'when colorProperty is ' + NONE;
const colorBaseSuffix = 'when colorProperty is not ' + NONE + ' and colorScale.base.value is not ' + NONE;
const colorBaseNoneSuffix = 'when colorProperty is not ' + NONE + ' and colorScale.base.value is ' + NONE;

const stackRule = { condition: ({ stack }: StackCondition) => stack !== NONE, suffix: stackSuffix };
const stackNoneRule = { condition: ({ stack }: StackCondition) => stack === NONE, suffix: stackNoneSuffix };
const gradientRule = { condition: ({ gradient }: GradientCondition) => gradient !== NONE, suffix: 'when gradient is not ' + NONE };
const colorPropertyRule = { condition: ({ colorProperty }: ColorCondition) => colorProperty !== NONE, suffix: colorPropertySuffix };
const categoryIndexFillRule = {
  condition: ({ shapeStyle }: ShapeFillCondition) =>
    shapeStyle?.normal?.fillColor === COLOR_CATEGORY_INDEX
    || shapeStyle?.focused?.fillColor === COLOR_CATEGORY_INDEX
    || shapeStyle?.defocused?.fillColor === COLOR_CATEGORY_INDEX,
  suffix: 'when a shapeStyle fillColor is ' + COLOR_CATEGORY_INDEX
};
const colorPropertyNoneRule = { condition: ({ colorProperty }: ColorCondition) => colorProperty === NONE, suffix: colorPropertyNoneSuffix };
const curveParamSuffix = 'when curve.type is ' + CURVE_TYPE_CARDINAL + ' or ' + CURVE_TYPE_CATMULL_ROM;
const curveParamRule = {
  condition: ({ curve }: CurveCondition) => curve?.type === CURVE_TYPE_CARDINAL || curve?.type === CURVE_TYPE_CATMULL_ROM,
  suffix: curveParamSuffix
};
const curveNoParamRule = {
  condition: ({ curve }: CurveCondition) => !(curve?.type === CURVE_TYPE_CARDINAL || curve?.type === CURVE_TYPE_CATMULL_ROM),
  suffix: 'for the other curve types'
};
const colorBaseRule = { condition: ({ colorProperty, colorScale }: ColorCondition) => colorProperty !== NONE && (colorScale?.base?.value ?? NONE) !== NONE, suffix: colorBaseSuffix };
const colorBaseNoneRule = { condition: ({ colorProperty, colorScale }: ColorCondition) => colorProperty !== NONE && (colorScale?.base?.value ?? NONE) === NONE, suffix: colorBaseNoneSuffix };

const labelBaseSideValidators = () => validators.partialObjectWithShape({
  minPositionFraction: validators.numberMinMax(0, 1).orOneOf([NONE, AUTO]),
  maxPositionFraction: validators.numberMinMax(0, 1).orOneOf([NONE, AUTO]),
  offset: validators.number().orEqual(AUTO),
  position: validators.oneOf([AUTO].concat(LABEL_POSITIONS))
}, true);

export default function getValidators(config: DeepPartial<SeriesConfig>, pieMode = false) {
  const supportsFill = ({ renderer }: RendererCondition) =>
    pieMode || renderer === RENDERER_AREA || renderer === RENDERER_BAR;
  const nonFillRendererRule = {
    condition: (condition: RendererCondition) => !supportsFill(condition),
    suffix: 'when chart type is not pie and renderer is not area or bar'
  };
  const fillRendererRule = {
    condition: supportsFill,
    suffix: 'when chart type is pie or renderer is area or bar'
  };
  const supportsColorProperty = ({ renderer, colorScale }: ColorRendererCondition) =>
    !pieMode && renderer === RENDERER_BAR && colorScale !== NONE;
  const colorRendererRule = {
    condition: supportsColorProperty,
    suffix: 'when chart type is xy and renderer is bar, and colorScale is not ' + NONE
  };
  const nonColorRendererRule = {
    condition: (condition: ColorRendererCondition) => !supportsColorProperty(condition),
    suffix: 'when chart type is not xy or renderer is not bar, or colorScale is ' + NONE
  };
  const fillRendererWithoutGradientRule = {
    condition: (condition: PatternCondition) => supportsFill(condition) && condition.gradient === NONE,
    suffix: 'when chart type is pie or renderer is area or bar, and gradient is ' + NONE
  };
  return {
    id: validators.id(),
    order: validators.integer(),
    axis: validators.string(),
    stack: validators.string().orEqual(NONE),
    group: validators.string().orEqual(NONE),
    property: validators.propertyRequired(),
    rangeProperty: validators.propertyOptional(),
    errorLowProperty: validators.conditional([
      { ...stackRule, validator: validators.equal(NONE) },
      { ...stackNoneRule, validator: validators.propertyOptional() },
    ], config),
    errorHighProperty: validators.conditional([
      { ...stackRule, validator: validators.equal(NONE) },
      { ...stackNoneRule, validator: validators.propertyOptional() },
    ], config),
    markerProperty: validators.propertyOptional(),
    labelProperty: validators.propertyOptional(),
    tooltipProperty: validators.propertyOptional(),
    colorProperty: validators.conditional([
      { ...colorRendererRule, validator: validators.propertyOptional() },
      { ...nonColorRendererRule, validator: validators.equal(NONE) }
    ], config),
    allowAbsentDataProperties: validators.boolean(),
    ignore: validators.boolean(),
    renderer: validators.oneOf(RENDERERS),
    missingValueMode: validators.oneOf(MISSING_VALUE_MODES),
    partialRangeIsMissing: validators.boolean(),
    curve: validators.partialObjectWithShape({
      type: validators.oneOf(CURVE_TYPES),
      param: validators.conditional([
        { ...curveParamRule, validator: validators.numberMinMax(0, 1) },
        { ...curveNoParamRule, validator: validators.equal(undefined) }
      ], config)
    }, true),
    bar: validators.partialObjectWithShape({
      widthFraction: validators.numberMinMax(0, 1),
      alignFraction: validators.numberMinMax(0, 1),
      minExtent: validators.numberMin(0)
    }, true),
    cap: validators.partialObjectWithShape({
      size: validators.numberMin(0),
      type: validators.oneOf(CAP_TYPES).orEqual(NONE),
      expand: validators.boolean(),
      onlyStackOuter: validators.boolean()
    }, true),
    errorBar: validators.partialObjectWithShape({
      capSize: validators.numberMin(0),
      style: seriesStyle.styleStates(lineMembers)
    }, true),
    valueLabel: validators.string().orEqual(NONE),
    valueFormat: validators.numberFormat().orOneOf([NONE, AUTO]),
    valuePrefix: validators.string().orEqual(NONE),
    valueSuffix: validators.string().orEqual(NONE),
    useTitleForValueLabel: validators.boolean(),
    title: validators.string().orEqual(NONE),
    shapeStyle: ownStyle.styleStates(styleMembers),
    label: validators.partialObjectWithShape({
      format: validators.numberFormat().orOneOf([NONE, AUTO]),
      prefix: validators.string().orEqual(NONE),
      suffix: validators.string().orEqual(NONE),
      textStyle: seriesStyle.styleStates(styleMembers),
      minPositionFraction: validators.numberMinMax(0, 1).orEqual(NONE),
      maxPositionFraction: validators.numberMinMax(0, 1).orEqual(NONE),
      minRangeFraction: validators.numberMinMax(0, 1).orEqual(NONE),
      offset: validators.number(),
      position: validators.oneOf(LABEL_POSITIONS),
      aboveBase: labelBaseSideValidators(),
      belowBase: labelBaseSideValidators()
    }, true),
    gradient: validators.conditional([
      { ...nonFillRendererRule, validator: validators.equal(NONE) },
      { ...colorPropertyRule, validator: validators.equal(NONE) },
      { ...categoryIndexFillRule, validator: validators.equal(NONE) },
      { ...fillRendererRule, validator: validators.string().orEqual(NONE) }
    ], config),
    pattern: validators.conditional([
      { ...nonFillRendererRule, validator: validators.equal(NONE) },
      { ...gradientRule, validator: validators.equal(NONE) },
      { ...fillRendererWithoutGradientRule, validator: validators.string().orEqual(NONE) }
    ], config),
    colorScale: validators.partialObjectWithShape({
      interpolation: validators.conditional([
        { ...colorPropertyRule, validator: validators.oneOf(COLOR_INTERPOLATIONS) },
        { ...colorPropertyNoneRule, validator: validators.equal(NONE) }
      ], config),
      min: validators.conditional([
        { ...colorPropertyNoneRule, validator: validators.equal(NONE) },
        { ...colorBaseRule, validator: validators.equal(NONE) },
        { ...colorBaseNoneRule, validator: validators.color() },
      ], config),
      max: validators.conditional([
        { ...colorPropertyNoneRule, validator: validators.equal(NONE) },
        { ...colorBaseRule, validator: validators.equal(NONE) },
        { ...colorBaseNoneRule, validator: validators.color() },
      ], config),
      missing: validators.conditional([
        { ...colorPropertyNoneRule, validator: validators.equal(NONE) },
        { ...colorPropertyRule, validator: validators.color().orEqual(NONE) },
      ], config),
      base: validators.partialObjectWithShape({
        value: validators.number().orEqual(NONE),
        aboveMin: validators.conditional([
          { ...colorPropertyNoneRule, validator: validators.equal(NONE) },
          { ...colorBaseNoneRule, validator: validators.equal(NONE) },
          { ...colorBaseRule, validator: validators.color() },
        ], config),
        aboveMax: validators.conditional([
          { ...colorPropertyNoneRule, validator: validators.equal(NONE) },
          { ...colorBaseNoneRule, validator: validators.equal(NONE) },
          { ...colorBaseRule, validator: validators.color() },
        ], config),
        belowMin: validators.conditional([
          { ...colorPropertyNoneRule, validator: validators.equal(NONE) },
          { ...colorBaseNoneRule, validator: validators.equal(NONE) },
          { ...colorBaseRule, validator: validators.color() },
        ], config),
        belowMax: validators.conditional([
          { ...colorPropertyNoneRule, validator: validators.equal(NONE) },
          { ...colorBaseNoneRule, validator: validators.equal(NONE) },
          { ...colorBaseRule, validator: validators.color() },
        ], config)
      }, true)
    }, true).orEqual(NONE),
    marker: validators.partialObjectWithShape({
      shape: validators.oneOf([NONE, ...MARKER_SHAPES]),
      minSize: validators.numberMin(0),
      showForMissingValues: validators.boolean(),
      size: validators.numberMin(0),
      sizeScale: validators.oneOf(MARKER_SIZE_SCALES),
      style: seriesStyle.styleStates(styleMembers)
    }, true),
    showInLegend: validators.boolean(),
    showInTooltip: validators.boolean(),
    showColorInLegend: validators.boolean(),
    showColorInTooltip: validators.boolean(),
    filterable: validators.boolean(),
    followSeries: validators.string().orEqual(NONE),
    focusOnHover: validators.boolean(),
    focusOnClick: validators.boolean(),
    focusCategoryOnHover: validators.boolean(),
    focusCategoryOnClick: validators.boolean(),
    showPointer: validators.boolean(),
    useAxisFocus: validators.boolean(),
    animateBaseFromAdjacent: validators.boolean()
  };
}
