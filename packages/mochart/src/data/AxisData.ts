import { scaleLinear, scaleTime, scaleUtc } from 'd3-scale';
import { format, formatPrefix, formatSpecifier } from 'd3-format';
import { timeFormat, utcFormat } from 'd3-time-format';

import { getWithMutations } from '../utils/WithMutations';
import { isCollapsedDomain, isExplicitCollapsedDomain } from './AxisDomainData';
import { getCategoryValueKey } from './CategoryValue';
import { areArraysAndEqual, arrayToMap, idAccessor } from '../utils/utils';
import { AUTO, NONE, SCALE_ORDINAL, SCALE_LINEAR, TYPE_DATE, TYPE_NUMBER, ANCHOR_START, ANCHOR_END, ANCHOR_MIDDLE } from '../config/core/constants';
import type { Anchor } from '../config/core/constants';
import { getMinorTickLabel } from '../config/core/minorConfig';
import { getFirstKeptStep, getPeriodBoundaries, getPeriodIndex, getPeriodStart, getStepCandidates } from './Steps';
import type { Auto, DataType } from '../config/core/constants';
import type { MinorTickLabel } from '../config/core/minorConfig';
import type { AxisConfigBase, AxisTickStepConfig, CategoryAxisConfig, CategoryAxisTick, CategoryAxisTickStepConfig, PlotConfig, ValueAxisTick } from '../types/config';
import type { EnhancedMochartConfig, EnhancedValueAxisConfig } from '../types/enhanced';
import type { AxisData, AxisScale, AxisTick, AxisValue, ChartData, CategoryAxisData, CategoryAxisDomain, CategorySpacingInfo, CategoryValue, CategoryValues, NullableDomain, ValueAxisData, TickLabelFormatter } from '../types/data';
import type { AxisLayoutInfo, ChartLayoutInfo, CategoryAxisLayoutInfo } from '../types/layout';

const autoTickLabelFormatNumber = 's';
// per-value form: without a tick step to take the precision from, the trailing zeros must be trimmed
const autoOrdinalTickLabelFormatNumber = '~s';
const autoTickLabelFormatDate = '%c';

const enableOrdinalExperimentalMode = true;

export function getAxisData(mochartConfig: EnhancedMochartConfig, chartLayoutInfo: ChartLayoutInfo, chartData: ChartData | null): AxisData {

  const categoryAxisData = getCategoryAxisData(mochartConfig.categoryAxis, chartLayoutInfo.categoryAxisLayoutInfo, chartData);
  const valueAxisData = getValueAxisData(mochartConfig.plot, mochartConfig.valueAxes, chartLayoutInfo.valueAxisLayoutInfos, chartData);

  return {
    category: categoryAxisData,
    value: valueAxisData
  };
}

function isScaleFunction(value: unknown): value is AxisScale {
  return typeof value === 'function' && 'domain' in value && 'range' in value;
}

// a date scale's domain() hands back fresh Date objects, so identity comparison never matches
function areDomainsEqual(oldDomain: unknown, newDomain: unknown): boolean {
  if (!Array.isArray(oldDomain) || !Array.isArray(newDomain) || oldDomain.length !== newDomain.length) {
    return false;
  }
  return oldDomain.every((value, i) => value instanceof Date && newDomain[i] instanceof Date
    ? value.getTime() === (newDomain[i] as Date).getTime()
    : value === newDomain[i]);
}

export function scaleMutator(oldValue: unknown, newValue: unknown): unknown {
  if (isScaleFunction(oldValue) && isScaleFunction(newValue)) {
    if (areDomainsEqual(oldValue.domain(), newValue.domain()) && areArraysAndEqual(oldValue.range(), newValue.range())) {
      return oldValue;
    }
    else {
      return newValue;
    }
  }
  else {
    return newValue;
  }
}

export function getAxisDataWithMutations(axisData: AxisData | null, mochartConfig: EnhancedMochartConfig, chartLayoutInfo: ChartLayoutInfo, chartData: ChartData | null): AxisData {
  return getWithMutations(axisData, getAxisData(mochartConfig, chartLayoutInfo, chartData), scaleMutator);
}

export function getAxisDataForCategoryChange(axisData: AxisData, mochartConfig: EnhancedMochartConfig, chartLayoutInfo: ChartLayoutInfo, chartData: ChartData | null): AxisData {
  const categoryAxisData = getCategoryAxisData(mochartConfig.categoryAxis, chartLayoutInfo.categoryAxisLayoutInfo, chartData);
  return getWithMutations(axisData, Object.assign({}, axisData, { category: categoryAxisData }), scaleMutator);
}

export function getAxisDataForSeriesChange(axisData: AxisData, mochartConfig: EnhancedMochartConfig, chartLayoutInfo: ChartLayoutInfo, chartData: ChartData | null): AxisData {
  const valueAxisData = getValueAxisData(mochartConfig.plot, mochartConfig.valueAxes, chartLayoutInfo.valueAxisLayoutInfos, chartData);
  return getWithMutations(axisData, Object.assign({}, axisData, { value: valueAxisData }), scaleMutator);
}

function getCategoryAxisData(categoryAxisConfig: CategoryAxisConfig, axisLayoutInfo: CategoryAxisLayoutInfo, chartData: ChartData | null): CategoryAxisData | null {
  let categoryAxisData: CategoryAxisData | null = null;
  if (chartData) {
    const { categoryData } = chartData;
    const spacingInfo = getCategorySpacingInfo(categoryAxisConfig, categoryData.renderAxisDomain, axisLayoutInfo.categoryExtent, categoryData.categoryValueInterval);
    const axisScale = getCategoryAxisScale(categoryAxisConfig, categoryData.renderAxisDomain, spacingInfo);
    const positions = getCategoryValuePositions(categoryAxisConfig, axisScale, categoryData.values);
    // a collapsed domain (one category, or explicit min === max) draws its single tick at the value, not at the widened render bounds
    const tickDomain = isCollapsedDomain(categoryData.axisDomain) ? categoryData.axisDomain : categoryData.renderAxisDomain;
    const { ticks: axisTickData, minorTickLabelLength } = buildCategoryAxisTickData(categoryAxisConfig, axisLayoutInfo, axisScale, tickDomain, categoryData.values.parsed, categoryData.values.key, positions);
    const maxTickLabelLength = getMaxTickLabelLength(categoryAxisConfig, categoryData.values.parsed, axisTickData, spacingInfo);

    categoryAxisData = {
      axisScale, axisTickData, maxTickLabelLength, maxMinorTickLabelLength: minorTickLabelLength, valueData: { spacingInfo, positions }
    };
  }
  return categoryAxisData;
}

function getValueAxisData(plotConfig: PlotConfig, valueAxisConfigs: EnhancedValueAxisConfig[], axisLayoutInfoArray: ChartLayoutInfo['valueAxisLayoutInfos'], chartData: ChartData | null): ValueAxisData | null {
  let valueAxisData: ValueAxisData | null = null;
  if (chartData) {
    const vertical = !plotConfig.inverted;
    const { seriesData } = chartData;
    const axisScales = getValueAxisScales(valueAxisConfigs, seriesData.raw.renderAxisDomains, seriesData.filtered.renderAxisDomains, axisLayoutInfoArray, vertical);
    const axisTickData = getValueAxisTickData(valueAxisConfigs, axisLayoutInfoArray, seriesData, axisScales, vertical);

    valueAxisData = {
      axisScales, axisTickData
    };
  }
  return valueAxisData;
}

export function getCategorySpacingInfo(categoryAxisConfig: CategoryAxisConfig, categoryAxisDomain: CategoryAxisDomain, categoryAxisExtent: number, categoryValueInterval: number | null): CategorySpacingInfo {
  let minPosition = 0;
  let maxPosition = categoryAxisExtent;
  const categoryAxisDomainExtent = categoryAxisDomain[0] === null || categoryAxisDomain[1] === null ? 0 : Math.abs(+categoryAxisDomain[1] - +categoryAxisDomain[0]);
  // slots across the domain: one per category on an ordinal axis, one per categoryValueInterval on a linear axis, one when a single category has no interval
  const categorySlotCount = categoryValueInterval !== null ? categoryAxisDomainExtent / categoryValueInterval : (categoryAxisDomainExtent === 0 ? 0 : 1);
  const categoryCountPadding = categoryAxisConfig.categoryCountPadding;
  let categoryValueExtent;
  if (categorySlotCount === 0 && categoryCountPadding === 0) {
    categoryValueExtent = maxPosition;
  }
  else if (categoryCountPadding > 0) {
    categoryValueExtent = maxPosition / (categorySlotCount + categoryCountPadding); // category extent is smaller, ex: to allow for bar widths
    minPosition+= categoryValueExtent / 2.0; // shift the visual range of the scale, ex: so the first and last bars aren't sliced in half
    maxPosition-= categoryValueExtent / 2.0;
  }
  else {
    categoryValueExtent = maxPosition / categorySlotCount;
  }
  categoryValueExtent =  Math.max(categoryAxisConfig.minCategoryValueExtent, Math.floor(categoryValueExtent * (1.0 - categoryAxisConfig.categoryPaddingFraction.outer)));
  const categoryValueOffset = Math.floor(categoryValueExtent / 2.0);
  return {
    categoryRange: [minPosition, maxPosition] as [number, number],
    categoryValueExtent,
    categoryValueOffset
  };
}

function getCategoryValuePositions(categoryAxisConfig: CategoryAxisConfig, scale: AxisScale, valueData: CategoryValues): number[] {
  const positions: number[] = [];
  const values = categoryAxisConfig.scale === SCALE_ORDINAL ? valueData.numeric : valueData.parsed;
  const count = values.length;
  for (let i=0; i<count; i++) {
    positions.push(scale(values[i] as number | Date));
  }
  return positions;
}

function getCategoryAxisScale(axisConfig: CategoryAxisConfig, axisDomain: CategoryAxisDomain, categorySpacingInfo: CategorySpacingInfo): AxisScale {
  const axisScale = (axisConfig.type === TYPE_DATE && axisConfig.scale === SCALE_LINEAR) ? (axisConfig.dateUTC ? scaleUtc() : scaleTime()) : scaleLinear();
  axisScale.domain(axisDomain);
  axisScale.range(reversedRange(categorySpacingInfo.categoryRange, axisConfig.reversed));
  return axisScale;
}

// reversing the range, not the domain: the domain stays ascending so bases, thresholds, ticks and
// the animation deltas are all untouched (an ordinal category axis reverses its category order too)
function reversedRange(range: [number, number], reversed: boolean): [number, number] {
  return reversed ? [range[1], range[0]] : range;
}

function getValueAxisScales(valueAxisConfigs: EnhancedValueAxisConfig[], rawAxisDomainArray: Record<string, NullableDomain>, filteredAxisDomainArray: Record<string, NullableDomain>, axisLayountInfoArray: ChartLayoutInfo['valueAxisLayoutInfos'], vertical: boolean): Record<string, AxisScale> {
  return arrayToMap(valueAxisConfigs, idAccessor, valueAxisConfig => {
    const axisId = valueAxisConfig.id;
    return getValueAxisScale(valueAxisConfig, rawAxisDomainArray[axisId], filteredAxisDomainArray[axisId], axisLayountInfoArray[axisId], vertical);
  });
}

function getValueAxisScale(axisConfig: EnhancedValueAxisConfig, rawAxisDomain: NullableDomain, filteredAxisDomain: NullableDomain, axisLayoutInfo: AxisLayoutInfo, vertical: boolean): AxisScale {
  return getValueAxisScaleForDomain(axisConfig, axisLayoutInfo, axisConfig.adjustForFiltering ? filteredAxisDomain : rawAxisDomain, vertical);
}

function getValueAxisScaleForDomain(axisConfig: EnhancedValueAxisConfig, axisLayoutInfo: AxisLayoutInfo, axisDomain: NullableDomain, vertical: boolean): AxisScale {
  const axisScale = scaleLinear();
  axisScale.domain(axisDomain);
  const range: [number, number] = vertical ? [axisLayoutInfo.valueExtent, 0] : [0, axisLayoutInfo.valueExtent];
  axisScale.range(reversedRange(range, axisConfig.reversed));
  return axisScale;
}

function createLinearTickObject(scaleTickValue: AxisValue, axisScale: AxisScale, tickLabelFormatter: TickLabelFormatter, isHidden: (tick: Omit<AxisTick, 'hidden'>) => boolean, minor = false): AxisTick {
  const tickObjectWithoutHidden: Omit<AxisTick, 'hidden'> = {
    label: tickLabelFormatter(scaleTickValue),
    position: axisScale(scaleTickValue),
    value: scaleTickValue
  };
  if (minor) {
    tickObjectWithoutHidden.minor = true;
  }
  return { ...tickObjectWithoutHidden, hidden: isHidden(tickObjectWithoutHidden) };
}

function createOrdinalTickObject(scaleTickValue: number, categoryValues: readonly CategoryValue[], categoryPositions: number[], tickLabelFormatter: TickLabelFormatter, isHidden: (tick: Omit<AxisTick, 'hidden'>) => boolean, minor = false): AxisTick {
  const tickObjectWithoutHidden: Omit<AxisTick, 'hidden'> = {
    label: tickLabelFormatter(categoryValues[scaleTickValue]),
    position: categoryPositions[scaleTickValue],
    value: categoryValues[scaleTickValue]
  };
  if (minor) {
    tickObjectWithoutHidden.minor = true;
  }
  return { ...tickObjectWithoutHidden, hidden: isHidden(tickObjectWithoutHidden) };
}

/** The format, prefix and suffix a label formatter is built from: the tick label settings, or the minor ones resolved. */
export interface TickLabelSettings {
  format: string | Auto | null;
  prefix: string | null;
  suffix: string | null;
}

/** How much room along the axis one kind of label needs, the widest of them, and whether the kind is drawn at all. */
interface TickLabelFit {
  visible: boolean;
  space: number;
}

/** The label fits of an axis: the labels a config hides take no part in fitting. */
function getTickLabelFits(axisConfig: AxisConfigBase & Pick<CategoryAxisConfig, 'scale'>, axisLayoutInfo: AxisLayoutInfo & Partial<Pick<CategoryAxisLayoutInfo, 'minTickSize' | 'minorMinTickSize'>>, minorTickLabel: MinorTickLabel): { major: TickLabelFit; minor: TickLabelFit; minorTruncated: boolean } {
  const ordinal = axisConfig.scale === SCALE_ORDINAL;
  const majorTruncated = ordinal && (axisConfig.tickLabel as CategoryAxisConfig['tickLabel']).truncation?.enabled === true && axisLayoutInfo.tickLabelParallel === true;
  const minorTruncated = ordinal && minorTickLabel.truncation?.enabled === true && axisLayoutInfo.minorTickLabelParallel === true;
  return {
    major: { visible: axisConfig.tickLabel.visible, space: axisConfig.tickLabel.visible ? (majorTruncated ? axisLayoutInfo.minTickSize ?? 0 : axisLayoutInfo.tickLabelSpace ?? 0) : 0 },
    minor: { visible: minorTickLabel.visible, space: minorTickLabel.visible ? (minorTruncated ? axisLayoutInfo.minorMinTickSize ?? 0 : axisLayoutInfo.minorTickLabelSpace ?? 0) : 0 },
    minorTruncated
  };
}

/**
 * The minor labels show only when every one fits beside its labeled neighbours, minor or not, measured from the
 * widest label of each kind plus minTickSpacing; when one does not fit they all hide. Returns the room the
 * narrowest-placed minor label has, the length a truncated minor label may take (Infinity with nothing to fit).
 */
function fitMinorLabels(ticks: AxisTick[], majorFit: TickLabelFit, minorFit: TickLabelFit, minTickSpacing: number): number {
  const minors = ticks.filter(tick => tick.minor === true);
  if (minors.length === 0 || !minorFit.visible) {
    return Infinity;
  }
  const labeled = ticks
    .filter(tick => !tick.hidden && (tick.minor === true || majorFit.visible))
    .sort((a, b) => a.position - b.position);
  let room = Infinity;
  let fits = true;
  labeled.forEach((tick, index) => {
    if (tick.minor !== true) {
      return;
    }
    for (const neighbour of [labeled[index - 1], labeled[index + 1]]) {
      if (neighbour === undefined) {
        continue;
      }
      const neighbourSpace = neighbour.minor === true ? minorFit.space : majorFit.space;
      const gap = Math.abs(neighbour.position - tick.position);
      if (gap < (minorFit.space + neighbourSpace) / 2 + minTickSpacing) {
        fits = false;
      }
      // the width this label could take with the neighbour's half and the spacing kept clear on this side
      room = Math.min(room, 2 * (gap - minTickSpacing - neighbourSpace / 2));
    }
  });
  if (!fits) {
    for (const tick of minors) {
      tick.hidden = true;
    }
  }
  return Math.max(0, room);
}

// float noise from a multiple of a decimal step (3 * 0.1) would leak into labels and lookups
function multiple(count: number, step: number): number {
  return Number((count * step).toPrecision(12));
}

interface LinearStepAxisConfig {
  type: DataType;
  dateUTC?: boolean;
  tickStep: AxisTickStepConfig & Partial<Pick<CategoryAxisTickStepConfig, 'period' | 'minorPeriod'>>;
}

interface LinearStepTicks {
  /** The ticks the step places, kept by count and offset and in value order, or null when it places none. */
  majors: AxisValue[] | null;
  /** The minor ticks between them; one closer to a tick than the regular minor spacing is hidden. */
  minors: { value: AxisValue; hidden: boolean }[];
  /** The axis value distance between the majors on a number scale (the interval), which the auto label precision follows; null for a period or no step. */
  step: number | null;
  /** The axis value distance between the minor ticks on a number scale (the interval split by minorSteps), null without them. */
  minorStep: number | null;
}

const noStepTicks: LinearStepTicks = { majors: null, minors: [], step: null, minorStep: null };

// which of a step's warnings are standing, per tickStep config: a warning repeats only after the step fits again
const warnedSteps = new WeakMap<object, { majors: boolean; minors: boolean }>();

function warnStep(step: object, kind: 'majors' | 'minors', tooDense: boolean, message: string): void {
  let state = warnedSteps.get(step);
  if (state === undefined) {
    state = { majors: false, minors: false };
    warnedSteps.set(step, state);
  }
  if (tooDense && !state[kind]) {
    console.warn(message);
  }
  state[kind] = tooDense;
}

/**
 * The ticks a linear axis's tickStep creates: the multiples of its interval or the boundaries of its period,
 * kept by count and offset counted from a fixed origin, with minor ticks from minorSteps or minorPeriod between
 * them. The ticks are counted before any is created: a step whose ticks would sit closer than minSpacing along
 * the axis creates none, and its minor ticks alone are dropped when only they would.
 */
function getLinearStepTicks(axisConfig: LinearStepAxisConfig, domain: [AxisValue, AxisValue], axisLength: number, axisName: string): LinearStepTicks {
  const step = axisConfig.tickStep;
  const domainMin = +domain[0];
  const domainMax = +domain[1];
  if (!(domainMax > domainMin)) {
    return noStepTicks;
  }
  const countN = step.count === AUTO ? 1 : step.count;
  const keep = (index: number) => step.count === AUTO || ((index - step.offset) % step.count + step.count) % step.count === 0;
  const tooDense = (spacing: number) => spacing < step.minSpacing;
  const warn = (kind: 'majors' | 'minors', dense: boolean) => warnStep(step, kind, dense, 'mochart ' + axisName + ' tickStep creates no ' + (kind === 'majors' ? 'ticks' : 'minor ticks') + ': they would be closer together than minSpacing (' + step.minSpacing + 'px)');

  if (axisConfig.type === TYPE_DATE) {
    const period = step.period ?? NONE;
    if (period === NONE) {
      return noStepTicks;
    }
    const dateUTC = axisConfig.dateUTC ?? true;
    const periods = getPeriodIndex(period, dateUTC, new Date(domainMax)) - getPeriodIndex(period, dateUTC, new Date(domainMin)) + 1;
    const majorsDense = tooDense(axisLength * countN / periods);
    warn('majors', majorsDense);
    if (majorsDense) {
      return noStepTicks;
    }
    const majors = getPeriodBoundaries(period, dateUTC, [new Date(domainMin), new Date(domainMax)]).filter(boundary => keep(getPeriodIndex(period, dateUTC, boundary)));
    const minorPeriod = step.minorPeriod ?? NONE;
    let minors: LinearStepTicks['minors'] = [];
    if (minorPeriod !== NONE) {
      const minorPeriods = getPeriodIndex(minorPeriod, dateUTC, new Date(domainMax)) - getPeriodIndex(minorPeriod, dateUTC, new Date(domainMin)) + 1;
      const minorsDense = tooDense(axisLength / minorPeriods);
      warn('minors', minorsDense);
      if (!minorsDense) {
        const majorTimes = majors.map(major => major.getTime());
        // a tick inside a minor period hides the minor ticks at both ends of that period; decided by calendar
        // period, not by a fixed span, so a day shortened by daylight saving does not hide the minor tick before a tick
        const hiddenMinorIndexes = new Set<number>();
        for (const major of majors) {
          const minorStart = getPeriodStart(minorPeriod, dateUTC, major);
          if (minorStart.getTime() !== major.getTime()) {
            const index = getPeriodIndex(minorPeriod, dateUTC, minorStart);
            hiddenMinorIndexes.add(index);
            hiddenMinorIndexes.add(index + 1);
          }
        }
        minors = getPeriodBoundaries(minorPeriod, dateUTC, [new Date(domainMin), new Date(domainMax)])
          .filter(boundary => !majorTimes.includes(boundary.getTime()))
          .map(boundary => ({ value: boundary, hidden: hiddenMinorIndexes.has(getPeriodIndex(minorPeriod, dateUTC, boundary)) }));
      }
    }
    return { majors, minors, step: null, minorStep: null };
  }

  const { interval, minorSteps } = step;
  if (interval === NONE) {
    return noStepTicks;
  }
  const span = domainMax - domainMin;
  const majorsDense = tooDense(axisLength * interval * countN / span);
  warn('majors', majorsDense);
  if (majorsDense) {
    return noStepTicks;
  }
  const majors: AxisValue[] = [];
  const lastIndex = Math.floor(domainMax / interval + 1e-9);
  for (let index = getFirstKeptStep(Math.ceil(domainMin / interval - 1e-9), step.count, step.offset); index <= lastIndex; index += countN) {
    majors.push(multiple(index, interval));
  }
  const minors: LinearStepTicks['minors'] = [];
  if (minorSteps !== NONE) {
    const minorStep = interval / minorSteps;
    const minorsDense = tooDense(axisLength * minorStep / span);
    warn('minors', minorsDense);
    if (!minorsDense) {
      for (let index = Math.ceil(domainMin / minorStep - 1e-9); index <= Math.floor(domainMax / minorStep + 1e-9); index++) {
        // a minor step on a kept tick is that tick; on a tick count skipped it is a minor tick
        if (index % minorSteps !== 0 || !keep(index / minorSteps)) {
          minors.push({ value: multiple(index, minorStep), hidden: false });
        }
      }
    }
  }
  // the drawn ticks are every count-th multiple, so their spacing is the interval times the count
  return { majors, minors, step: interval * countN, minorStep: minorSteps !== NONE ? interval / minorSteps : null };
}

/** The smallest gap between the explicit number ticks, the step their auto label precision follows; null with fewer than two. */
function getExplicitTickStep(explicitTicks: readonly { value: unknown }[]): number | null {
  const values = explicitTicks.map(tick => tick.value).filter((value): value is number => typeof value === 'number' && Number.isFinite(value)).sort((a, b) => a - b);
  let step: number | null = null;
  for (let i = 1; i < values.length; i++) {
    const gap = values[i] - values[i - 1];
    if (gap > 0 && (step === null || gap < step)) {
      step = gap;
    }
  }
  return step;
}

/** The linear ticks of an axis in value order: the step's ticks (or the scale's) with the minor ticks between them. */
function createLinearTicks(majors: AxisValue[], minors: LinearStepTicks['minors'], axisScale: AxisScale, majorFormatter: TickLabelFormatter, minorFormatter: TickLabelFormatter, isMajorHidden: (index: number, tick: Omit<AxisTick, 'hidden'>) => boolean, isMinorHidden: (tick: Omit<AxisTick, 'hidden'>) => boolean): AxisTick[] {
  const ticks = majors.map((major, index) => createLinearTickObject(major, axisScale, majorFormatter, tick => isMajorHidden(index, tick)));
  if (minors.length === 0) {
    return ticks;
  }
  for (const minor of minors) {
    ticks.push(createLinearTickObject(minor.value, axisScale, minorFormatter, tick => minor.hidden || isMinorHidden(tick), true));
  }
  return ticks.sort((a, b) => +a.value - +b.value);
}

/** The ticks of the category axis; see buildCategoryAxisTickData for the minor label room. */
export function getCategoryAxisTickData(axisConfig: CategoryAxisConfig, axisLayoutInfo: CategoryAxisLayoutInfo, axisScale: AxisScale, axisDomain: CategoryAxisDomain, categoryValues: readonly CategoryValue[], categoryKeys: readonly CategoryValue[], categoryPositions: number[]): AxisTick[] {
  return buildCategoryAxisTickData(axisConfig, axisLayoutInfo, axisScale, axisDomain, categoryValues, categoryKeys, categoryPositions).ticks;
}

function buildCategoryAxisTickData(axisConfig: CategoryAxisConfig, axisLayoutInfo: CategoryAxisLayoutInfo, axisScale: AxisScale, axisDomain: CategoryAxisDomain, categoryValues: readonly CategoryValue[], categoryKeys: readonly CategoryValue[], categoryPositions: number[]): { ticks: AxisTick[]; minorTickLabelLength: number } {
  const minorTickLabel = getMinorTickLabel(axisConfig.tickLabel);
  const fits = getTickLabelFits(axisConfig, axisLayoutInfo, minorTickLabel);
  if (axisConfig.ticks !== NONE) {
    const ticks = getExplicitCategoryAxisTickData(axisConfig, minorTickLabel, axisConfig.ticks, axisScale, categoryValues, categoryKeys, categoryPositions);
    return { ticks, minorTickLabelLength: fitMinorLabels(ticks, fits.major, fits.minor, axisConfig.minTickSpacing) };
  }
  let ticks: AxisTick[] = [];
  // the single-label fallback: shown once no other label of either kind is, decided after the minor fit
  let singleTick: AxisTick | null = null;
  // magnitude: a reversed axis has a descending range, and tick counting needs a positive extent
  const categoryAxisRangeExtent = Math.abs(axisScale.range()[1] - axisScale.range()[0]);
  const categoryAxisDomainExtent = +axisScale.domain()[1] - +axisScale.domain()[0];

  if (categoryValues.length > 0) {
    let scaleTicks: AxisValue[];
    let tickCount: number;
    // the axis room one ordinal tick label needs, the widest label plus the spacing, for the step rule's collision pass
    let ordinalTickSpace = 0;
    let stepTicks = noStepTicks;

    if (categoryValues.length === 1) {
      if (axisConfig.scale === SCALE_ORDINAL) {
        scaleTicks = [0];
      }
      else {
        const axisMin = axisDomain[0];
        const axisMax = axisDomain[1];
        // tickDomain, not the scale: an explicit collapsed domain draws one tick at its value
        if (axisMin !== null && axisMax !== null && +axisMin !== +axisMax) {
          scaleTicks = [axisMin, axisMax];
        }
        else {
          scaleTicks = [categoryValues[0] as AxisValue];
        }
      }
      tickCount = scaleTicks.length;
    }
    else {
      tickCount = Math.max(1, getTickCount(axisConfig, categoryAxisRangeExtent, categoryAxisDomainExtent, fits.major.space));
      ordinalTickSpace = fits.major.space + axisConfig.minTickSpacing;

      if (axisConfig.scale === SCALE_ORDINAL && tickCount > categoryValues.length) {
        tickCount = categoryValues.length;
      }

      // a step rule picks from every category (or period boundary), whatever the fit count; a lone fitting tick
      // otherwise keeps its single-tick formatting
      if (tickCount === 1 && !hasTickStep(axisConfig)) {
        if (axisConfig.scale === SCALE_ORDINAL) {
          scaleTicks = [0];
        }
        else {
          scaleTicks = [categoryValues[0] as AxisValue];
        }
      }
      else if (axisConfig.scale === SCALE_ORDINAL) {
        scaleTicks = categoryValues.map((_v, i) => i);
      }
      else {
        stepTicks = getLinearStepTicks(axisConfig, axisScale.domain() as [AxisValue, AxisValue], categoryAxisRangeExtent, 'categoryAxis');
        scaleTicks = stepTicks.majors ?? axisScale.ticks(tickCount);
      }
    }
    let tickLabelFormatter: TickLabelFormatter;
    let minorTickLabelFormatter: TickLabelFormatter;
    if (axisConfig.scale === SCALE_ORDINAL) {
      tickLabelFormatter = getOrdinalScaleTickLabelFormatter(axisConfig, axisConfig.tickLabel, axisScale, scaleTicks.length, categoryValues);
      minorTickLabelFormatter = getOrdinalScaleTickLabelFormatter(axisConfig, minorTickLabel, axisScale, scaleTicks.length, categoryValues);
    }
    else {
      tickLabelFormatter = getLinearScaleTickLabelFormatter(axisConfig, axisConfig.tickLabel, axisScale, scaleTicks.length, stepTicks.step);
      minorTickLabelFormatter = getLinearScaleTickLabelFormatter(axisConfig, minorTickLabel, axisScale, Math.max(scaleTicks.length, stepTicks.minors.length), stepTicks.minorStep ?? stepTicks.step);
    }
    if (axisConfig.scale === SCALE_ORDINAL) {
      // a parallel untruncated label that would spill past either axis end is hidden, each kind tested with its own
      // width and anchor; the step rule's collision pass needs to know the major range
      const edgeRange = !axisConfig.tickLabel.truncation.enabled && axisLayoutInfo.tickLabelParallel
        ? getEdgeRange(axisLayoutInfo, axisLayoutInfo.tickLabelSpace, axisLayoutInfo.tickLabelAnchor) : null;
      const minorEdgeRange = fits.minor.visible && !fits.minorTruncated && axisLayoutInfo.minorTickLabelParallel
        ? getEdgeRange(axisLayoutInfo, axisLayoutInfo.minorTickLabelSpace, axisLayoutInfo.minorTickLabelAnchor) : null;
      const { isSkipped, isMinor } = getOrdinalTickRule(axisConfig, categoryValues, categoryPositions, tickCount, ordinalTickSpace, edgeRange, fits.major.visible);
      const outsideEnds = ({ position, minor }: Omit<AxisTick, 'hidden'>) => {
        const range = minor === true ? minorEdgeRange : edgeRange;
        return range !== null && (position < range[0] || position > range[1]);
      };
      ticks = scaleTicks.map((scaleTick, i) => {
        const index = scaleTick as number;
        const minor = isMinor(index);
        return createOrdinalTickObject(index, categoryValues, categoryPositions, minor ? minorTickLabelFormatter : tickLabelFormatter, tick => isSkipped(i) || outsideEnds(tick), minor);
      });
      if (edgeRange !== null && categoryValues.length > 0) {
        const { tickLabelAnchor } = axisLayoutInfo;
        const singleIndex = tickLabelAnchor === ANCHOR_START ? 0 : (tickLabelAnchor === ANCHOR_END ? categoryValues.length-1 : Math.floor(categoryValues.length / 2));
        singleTick = createOrdinalTickObject(singleIndex, categoryValues, categoryPositions, tickLabelFormatter, () => true);
        ticks.push(singleTick);
      }
    }
    else {
      const { preTicks, postTicks } = getLinearAxisExtraTicks(axisDomain, axisScale, scaleTicks);
      // a step's ticks can far outnumber the fitting ticks, so they thin to every k-th while their labels are drawn; generated ticks at most halve
      const tickInterval = stepTicks.majors !== null ? (fits.major.visible ? Math.max(1, Math.ceil(scaleTicks.length / tickCount)) : 1) : (scaleTicks.length > tickCount ? 2 : 1);

      if (axisLayoutInfo.tickLabelParallel) {
        const { tickLabelAnchor } = axisLayoutInfo;
        const [minPosition, maxPosition] = getEdgeRange(axisLayoutInfo, axisLayoutInfo.tickLabelSpace, tickLabelAnchor);
        const outside = ({ position }: Omit<AxisTick, 'hidden'>) => position < minPosition || position > maxPosition;

        ticks = createLinearTicks(scaleTicks, stepTicks.minors, axisScale, tickLabelFormatter, minorTickLabelFormatter, (i, tick) => i % tickInterval !== 0 || outside(tick), outside);
        if (categoryValues.length > 0) {
          const singleValue = tickLabelAnchor === ANCHOR_START ? axisDomain[0]! : (tickLabelAnchor === ANCHOR_END ? axisDomain[1]! : +axisDomain[0]! + (+axisDomain[1]! - +axisDomain[0]!) / 2);
          const singleTickValue = axisConfig.type === TYPE_DATE ? new Date(singleValue) : singleValue;
          singleTick = createLinearTickObject(singleTickValue, axisScale, tickLabelFormatter, () => true);
          ticks.push(singleTick);
        }
      }
      else {
        ticks = createLinearTicks(scaleTicks, stepTicks.minors, axisScale, tickLabelFormatter, minorTickLabelFormatter, i => i % tickInterval !== 0, () => false);
      }

      if (preTicks.length > 0) {
        ticks = preTicks.map(preTick => createLinearTickObject(preTick, axisScale, tickLabelFormatter, () => true)).concat(ticks);
      }
      if (postTicks.length > 0) {
        ticks = ticks.concat(postTicks.map(postTick => createLinearTickObject(postTick, axisScale, tickLabelFormatter, () => true)));
      }
    }
  }

  const minorTickLabelLength = fitMinorLabels(ticks, fits.major, fits.minor, axisConfig.minTickSpacing);
  if (singleTick !== null) {
    const single = singleTick;
    single.hidden = ticks.some(tick => tick !== single && tick.hidden === false);
  }
  return { ticks, minorTickLabelLength };
}

/** The positions a parallel label of one kind may sit at without spilling past an axis end, from that kind's widest label and anchor. */
function getEdgeRange(axisLayoutInfo: CategoryAxisLayoutInfo, tickLabelSpace: number, tickLabelAnchor: Anchor): [number, number] {
  const { before, after, categoryExtent } = axisLayoutInfo;
  const beforeOffset = tickLabelAnchor === ANCHOR_START ? 0 : (tickLabelAnchor === ANCHOR_MIDDLE ? Math.ceil(tickLabelSpace / 2.0) : tickLabelSpace);
  const afterOffset = tickLabelAnchor === ANCHOR_START ? tickLabelSpace : (tickLabelAnchor === ANCHOR_MIDDLE ? Math.ceil(tickLabelSpace / 2.0) : 0);
  return [beforeOffset - before, categoryExtent + after - afterOffset];
}

function hasTickStep(axisConfig: CategoryAxisConfig): boolean {
  const { count, offset, period, interval, includeFirst } = axisConfig.tickStep;
  return count !== AUTO || offset !== 0 || period !== NONE || interval !== NONE || includeFirst;
}

interface OrdinalTickRule {
  /** Whether the category's tick is hidden by the tick budget or the step rule, before the axis end checks. */
  isSkipped: (index: number) => boolean;
  /** Whether the category lies between a step rule's ticks. */
  isMinor: (index: number) => boolean;
}

// Which ordinal category indexes lose their tick: without a step rule every tickInterval-th category keeps
// one; with a rule its survivors thin to every k-th from the first, so a thinned weekly rule stays on Mondays.
// The categories between the rule's ticks are minor, and whether their labels fit is decided afterwards.
function getOrdinalTickRule(axisConfig: CategoryAxisConfig, categoryValues: readonly CategoryValue[], categoryPositions: number[], tickCount: number, tickSpace: number, edgeRange: [number, number] | null, labelsVisible: boolean): OrdinalTickRule {
  if (!hasTickStep(axisConfig)) {
    const tickInterval = Math.ceil(categoryValues.length / tickCount);
    return { isSkipped: (index) => index % tickInterval !== 0, isMinor: () => false };
  }
  const stepIndexes = getStepCandidates(axisConfig.tickStep, categoryValues, axisConfig.type, axisConfig.dateUTC).selected;
  // labels a config hides take no part in fitting, so nothing is thinned to make room for them
  const thinning = labelsVisible ? Math.max(1, Math.ceil(stepIndexes.length / tickCount)) : 1;
  // the survivors are evenly strided, which assumes equal periods; a period holding a single category puts its
  // tick one slot from the next, so a survivor closer to the last kept one than a label needs is hidden too,
  // and one the axis ends hide anyway does not count as kept
  const visibleIndexes = new Set<number>();
  let lastKept: number | null = null;
  stepIndexes.forEach((index, position) => {
    const categoryPosition = categoryPositions[index]!;
    const insideEnds = edgeRange === null || (categoryPosition >= edgeRange[0] && categoryPosition <= edgeRange[1]);
    if (position % thinning === 0 && insideEnds && (!labelsVisible || lastKept === null || Math.abs(categoryPosition - categoryPositions[lastKept]!) >= tickSpace)) {
      visibleIndexes.add(index);
      lastKept = index;
    }
  });
  const majorIndexes = new Set(stepIndexes);
  const isMinor = (index: number) => !majorIndexes.has(index);
  return {
    isSkipped: (index) => isMinor(index) ? false : !visibleIndexes.has(index),
    isMinor
  };
}

function getExplicitCategoryAxisTickData(axisConfig: CategoryAxisConfig, minorTickLabel: MinorTickLabel, explicitTicks: readonly CategoryAxisTick[], axisScale: AxisScale, categoryValues: readonly CategoryValue[], categoryKeys: readonly CategoryValue[], categoryPositions: number[]): AxisTick[] {
  if (axisConfig.scale === SCALE_ORDINAL) {
    // a tick names a category the way the rest of the chart identifies it: by its keyProperty value when the axis has one, else by its value
    const indexesByKey = new Map<string, number[]>();
    categoryKeys.forEach((categoryKey, index) => {
      const key = getCategoryValueKey(axisConfig, categoryKey);
      const indexes = indexesByKey.get(key);
      if (indexes === undefined) {
        indexesByKey.set(key, [index]);
      }
      else {
        indexes.push(index);
      }
    });
    const tickLabelFormatter = getOrdinalScaleTickLabelFormatter(axisConfig, axisConfig.tickLabel, axisScale, explicitTicks.length, categoryValues);
    const minorTickLabelFormatter = getOrdinalScaleTickLabelFormatter(axisConfig, minorTickLabel, axisScale, explicitTicks.length, categoryValues);
    const ticks: AxisTick[] = [];
    explicitTicks.forEach(({ value, label, minor }) => {
      const indexes = indexesByKey.get(getCategoryValueKey(axisConfig, value));
      if (indexes === undefined) {
        // a tick naming no category is hidden at the axis start with no label: a finite position keeps the markup valid
        // svg, and the axis measures every label, hidden ones included, so one that can never show reserves no room
        ticks.push(minor === true ? { label: '', position: 0, value, hidden: true, minor: true } : { label: '', position: 0, value, hidden: true });
      }
      else {
        indexes.forEach(index => {
          const tick = createOrdinalTickObject(index, categoryValues, categoryPositions, minor === true ? minorTickLabelFormatter : tickLabelFormatter, () => false, minor === true);
          ticks.push(label === undefined ? tick : { ...tick, label });
        });
      }
    });
    return ticks;
  }
  const explicitStep = getExplicitTickStep(explicitTicks);
  const tickLabelFormatter = getLinearScaleTickLabelFormatter(axisConfig, axisConfig.tickLabel, axisScale, explicitTicks.length, explicitStep);
  const minorTickLabelFormatter = getLinearScaleTickLabelFormatter(axisConfig, minorTickLabel, axisScale, explicitTicks.length, explicitStep);
  return createExplicitLinearTicks(axisConfig, explicitTicks, axisScale, tickLabelFormatter, minorTickLabelFormatter);
}

/** Explicit linear ticks are placed by value; one outside the range is hidden, and a minor one waits on the minor label fit. */
function createExplicitLinearTicks(axisConfig: Pick<CategoryAxisConfig, 'type'>, explicitTicks: readonly (CategoryAxisTick | ValueAxisTick)[], axisScale: AxisScale, tickLabelFormatter: TickLabelFormatter, minorTickLabelFormatter: TickLabelFormatter): AxisTick[] {
  const [rangeStart, rangeEnd] = axisScale.range();
  const rangeMin = Math.min(rangeStart, rangeEnd);
  const rangeMax = Math.max(rangeStart, rangeEnd);
  return explicitTicks.map(({ value, label, minor }) => {
    const axisValue: AxisValue = axisConfig.type === TYPE_DATE ? new Date(value) : value as number;
    const position = axisScale(axisValue);
    const tick: AxisTick = {
      label: label ?? (minor === true ? minorTickLabelFormatter : tickLabelFormatter)(axisValue),
      position,
      value: axisValue,
      hidden: !Number.isFinite(position) || position < rangeMin || position > rangeMax
    };
    if (minor === true) {
      tick.minor = true;
    }
    return tick;
  });
}

function getMaxTickLabelLength(_categoryAxisConfig: CategoryAxisConfig, categoryValues: readonly CategoryValue[], axisTickData: AxisTick[], spacingInfo: CategorySpacingInfo): number {
  // at least one: explicit ticks can all be hidden, and the clip width must stay finite; a shown minor
  // label already fits beside its neighbours, so only the major ticks share the axis out
  const visibleTickCount = Math.max(1, axisTickData.reduce((count, tick) => count + (tick.hidden || tick.minor ? 0 : 1), 0));
  return categoryValues.length / visibleTickCount * spacingInfo.categoryValueExtent;
}

function getValueAxisTickData(axisConfigArray: EnhancedValueAxisConfig[], axisLayoutInfoArray: ChartLayoutInfo['valueAxisLayoutInfos'], seriesData: ChartData['seriesData'], axisScaleArray: Record<string, AxisScale>, vertical: boolean): Record<string, AxisTick[]> {
  return arrayToMap(axisConfigArray, idAccessor, axisConfig => {
    const axisId = axisConfig.id;
    // explicit min === max: the single tick belongs at the configured value, not at the widened render bounds
    const explicitCollapsed = isExplicitCollapsedDomain(axisConfig, seriesData.raw.axisDomains[axisId]);
    const rawDomain = explicitCollapsed ? seriesData.raw.axisDomains[axisId] : seriesData.raw.renderAxisDomains[axisId];
    const filteredDomain = explicitCollapsed ? seriesData.filtered.axisDomains[axisId] : seriesData.filtered.renderAxisDomains[axisId];
    return getValueAxisTickDataObject(axisConfig, axisLayoutInfoArray[axisId], rawDomain, filteredDomain, seriesData.raw.renderAxisDomains[axisId], seriesData.axisSeriesCounts[axisId], axisScaleArray[axisId], vertical);
  });
}

function getValueAxisTickDataObject(axisConfig: EnhancedValueAxisConfig, axisLayoutInfo: AxisLayoutInfo, rawValueAxisDomain: NullableDomain, filteredValueAxisDomain: NullableDomain, rawRenderValueAxisDomain: NullableDomain, visibleSeriesCount: number, axisScale: AxisScale, vertical: boolean): AxisTick[] {
  let ticks: AxisTick[] = [];
  const minorTickLabel = getMinorTickLabel(axisConfig.tickLabel);
  const fits = getTickLabelFits(axisConfig, axisLayoutInfo, minorTickLabel);
  if (axisConfig.ticks !== NONE) {
    if (axisConfig.visibleWhenAllFiltered || visibleSeriesCount > 0) {
      const explicitStep = getExplicitTickStep(axisConfig.ticks);
      const tickLabelFormatter = getLinearScaleTickLabelFormatter(axisConfig, axisConfig.tickLabel, axisScale, axisConfig.ticks.length, explicitStep);
      const minorTickLabelFormatter = getLinearScaleTickLabelFormatter(axisConfig, minorTickLabel, axisScale, axisConfig.ticks.length, explicitStep);
      ticks = createExplicitLinearTicks(axisConfig, axisConfig.ticks, axisScale, tickLabelFormatter, minorTickLabelFormatter);
      fitMinorLabels(ticks, fits.major, fits.minor, axisConfig.minTickSpacing);
    }
    return ticks;
  }
  if (axisConfig.visibleWhenAllFiltered || visibleSeriesCount > 0) {
    let tickCount = axisConfig.tickCount;
    let scaleTicks: AxisValue[];
    let stepTicks = noStepTicks;
    const adjustForFiltering = axisConfig.adjustForFiltering;
    const adjustTickLabelsForFiltering = adjustForFiltering && axisConfig.tickLabel.adjustSizeForFiltering;
    const valueAxisDomain = adjustForFiltering ? filteredValueAxisDomain : rawValueAxisDomain;
    const tickBoundsValueAxisDomain = adjustTickLabelsForFiltering ? filteredValueAxisDomain : rawValueAxisDomain;
    if (valueAxisDomain[0] === valueAxisDomain[1]) {
      if (valueAxisDomain[0] === null) {
        tickCount = 0;
        scaleTicks = [];
      }
      else {
        tickCount = 1;
        scaleTicks = [valueAxisDomain[0]];
      }
    }
    else {
      const valueAxisDomainExtent = valueAxisDomain[1]! - valueAxisDomain[0]!;
      tickCount = getTickCount(axisConfig, axisLayoutInfo.valueExtent, valueAxisDomainExtent, fits.major.space);
      stepTicks = getLinearStepTicks(axisConfig, axisScale.domain() as [AxisValue, AxisValue], axisLayoutInfo.valueExtent, 'value axis ' + axisConfig.id);
      if (stepTicks.majors !== null) {
        scaleTicks = stepTicks.majors;
      }
      else if (tickCount === 1) {
        scaleTicks = [valueAxisDomain[0]!];
      }
      else {
        scaleTicks = axisScale.ticks(tickCount);
      }
    }
    // the visible ticks take their precision from the scale that generated them, or from the step that placed them
    const tickLabelFormatter = getLinearScaleTickLabelFormatter(axisConfig, axisConfig.tickLabel, axisScale, scaleTicks.length, stepTicks.step);
    const minorTickLabelFormatter = getLinearScaleTickLabelFormatter(axisConfig, minorTickLabel, axisScale, Math.max(scaleTicks.length, stepTicks.minors.length), stepTicks.minorStep ?? stepTicks.step);
    // the hidden size ticks span the raw domain, so they keep its precision for stable label bounds
    // (always the render domain: a collapsed domain gives tickFormat a zero step and garbage precision)
    const sizeTickLabelFormatter = adjustTickLabelsForFiltering ? tickLabelFormatter
      : getLinearScaleTickLabelFormatter(axisConfig, axisConfig.tickLabel, getValueAxisScaleForDomain(axisConfig, axisLayoutInfo, rawRenderValueAxisDomain, vertical), scaleTicks.length);
    const { preTicks, postTicks } = getLinearAxisExtraTicks(tickBoundsValueAxisDomain, axisScale, scaleTicks);
    const tickInterval = stepTicks.majors !== null ? (fits.major.visible ? Math.max(1, Math.ceil(scaleTicks.length / Math.max(1, tickCount))) : 1) : (scaleTicks.length > tickCount ? 2 : 1);
    ticks = createLinearTicks(scaleTicks, stepTicks.minors, axisScale, tickLabelFormatter, minorTickLabelFormatter, i => i % tickInterval !== 0, () => false);
    if (preTicks.length > 0) {
      ticks = preTicks.map(preTick => createLinearTickObject(preTick, axisScale, sizeTickLabelFormatter, () => true)).concat(ticks);
    }
    if (postTicks.length > 0) {
      ticks = ticks.concat(postTicks.map(postTick => createLinearTickObject(postTick, axisScale, sizeTickLabelFormatter, () => true)));
    }
    fitMinorLabels(ticks, fits.major, fits.minor, axisConfig.minTickSpacing);
  }
  return ticks;
}

function getLinearAxisExtraTicks(axisDomain: CategoryAxisDomain, _axisScale: AxisScale, scaleTicks: AxisValue[]): { preTicks: AxisValue[]; postTicks: AxisValue[] } {
  const preTicks: AxisValue[] = [];
  const postTicks: AxisValue[] = [];
  if (scaleTicks.length > 1) {
    const minTickValue = scaleTicks[0];
    const maxTickValue = scaleTicks[scaleTicks.length - 1];
    if (axisDomain[0] !== null && +axisDomain[0] < +minTickValue) {
      preTicks.push(axisDomain[0]);
    }
    else if (axisDomain[0] !== null && +axisDomain[0] > +maxTickValue) {
      postTicks.push(axisDomain[0]);
    }
    if (axisDomain[1] !== null && +axisDomain[1] < +minTickValue) {
      preTicks.push(axisDomain[1]);
    }
    else if (axisDomain[1] !== null && +axisDomain[1] > +maxTickValue) {
      postTicks.push(axisDomain[1]);
    }
  }
  else if (scaleTicks.length === 1) {
    if (axisDomain[0] !== null && axisDomain[1] !== null && +axisDomain[0] === +axisDomain[1]) {
      if (+scaleTicks[0] !== +axisDomain[0]) {
        if (+scaleTicks[0] < +axisDomain[0]) {
          postTicks.push(axisDomain[0]);
        }
        else {
          preTicks.push(axisDomain[0]);
        }
      }
    }
    else {
      if (axisDomain[0] !== null && +scaleTicks[0] > +axisDomain[0]) {
        preTicks.push(axisDomain[0]);
      }
      if (axisDomain[1] !== null && +scaleTicks[0] < +axisDomain[1]) {
        postTicks.push(axisDomain[1]);
      }
    }
  }
  else {
    if (axisDomain[0] !== null) {
      if (axisDomain[1] !== null && +axisDomain[0] === +axisDomain[1]) {
        preTicks.push(axisDomain[0]);
      }
      else {
        preTicks.push(axisDomain[0]);
        if (axisDomain[1] !== null) preTicks.push(axisDomain[1]);
      }
    }
  }
  return { preTicks, postTicks };
}

function getTickCount(axisConfig: AxisConfigBase, axisRangeExtent: number, axisDomainExtent: number, tickLabelSpace: number): number {
  const { tickCount, maxTickCount, minTickSpacing, minTickInterval } = axisConfig;
  let count;
  if (tickCount === AUTO) {
    // an invisible axis has no label width, so the divisor is floored at one pixel per tick
    const tickSpace = Math.max(1, tickLabelSpace + minTickSpacing);
    count = Math.max(1, Math.floor((axisRangeExtent + minTickSpacing) / tickSpace));
    if (minTickInterval > 0) {
      const intervalCount = Math.max(1, Math.floor(axisDomainExtent / minTickInterval) + 1);
      count = Math.min(intervalCount, count);
    }
    if (maxTickCount > 0) {
      count = Math.min(maxTickCount, count);
    }
  }
  else {
    count = tickCount;
  }
  return count;
}

/** The decimal places needed to write a step exactly (0.25 needs 2, 2.5 needs 1, 250 none), read from its shortest decimal form. */
function getStepDecimals(step: number): number {
  const [mantissa, exponent = '0'] = Math.abs(step).toPrecision(12).split('e');
  const dot = mantissa.indexOf('.');
  const mantissaDecimals = dot === -1 ? 0 : mantissa.replace(/0+$/, '').length - dot - 1;
  return Math.max(0, mantissaDecimals - Number(exponent));
}

function getExponent(value: number): number {
  return value === 0 ? 0 : Math.floor(Math.log10(Math.abs(value)));
}

/**
 * A number format whose precision, when the specifier leaves it open, names the drawn ticks exactly: what
 * d3's scale.tickFormat does for its own 1-2-5 steps, done for a step the config chose, so a tickStep
 * interval of 0.25 reads 0.25 rather than the 0.3 that d3's precision helpers would give it.
 */
function getStepTickFormat(axisScale: AxisScale, step: number, specifierString: string): TickLabelFormatter {
  const specifier = formatSpecifier(specifierString);
  const [domainStart, domainEnd] = axisScale.domain() as [number, number];
  const magnitude = Math.max(Math.abs(domainStart), Math.abs(domainEnd));
  if (specifier.precision === undefined) {
    if (specifier.type === 's') {
      // formatPrefix writes the value scaled by the SI prefix of the magnitude in fixed notation
      const prefixExponent = Math.max(-8, Math.min(8, Math.floor(getExponent(magnitude) / 3))) * 3;
      specifier.precision = getStepDecimals(step / 10 ** prefixExponent);
      const prefixFormat = formatPrefix(specifier, magnitude);
      return tick => prefixFormat(tick as number);
    }
    if (specifier.type === 'f' || specifier.type === '%') {
      specifier.precision = getStepDecimals(step * (specifier.type === '%' ? 100 : 1));
    }
    else if (specifier.type === '' || specifier.type === 'e' || specifier.type === 'g' || specifier.type === 'p' || specifier.type === 'r') {
      // significant digits: from the leading digit of the largest value down to the step's last decimal
      specifier.precision = Math.max(1, getExponent(Math.max(magnitude, step)) + 1 + getStepDecimals(step)) - (specifier.type === 'e' ? 1 : 0);
    }
  }
  const numberFormat = format(specifier);
  return tick => numberFormat(tick as number);
}

function getLinearScaleTickLabelFormatter(axisConfig: CategoryAxisConfig | EnhancedValueAxisConfig, tickLabel: TickLabelSettings, axisScale: AxisScale, tickCount: number, tickStep: number | null = null): TickLabelFormatter {
  let tickLabelFormatter: TickLabelFormatter = tick => tick;
  if (tickLabel.format !== NONE) {
    if (axisConfig.type === TYPE_NUMBER) {
      const specifier = tickLabel.format === AUTO ? autoTickLabelFormatNumber : tickLabel.format;
      if (tickStep !== null && tickStep > 0) {
        tickLabelFormatter = getStepTickFormat(axisScale, tickStep, specifier);
      }
      else {
        // the scale's own ticks: d3 derives the precision from the step it picks for this count over the domain
        tickLabelFormatter = axisScale.tickFormat(Math.max(1, tickCount), specifier);
      }
    }
    else if (axisConfig.type === TYPE_DATE) {
      if (tickLabel.format === AUTO && tickCount > 1) {
        tickLabelFormatter = axisScale.tickFormat();
      }
      else {
        const timeFormatter = 'dateUTC' in axisConfig && axisConfig.dateUTC ? utcFormat : timeFormat;
        if (tickLabel.format === AUTO) {
          const formatter = timeFormatter(autoTickLabelFormatDate);
          tickLabelFormatter = tick => formatter(tick as Date);
        }
        else {
          const formatter = timeFormatter(tickLabel.format);
          tickLabelFormatter = tick => formatter(tick as Date);
        }
      }
    }
  }
  return getTickLabelFormatterForPrefixAndSuffix(tickLabel, tickLabelFormatter);
}

function getDomainForValues(values: readonly CategoryValue[]): [AxisValue, AxisValue] {
  let min: AxisValue | null = null;
  let max: AxisValue | null = null;
  const count = values.length;
  for (let i=0; i<count; i++) {
    const value = values[i] as AxisValue;
    if (max === null || +value > +max) {
      max = value;
    }
    if (min === null || +value < +min) {
      min = value;
    }
  }
  return [min!, max!];
}

function getOrdinalScaleTickLabelFormatter(axisConfig: CategoryAxisConfig, tickLabel: TickLabelSettings, axisScale: AxisScale, tickCount: number, values: readonly CategoryValue[]): TickLabelFormatter {
  if (tickCount <= 1) {
    return getLinearScaleTickLabelFormatter(axisConfig, tickLabel, axisScale, tickCount);
  }
  else {
    let tickLabelFormatter: TickLabelFormatter = tick => tick;
    if (tickLabel.format !== NONE) {
      if (axisConfig.type === TYPE_NUMBER) {
        const formatSpecifier = tickLabel.format === AUTO ? autoOrdinalTickLabelFormatNumber : tickLabel.format;
        // per value, not a linear tickFormat: its precision comes from the tick step, which rounds small categories to 0
        const formatter = format(formatSpecifier);
        tickLabelFormatter = tick => formatter(tick as number);
      }
      else if (axisConfig.type === TYPE_DATE) {
        const timeFormatter = axisConfig.dateUTC ? utcFormat : timeFormat;
        if (tickLabel.format === AUTO) {
          // Experimental code to try to create a nice uniform tick format for ordinal date scales. needs work...
          if (enableOrdinalExperimentalMode) {
            tickLabelFormatter = (axisConfig.dateUTC ? scaleUtc() : scaleTime()).domain(getDomainForValues(values)).tickFormat();
          }
          else {
            const formatter = timeFormatter(autoTickLabelFormatDate);
            tickLabelFormatter = tick => formatter(tick as Date);
          }
        }
        else {
          const formatter = timeFormatter(tickLabel.format);
          tickLabelFormatter = tick => formatter(tick as Date);
        }
      }
    }
    return getTickLabelFormatterForPrefixAndSuffix(tickLabel, tickLabelFormatter);
  }
}

function getTickLabelFormatterForPrefixAndSuffix(tickLabel: TickLabelSettings, tickLabelFormatter: TickLabelFormatter): TickLabelFormatter {
  if (tickLabel.prefix !== NONE || tickLabel.suffix !== NONE) {
    const oldTickLabelFormatter = tickLabelFormatter;
    if (tickLabel.prefix !== NONE && tickLabel.suffix !== NONE) {
      const prefix = tickLabel.prefix!;
      const suffix = tickLabel.suffix!;
      tickLabelFormatter = (tick: CategoryValue) => (prefix + oldTickLabelFormatter(tick) + suffix);
    }
    else if (tickLabel.prefix !== NONE) {
      const prefix = tickLabel.prefix!;
      tickLabelFormatter = (tick: CategoryValue) => (prefix + oldTickLabelFormatter(tick));
    }
    else if (tickLabel.suffix !== NONE) {
      const suffix = tickLabel.suffix!;
      tickLabelFormatter = (tick: CategoryValue) => (oldTickLabelFormatter(tick) + suffix);
    }
  }
  return tickLabelFormatter;
}
