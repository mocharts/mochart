import { color as parseColor } from 'd3-color';

import validators from '@mochart/movalid';
import type { CustomValidator, Validator } from '@mochart/movalid';
import { NONE, TOP_RIGHT_BOTTOM_LEFT, COLOR_CURRENT } from '../core/constants';

// an id is woven into dom ids and their url(#...) references, which have no escaping, so it is restricted to characters that need none
const idRegexp = /^[A-Za-z0-9_-]+$/;


// SVG stroke-dasharray: unitless numbers (decimals allowed) separated by whitespace and/or one comma
const dashArrayRegexp = /^\s*(?:\d*\.\d+|\d+)(?:(?:\s*,\s*|\s+)(?:\d*\.\d+|\d+))*\s*$/;

// Transcribed verbatim from d3's formatSpecifier (github.com/d3/d3-format) so the two stay
// diff-able; its redundant character-class escapes are not ours to re-derive.
// eslint-disable-next-line no-useless-escape
const numberFormatRegexp = /^(?:(.)?([<>=^]))?([+\-\( ])?([$#])?(0)?(\d+)?(,)?(\.\d+)?(~)?([a-z%])?$/i;

// colors mochart interpolates itself must be parseable by d3-color (the SeriesColors/utils-style contract), so ask d3 rather than guess
const parsableColor: CustomValidator = value => typeof value === 'string' && parseColor(value) !== null;
parsableColor.message = 'should be a valid color';
const color = () => validators.custom(parsableColor).withCustomName('color');

// a color written straight to a dom attribute or declaration is resolved by the browser, so it also accepts css color functions d3-color predates
const cssColorFunctionRegexp =/^(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix|light-dark|var)\(.*\)$/i;
const renderableColor: CustomValidator = value =>
  typeof value === 'string' && (parseColor(value) !== null || cssColorFunctionRegexp.test(value.trim()));

// 'currentColor' is accepted only here, where the browser resolves it; the bare color() fields feed d3 scale ranges, where a keyword would interpolate to NaN
const svgColorValidator =validators.custom(renderableColor).orOneOf(['none', COLOR_CURRENT]).withCustomName('svgColor').withMessage('should be a valid svg color (or "none" / "currentColor")');

// The tooltip's colors become css declarations, where 'none' is not a color at all: it would be dropped
// as an invalid declaration and leave the property inheriting, so it is rejected rather than accepted.
const cssColorValidator = validators.custom(renderableColor).orEqual(COLOR_CURRENT).withCustomName('cssColor').withMessage('should be a valid css color (or "currentColor")');

const opacityValidator = validators.numberMinMax(0, 1).orEqual(NONE);
const strokeWidthValidator = validators.numberMin(0).orEqual(NONE);

const styleKeyMap = {
  strokeColor: svgColorValidator.orEqual(NONE),
  strokeOpacity: opacityValidator,
  fillColor: svgColorValidator.orEqual(NONE),
  fillOpacity: opacityValidator,
  strokeWidth: strokeWidthValidator,
  strokeDashArray: validators.regexp(dashArrayRegexp).withCustomName('dashArray').withMessage('should be a valid dash array').orEqual(NONE)
};

const cssStyleKeyMap = {
  strokeColor: cssColorValidator.orEqual(NONE),
  strokeOpacity: opacityValidator,
  fillColor: cssColorValidator.orEqual(NONE),
  fillOpacity: opacityValidator,
  strokeWidth: strokeWidthValidator
};

const id = () => validators.stringRegexp(idRegexp).withCustomName('id').withMessage('should be a string of letters, digits, dashes and underscores');
const dashArray = () => validators.regexp(dashArrayRegexp).withCustomName('dashArray').withMessage('should be a valid dash array');
const numberFormat = () => validators.regexp(numberFormatRegexp).withCustomName('numberFormat').withMessage('should be a valid number format');
const dateFormat = () => validators.string().withCustomName('dateFormat').withMessage('should be a valid date format');
const propertyRequired = () => validators.string().withCustomName('propertyRequired').withMessage('should be a string naming a data property');
const propertyOptional = () => validators.string().withCustomName('propertyOptional').withMessage('should be a string naming a data property').orEqual(NONE);
// Partial like every nested config (deep-merged over its default); extras pass for the unknown-key walk.
const partialObjectWith = (keys: string[], valueValidator: Validator): Validator => {
  const shape: Record<string, Validator> = {};
  for (const key of keys) {
    shape[key] = valueValidator;
  }
  return validators.partialObjectWithShape(shape, true);
};
const margin = () => partialObjectWith(TOP_RIGHT_BOTTOM_LEFT, validators.numberMin(0));
const padding = () => partialObjectWith(TOP_RIGHT_BOTTOM_LEFT, validators.numberMin(0));
// Partial (a style is deep-merged over its default), and extra members pass so that an unknown member
// is reported once by the unknown-key walk rather than as an error as well.
const style = () => validators.partialObjectWithShape(styleKeyMap, true);
const cssStyle = () => validators.partialObjectWithShape(cssStyleKeyMap, true);
const strokeStyle = () => validators.partialObjectWithShape({
  strokeColor: styleKeyMap.strokeColor,
  strokeOpacity: styleKeyMap.strokeOpacity,
  strokeWidth: styleKeyMap.strokeWidth,
  strokeDashArray: styleKeyMap.strokeDashArray
}, true);
const opacity = () => validators.numberMinMax(0, 1);
const svgColor = () => svgColorValidator;
const cssColor = () => cssColorValidator;

// Object.assign (not object spread) so TypeScript keeps the keys of movalid's
// mapped Validators type — spreading it into a literal collapses them.
const configValidators = Object.assign({}, validators, {
  color,
  id,
  dashArray,
  numberFormat,
  dateFormat,
  propertyRequired,
  propertyOptional,
  partialObjectWith,
  margin,
  padding,
  style,
  cssStyle,
  strokeStyle,
  opacity,
  svgColor,
  cssColor
});

/** A bound is a number, or a date primitive on a date axis; anything else is another rule's error. */
export function boundValue(value: unknown, dateAxis: boolean): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (!dateAxis) {
    return null;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.getTime();
  }
  if (typeof value === 'string') {
    const time = new Date(value).getTime();
    return Number.isNaN(time) ? null : time;
  }
  return null;
}

export default configValidators;