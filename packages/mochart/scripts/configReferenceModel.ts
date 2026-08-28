// Builds the config-reference model for every docs surface (generated JSON, legacy
// mochart-docs.html, JSDoc codegen) from the same per-section sources the runtime uses —
// descriptions, validators, and (conditional) defaults — and cross-checks their keys stay in sync.

import {
  configWithoutAllValidators as mochartConfigSectionValidators,
  getUniqueMessage,
  getReferenceMessage,
  getCommonReferenceMessage,
  allValidator
} from '../src/config/validation/mochartConfig';
import getSectionDescriptions from '../src/config/docs/mochartConfig';
import { sectionKeyAllMap } from '../src/config/core/mochartConfig';

import getAccessibilityDefaults from '../src/config/defaults/accessibilityConfig';
import getAccessibilityValidators from '../src/config/validation/accessibilityConfig';
import * as accessibilityDocs from '../src/config/docs/accessibilityConfig';

import getAnimationDefaults from '../src/config/defaults/animationConfig';
import getAnimationValidators from '../src/config/validation/animationConfig';
import * as animationDocs from '../src/config/docs/animationConfig';

import getChartDefaults from '../src/config/defaults/chartConfig';
import getChartValidators from '../src/config/validation/chartConfig';
import * as chartDocs from '../src/config/docs/chartConfig';

import getColorPaletteDefaults from '../src/config/defaults/colorPaletteConfig';
import getColorPaletteValidators from '../src/config/validation/colorPaletteConfig';
import * as colorPaletteDocs from '../src/config/docs/colorPaletteConfig';

import { getRegularDefaults as getClipIndicatorRegularDefaults, getConditionalDefaults as getClipIndicatorConditionalDefaults } from '../src/config/defaults/clipIndicatorConfig';
import getClipIndicatorValidators from '../src/config/validation/clipIndicatorConfig';
import * as clipIndicatorDocs from '../src/config/docs/clipIndicatorConfig';
import getCrosshairDefaults from '../src/config/defaults/crosshairConfig';
import getCrosshairValidators from '../src/config/validation/crosshairConfig';
import * as crosshairDocs from '../src/config/docs/crosshairConfig';

import { getThresholdEntryDefaults } from '../src/config/defaults/axisConfig';
import { getRegularDefaults as getCategoryAxisRegularDefaults, getConditionalDefaults as getCategoryAxisConditionalDefaults } from '../src/config/defaults/categoryAxisConfig';
import getCategoryAxisValidators from '../src/config/validation/categoryAxisConfig';
import * as categoryAxisDocs from '../src/config/docs/categoryAxisConfig';

import { getRegularDefaults as getLegendRegularDefaults, getConditionalDefaults as getLegendConditionalDefaults } from '../src/config/defaults/legendConfig';
import getLegendValidators from '../src/config/validation/legendConfig';
import * as legendDocs from '../src/config/docs/legendConfig';

import { getRegularDefaults as getLinearGradientRegularDefaults, getConditionalDefaults as getLinearGradientConditionalDefaults } from '../src/config/defaults/linearGradientConfig';
import getLinearGradientValidators from '../src/config/validation/linearGradientConfig';
import * as linearGradientDocs from '../src/config/docs/linearGradientConfig';

import { getRegularDefaults as getPatternRegularDefaults, getConditionalDefaults as getPatternConditionalDefaults } from '../src/config/defaults/patternConfig';
import getPatternValidators from '../src/config/validation/patternConfig';
import * as patternDocs from '../src/config/docs/patternConfig';

import { getRegularDefaults as getPieRegularDefaults, getConditionalDefaults as getPieConditionalDefaults } from '../src/config/defaults/pieConfig';
import getPieValidators from '../src/config/validation/pieConfig';
import * as pieDocs from '../src/config/docs/pieConfig';

import getPlotDefaults from '../src/config/defaults/plotConfig';
import getPlotValidators from '../src/config/validation/plotConfig';
import * as plotDocs from '../src/config/docs/plotConfig';

import { getRegularDefaults as getRadialGradientRegularDefaults, getConditionalDefaults as getRadialGradientConditionalDefaults } from '../src/config/defaults/radialGradientConfig';
import getRadialGradientValidators from '../src/config/validation/radialGradientConfig';
import * as radialGradientDocs from '../src/config/docs/radialGradientConfig';

import { getRegularDefaults as getValueAxisRegularDefaults, getConditionalDefaults as getValueAxisConditionalDefaults } from '../src/config/defaults/valueAxisConfig';
import getValueAxisValidators from '../src/config/validation/valueAxisConfig';
import * as valueAxisDocs from '../src/config/docs/valueAxisConfig';

import { getRegularDefaults as getSeriesRegularDefaults, getConditionalDefaults as getSeriesConditionalDefaults } from '../src/config/defaults/seriesConfig';
import getSeriesValidators from '../src/config/validation/seriesConfig';
import * as seriesDocs from '../src/config/docs/seriesConfig';

import { getRegularDefaults as getSeriesGroupRegularDefaults, getConditionalDefaults as getSeriesGroupConditionalDefaults } from '../src/config/defaults/seriesGroupConfig';
import getSeriesGroupValidators from '../src/config/validation/seriesGroupConfig';
import * as seriesGroupDocs from '../src/config/docs/seriesGroupConfig';

import { getRegularDefaults as getSeriesStackRegularDefaults, getConditionalDefaults as getSeriesStackConditionalDefaults } from '../src/config/defaults/seriesStackConfig';
import getSeriesStackValidators from '../src/config/validation/seriesStackConfig';
import * as seriesStackDocs from '../src/config/docs/seriesStackConfig';

import getTitleDefaults from '../src/config/defaults/titleConfig';
import getTitleValidators from '../src/config/validation/titleConfig';
import * as titleDocs from '../src/config/docs/titleConfig';

import { getRegularDefaults as getTooltipRegularDefaults, getConditionalDefaults as getTooltipConditionalDefaults } from '../src/config/defaults/tooltipConfig';
import getTooltipValidators from '../src/config/validation/tooltipConfig';
import * as tooltipDocs from '../src/config/docs/tooltipConfig';

import validators from '@mochart/movalid';
import type { Validator } from '@mochart/movalid';

import type { ConditionalDefaultRule } from '../src/config/defaults/conditionalDefault';
import type { DescriptionEntry, DescriptionMap } from '../src/config/docs/shared';
import type {
  CategoryAxisConfig,
  ClipIndicatorConfig,
  LegendConfig,
  LinearGradientConfig,
  PatternConfig,
  PieConfig,
  RadialGradientConfig,
  ValueAxisConfig,
  SeriesConfig,
  SeriesGroupConfig,
  SeriesStackConfig,
  TooltipConfig
} from '../src/types/config';

type ValidatorMap = Record<string, Validator>;
type Defaults = Record<string, unknown>;
type Descriptions = DescriptionMap;
type AnyRule = ConditionalDefaultRule<unknown, unknown, unknown>;

/** A conditional-default leaf: the thunk `conditionalDefault()` returns. */
type ConditionalDefaultLeaf = (() => unknown) & { rules?: AnyRule[] };

/** A conditional-defaults tree, nesting the way the config nests. A branch has no `rules`, so leaf and branch are told apart by type, not truthiness. */
interface ConditionalDefaults {
  [key: string]: ConditionalDefaultLeaf | ConditionalDefaults | undefined;
}

function isConditionalDefaultLeaf(value: ConditionalDefaultLeaf | ConditionalDefaults | undefined): value is ConditionalDefaultLeaf {
  return typeof value === 'function';
}

function conditionalDefaultBranch(value: ConditionalDefaultLeaf | ConditionalDefaults | undefined): ConditionalDefaults {
  if (value === undefined) {
    return {};
  }
  if (isConditionalDefaultLeaf(value)) {
    const members: ConditionalDefaults = {};
    for (const rule of value.rules ?? []) {
      if (rule.default !== null && typeof rule.default === 'object' && !Array.isArray(rule.default)) {
        Object.assign(members, rule.default);
      }
    }
    return members;
  }
  return value;
}

function nestedDefaults(value: unknown): Defaults {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Defaults : {};
}

function descriptionText(entry: DescriptionEntry | undefined): string | undefined {
  return typeof entry === 'string' ? entry : entry?.description;
}

function nestedDescriptions(entry: DescriptionEntry | undefined): DescriptionMap {
  return typeof entry === 'object' && entry !== null ? entry.properties : {};
}

type SectionReference = { section: string | string[]; key: string; commonKey?: string };
interface SectionValidatorInfo {
  validator: Validator;
  uniqueKeys?: string[];
  allExcludedKeys?: string[];
  references?: Record<string, SectionReference>;
  commonReferences?: Record<string, SectionReference>;
  crossRules?: Record<string, () => string>;
}
type SectionValidatorMap = Record<string, SectionValidatorInfo>;

interface DocsModule {
  default: () => Descriptions;
  getDetails?: () => Descriptions;
}

// --- Public model types ------------------------------------------------------

export type DefaultValue =
  | { kind: 'color'; color: string }
  | { kind: 'colors'; colors: string[] }
  | { kind: 'literal'; text: string }
  | { kind: 'none' };

export interface ConditionalDefaultValue {
  value: DefaultValue;
  /** Human-readable condition under which this default applies. */
  condition: string;
}

export interface PropertyDoc {
  key: string;
  description: string;
  /** Optional longer remark, markdown. */
  details?: string;
  /** Validation rule messages, including uniqueness/reference constraints. */
  rules: string[];
  /** The shape rule with its members' own rules left out, for pages that document those members below. */
  shapeRule?: ShapeRuleDoc;
  default?: DefaultValue;
  conditionalDefaults?: ConditionalDefaultValue[];
  /** Machine-readable value information used by config editors. */
  editor: EditorValueDoc;
  /** A value selected from ids declared elsewhere in the same config. */
  reference?: EditorReferenceDoc;
  /** Members of a nested object property; their anchor ids extend the parent's. */
  properties?: PropertyDoc[];
  /** True when `properties` documents the members of each array element rather than of an object value. */
  itemShape?: boolean;
  /** True when the property has no default and a value must be supplied. */
  required?: boolean;
}

/** `lead` names the shape, `keys` its members, `tail` whatever the rule allows besides it ("or be equal to null"). */
export interface ShapeRuleDoc {
  lead: string;
  keys: string[];
  tail?: string;
}

export type EditorValueType = 'any' | 'array' | 'boolean' | 'number' | 'object' | 'string';

export interface EditorValueDoc {
  types: EditorValueType[];
  enum?: unknown[];
  minimum?: number;
  maximum?: number;
  format?: string;
  properties?: Record<string, EditorValueDoc>;
  items?: EditorValueDoc;
}

export interface EditorReferenceDoc {
  sections: string[];
  key: string;
  commonKey?: string;
}

export interface SectionDoc {
  /** Top-level config key, e.g. 'series'. Anchor ids are `${id}.${key}`. */
  id: string;
  title: string;
  description: string;
  /** Companion `*Defaults` key whose values apply to every entry, if any. */
  allKey?: string;
  allDescription?: string;
  /** Per-entry unique properties (e.g. id/order) — not settable on the all config. */
  uniqueKeys?: string[];
  /** Additional per-entry properties that cannot be supplied by the companion defaults section. */
  allExcludedKeys?: string[];
  /** 'object' for single sections, 'array' for config lists. */
  shape: 'object' | 'array';
  /** The section's own shape rule, stated the way its nested properties state theirs. */
  shapeRule?: ShapeRuleDoc;
  /** Top-level properties a value must be supplied for, in the order they are documented. */
  requiredKeys?: string[];
  properties: PropertyDoc[];
}

export interface TopLevelKeyDoc {
  key: string;
  description: string;
  rules: string[];
  defaultText: string;
  /** Present when a detail section page exists for this key. */
  sectionId?: string;
  allKey?: string;
  allDescription?: string;
  allRules?: string[];
  allDefaultText?: string;
  editor: EditorValueDoc;
}

export interface ConfigReferenceModel {
  topLevel: TopLevelKeyDoc[];
  sections: SectionDoc[];
}

export interface ConfigReferenceResult {
  model: ConfigReferenceModel;
  /** Cross-source key mismatches; non-empty means the docs sources are out of sync. */
  integrityErrors: string[];
}

// --- Section descriptors -----------------------------------------------------

interface SectionSource {
  id: string;
  title: string;
  regularDefaults: Defaults;
  conditionalDefaults?: ConditionalDefaults;
  validators: ValidatorMap;
  docs: DocsModule;
  /** Defaults merged under each element of an array-valued property, keyed by that property. */
  itemDefaults?: Record<string, Defaults>;
}

function getSectionSources(): SectionSource[] {
  return [
    { id: 'accessibility', title: 'Accessibility Config', regularDefaults: getAccessibilityDefaults(), validators: getAccessibilityValidators(), docs: accessibilityDocs },
    { id: 'animation', title: 'Animation Config', regularDefaults: getAnimationDefaults(), validators: getAnimationValidators(), docs: animationDocs },
    { id: 'chart', title: 'Chart Config', regularDefaults: getChartDefaults(), validators: getChartValidators(), docs: chartDocs },
    { id: 'colorPalette', title: 'Color Palette Config', regularDefaults: getColorPaletteDefaults(), validators: getColorPaletteValidators(), docs: colorPaletteDocs },
    { id: 'clipIndicator', title: 'Clip Indicator Config', regularDefaults: getClipIndicatorRegularDefaults(), conditionalDefaults: getClipIndicatorConditionalDefaults({} as ClipIndicatorConfig), validators: getClipIndicatorValidators(), docs: clipIndicatorDocs },
    { id: 'crosshair', title: 'Crosshair Config', regularDefaults: getCrosshairDefaults(), validators: getCrosshairValidators(), docs: crosshairDocs },
    { id: 'categoryAxis', title: 'Category Axis Config', regularDefaults: getCategoryAxisRegularDefaults(), conditionalDefaults: getCategoryAxisConditionalDefaults({} as CategoryAxisConfig, false, false), validators: getCategoryAxisValidators({}), docs: categoryAxisDocs, itemDefaults: { thresholds: getThresholdEntryDefaults() } },
    { id: 'legend', title: 'Legend Config', regularDefaults: getLegendRegularDefaults(), conditionalDefaults: getLegendConditionalDefaults({} as LegendConfig, 0), validators: getLegendValidators(), docs: legendDocs },
    { id: 'linearGradients', title: 'Linear Gradient Config', regularDefaults: getLinearGradientRegularDefaults(), conditionalDefaults: getLinearGradientConditionalDefaults({} as LinearGradientConfig, 0), validators: getLinearGradientValidators(), docs: linearGradientDocs },
    { id: 'patterns', title: 'Pattern Config', regularDefaults: getPatternRegularDefaults(), conditionalDefaults: getPatternConditionalDefaults({} as PatternConfig, 0), validators: getPatternValidators({}), docs: patternDocs },
    { id: 'pie', title: 'Pie Config', regularDefaults: getPieRegularDefaults(), conditionalDefaults: getPieConditionalDefaults({} as PieConfig), validators: getPieValidators(), docs: pieDocs },
    { id: 'plot', title: 'Plot Config', regularDefaults: getPlotDefaults(), validators: getPlotValidators(), docs: plotDocs },
    { id: 'radialGradients', title: 'Radial Gradient Config', regularDefaults: getRadialGradientRegularDefaults(), conditionalDefaults: getRadialGradientConditionalDefaults({} as RadialGradientConfig, 0), validators: getRadialGradientValidators(), docs: radialGradientDocs },
    { id: 'valueAxes', title: 'Value Axis Config', regularDefaults: getValueAxisRegularDefaults(), conditionalDefaults: getValueAxisConditionalDefaults({} as ValueAxisConfig, 0, false, false), validators: getValueAxisValidators(), docs: valueAxisDocs, itemDefaults: { thresholds: getThresholdEntryDefaults() } },
    { id: 'series', title: 'Series Config', regularDefaults: getSeriesRegularDefaults(), conditionalDefaults: getSeriesConditionalDefaults({} as SeriesConfig, 0, null, null, null, null, null, false), validators: getSeriesValidators({}), docs: seriesDocs },
    { id: 'seriesGroups', title: 'Series Group Config', regularDefaults: getSeriesGroupRegularDefaults(), conditionalDefaults: getSeriesGroupConditionalDefaults({} as SeriesGroupConfig, 0), validators: getSeriesGroupValidators(), docs: seriesGroupDocs },
    { id: 'seriesStacks', title: 'Series Stack Config', regularDefaults: getSeriesStackRegularDefaults(), conditionalDefaults: getSeriesStackConditionalDefaults({} as SeriesStackConfig, 0, null), validators: getSeriesStackValidators(), docs: seriesStackDocs },
    { id: 'title', title: 'Title Config', regularDefaults: getTitleDefaults(), validators: getTitleValidators(), docs: titleDocs },
    { id: 'tooltip', title: 'Tooltip Config', regularDefaults: getTooltipRegularDefaults(), conditionalDefaults: getTooltipConditionalDefaults({} as TooltipConfig, false), validators: getTooltipValidators(), docs: tooltipDocs }
  ];
}

/** Why a property has no default: a value must be supplied, or it is left unset and nothing fills it in. */
type MissingDefault = 'required' | 'optional';

// Properties that intentionally have no default, keyed by path within the section
// (`parent.member`, `parent[].member`); 'required' entries also drive the reference pages' required lists.
const missingDefaultWhitelist: Record<string, Record<string, MissingDefault>> = {
  categoryAxis: {
    property: 'required',
    'thresholds[].value': 'required'
  },
  linearGradients: {
    stops: 'required',
    'stops[].offset': 'required',
    'stops[].color': 'required',
    'stops[].opacity': 'required'
  },
  patterns: {
    type: 'required'
  },
  radialGradients: {
    stops: 'required',
    'stops[].offset': 'required',
    'stops[].color': 'required',
    'stops[].opacity': 'required'
  },
  series: {
    property: 'required',
    // Left unset so each d3 curve applies its own tension/alpha.
    'curve.param': 'optional'
  },
  valueAxes: {
    'thresholds[].value': 'required',
    'ticks[].value': 'required',
    // A tick with no label falls back to the value formatted with tickLabel.format.
    'ticks[].label': 'optional'
  }
};

// --- Integrity checks --------------------------------------------------------

function arrayEqual(a: string[], b: string[]) {
  return a.length === b.length && a.every((ae, i) => ae === b[i]);
}

const noChange = {
  hasChanges: false,
  added: [] as string[],
  removed: [] as string[]
};

/** Compare a validator map against a companion source (defaults, descriptions), naming keys by their path within the section. */
function getAddedRemoved(a: Record<string, unknown>, b: Record<string, unknown>, prefix: string, whitelist: Record<string, MissingDefault> = {}) {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (arrayEqual([...aKeys].sort(), [...bKeys].sort())) {
    return noChange;
  }
  const added: string[] = [];
  const removed: string[] = [];
  for (const aKey of aKeys) {
    if (b[aKey] === undefined && whitelist[prefix + aKey] === undefined) {
      removed.push(prefix + aKey);
    }
  }
  for (const bKey of bKeys) {
    if (a[bKey] === undefined) {
      added.push(prefix + bKey);
    }
  }
  return {
    hasChanges: added.length > 0 || removed.length > 0,
    added,
    removed
  };
}

/** Keys with a default at this level, computed per level so a conditional branch naming one nested member does not read as replacing the whole regular default. */
function defaultPresence(regularDefaults: Defaults, conditionalDefaults: ConditionalDefaults): Record<string, unknown> {
  const presence: Record<string, unknown> = {};
  for (const key of Object.keys(regularDefaults)) {
    if (regularDefaults[key] !== undefined) presence[key] = true;
  }
  for (const key of Object.keys(conditionalDefaults)) {
    if (conditionalDefaults[key] !== undefined) presence[key] = true;
  }
  return presence;
}

interface IntegrityLevel {
  id: string;
  /** Path within the section, `''` at the top and `'backgroundStyle.'` inside it. */
  prefix: string;
  validators: ValidatorMap;
  regularDefaults: Defaults;
  conditionalDefaults: ConditionalDefaults;
  /** False below a conditional leaf, whose members have no static defaults. */
  checkDefaults: boolean;
  descriptions: Descriptions;
  details: Descriptions;
  whitelist: Record<string, MissingDefault>;
  /** Defaults merged under each element of an array-valued property at this level. */
  itemDefaults?: Record<string, Defaults>;
}

function checkLevelIntegrity(level: IntegrityLevel, errors: string[]) {
  const { id, prefix, validators, descriptions, details } = level;

  if (level.checkDefaults) {
    const defaults = defaultPresence(level.regularDefaults, level.conditionalDefaults);
    const defaultDiff = getAddedRemoved(validators, defaults, prefix, level.whitelist);
    if (defaultDiff.hasChanges) {
      errors.push(`${id}: defaults and validators have different keys (missing default: ${JSON.stringify(defaultDiff.removed)}, missing validator: ${JSON.stringify(defaultDiff.added)})`);
    }
  }
  const descriptionDiff = getAddedRemoved(validators, descriptions, prefix);
  if (descriptionDiff.hasChanges) {
    errors.push(`${id}: descriptions and validators have different keys (missing description: ${JSON.stringify(descriptionDiff.removed)}, missing validator: ${JSON.stringify(descriptionDiff.added)})`);
  }
  for (const detailKey of Object.keys(details)) {
    if (validators[detailKey] === undefined) {
      errors.push(`${id}: details entry '${prefix + detailKey}' has no matching validator`);
    }
  }

  // nested shapes are checked the same way, so a new style member cannot ship without a default and a description
  for (const key of Object.keys(validators)) {
    const nested = validators[key]!.nestedValues;
    if (!nested) {
      continue;
    }
    const conditional = level.conditionalDefaults[key];
    checkLevelIntegrity({
      id,
      prefix: prefix + key + '.',
      validators: nested,
      regularDefaults: nestedDefaults(level.regularDefaults[key]),
      conditionalDefaults: conditionalDefaultBranch(conditional),
      // a conditional group still documents its members, but one that resolves to a plain value has none to check
      checkDefaults: level.checkDefaults
        && (!isConditionalDefaultLeaf(conditional) || Object.keys(conditionalDefaultBranch(conditional)).length > 0),
      descriptions: nestedDescriptions(descriptions[key]),
      details: nestedDescriptions(details[key]),
      whitelist: level.whitelist
    }, errors);
  }

  // an array element's shape is checked the same way, against the entry defaults the section declares for it
  for (const key of Object.keys(validators)) {
    const itemNested = validators[key]!.itemValidator?.nestedValues;
    if (!itemNested) {
      continue;
    }
    checkLevelIntegrity({
      id,
      prefix: prefix + key + '[].',
      validators: itemNested,
      regularDefaults: nestedDefaults(level.itemDefaults?.[key]),
      conditionalDefaults: {},
      checkDefaults: level.checkDefaults,
      descriptions: nestedDescriptions(descriptions[key]),
      details: nestedDescriptions(details[key]),
      whitelist: level.whitelist
    }, errors);
  }
}

function checkKeyIntegrity(section: SectionSource, errors: string[]) {
  checkLevelIntegrity({
    id: section.id,
    prefix: '',
    validators: section.validators,
    regularDefaults: section.regularDefaults,
    conditionalDefaults: section.conditionalDefaults ?? {},
    checkDefaults: true,
    descriptions: section.docs.default(),
    details: section.docs.getDetails ? section.docs.getDetails() : {},
    whitelist: missingDefaultWhitelist[section.id] ?? {},
    itemDefaults: section.itemDefaults
  }, errors);
}

// --- Default value formatting ------------------------------------------------

const colorValidator = validators.color();

function isColor(value: unknown): value is string {
  return colorValidator(value) === true;
}

function isColorArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && !value.some(aValue => !isColor(aValue));
}

// Levels of nesting a default literal spells out before collapsing to `{ … }` / `[ … ]`;
// a collapsed object's members are documented as nested properties of their own.
const literalObjectDepth = 1;

function formatLiteral(value: unknown, depth = 0): string {
  if (value === undefined) {
    return '';
  }
  if (value === null) {
    return 'null';
  }
  if (typeof value === 'string') {
    return '"' + value + '"';
  }
  if (Array.isArray(value)) {
    if (depth >= literalObjectDepth) {
      return '[ … ]';
    }
    return '[' + value.map(item => formatLiteral(item, depth + 1)).join(', ') + ']';
  }
  if (typeof value === 'object') {
    if (depth >= literalObjectDepth) {
      return '{ … }';
    }
    const record = value as Record<string, unknown>;
    return '{ ' + Object.keys(record).map(key => key + ': ' + formatLiteral(record[key], depth + 1)).join(', ') + ' }';
  }
  return String(value);
}

export function formatDefaultValue(value: unknown): DefaultValue {
  if (value === undefined) {
    return { kind: 'none' };
  }
  if (isColor(value)) {
    return { kind: 'color', color: value };
  }
  if (isColorArray(value)) {
    return { kind: 'colors', colors: value };
  }
  return { kind: 'literal', text: formatLiteral(value) };
}

function formatConditionalDefaults(conditionalDefault: { rules?: AnyRule[] }): ConditionalDefaultValue[] {
  return (conditionalDefault.rules ?? []).filter(rule => rule.suffix !== null).map(rule => ({
    value: rule.defaultText ? { kind: 'literal', text: rule.defaultText } as DefaultValue : formatDefaultValue(rule.default),
    condition: rule.suffix as string
  }));
}

// --- Section-level validation messages --------------------------------------

function safeAdd(map: Record<string, string[]>, key: string, value: string) {
  let theArray = map[key];
  if (!theArray) {
    map[key] = theArray = [];
  }
  theArray.push(value);
}

function getSectionKeyRules(sectionValidator: SectionValidatorInfo): Record<string, string[]> {
  const sectionKeyRules: Record<string, string[]> = {};
  if (sectionValidator.uniqueKeys) {
    sectionValidator.uniqueKeys.forEach(uniqueKey => {
      safeAdd(sectionKeyRules, uniqueKey, getUniqueMessage());
    });
  }
  const references = sectionValidator.references;
  if (references) {
    Object.keys(references).forEach(referenceKey => {
      const reference = references[referenceKey]!;
      safeAdd(sectionKeyRules, referenceKey, getReferenceMessage(reference.section, reference.key));
    });
  }
  const commonReferences = sectionValidator.commonReferences;
  if (commonReferences) {
    Object.keys(commonReferences).forEach(commonReferenceKey => {
      const commonReference = commonReferences[commonReferenceKey]!;
      safeAdd(sectionKeyRules, commonReferenceKey, getCommonReferenceMessage(
        commonReference.section, commonReference.key, commonReference.commonKey!));
    });
  }
  const crossRules = sectionValidator.crossRules;
  if (crossRules) {
    Object.keys(crossRules).forEach(crossRuleKey => {
      safeAdd(sectionKeyRules, crossRuleKey, crossRules[crossRuleKey]!());
    });
  }
  return sectionKeyRules;
}

/** Splits a shape rule into its lead, its member keys and whatever it allows besides the shape. */
function buildShapeRule(rule: string | undefined, keys: string[]): ShapeRuleDoc | undefined {
  if (rule === undefined) {
    return undefined;
  }
  const open = rule.indexOf('{');
  const close = rule.lastIndexOf('}');
  if (open === -1 || close < open) {
    return undefined;
  }
  const shapeRule: ShapeRuleDoc = { lead: rule.slice(0, open).trim(), keys };
  const tail = rule.slice(close + 1).trim();
  if (tail !== '') {
    shapeRule.tail = tail;
  }
  return shapeRule;
}

function getPropertyRules(validator: Validator, sectionRules: string[] | undefined): string[] {
  const rules = validator.errorMessages.filter(message => message !== 'should be any value');
  return sectionRules && sectionRules.length > 0 ? rules.concat(sectionRules) : rules;
}

function unique<T>(values: T[]): T[] {
  return values.filter((value, index) => values.indexOf(value) === index);
}

function editorTypeForValue(value: unknown): EditorValueType {
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'object') return 'object';
  return 'string';
}

// custom validators report the name 'custom', so their own name is what identifies the value type
const CUSTOM_VALIDATOR_TYPES: Record<string, EditorValueType[]> = {
  color: ['string'],
  svgColor: ['string'],
  cssColor: ['string']
};

/** The one format shared by every named branch of a conditional, so a branch's tag is not lost. */
function alternativeFormat(validator: Validator): string | undefined {
  const names = unique((validator.alternativeValidators ?? [])
    .map(alternative => alternative.customName)
    .filter((name): name is string => typeof name === 'string'));
  return names.length === 1 ? names[0] : undefined;
}

function editorTypesForValidator(validator: Validator): EditorValueType[] {
  const alternatives = validator.alternativeValidators ?? [];
  if (alternatives.length > 0) {
    return unique(alternatives.flatMap(editorTypesForValidator));
  }
  switch (validator.validatorName) {
    case 'custom': return CUSTOM_VALIDATOR_TYPES[validator.customName ?? ''] ?? ['any'];
    case 'any': return ['any'];
    case 'array':
    case 'arrayOf':
    case 'arrayWithLength':
    case 'arrayWithLengthMin':
    case 'arrayWithLengthMax':
    case 'arrayWithLengthMinMax': return ['array'];
    case 'boolean': return ['boolean'];
    case 'number':
    case 'numberMin':
    case 'numberMax':
    case 'numberMinMax':
    case 'integer':
    case 'integerMin':
    case 'integerMax':
    case 'integerMinMax': return ['number'];
    case 'numeric':
    case 'numericMin':
    case 'numericMax':
    case 'numericMinMax':
    case 'datePrimitive': return ['number', 'string'];
    case 'object':
    case 'objectWith':
    case 'objectWithSome':
    case 'objectWithShape':
    case 'partialObjectWithShape': return ['object'];
    case 'string':
    case 'stringWithLength':
    case 'stringWithLengthMin':
    case 'stringWithLengthMax':
    case 'stringWithLengthMinMax':
    case 'regexp':
    case 'dateISO': return ['string'];
    case 'equal':
    case 'oneOf':
    case 'oneIn': {
      const values = (validator.allowedValues ?? []).filter(value => value !== undefined && value !== null);
      if (values.length === 0) return ['any'];
      return unique(values.map(editorTypeForValue));
    }
    default: return ['any'];
  }
}

function buildEditorValue(validator: Validator): EditorValueDoc {
  const allowed = (validator.allowedValues ?? []).filter(value => value !== undefined);
  // Extensions like numberMin(0).orEqual("auto") keep the base validator's name,
  // so the literal alternatives join the type union as well as the enum completions.
  const literalTypes = allowed
    .filter(value => value !== null)
    .map(editorTypeForValue);
  const editor: EditorValueDoc = {
    types: unique(editorTypesForValidator(validator).concat(literalTypes))
  };
  if (allowed.length > 0) {
    editor.enum = allowed;
    if (allowed.includes(null) && !editor.types.includes('any')) {
      // JSON null is represented by the enum rather than as a structural type.
      editor.types = unique(editor.types);
    }
  }
  if (validator.rangeValues?.min !== undefined) editor.minimum = validator.rangeValues.min;
  if (validator.rangeValues?.max !== undefined) editor.maximum = validator.rangeValues.max;
  const format = validator.customName ?? alternativeFormat(validator);
  if (format) editor.format = format;
  if (validator.nestedValues) {
    editor.properties = Object.fromEntries(Object.entries(validator.nestedValues)
      .map(([key, nested]) => [key, buildEditorValue(nested)]));
  }
  if (validator.itemValidator) editor.items = buildEditorValue(validator.itemValidator);
  return editor;
}

function editorReference(reference: SectionReference): EditorReferenceDoc {
  return {
    sections: Array.isArray(reference.section) ? reference.section : [reference.section],
    key: reference.key,
    ...(reference.commonKey ? { commonKey: reference.commonKey } : {})
  };
}

// --- Model assembly ----------------------------------------------------------

function getShapeDefaultText(validator: Validator): string {
  if (validator.validatorName === 'object') {
    return '{}';
  }
  if (validator.validatorName === 'arrayOf') {
    return '[]';
  }
  return '';
}

interface PropertySource {
  key: string;
  /** Path within the section, `'thresholds[].value'` for a member of an array element. */
  path: string;
  validator: Validator;
  description: DescriptionEntry | undefined;
  detail: DescriptionEntry | undefined;
  regularDefault: unknown;
  conditionalDefault: ConditionalDefaultLeaf | ConditionalDefaults | undefined;
  /** Section-level rules (uniqueness, references); top-level properties only. */
  sectionRules: string[] | undefined;
  /** Id reference constraint; top-level properties only. */
  reference?: SectionReference;
  /** Defaults merged under each element of this property, when it holds an array of objects. */
  itemDefaults?: Defaults;
  /** The section's missing-default whitelist, which says which properties must be supplied. */
  whitelist: Record<string, MissingDefault>;
}

/** Document one property and, when its validator describes a shape, each of its members in turn. */
function buildPropertyDoc(source: PropertySource): PropertyDoc {
  const { key, validator, description, detail, regularDefault, conditionalDefault } = source;
  const property: PropertyDoc = {
    key,
    description: descriptionText(description) as string,
    rules: getPropertyRules(validator, source.sectionRules),
    editor: buildEditorValue(validator)
  };
  if (source.whitelist[source.path] === 'required') {
    property.required = true;
  }
  if (source.reference) {
    property.reference = editorReference(source.reference);
  }
  const detailText = descriptionText(detail);
  if (detailText !== undefined) {
    property.details = detailText;
  }
  if (isConditionalDefaultLeaf(conditionalDefault)) {
    property.conditionalDefaults = formatConditionalDefaults(conditionalDefault);
  }
  else {
    // a nested branch is a default for members, not for this property, which keeps its regular default
    property.default = formatDefaultValue(regularDefault);
  }
  const memberDescriptions = nestedDescriptions(description);
  const memberDetails = nestedDescriptions(detail);
  const nested = validator.nestedValues;
  const itemNested = validator.itemValidator?.nestedValues;
  if (nested) {
    const nestedRegular = nestedDefaults(regularDefault);
    const nestedConditional = conditionalDefaultBranch(conditionalDefault);
    property.shapeRule = buildShapeRule(property.rules[0], Object.keys(nested).sort());
    property.properties = Object.keys(nested).sort().map(memberKey => buildPropertyDoc({
      key: memberKey,
      path: source.path + '.' + memberKey,
      validator: nested[memberKey]!,
      description: memberDescriptions[memberKey],
      detail: memberDetails[memberKey],
      regularDefault: nestedRegular[memberKey],
      conditionalDefault: nestedConditional[memberKey],
      sectionRules: undefined,
      whitelist: source.whitelist
    }));
  }
  else if (itemNested) {
    // an array of objects: the members documented are each element's, and the defaults are the entry defaults
    const entryDefaults = nestedDefaults(source.itemDefaults);
    property.itemShape = true;
    property.shapeRule = buildShapeRule(property.rules[0], Object.keys(itemNested).sort());
    property.properties = Object.keys(itemNested).sort().map(memberKey => buildPropertyDoc({
      key: memberKey,
      path: source.path + '[].' + memberKey,
      validator: itemNested[memberKey]!,
      description: memberDescriptions[memberKey],
      detail: memberDetails[memberKey],
      regularDefault: entryDefaults[memberKey],
      conditionalDefault: undefined,
      sectionRules: undefined,
      whitelist: source.whitelist
    }));
  }
  return property;
}

function buildSectionDoc(source: SectionSource, sectionValidators: SectionValidatorMap): SectionDoc {
  const sectionDescriptions: Record<string, string> = getSectionDescriptions();
  const descriptions = source.docs.default();
  const details = source.docs.getDetails ? source.docs.getDetails() : {};
  const sectionValidator = sectionValidators[source.id];
  const sectionKeyRules = getSectionKeyRules(sectionValidator);
  const allKey = sectionKeyAllMap[source.id];

  const whitelist = missingDefaultWhitelist[source.id] ?? {};

  const properties = Object.keys(source.validators).sort().map(key => buildPropertyDoc({
    key,
    path: key,
    validator: source.validators[key],
    description: descriptions[key],
    detail: details[key],
    regularDefault: source.regularDefaults[key],
    conditionalDefault: source.conditionalDefaults?.[key],
    sectionRules: sectionKeyRules[key],
    // A common reference is the more specific form: it points at the same
    // source collection but additionally constrains candidates by commonKey.
    reference: sectionValidator.commonReferences?.[key] ?? sectionValidator.references?.[key],
    itemDefaults: source.itemDefaults?.[key],
    whitelist
  }));

  const section: SectionDoc = {
    id: source.id,
    title: source.title,
    description: sectionDescriptions[source.id],
    shape: sectionValidator.validator.validatorName === 'arrayOf' ? 'array' : 'object',
    properties
  };
  // the section validator holds no member list of its own — its properties are validated separately —
  // so the rule is composed rather than split, in the wording its nested properties use
  section.shapeRule = {
    lead: (section.shape === 'array' ? 'should be an array with elements that should be an object' : 'should be an object') +
      ' with any of the properties',
    keys: properties.map(property => property.key)
  };
  const requiredKeys = properties.filter(property => property.required).map(property => property.key);
  if (requiredKeys.length > 0) {
    section.requiredKeys = requiredKeys;
  }
  if (allKey) {
    section.allKey = allKey;
    section.allDescription = sectionDescriptions[allKey];
  }
  if (sectionValidator.uniqueKeys) {
    section.uniqueKeys = sectionValidator.uniqueKeys;
  }
  if (sectionValidator.allExcludedKeys) {
    section.allExcludedKeys = sectionValidator.allExcludedKeys;
  }
  return section;
}

function buildTopLevel(sectionIds: Set<string>): TopLevelKeyDoc[] {
  const sectionValidators = mochartConfigSectionValidators as SectionValidatorMap;
  const sectionDescriptions: Record<string, string> = getSectionDescriptions();
  return Object.keys(sectionValidators).sort().map(key => {
    const validator = sectionValidators[key].validator;
    const doc: TopLevelKeyDoc = {
      key,
      description: sectionDescriptions[key],
      rules: [validator.errorMessage],
      defaultText: getShapeDefaultText(validator),
      editor: buildEditorValue(validator)
    };
    if (sectionIds.has(key)) {
      doc.sectionId = key;
    }
    const allKey = sectionKeyAllMap[key];
    if (allKey) {
      doc.allKey = allKey;
      doc.allDescription = sectionDescriptions[allKey];
      doc.allRules = [allValidator.errorMessage];
      doc.allDefaultText = getShapeDefaultText(allValidator);
    }
    return doc;
  });
}

/** Top-level keys the runtime validates as config sections (per-property validator maps), as opposed to scalar keys like `version`. */
export function getRuntimeSectionIds(): string[] {
  return Object.keys(mochartConfigSectionValidators).filter(key => mochartConfigSectionValidators[key].validators !== undefined).sort();
}

// Every runtime section must have a docs source and vice versa, or the section falls out of every docs surface silently.
function checkSectionCoverage(sources: SectionSource[], errors: string[]) {
  const sourceIds = new Set(sources.map(source => source.id));
  const runtimeIds = new Set(getRuntimeSectionIds());
  for (const id of runtimeIds) {
    if (!sourceIds.has(id)) {
      errors.push(id + ': config section is registered in the section validators but has no docs source');
    }
  }
  for (const id of sourceIds) {
    if (!runtimeIds.has(id)) {
      errors.push(id + ': docs source has no config section registered in the section validators');
    }
  }
}

export function buildConfigReference(): ConfigReferenceResult {
  const integrityErrors: string[] = [];
  const sources = getSectionSources();
  const sectionValidators = mochartConfigSectionValidators as SectionValidatorMap;
  checkSectionCoverage(sources, integrityErrors);
  for (const source of sources) {
    checkKeyIntegrity(source, integrityErrors);
  }
  const sections = sources
    .filter(source => sectionValidators[source.id] !== undefined)
    .map(source => buildSectionDoc(source, sectionValidators));
  const topLevel = buildTopLevel(new Set(sections.map(section => section.id)));
  return {
    model: { topLevel, sections },
    integrityErrors
  };
}
