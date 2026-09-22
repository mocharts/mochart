import validators, { boundValue } from './validators';
import getTruncationValidators from './truncationConfig';
import { filterConfig, getRawIndices } from '../core/configUtils';
import { getPropertyMessage, isConfigObject } from './messages';
import { createStyleValidators, lineMembers, styleMembers } from './styleStateValidators';

import { AUTO, NONE, MAJOR, ANCHORS, STYLE_SAME, SIDES, SCALE_ORDINAL, THRESHOLD_TITLE_SIDES, TITLE_SIDE_INSIDE, TYPE_DATE } from '../core/constants';

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
    visible: validators.boolean(),
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
    textStyle: styleStates(styleMembers),
    font: validators.font(),
    minorVisible: validators.boolean().orEqual(MAJOR),
    minorFront: validators.boolean().orEqual(MAJOR),
    minorBackgroundStyle: validators.styleOrMajor(),
    minorSize: validators.numberMin(0).orOneOf([AUTO, MAJOR]),
    minorMarginInner: validators.numberMin(0).orEqual(MAJOR),
    minorMarginOuter: validators.numberMin(0).orEqual(MAJOR),
    minorPaddingInner: validators.numberMin(0).orEqual(MAJOR),
    minorPaddingOuter: validators.numberMin(0).orEqual(MAJOR),
    minorPrefix: validators.string().orEqual(NONE),
    minorSuffix: validators.string().orEqual(NONE),
    minorRotation: validators.numberMinMax(-90, 90).orEqual(MAJOR),
    minorAnchor: validators.oneOf(ANCHORS.concat([AUTO, MAJOR])),
    minorTextStyle: styleStates(styleMembers, true),
    minorFont: validators.fontOrMajor()
  };
}

/** The tickStep members shared by both axes; the category axis adds period, minorPeriod and includeFirst and narrows the rest to its scales. */
export function getTickStepValidators(): Record<string, Validator> {
  return {
    interval: thresholdStepIntervalValidator,
    count: validators.integerMin(1).orEqual(AUTO),
    offset: validators.integerMin(0),
    minorSteps: validators.integerMin(2).orEqual(NONE),
    minSpacing: validators.numberMin(2)
  };
}

// a threshold sits on the axis's value scale, so its value takes the axis's own primitive: number by default, date on a date category axis
const positiveNumber = validators.custom((value: unknown) => typeof value === 'number' && Number.isFinite(value) && value > 0)
  .withCustomName('positiveNumber').withMessage('should be a number greater than 0');

/** The thresholdStep interval: an axis value distance above 0, or null. */
export const thresholdStepIntervalValidator = positiveNumber.orEqual(NONE);

/** The thresholdStep members both axes share; the category axis adds period and narrows interval to its number scale. */
export function getThresholdStepValidators(): Record<string, Validator> {
  return {
    visible: validators.boolean(),
    interval: thresholdStepIntervalValidator,
    count: validators.integerMin(1),
    offset: validators.integerMin(0),
    minSpacing: validators.numberMin(2),
    range: validators.boolean(),
    front: validators.boolean(),
    style: styleStates(styleMembers),
    pattern: validators.string().orEqual(NONE),
    gradient: validators.string().orEqual(NONE)
  };
}

export default function getValidators(thresholdValue = validators.number(), tickLabelValidators: Record<string, Validator> = getTickLabelValidators(), pieMode = false, thresholdStepValidators: Record<string, Validator> = getThresholdStepValidators(), tickStepValidators: Record<string, Validator> = getTickStepValidators()) {
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
      style: styleStates(lineMembers),
      minorVisible: validators.boolean().orEqual(MAJOR),
      minorFront: validators.boolean().orEqual(MAJOR),
      minorStyle: styleStates(lineMembers, true)
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
      rangeValue: thresholdValue.orOneOf([NONE, undefined]),
      front: validators.boolean().orEqual(undefined),
      style: styleStates(styleMembers).orEqual(undefined),
      pattern: validators.string().orOneOf([NONE, undefined]),
      gradient: validators.string().orOneOf([NONE, undefined]),
      title: validators.partialObjectWithShape({
        text: validators.string().orOneOf([NONE, undefined]),
        side: validators.oneOf(THRESHOLD_TITLE_SIDES).orEqual(undefined),
        align: validators.oneOf(ANCHORS).orOneOf([AUTO, undefined]),
        snapToValue: validators.boolean().orEqual(undefined),
        margin: validators.margin().orEqual(undefined),
        padding: validators.padding().orEqual(undefined),
        textStyle: styleStates(styleMembers).orEqual(undefined),
        font: validators.font().orEqual(undefined),
        backgroundStyle: validators.style().orEqual(undefined)
      }, true).orEqual(undefined)
    }), true),

    thresholdStep: group(thresholdStepValidators),

    tickCount: validators.integerMin(0).orEqual(AUTO),

    tickLabel: group(tickLabelValidators),

    tickMark: group({
      visible: validators.boolean(),
      front: validators.boolean(),
      size: validators.numberMin(0),
      marginInner: validators.numberMin(0),
      style: styleStates(lineMembers),
      minorVisible: validators.boolean().orEqual(MAJOR),
      minorFront: validators.boolean().orEqual(MAJOR),
      minorSize: validators.numberMin(0).orEqual(MAJOR),
      minorMarginInner: validators.numberMin(0).orEqual(MAJOR),
      minorStyle: styleStates(lineMembers, true)
    }),

    tickStep: group(tickStepValidators),

    title: group({
      text: validators.string().orEqual(NONE),
      front: validators.boolean(),
      backgroundStyle: validators.style(),
      truncation: group(getTruncationValidators()),
      size: validators.numberMin(0).orEqual(AUTO),
      marginInner: validators.numberMin(0),
      marginOuter: validators.numberMin(0),
      paddingInner: validators.numberMin(0),
      paddingOuter: validators.numberMin(0),
      textStyle: styleStates(styleMembers),
      font: validators.font()
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

const thresholdPatternMessage = 'should be the id of a patterns entry';
const thresholdGradientMessage = 'should be the id of a linearGradients or radialGradients entry';
const thresholdPatternGradientMessage = 'cannot be combined with gradient';
const thresholdInsideMessage = 'should be "inside" only on a threshold range (an entry with a rangeValue)';

function getSectionIds(config: ConfigObject, sectionKeys: string[]): Set<string> {
  const ids = new Set<string>();
  for (const sectionKey of sectionKeys) {
    const sections = config[sectionKey];
    if (Array.isArray(sections)) {
      for (const section of sections) {
        if (isConfigObject(section) && typeof section['id'] === 'string') {
          ids.add(section['id']);
        }
      }
    }
  }
  return ids;
}

interface ValidationAxis {
  prefix: string;
  path: (string | number)[];
  axis: unknown;
  /** The axis as authored, or null when every member of the axis is its own (the category axis, the implicit axis). */
  raw: ConfigObject | null;
}

/** The axes a cross-member pass walks: the category axis, then the value axes at their authored indexes, or valueAxisDefaults for the implicit one. */
function getValidationAxes(config: ConfigObject, configWithoutDefaults: ConfigObject): ValidationAxis[] {
  const axes: ValidationAxis[] = [{ prefix: 'categoryAxis', path: ['categoryAxis'], axis: config['categoryAxis'], raw: null }];
  const valueAxes = config['valueAxes'];
  if (Array.isArray(valueAxes)) {
    // the built axes drop ignored entries, so an error is reported at the authored index like the other cross-section passes;
    // with no authored entries the implicit axis is the valueAxisDefaults, so its members are reported there
    const rawValueAxes = configWithoutDefaults['valueAxes'];
    const rawIndices = getRawIndices(rawValueAxes);
    if (rawIndices === null ? !filterConfig(rawValueAxes) : rawIndices.length === 0) {
      axes.push({ prefix: 'valueAxisDefaults', path: ['valueAxisDefaults'], axis: valueAxes[0], raw: null });
    }
    else {
      valueAxes.forEach((axis, index) => {
        const rawIndex = rawIndices?.[index] ?? index;
        const rawAxis = rawIndices === null ? rawValueAxes : (rawValueAxes as unknown[])[rawIndex];
        axes.push({ prefix: 'valueAxes[' + rawIndex + ']', path: ['valueAxes', rawIndex], axis, raw: isConfigObject(rawAxis) ? rawAxis : null });
      });
    }
  }
  return axes;
}

// a member the axis did not author came from valueAxisDefaults: it is reported there, and once, not on every axis that inherits it
function isAuthored(raw: ConfigObject | null, memberPath: (string | number)[]): boolean {
  if (raw === null) {
    return true;
  }
  const [section, member] = memberPath;
  if (section === 'thresholds' || section === 'ticks') {
    return Array.isArray(raw[section]);
  }
  const group = raw[section as string];
  return isConfigObject(group) && typeof member === 'string' && group[member] !== undefined;
}

type AxisReporter = (memberPath: (string | number)[], memberText: string, message: string) => void;

function getAxisReporter({ prefix, path, raw }: ValidationAxis, reportedDefaults: Set<string>, errors: string[], errorDetails: LocatedValidationMessage[]): AxisReporter {
  return (memberPath, memberText, message) => {
    if (isAuthored(raw, memberPath)) {
      errors.push(getPropertyMessage(prefix, memberText, message));
      errorDetails.push({ path: [...path, ...memberPath], message });
      return;
    }
    const key = memberText + ' ' + message;
    if (!reportedDefaults.has(key)) {
      reportedDefaults.add(key);
      errors.push(getPropertyMessage('valueAxisDefaults', memberText, message));
      errorDetails.push({ path: ['valueAxisDefaults', ...memberPath], message });
    }
  };
}

const PERIOD_ORDER = ['day', 'week', 'month', 'year'];
const stepNeedsPlacementMessage = 'should be left at its default on a linear axis unless period or interval is set';
const minorPeriodNeedsPeriodMessage = 'should be null unless period is set';
const offsetNeedsCountMessage = 'should be 0 on a linear axis unless count is a number, since every step is kept and there is nothing to shift';
const minorPeriodTooLongMessage = 'should be a shorter period than period';
const minorStepsNeedsIntervalMessage = 'should be null unless interval is set';
const duplicateTickMessage = 'should not repeat the value of another ticks entry';

/** The step rules that cross members, in tickStep and thresholdStep alike: what count and offset count on a linear axis, and what the minor members need. */
export function validateStepRules(config: ConfigObject, configWithoutDefaults: ConfigObject, errors: string[], errorDetails: LocatedValidationMessage[]): void {
  const reportedDefaults = new Set<string>();
  for (const validationAxis of getValidationAxes(config, configWithoutDefaults)) {
    const { axis } = validationAxis;
    if (!isConfigObject(axis)) {
      continue;
    }
    const report = getAxisReporter(validationAxis, reportedDefaults, errors, errorDetails);
    // a value axis is always linear; the category axis says so itself
    const linear = axis['scale'] !== SCALE_ORDINAL;
    for (const [groupKey, defaultCount] of [['tickStep', AUTO], ['thresholdStep', 1]] as const) {
      const step = axis[groupKey];
      if (!isConfigObject(step)) {
        continue;
      }
      const reportStep = (member: string, message: string) => report([groupKey, member], groupKey + '.' + member, message);
      const placed = (step['period'] !== undefined && step['period'] !== NONE) || (step['interval'] !== undefined && step['interval'] !== NONE);
      if (linear && !placed) {
        if (step['count'] !== defaultCount) {
          reportStep('count', stepNeedsPlacementMessage);
        }
        if (step['offset'] !== 0) {
          reportStep('offset', stepNeedsPlacementMessage);
        }
      }
      // a linear offset shifts which count-th step is kept, so with every step kept (count "auto") it does nothing
      else if (linear && step['offset'] !== 0 && step['offset'] !== undefined && (step['count'] === undefined || step['count'] === AUTO) && defaultCount === AUTO) {
        reportStep('offset', offsetNeedsCountMessage);
      }
      if (groupKey === 'tickStep') {
        const minorPeriod = step['minorPeriod'];
        if (typeof minorPeriod === 'string') {
          const period = step['period'];
          if (typeof period !== 'string') {
            reportStep('minorPeriod', minorPeriodNeedsPeriodMessage);
          }
          else if (PERIOD_ORDER.indexOf(minorPeriod) >= PERIOD_ORDER.indexOf(period)) {
            reportStep('minorPeriod', minorPeriodTooLongMessage);
          }
        }
        if (typeof step['minorSteps'] === 'number' && (step['interval'] === undefined || step['interval'] === NONE)) {
          reportStep('minorSteps', minorStepsNeedsIntervalMessage);
        }
      }
    }
  }
}

/** Two explicit ticks at one position would put a tick and a minor tick together, so entries are matched the way a tick finds its category. */
export function validateTickEntries(config: ConfigObject, configWithoutDefaults: ConfigObject, errors: string[], errorDetails: LocatedValidationMessage[]): void {
  const reportedDefaults = new Set<string>();
  for (const validationAxis of getValidationAxes(config, configWithoutDefaults)) {
    const { axis } = validationAxis;
    if (!isConfigObject(axis) || !Array.isArray(axis['ticks'])) {
      continue;
    }
    const report = getAxisReporter(validationAxis, reportedDefaults, errors, errorDetails);
    const dateAxis = axis['type'] === TYPE_DATE && (axis['keyProperty'] === undefined || axis['keyProperty'] === NONE);
    const seen = new Set<string>();
    axis['ticks'].forEach((tick, index) => {
      if (!isConfigObject(tick) || (typeof tick['value'] !== 'string' && typeof tick['value'] !== 'number')) {
        return;
      }
      // the same key the chart matches ticks to categories by (getCategoryValueKey): the instant on a date axis without a keyProperty, else the value as a string, so 1 and '1' are one entry
      const dateValue = dateAxis ? boundValue(tick['value'], true) : null;
      const key = dateValue !== null ? 'date:' + dateValue : String(tick['value']);
      if (seen.has(key)) {
        report(['ticks', index, 'value'], 'ticks[' + index + '].value', duplicateTickMessage);
      }
      seen.add(key);
    });
  }
}

/** The threshold entry rules that cross sections or members: pattern and gradient ids, their exclusivity, and the inside title side. */
export function validateThresholdEntries(config: ConfigObject, configWithoutDefaults: ConfigObject, errors: string[], errorDetails: LocatedValidationMessage[]): void {
  const patternIds = getSectionIds(config, ['patterns']);
  const gradientIds = getSectionIds(config, ['linearGradients', 'radialGradients']);
  const reportedDefaults = new Set<string>();
  for (const validationAxis of getValidationAxes(config, configWithoutDefaults)) {
    const { axis } = validationAxis;
    if (!isConfigObject(axis)) {
      continue;
    }
    const report = getAxisReporter(validationAxis, reportedDefaults, errors, errorDetails);
    const step = axis['thresholdStep'];
    if (isConfigObject(step)) {
      const reportStep = (member: string, message: string) => report(['thresholdStep', member], 'thresholdStep.' + member, message);
      if (typeof step['pattern'] === 'string' && !patternIds.has(step['pattern'])) {
        reportStep('pattern', thresholdPatternMessage);
      }
      if (typeof step['gradient'] === 'string' && !gradientIds.has(step['gradient'])) {
        reportStep('gradient', thresholdGradientMessage);
      }
      if (typeof step['pattern'] === 'string' && typeof step['gradient'] === 'string') {
        reportStep('pattern', thresholdPatternGradientMessage);
      }
    }
    if (!Array.isArray(axis['thresholds'])) {
      continue;
    }
    axis['thresholds'].forEach((threshold, index) => {
      if (!isConfigObject(threshold)) {
        return;
      }
      const reportEntry = (member: string, message: string, memberPath: (string | number)[]) => report(['thresholds', index, ...memberPath], 'thresholds[' + index + '].' + member, message);
      const pattern = threshold['pattern'];
      const gradient = threshold['gradient'];
      if (typeof pattern === 'string' && !patternIds.has(pattern)) {
        reportEntry('pattern', thresholdPatternMessage, ['pattern']);
      }
      if (typeof gradient === 'string' && !gradientIds.has(gradient)) {
        reportEntry('gradient', thresholdGradientMessage, ['gradient']);
      }
      if (typeof pattern === 'string' && typeof gradient === 'string') {
        reportEntry('pattern', thresholdPatternGradientMessage, ['pattern']);
      }
      const title = threshold['title'];
      if (isConfigObject(title) && title['side'] === TITLE_SIDE_INSIDE && (threshold['rangeValue'] === undefined || threshold['rangeValue'] === null)) {
        reportEntry('title.side', thresholdInsideMessage, ['title', 'side']);
      }
    });
  }
}

