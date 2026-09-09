import {
  AUTO, NONE, RENDERER_AREA, RENDERER_BAR, RENDERER_LINE, RENDERER_NONE, MARKER_SHAPE_CIRCLE, MARKER_SIZE_SCALE_SQRT, CURVE_TYPE_LINEAR,
  STYLE_SAME, COLOR_SERIES, COLOR_SERIES_INDEX, COLOR_CATEGORY_INDEX, COLOR_CURRENT, LABEL_POSITION_CENTER,
  COLOR_INTERPOLATION_HCL, MISSING_VALUE_MODE_BREAK, STYLE_STATES
} from '../core/constants';

import { resolveDefaults, conditionalDefault, defaultRule } from './conditionalDefault';
import type { DeepPartial, SeriesConfig } from '../../types/config';

const colorPropertySuffix = 'when colorProperty is not ' + NONE;
const colorPropertyNoneSuffix = 'when colorProperty is ' + NONE;
const colorBaseSuffix = 'when colorProperty is not ' + NONE + ' and colorScale.base.value is not ' + NONE;
const colorBaseNoneSuffix = 'when colorProperty is not ' + NONE + ' and colorScale.base.value is ' + NONE;

export default function getDefaults(config: DeepPartial<SeriesConfig> = {}, index: number, soleValueAxisId: string | null, soleSeriesStackId: string | null, soleSeriesGroupId: string | null, soleGradientConfigId: string | null, solePatternConfigId: string | null, pieMode = false): Partial<SeriesConfig> {
  return resolveDefaults(getRegularDefaults(), getConditionalDefaults, config, index, soleValueAxisId, soleSeriesStackId, soleSeriesGroupId, soleGradientConfigId, solePatternConfigId, pieMode);
}

export function getRegularDefaults() {
  return {
    rangeProperty: NONE,
    errorLowProperty: NONE,
    errorHighProperty: NONE,
    markerProperty: NONE,
    labelProperty: NONE,
    tooltipProperty: NONE,
    colorProperty: NONE,
    allowAbsentDataProperties: false,
    stack: NONE,
    group: NONE,
    gradient: NONE,
    pattern: NONE,
    ignore: false,
    renderer: RENDERER_LINE,
    missingValueMode: MISSING_VALUE_MODE_BREAK,
    partialRangeIsMissing: false,
    curve: { type: CURVE_TYPE_LINEAR },
    bar: {
      widthFraction: 1,
      alignFraction: 0.5,
      minExtent: 0
    },
    cap: {
      size: 5,
      type: NONE,
      expand: true,
      onlyStackOuter: false
    },
    errorBar: {
      capSize: 6,
      style: {
        normal: { strokeColor: COLOR_SERIES, strokeOpacity: 0.9, strokeWidth: 1.5, strokeDashArray: NONE },
        focused: { strokeColor: STYLE_SAME, strokeOpacity: 1, strokeWidth: 1.5, strokeDashArray: STYLE_SAME },
        defocused: { strokeColor: STYLE_SAME, strokeOpacity: 0.5, strokeWidth: 1.5, strokeDashArray: STYLE_SAME }
      }
    },
    valueLabel: NONE,
    valueFormat: AUTO,
    valuePrefix: NONE,
    valueSuffix: NONE,
    useTitleForValueLabel: true,
    title: NONE,
    label: {
      format: AUTO,
      prefix: NONE,
      suffix: NONE,
      textStyle: {
        normal: { strokeColor: COLOR_CURRENT, strokeOpacity: 0.8, strokeWidth: 1, strokeDashArray: NONE, fillColor: COLOR_CURRENT, fillOpacity: 0.8 },
        focused: { strokeColor: STYLE_SAME, strokeOpacity: 1, strokeWidth: 1, strokeDashArray: STYLE_SAME, fillColor: STYLE_SAME, fillOpacity: 1 },
        defocused: { strokeColor: STYLE_SAME, strokeOpacity: 1, strokeWidth: 1, strokeDashArray: STYLE_SAME, fillColor: STYLE_SAME, fillOpacity: 1 }
      },
      minPositionFraction: NONE,
      maxPositionFraction: NONE,
      minRangeFraction: NONE,
      offset: 0,
      position: LABEL_POSITION_CENTER,
      aboveBase: { minPositionFraction: AUTO, maxPositionFraction: AUTO, offset: AUTO, position: AUTO },
      belowBase: { minPositionFraction: AUTO, maxPositionFraction: AUTO, offset: AUTO, position: AUTO }
    },
    // Only the shape's colors are regular defaults; its opacities and widths are renderer-conditional.
    shapeStyle: {
      normal: { strokeColor: COLOR_SERIES_INDEX, strokeDashArray: NONE, fillColor: COLOR_SERIES_INDEX },
      focused: { strokeColor: STYLE_SAME, strokeDashArray: STYLE_SAME, fillColor: STYLE_SAME },
      defocused: { strokeColor: STYLE_SAME, strokeDashArray: STYLE_SAME, fillColor: STYLE_SAME }
    },
    colorScale: {
      interpolation: NONE,
      min: NONE,
      max: NONE,
      missing: NONE,
      base: {
        value: NONE,
        aboveMin: NONE,
        aboveMax: NONE,
        belowMin: NONE,
        belowMax: NONE
      }
    },
    marker: {
      minSize: 1,
      showForMissingValues: false,
      size: 6,
      sizeScale: MARKER_SIZE_SCALE_SQRT,
      style: {
        normal: { strokeColor: COLOR_SERIES, strokeOpacity: 0.9, strokeWidth: 1, strokeDashArray: NONE, fillColor: COLOR_SERIES, fillOpacity: 0.9 },
        focused: { strokeColor: STYLE_SAME, strokeOpacity: 1, strokeWidth: 3, strokeDashArray: STYLE_SAME, fillColor: STYLE_SAME, fillOpacity: 1 },
        defocused: { strokeColor: STYLE_SAME, strokeOpacity: 0.8, strokeWidth: 1, strokeDashArray: STYLE_SAME, fillColor: STYLE_SAME, fillOpacity: 0.8 }
      }
    },
    showInTooltip: true,
    filterable: true,
    followSeries: NONE,
    focusOnHover: false,
    focusOnClick: false,
    focusCategoryOnHover: false,
    focusCategoryOnClick: false,
    showPointer: false,
    useAxisFocus: true
  };
}

function isCategoryIndexColored({ shapeStyle }: SeriesConfig): boolean {
  const normal = shapeStyle !== null && typeof shapeStyle === 'object' && !Array.isArray(shapeStyle) ? shapeStyle.normal : undefined;
  const { strokeColor, fillColor } = normal !== null && typeof normal === 'object' ? normal : {};
  return strokeColor === COLOR_CATEGORY_INDEX || fillColor === COLOR_CATEGORY_INDEX;
}

function usesFillRenderer({ renderer }: SeriesConfig, pieMode: boolean): boolean {
  return pieMode || renderer === RENDERER_AREA || renderer === RENDERER_BAR;
}

function isCategoryIndexFilled({ shapeStyle }: SeriesConfig): boolean {
  const states = shapeStyle !== null && typeof shapeStyle === 'object' && !Array.isArray(shapeStyle)
    ? shapeStyle as unknown as Record<string, { fillColor?: unknown } | undefined>
    : {};
  return STYLE_STATES.some(state => states[state]?.fillColor === COLOR_CATEGORY_INDEX);
}

function supportsAutomaticGradient(config: SeriesConfig, pieMode: boolean): boolean {
  return usesFillRenderer(config, pieMode) && config.colorProperty === NONE && !isCategoryIndexFilled(config);
}

const followSeriesSuffix = 'when followSeries is not ' + NONE;
const followSeriesNoneSuffix = 'when followSeries is ' + NONE;
const nonColorRendererSuffix = 'when chart type is not xy or renderer is not bar';
const colorRendererSuffix = 'when chart type is xy and renderer is bar';
const categoryIndexColorSuffix = 'when shapeStyle.normal.strokeColor or shapeStyle.normal.fillColor is ' + COLOR_CATEGORY_INDEX;
const notCategoryIndexColorSuffix = 'when neither shapeStyle.normal.strokeColor nor shapeStyle.normal.fillColor is ' + COLOR_CATEGORY_INDEX;

export function getConditionalDefaults(configWithRegularDefaults: SeriesConfig, index: number, soleValueAxisId: string | null, soleSeriesStackId: string | null, soleSeriesGroupId: string | null, soleGradientConfigId: string | null, solePatternConfigId: string | null, pieMode = false) {
  return {
    id: conditionalDefault([
      { ...defaultRule, default: 'S' + index, defaultText: 'S${index}' }
    ], configWithRegularDefaults, index),
    order: conditionalDefault([
      { ...defaultRule, default: index, defaultText: '${index}' }
    ], configWithRegularDefaults, index),
    axis: conditionalDefault([
      { ...defaultRule, default: soleValueAxisId === null ? undefined : soleValueAxisId, defaultText: 'sole axis id' }
    ], configWithRegularDefaults, index),
    stack: conditionalDefault([
      { ...defaultRule, default: soleSeriesStackId, defaultText: 'sole stack id' }
    ], configWithRegularDefaults, index),
    group: conditionalDefault([
      { ...defaultRule, default: soleSeriesGroupId, defaultText: 'sole group id' }
    ], configWithRegularDefaults, index),
    gradient: conditionalDefault([
      { condition: config => supportsAutomaticGradient(config, pieMode), suffix: 'when chart type is pie or renderer is area or bar, colorProperty is null, and no shapeStyle fillColor is ' + COLOR_CATEGORY_INDEX, default: soleGradientConfigId, defaultText: 'sole gradient id' },
      { ...defaultRule, default: NONE }
    ], configWithRegularDefaults, index),
    pattern: conditionalDefault([
      { condition: config => usesFillRenderer(config, pieMode), suffix: 'when chart type is pie or renderer is area or bar', default: solePatternConfigId, defaultText: 'sole pattern id' },
      { ...defaultRule, default: NONE }
    ], configWithRegularDefaults, index),
    animateBaseFromAdjacent: conditionalDefault([
      { condition: ({ renderer }) => renderer === RENDERER_BAR, suffix: 'when renderer is ' + RENDERER_BAR, default: false },
      { condition: ({ renderer }) => renderer === RENDERER_LINE, suffix: 'when renderer is ' + RENDERER_LINE, default: true },
      { condition: ({ renderer }) => renderer === RENDERER_AREA, suffix: 'when renderer is ' + RENDERER_AREA, default: true },
      { condition: ({ renderer }) => renderer === RENDERER_NONE, suffix: 'when renderer is ' + RENDERER_NONE, default: false },
      { ...defaultRule, default: false }
    ], configWithRegularDefaults, index),
    shapeStyle: {
      normal: {
        strokeOpacity: conditionalDefault([
          { condition: ({ renderer }) => renderer === RENDERER_BAR, suffix: 'when renderer is ' + RENDERER_BAR, default: 0.8 },
          { condition: ({ renderer }) => renderer === RENDERER_LINE, suffix: 'when renderer is ' + RENDERER_LINE, default: 0.9 },
          { condition: ({ renderer }) => renderer === RENDERER_AREA, suffix: 'when renderer is ' + RENDERER_AREA, default: 0.8 },
          { condition: ({ renderer }) => renderer === RENDERER_NONE, suffix: 'when renderer is ' + RENDERER_NONE, default: 0.9 },
          { ...defaultRule, default: 0.8 }
        ], configWithRegularDefaults, index),
        strokeWidth: conditionalDefault([
          { condition: ({ renderer }) => renderer === RENDERER_BAR, suffix: 'when renderer is ' + RENDERER_BAR, default: 0 },
          { condition: ({ renderer }) => renderer === RENDERER_LINE, suffix: 'when renderer is ' + RENDERER_LINE, default: 3 },
          { condition: ({ renderer }) => renderer === RENDERER_AREA, suffix: 'when renderer is ' + RENDERER_AREA, default: 0 },
          { condition: ({ renderer }) => renderer === RENDERER_NONE, suffix: 'when renderer is ' + RENDERER_NONE, default: 0 },
          { ...defaultRule, default: 1 }
        ], configWithRegularDefaults, index),
        fillOpacity: conditionalDefault([
          { condition: ({ renderer }) => renderer === RENDERER_BAR, suffix: 'when renderer is ' + RENDERER_BAR, default: 0.8 },
          { condition: ({ renderer }) => renderer === RENDERER_LINE, suffix: 'when renderer is ' + RENDERER_LINE, default: 0.9 },
          { condition: ({ renderer }) => renderer === RENDERER_AREA, suffix: 'when renderer is ' + RENDERER_AREA, default: 0.8 },
          { condition: ({ renderer }) => renderer === RENDERER_NONE, suffix: 'when renderer is ' + RENDERER_NONE, default: 0.9 },
          { ...defaultRule, default: 0.8 }
        ], configWithRegularDefaults, index)
      },
      focused: {
        strokeOpacity: conditionalDefault([
          { condition: ({ renderer }) => renderer === RENDERER_BAR, suffix: 'when renderer is ' + RENDERER_BAR, default: 1 },
          { condition: ({ renderer }) => renderer === RENDERER_LINE, suffix: 'when renderer is ' + RENDERER_LINE, default: 1 },
          { condition: ({ renderer }) => renderer === RENDERER_AREA, suffix: 'when renderer is ' + RENDERER_AREA, default: 1 },
          { condition: ({ renderer }) => renderer === RENDERER_NONE, suffix: 'when renderer is ' + RENDERER_NONE, default: 1 },
          { ...defaultRule, default: 1 }
        ], configWithRegularDefaults, index),
        strokeWidth: conditionalDefault([
          { condition: ({ renderer }) => renderer === RENDERER_BAR, suffix: 'when renderer is ' + RENDERER_BAR, default: 1 },
          { condition: ({ renderer }) => renderer === RENDERER_LINE, suffix: 'when renderer is ' + RENDERER_LINE, default: 4 },
          { condition: ({ renderer }) => renderer === RENDERER_AREA, suffix: 'when renderer is ' + RENDERER_AREA, default: 1 },
          { condition: ({ renderer }) => renderer === RENDERER_NONE, suffix: 'when renderer is ' + RENDERER_NONE, default: 0 },
          { ...defaultRule, default: 1 }
        ], configWithRegularDefaults, index),
        fillOpacity: conditionalDefault([
          { condition: ({ renderer }) => renderer === RENDERER_BAR, suffix: 'when renderer is ' + RENDERER_BAR, default: 1 },
          { condition: ({ renderer }) => renderer === RENDERER_LINE, suffix: 'when renderer is ' + RENDERER_LINE, default: 1 },
          { condition: ({ renderer }) => renderer === RENDERER_AREA, suffix: 'when renderer is ' + RENDERER_AREA, default: 1 },
          { condition: ({ renderer }) => renderer === RENDERER_NONE, suffix: 'when renderer is ' + RENDERER_NONE, default: 1 },
          { ...defaultRule, default: 1 }
        ], configWithRegularDefaults, index)
      },
      defocused: {
        strokeOpacity: conditionalDefault([
          { condition: ({ renderer }) => renderer === RENDERER_BAR, suffix: 'when renderer is ' + RENDERER_BAR, default: 0.5 },
          { condition: ({ renderer }) => renderer === RENDERER_LINE, suffix: 'when renderer is ' + RENDERER_LINE, default: 0.8 },
          { condition: ({ renderer }) => renderer === RENDERER_AREA, suffix: 'when renderer is ' + RENDERER_AREA, default: 0.5 },
          { condition: ({ renderer }) => renderer === RENDERER_NONE, suffix: 'when renderer is ' + RENDERER_NONE, default: 0.8 },
          { ...defaultRule, default: 1 }
        ], configWithRegularDefaults, index),
        strokeWidth: conditionalDefault([
          { condition: ({ renderer }) => renderer === RENDERER_BAR, suffix: 'when renderer is ' + RENDERER_BAR, default: 0 },
          { condition: ({ renderer }) => renderer === RENDERER_LINE, suffix: 'when renderer is ' + RENDERER_LINE, default: 2 },
          { condition: ({ renderer }) => renderer === RENDERER_AREA, suffix: 'when renderer is ' + RENDERER_AREA, default: 0 },
          { condition: ({ renderer }) => renderer === RENDERER_NONE, suffix: 'when renderer is ' + RENDERER_NONE, default: 0 },
          { ...defaultRule, default: 1 }
        ], configWithRegularDefaults, index),
        fillOpacity: conditionalDefault([
          { condition: ({ renderer }) => renderer === RENDERER_BAR, suffix: 'when renderer is ' + RENDERER_BAR, default: 0.5 },
          { condition: ({ renderer }) => renderer === RENDERER_LINE, suffix: 'when renderer is ' + RENDERER_LINE, default: 0.8 },
          { condition: ({ renderer }) => renderer === RENDERER_AREA, suffix: 'when renderer is ' + RENDERER_AREA, default: 0.5 },
          { condition: ({ renderer }) => renderer === RENDERER_NONE, suffix: 'when renderer is ' + RENDERER_NONE, default: 0.8 },
          { ...defaultRule, default: 1 }
        ], configWithRegularDefaults, index)
      }
    },
    marker: {
      shape: conditionalDefault([
        { condition: ({ renderer }) => renderer === RENDERER_BAR, suffix: 'when renderer is ' + RENDERER_BAR, default: NONE },
        { condition: ({ renderer }) => renderer === RENDERER_LINE, suffix: 'when renderer is ' + RENDERER_LINE, default: MARKER_SHAPE_CIRCLE },
        { condition: ({ renderer }) => renderer === RENDERER_AREA, suffix: 'when renderer is ' + RENDERER_AREA, default: MARKER_SHAPE_CIRCLE },
        { condition: ({ renderer }) => renderer === RENDERER_NONE, suffix: 'when renderer is ' + RENDERER_NONE, default: MARKER_SHAPE_CIRCLE },
        { ...defaultRule, default: NONE }
      ], configWithRegularDefaults, index)
    },
    colorScale: conditionalDefault([
      { condition: ({ renderer }) => pieMode || renderer !== RENDERER_BAR, suffix: nonColorRendererSuffix, default: NONE },
      {
        condition: ({ renderer }) => !pieMode && renderer === RENDERER_BAR,
        suffix: colorRendererSuffix,
        defaultText: 'the members below',
        default: {
          interpolation: conditionalDefault([
          { condition: ({ colorProperty }) => colorProperty === NONE, suffix: colorPropertyNoneSuffix, default: NONE },
          { condition: ({ colorProperty }) => colorProperty !== NONE, suffix: colorPropertySuffix, default: COLOR_INTERPOLATION_HCL },
          { ...defaultRule, default: NONE }
        ], configWithRegularDefaults, index),
        min: conditionalDefault([
          { condition: ({ colorProperty }) => colorProperty === NONE, suffix: colorPropertyNoneSuffix, default: NONE },
          { condition: ({ colorProperty, colorScale }) => colorProperty !== NONE && (colorScale?.base?.value ?? NONE) === NONE, suffix: colorBaseNoneSuffix, default: '#8f8fff' },
          { condition: ({ colorProperty, colorScale }) => colorProperty !== NONE && (colorScale?.base?.value ?? NONE) !== NONE, suffix: colorBaseSuffix, default: NONE },
          { ...defaultRule, default: NONE }
        ], configWithRegularDefaults, index),
        max: conditionalDefault([
          { condition: ({ colorProperty }) => colorProperty === NONE, suffix: colorPropertyNoneSuffix, default: NONE },
          { condition: ({ colorProperty, colorScale }) => colorProperty !== NONE && (colorScale?.base?.value ?? NONE) === NONE, suffix: colorBaseNoneSuffix, default: '#0000ff' },
          { condition: ({ colorProperty, colorScale }) => colorProperty !== NONE && (colorScale?.base?.value ?? NONE) !== NONE, suffix: colorBaseSuffix, default: NONE },
          { ...defaultRule, default: NONE }
        ], configWithRegularDefaults, index),
        missing: conditionalDefault([
          { condition: ({ colorProperty }) => colorProperty === NONE, suffix: colorPropertyNoneSuffix, default: NONE },
          { condition: ({ colorProperty }) => colorProperty !== NONE, suffix: colorPropertySuffix, default: '#cccccc' },
          { ...defaultRule, default: NONE }
        ], configWithRegularDefaults, index),
        base: {
          aboveMin: conditionalDefault([
            { condition: ({ colorProperty }) => colorProperty === NONE, suffix: colorPropertyNoneSuffix, default: NONE },
            { condition: ({ colorProperty, colorScale }) => colorProperty !== NONE && (colorScale?.base?.value ?? NONE) === NONE, suffix: colorBaseNoneSuffix, default: NONE },
            { condition: ({ colorProperty, colorScale }) => colorProperty !== NONE && (colorScale?.base?.value ?? NONE) !== NONE, suffix: colorBaseSuffix, default: '#8f8fff' },
            { ...defaultRule, default: NONE }
          ], configWithRegularDefaults, index),
          aboveMax: conditionalDefault([
            { condition: ({ colorProperty }) => colorProperty === NONE, suffix: colorPropertyNoneSuffix, default: NONE },
            { condition: ({ colorProperty, colorScale }) => colorProperty !== NONE && (colorScale?.base?.value ?? NONE) === NONE, suffix: colorBaseNoneSuffix, default: NONE },
            { condition: ({ colorProperty, colorScale }) => colorProperty !== NONE && (colorScale?.base?.value ?? NONE) !== NONE, suffix: colorBaseSuffix, default: '#0000ff' },
            { ...defaultRule, default: NONE }
          ], configWithRegularDefaults, index),
          belowMin: conditionalDefault([
            { condition: ({ colorProperty }) => colorProperty === NONE, suffix: colorPropertyNoneSuffix, default: NONE },
            { condition: ({ colorProperty, colorScale }) => colorProperty !== NONE && (colorScale?.base?.value ?? NONE) === NONE, suffix: colorBaseNoneSuffix, default: NONE },
            { condition: ({ colorProperty, colorScale }) => colorProperty !== NONE && (colorScale?.base?.value ?? NONE) !== NONE, suffix: colorBaseSuffix, default: '#ff0000' },
            { ...defaultRule, default: NONE }
          ], configWithRegularDefaults, index),
          belowMax: conditionalDefault([
            { condition: ({ colorProperty }) => colorProperty === NONE, suffix: colorPropertyNoneSuffix, default: NONE },
            { condition: ({ colorProperty, colorScale }) => colorProperty !== NONE && (colorScale?.base?.value ?? NONE) === NONE, suffix: colorBaseNoneSuffix, default: NONE },
            { condition: ({ colorProperty, colorScale }) => colorProperty !== NONE && (colorScale?.base?.value ?? NONE) !== NONE, suffix: colorBaseSuffix, default: '#ff8f8f' },
            { ...defaultRule, default: NONE }
          ], configWithRegularDefaults, index)
        }
      }
    }
    ], configWithRegularDefaults, index),
    showInLegend: conditionalDefault([
      { condition: ({ followSeries }) => followSeries !== NONE, suffix: followSeriesSuffix, default: false },
      { condition: ({ followSeries }) => followSeries === NONE, suffix: followSeriesNoneSuffix, default: true },
      { ...defaultRule, default: true }
    ], configWithRegularDefaults, index),
    showColorInLegend: conditionalDefault([
      { condition: (config) => isCategoryIndexColored(config), suffix: categoryIndexColorSuffix, default: false },
      { condition: (config) => !isCategoryIndexColored(config), suffix: notCategoryIndexColorSuffix, default: true },
      { ...defaultRule, default: true }
    ], configWithRegularDefaults, index),
    showColorInTooltip: conditionalDefault([
      { condition: (config) => isCategoryIndexColored(config), suffix: categoryIndexColorSuffix, default: false },
      { condition: (config) => !isCategoryIndexColored(config), suffix: notCategoryIndexColorSuffix, default: true },
      { ...defaultRule, default: true }
    ], configWithRegularDefaults, index)
  };
}
