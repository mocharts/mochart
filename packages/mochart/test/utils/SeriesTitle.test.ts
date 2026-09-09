import { describe, it, expect } from 'vitest';
import { getSeriesTitle, getSeriesLabel, labelSuffix, noLabel } from '../../src/utils/SeriesTitle';
import type { EnhancedSeriesConfig } from '../../src/types/enhanced';


// Only a handful of fields are read; cast a partial to keep fixtures small.
const series = (over: Partial<EnhancedSeriesConfig>): EnhancedSeriesConfig => over as EnhancedSeriesConfig;

describe('getSeriesTitle', () => {
  it('uses the explicit title when set', () => {
    expect(getSeriesTitle(series({ id: 's1', title: 'Sales' }))).toBe('Sales');
  });

  it('falls back to "Series <id>" when the title is none (null)', () => {
    expect(getSeriesTitle(series({ id: 's1', title: null }))).toBe('Series s1');
  });
});

describe('getSeriesLabel', () => {
  it('uses valueLabel with the default suffix when set', () => {
    const s = series({ id: 's1', valueLabel: 'Rev', useTitleForValueLabel: false, title: null });
    expect(getSeriesLabel(s)).toBe('Rev' + labelSuffix);
  });

  it('uses a custom suffix when provided', () => {
    const s = series({ id: 's1', valueLabel: 'Rev', useTitleForValueLabel: false, title: null });
    expect(getSeriesLabel(s, ' = ')).toBe('Rev = ');
  });

  it('falls back to the title when useTitleForValueLabel is set and no valueLabel', () => {
    const s = series({ id: 's1', valueLabel: null, useTitleForValueLabel: true, title: 'Sales' });
    expect(getSeriesLabel(s)).toBe('Sales' + labelSuffix);
  });

  it('returns the empty label (no suffix) when nothing applies', () => {
    const s = series({ id: 's1', valueLabel: null, useTitleForValueLabel: false, title: 'Sales' });
    expect(getSeriesLabel(s)).toBe(noLabel);
  });
});
