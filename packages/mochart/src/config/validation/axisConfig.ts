import validators, { boundValue } from './validators';
import { filterConfig, getRawIndices } from '../core/configUtils';
import { getPropertyMessage, isConfigObject } from './messages';
import { createStyleValidators, lineMembers, styleMembers } from './styleStateValidators';

import { AUTO, NONE, ANCHORS, STYLE_SAME, SIDES, THRESHOLD_TITLE_SIDES, TYPE_DATE } from '../core/constants';

import type { ConfigObject, LocatedValidationMessage } from './messages';
import type { Validator } from '@mochart/movalid';

// Never null: an axis writes stroke="none" so a host-css stroke cannot inherit onto its text.
const { styleShape, styleStates } = createStyleValidators(allowSame =>
  allowSame ? validators.svgColor().orEqual(STYLE_SAME) : validators.svgColor()
);

export const axisStyleValidators = { styleShape, styleStates, lineMembers, styleMembers };

// A nested config group: partial like every nested config (deep-merged over its default); extras pass for the unknown-key walk.
const group = (shape: Record<string, Validator>) => validators.partialObjectWithShape(shape, true);

/** The tick label members shared by both axes; each axis adds its own (format rules, truncation, filtering). */
export function getTickLabelValidators(): Record<string, Validator> {
  return {
    front: validators.boolean(),
    backgroundStyle: validators.style(),
    size: validators.numberMin(0).orEqual(AUTO),
    marginInner: validators.numberMin(0),
    marginOuter: validators.numberMin(0),
    paddingInner: validators.numberMin(0),
    paddingOuter: validators.numberMin(0),
    prefix: validators.string().orEqual(NONE),
    suffix: validators.string().orEqual(NONE),
    rotation: validators.numberMinMax(-90, 90),
    anchor: validators.oneOf(ANCHORS.concat([AUTO])),
    textStyle: styleStates(styleMembers)
  };
}

// a threshold sits on the axis's value scale, so its value takes the axis's own primitive: number by default, date on a date category axis
export default function getValidators(thresholdValue = validators.number(), tickLabelValidators: Record<string, Validator> = getTickLabelValidators(), pieMode = false) {
  return {
    axisLine: group({
      visible: validators.boolean(),
      front: validators.boolean(),
      marginInner: validators.numberMin(0),
      style: styleStates(lineMembers)
    }),

    backgroundStyle: validators.style(),
    backgroundFront: validators.boolean(),

    side: validators.oneOf(SIDES),

    reversed: validators.boolean(),

    collapsed: validators.boolean(),

    focusRange: group({
      visible: validators.boolean(),
      front: validators.boolean(),
      applyToTitle: validators.boolean(),
      style: styleShape(styleMembers, false)
    }),

    focusTickMark: group({
      visible: validators.boolean(),
      front: validators.boolean(),
      size: validators.numberMin(0),
      marginInner: validators.numberMin(0),
      style: styleShape(['strokeColor', 'strokeOpacity', 'strokeWidth', 'strokeDashArray'], false)
    }),

    gridLine: group({
      visible: validators.boolean(),
      front: validators.boolean(),
      style: styleStates(lineMembers)
    }),

    marginInner: validators.numberMin(0),
    marginOuter: validators.numberMin(0),

    maxTickCount: validators.integerMin(0),

    minTickSpacing: validators.numberMin(0),
    minTickInterval: validators.numberMin(0),

    paddingInner: validators.numberMin(0),
    paddingOuter: validators.numberMin(0),

    thresholds: validators.arrayOf(validators.objectWithShape({
      value: thresholdValue,
      front: validators.boolean().orEqual(undefined),
      style: styleStates(lineMembers).orEqual(undefined),
      title: validators.partialObjectWithShape({
        text: validators.string().orOneOf([NONE, undefined]),
        side: validators.oneOf(THRESHOLD_TITLE_SIDES).orEqual(undefined),
        snapToValue: validators.boolean().orEqual(undefined),
        margin: validators.margin().orEqual(undefined),
        padding: validators.padding().orEqual(undefined),
        textStyle: styleStates(styleMembers).orEqual(undefined),
        backgroundStyle: validators.style().orEqual(undefined)
      }, true).orEqual(undefined)
    }), true),

    tickCount: validators.integerMin(0).orEqual(AUTO),

    tickLabel: group(tickLabelValidators),

    tickMark: group({
      visible: validators.boolean(),
      front: validators.boolean(),
      size: validators.numberMin(0),
      marginInner: validators.numberMin(0),
      style: styleStates(lineMembers)
    }),

    title: group({
      text: validators.string().orEqual(NONE),
      front: validators.boolean(),
      backgroundStyle: validators.style(),
      truncationEnabled: validators.boolean(),
      truncationText: validators.string(),
      size: validators.numberMin(0).orEqual(AUTO),
      marginInner: validators.numberMin(0),
      marginOuter: validators.numberMin(0),
      paddingInner: validators.numberMin(0),
      paddingOuter: validators.numberMin(0),
      textStyle: styleStates(styleMembers)
    }),

    visible: validators.conditional([
      { condition: () => pieMode, suffix: 'when chart type is not xy', validator: validators.equal(false) },
      { condition: () => !pieMode, suffix: 'when chart type is xy', validator: validators.boolean() }
    ], {})
  };
}

/** min above max is a mistake (axis.reversed is the way to invert an axis); min === max stays legal, as auto produces it from flat data. */
export function getAxisBoundsMessage(maxKey: string, max: unknown): string {
  return 'should not be above the ' + maxKey + ' property of the same axis: ' + JSON.stringify(max);
}

export function validateAxisBounds(config: ConfigObject, configWithoutDefaults: ConfigObject, errors: string[], errorDetails: LocatedValidationMessage[]): void {
  checkAxisBounds(config['categoryAxis'], 'categoryAxis', undefined, errors, errorDetails);
  const valueAxes = config['valueAxes'];
  if (Array.isArray(valueAxes)) {
    const rawValueAxes = configWithoutDefaults['valueAxes'];
    const rawIndices = getRawIndices(rawValueAxes);
    // no authored entries: the implicit axis takes its bounds from valueAxisDefaults, so report there
    if (rawIndices === null ? !filterConfig(rawValueAxes) : rawIndices.length === 0) {
      checkAxisBounds(valueAxes[0], 'valueAxisDefaults', undefined, errors, errorDetails);
      return;
    }
    for (let i = 0; i < valueAxes.length; i++) {
      checkAxisBounds(valueAxes[i], 'valueAxes', rawIndices?.[i] ?? i, errors, errorDetails);
    }
  }
}

function checkAxisBounds(section: unknown, sectionKey: string, index: number | undefined, errors: string[], errorDetails: LocatedValidationMessage[]): void {
  if (!isConfigObject(section)) {
    return;
  }
  checkAxisBoundsPair(section, 'min', 'max', AUTO, sectionKey, index, errors, errorDetails);
  checkAxisBoundsPair(section, 'softMin', 'softMax', NONE, sectionKey, index, errors, errorDetails);
}

function checkAxisBoundsPair(section: ConfigObject, minKey: string, maxKey: string, unset: unknown, sectionKey: string, index: number | undefined, errors: string[], errorDetails: LocatedValidationMessage[]): void {
  const min = section[minKey];
  const max = section[maxKey];
  // an unset end (auto for min/max, null for the soft pair) is computed from the data, so there is no authored pair to compare
  if (min === unset || max === unset || min === undefined || max === undefined) {
    return;
  }
  const dateAxis = section['type'] === TYPE_DATE;
  const minValue = boundValue(min, dateAxis);
  const maxValue = boundValue(max, dateAxis);
  if (minValue === null || maxValue === null || minValue <= maxValue) {
    return;
  }
  const message = getAxisBoundsMessage(maxKey, max);
  errors.push(getPropertyMessage(sectionKey, minKey, message, index));
  errorDetails.push({ path: index === undefined ? [sectionKey, minKey] : [sectionKey, index, minKey], message });
}
