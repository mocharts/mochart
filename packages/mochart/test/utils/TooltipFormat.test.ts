import { describe, it, expect } from 'vitest';
import { getSeriesText, getFilteredValue } from '../../src/utils/TooltipFormat';
import { MISSING_VALUE } from '../../src/utils/utils';
import type { PieTooltipValues } from '../../src/utils/TooltipFormat';
import type { TooltipConfig } from '../../src/types/config';
import type { ChartData, SeriesValueObject } from '../../src/types/data';
import type { EnhancedSeriesConfig } from '../../src/types/enhanced';

// getSeriesText walks a "category series slice" shaped like the runtime's data
// layer. Build small typed-loose fixtures rather than a full ChartData.
type ValueObj = Record<string, number | null | undefined>;
interface Slice {
  axisBases: Record<string, number | null>;
  raw: { values: Record<string, ValueObj>; domains: unknown };
  filtered: { values: Record<string, ValueObj>; domains: unknown };
}

function makeTooltipConfig(over: Partial<TooltipConfig> = {}): TooltipConfig {
  return {
    filteredValueText: null,
    filteredValueCharacter: null,
    adjustForFiltering: false,
    showMissingValues: false,
    missingValueText: 'N/A',
    rangeValueSeparator: ' - ',
    ...over
  } as TooltipConfig;
}

function makeSeriesConfig(over: Partial<EnhancedSeriesConfig> = {}): EnhancedSeriesConfig {
  return {
    id: 's1',
    rangeProperty: null,
    errorLowProperty: null,
    errorHighProperty: null,
    markerProperty: null,
    tooltipProperty: null,
    followSeries: null,
    valueLabel: 'Val',
    useTitleForValueLabel: false,
    title: null,
    valueAxisConfig: { id: 'y' },
    ...over
  } as EnhancedSeriesConfig;
}

function makeSlice(raw: ValueObj, filtered: ValueObj = raw, axisBases: Record<string, number | null> = { y: 0 }): Slice {
  return {
    axisBases,
    raw: { values: { s1: raw }, domains: {} },
    filtered: { values: { s1: filtered }, domains: {} }
  };
}

const identity = (v: number | Date) => v as unknown as string;

describe('getSeriesText', () => {
  it('formats a plain value with its label', () => {
    const { labelText, valueText } = getSeriesText(
      makeTooltipConfig(), makeSeriesConfig(), identity, makeSlice({ plain: 42 }) as never, false
    );
    expect(labelText).toBe('Val: ');
    expect(valueText).toBe('42');
  });

  it('joins a range value and plain value with the range separator', () => {
    const { valueText } = getSeriesText(
      makeTooltipConfig(),
      makeSeriesConfig({ rangeProperty: 'hi' }),
      identity,
      makeSlice({ plain: 42, range: 10 }) as never,
      false
    );
    expect(valueText).toBe('10 - 42');
  });

  it('collapses a range whose two ends format identically to the single value', () => {
    const { valueText } = getSeriesText(
      makeTooltipConfig(),
      makeSeriesConfig({ rangeProperty: 'hi' }),
      identity,
      makeSlice({ plain: 42, range: 42 }) as never, // e.g. an OHLC open/close tick
      false
    );
    expect(valueText).toBe('42');
  });

  describe('skip semantics for ranged series (direction-split idiom)', () => {
    const skipConfig = { rangeProperty: 'hi', missingValueMode: 'connect', partialRangeIsMissing: true, stack: null } as const;

    it('hides the row when the plain value is missing, even when missing values are shown', () => {
      const { valueText } = getSeriesText(
        makeTooltipConfig({ showMissingValues: true }),
        makeSeriesConfig(skipConfig),
        identity,
        makeSlice({ range: 10 }) as never, // plain undefined — the other direction's row
        false
      );
      expect(valueText).toBe(null);
    });

    it('hides the row when the range value is missing', () => {
      const { valueText } = getSeriesText(
        makeTooltipConfig({ showMissingValues: true }),
        makeSeriesConfig(skipConfig),
        identity,
        makeSlice({ plain: 42 }) as never, // range undefined
        false
      );
      expect(valueText).toBe(null);
    });

    it('keeps the row when both values are present', () => {
      const { valueText } = getSeriesText(
        makeTooltipConfig({ showMissingValues: true }),
        makeSeriesConfig(skipConfig),
        identity,
        makeSlice({ plain: 42, range: 10 }) as never,
        false
      );
      expect(valueText).toBe('10 - 42');
    });

    it('hides a plain follower row when its value is missing (direction-split volume)', () => {
      const { valueText } = getSeriesText(
        makeTooltipConfig({ showMissingValues: true }),
        makeSeriesConfig({ missingValueMode: 'connect', stack: null, followSeries: 'up' }),
        identity,
        makeSlice({}) as never, // plain undefined — the other direction's volume row
        false
      );
      expect(valueText).toBe(null);
    });

    it('keeps the missing-value text for a plain connect series that follows nothing', () => {
      const { valueText } = getSeriesText(
        makeTooltipConfig({ showMissingValues: true, missingValueText: 'N/A' }),
        makeSeriesConfig({ missingValueMode: 'connect', stack: null }),
        identity,
        makeSlice({}) as never,
        false
      );
      expect(valueText).toBe('N/A');
    });

    it('still shows a partial range as missing-value text without the skip flags', () => {
      const { valueText } = getSeriesText(
        makeTooltipConfig({ showMissingValues: true, missingValueText: 'N/A' }),
        makeSeriesConfig({ rangeProperty: 'hi', stack: null }),
        identity,
        makeSlice({ range: 10 }) as never,
        false
      );
      expect(valueText).toBe('10 - N/A');
    });
  });

  it('shows a marker-only value in parentheses when there is no plain value', () => {
    const { valueText } = getSeriesText(
      makeTooltipConfig(),
      makeSeriesConfig({ markerProperty: 'm' }),
      identity,
      makeSlice({ marker: 7 }) as never, // plain undefined
      false
    );
    expect(valueText).toBe('(7)');
  });

  it('appends a marker value in parentheses after a plain value', () => {
    const { valueText } = getSeriesText(
      makeTooltipConfig(),
      makeSeriesConfig({ markerProperty: 'm' }),
      identity,
      makeSlice({ plain: 42, marker: 7 }) as never,
      false
    );
    expect(valueText).toBe('42 (7)');
  });

  describe('error bounds', () => {
    it('appends both error bounds in parentheses joined by the range separator', () => {
      const { valueText } = getSeriesText(
        makeTooltipConfig(),
        makeSeriesConfig({ errorLowProperty: 'lo', errorHighProperty: 'hi' }),
        identity,
        makeSlice({ plain: 42, errorLow: 38, errorHigh: 47 }) as never,
        false
      );
      expect(valueText).toBe('42 (38 - 47)');
    });

    it('appends a sole defined bound without the separator', () => {
      const { valueText } = getSeriesText(
        makeTooltipConfig(),
        makeSeriesConfig({ errorLowProperty: 'lo', errorHighProperty: 'hi' }),
        identity,
        makeSlice({ plain: 42, errorLow: 38 }) as never, // errorHigh undefined
        false
      );
      expect(valueText).toBe('42 (38)');
    });

    it('renders nothing for missing bounds even when missing values are shown', () => {
      const { valueText } = getSeriesText(
        makeTooltipConfig({ showMissingValues: true, missingValueText: 'N/A' }),
        makeSeriesConfig({ errorLowProperty: 'lo', errorHighProperty: 'hi' }),
        identity,
        makeSlice({ plain: 42 }) as never, // both bounds undefined
        false
      );
      expect(valueText).toBe('42');
    });

    it('combines with a range value', () => {
      const { valueText } = getSeriesText(
        makeTooltipConfig(),
        makeSeriesConfig({ rangeProperty: 'r', errorLowProperty: 'lo', errorHighProperty: 'hi' }),
        identity,
        makeSlice({ plain: 42, range: 10, errorLow: 8, errorHigh: 47 }) as never,
        false
      );
      expect(valueText).toBe('10 - 42 (8 - 47)');
    });
  });

  it('shows the tooltipProperty value in place of the plain and range values', () => {
    const { labelText, valueText } = getSeriesText(
      makeTooltipConfig(),
      makeSeriesConfig({ rangeProperty: 'hi', tooltipProperty: 't' }),
      identity,
      makeSlice({ plain: 42, range: 10, tooltip: 99 }) as never,
      false
    );
    expect(labelText).toBe('Val: ');
    expect(valueText).toBe('99');
  });

  it('treats an absent tooltipProperty value as missing', () => {
    const { valueText } = getSeriesText(
      makeTooltipConfig({ showMissingValues: false }),
      makeSeriesConfig({ tooltipProperty: 't' }),
      identity,
      makeSlice({ plain: 42 }) as never, // tooltip undefined
      false
    );
    expect(valueText).toBe(null);
  });

  it('is null when there is no value and missing values are hidden', () => {
    const { valueText } = getSeriesText(
      makeTooltipConfig({ showMissingValues: false }),
      makeSeriesConfig(),
      identity,
      makeSlice({}) as never, // plain undefined
      false
    );
    expect(valueText).toBe(null);
  });

  it('shows the missing-value text when the value is absent but missing values are shown', () => {
    const { valueText } = getSeriesText(
      makeTooltipConfig({ showMissingValues: true, missingValueText: '—' }),
      makeSeriesConfig(),
      identity,
      makeSlice({}, { plain: 5 }) as never, // raw hole, filtered present
      false
    );
    expect(valueText).toBe('—');
  });

  describe('pie tooltip values', () => {
    // TooltipContent picks the fraction from the filtered or raw slice shares (getPieSliceFractionMap)
    // and passes it with the row's filtered flag; a percentage is derived, not stored per value key.
    const pieValues = (over: Partial<PieTooltipValues> = {}): PieTooltipValues => ({
      valueType: 'percent',
      percentFormat: (fraction: number) => (fraction * 100).toFixed(1) + '%',
      fraction: 0.25,
      rawFraction: 0.2,
      filtered: false,
      ...over
    });

    it('replaces the value with the slice percentage', () => {
      const { valueText } = getSeriesText(
        makeTooltipConfig(), makeSeriesConfig(), identity, makeSlice({ plain: 42 }) as never, false, pieValues()
      );
      expect(valueText).toBe('25.0%');
    });

    it('combines the value and the percentage in both orders', () => {
      const slice = makeSlice({ plain: 42 }) as never;
      expect(getSeriesText(makeTooltipConfig(), makeSeriesConfig(), identity, slice, false,
        pieValues({ valueType: 'valuePercent' })).valueText).toBe('42 (25.0%)');
      expect(getSeriesText(makeTooltipConfig(), makeSeriesConfig(), identity, slice, false,
        pieValues({ valueType: 'percentValue' })).valueText).toBe('25.0% (42)');
    });

    it('leaves the plain value alone for the value type', () => {
      const { valueText } = getSeriesText(
        makeTooltipConfig(), makeSeriesConfig(), identity, makeSlice({ plain: 42 }) as never, false,
        pieValues({ valueType: 'value' })
      );
      expect(valueText).toBe('42');
    });

    it('lets an explicit tooltipProperty win over the pie percentages', () => {
      const { valueText } = getSeriesText(
        makeTooltipConfig(), makeSeriesConfig({ tooltipProperty: 't' }), identity,
        makeSlice({ plain: 42, tooltip: 99 }) as never, false, pieValues()
      );
      expect(valueText).toBe('99');
    });

    it('hides the row when the slice has no value, rather than showing a 0% share', () => {
      const { valueText } = getSeriesText(
        makeTooltipConfig({ showMissingValues: false }), makeSeriesConfig(), identity,
        makeSlice({}) as never, false, pieValues({ fraction: 0 })
      );
      expect(valueText).toBe(null);
    });

    it('masks a filtered slice\'s percentage, sized from its share of the full total', () => {
      const { valueText } = getSeriesText(
        makeTooltipConfig({ adjustForFiltering: true, filteredValueCharacter: '#' }),
        makeSeriesConfig(), identity,
        makeSlice({ plain: 42 }, { plain: null }, { y: 100 }) as never, // base "100" => 3 chars
        true,
        pieValues({ valueType: 'percentValue', fraction: 0, rawFraction: 0.2, filtered: true })
      );
      expect(valueText).toBe('##### (###)'); // raw "20.0%" => 5 chars
    });

    it('shows the percentage untouched when filtering adjustment is off', () => {
      const { valueText } = getSeriesText(
        makeTooltipConfig({ adjustForFiltering: false }), makeSeriesConfig(), identity,
        makeSlice({ plain: 42 }) as never, false,
        pieValues({ fraction: 0.2, filtered: true })
      );
      expect(valueText).toBe('20.0%');
    });
  });

  describe('filtering', () => {
    it('uses the filtered value when the series is not filtered', () => {
      const { valueText } = getSeriesText(
        makeTooltipConfig({ adjustForFiltering: true }),
        makeSeriesConfig(),
        identity,
        makeSlice({ plain: 42 }, { plain: 30 }, { y: 0 }) as never,
        true
      );
      expect(valueText).toBe('30');
    });

    it('substitutes filteredValueText for a filtered value', () => {
      const { valueText } = getSeriesText(
        makeTooltipConfig({ adjustForFiltering: true, filteredValueText: '***' }),
        makeSeriesConfig(),
        identity,
        makeSlice({ plain: 42 }, { plain: null }, { y: 99 }) as never, // filtered null => filtered
        true
      );
      expect(valueText).toBe('***');
    });

    it('repeats filteredValueCharacter to mask the base value length', () => {
      const { valueText } = getSeriesText(
        makeTooltipConfig({ adjustForFiltering: true, filteredValueCharacter: '#' }),
        makeSeriesConfig(),
        identity,
        makeSlice({ plain: 42 }, { plain: null }, { y: 100 }) as never, // base "100" => 3 chars
        true
      );
      expect(valueText).toBe('###');
    });
  });
});

describe('getFilteredValue', () => {
  const seriesConfig = makeSeriesConfig({ valueAxisConfig: { id: 'y' } as EnhancedSeriesConfig['valueAxisConfig'] });

  function makeChartData(over: Partial<{ base: number; categories: (unknown)[]; markerDomain: number[]; tooltipDomain: number[] }> = {}): ChartData {
    const base = over.base ?? 5;
    const categories = over.categories ?? ['a', 'b', undefined];
    return {
      seriesData: {
        axisBases: { y: base },
        raw: { domains: { s1: { marker: over.markerDomain ?? [3, 9], tooltip: over.tooltipDomain ?? [2, 8] } } }
      },
      categoryData: { values: { key: categories } }
    } as unknown as ChartData;
  }

  it('returns the original object unchanged when the plain value is not null', () => {
    const valueObject = { plain: [1, 2, 3] } as unknown as SeriesValueObject;
    expect(getFilteredValue(makeChartData(), seriesConfig, valueObject)).toBe(valueObject);
  });

  it('fills plain values from the axis base, keeping category holes missing', () => {
    const valueObject = { plain: null } as unknown as SeriesValueObject;
    const out = getFilteredValue(makeChartData({ base: 5 }), seriesConfig, valueObject);
    expect(out.plain).toEqual([5, 5, MISSING_VALUE]);
  });

  it('mirrors plain into range when a range property is configured', () => {
    const valueObject = { plain: null, range: null } as unknown as SeriesValueObject;
    const out = getFilteredValue(makeChartData({ base: 5 }), makeSeriesConfig({ rangeProperty: 'hi' }), valueObject);
    expect(out.range).toEqual(out.plain);
  });

  it('fills marker values from the marker domain minimum', () => {
    const valueObject = { plain: null, marker: null } as unknown as SeriesValueObject;
    const out = getFilteredValue(
      makeChartData({ base: 5, markerDomain: [3, 9] }),
      makeSeriesConfig({ markerProperty: 'm' }),
      valueObject
    );
    expect(out.marker).toEqual([3, 3, MISSING_VALUE]);
  });

  it('fills tooltip values from the tooltip domain minimum', () => {
    const valueObject = { plain: null, tooltip: null } as unknown as SeriesValueObject;
    const out = getFilteredValue(
      makeChartData({ base: 5, tooltipDomain: [2, 8] }),
      makeSeriesConfig({ tooltipProperty: 't' }),
      valueObject
    );
    expect(out.tooltip).toEqual([2, 2, MISSING_VALUE]);
  });
});
