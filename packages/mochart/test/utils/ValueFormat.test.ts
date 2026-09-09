import { describe, it, expect } from 'vitest';
import { scaleLinear } from 'd3-scale';
import {
  getCategoryFormat,
  getSeriesFormat,
  getSeriesFormats,
  getSeriesLabelFormat
} from '../../src/utils/ValueFormat';
import type { CategoryAxisConfig } from '../../src/types/config';
import type { EnhancedSeriesConfig, EnhancedValueAxisConfig } from '../../src/types/enhanced';

// These formatters read only a few fields; cast small partials to keep the
// fixtures focused on the branch under test.
const categoryAxis = (over: Record<string, unknown>): CategoryAxisConfig => over as unknown as CategoryAxisConfig;
const valueAxis = (over: Record<string, unknown>): EnhancedValueAxisConfig => over as unknown as EnhancedValueAxisConfig;
// the affix fields are read unconditionally (an enhanced config always carries them),
// so they default to null here rather than each fixture having to remember them
const series = (over: Record<string, unknown>): EnhancedSeriesConfig =>
  ({ valuePrefix: null, valueSuffix: null, ...over, label: { prefix: null, suffix: null, ...(over['label'] as object) } }) as unknown as EnhancedSeriesConfig;

describe('getCategoryFormat', () => {
  it('is an identity for string categories with no formatting', () => {
    const fmt = getCategoryFormat(categoryAxis({
      type: 'string', valueFormat: null, valuePrefix: null, valueSuffix: null
    }));
    expect(fmt('Jan')).toBe('Jan');
  });

  it('stringifies dates as a UTC string when dateUTC is set', () => {
    const fmt = getCategoryFormat(categoryAxis({
      type: 'date', dateUTC: true, valueFormat: null, valuePrefix: null, valueSuffix: null
    }));
    const d = new Date(Date.UTC(2020, 0, 1));
    expect(fmt(d)).toBe(d.toUTCString());
  });

  it('stringifies dates with toString when dateUTC is false', () => {
    const fmt = getCategoryFormat(categoryAxis({
      type: 'date', dateUTC: false, valueFormat: null, valuePrefix: null, valueSuffix: null
    }));
    const d = new Date(2020, 0, 1);
    expect(fmt(d)).toBe(d.toString());
  });

  it('uses auto tickLabelFormat for dates when valueFormat is auto', () => {
    const fmt = getCategoryFormat(categoryAxis({
      type: 'date', dateUTC: true, valueFormat: 'auto', tickLabel: { format: 'auto' },
      valuePrefix: null, valueSuffix: null
    }));
    // %c produces a full locale date/time string; just assert it is non-empty text
    expect(typeof fmt(new Date(Date.UTC(2021, 5, 15)))).toBe('string');
    expect((fmt(new Date(Date.UTC(2021, 5, 15))) as string).length).toBeGreaterThan(0);
  });

  it('uses an explicit tickLabelFormat for dates when valueFormat is auto', () => {
    const fmt = getCategoryFormat(categoryAxis({
      type: 'date', dateUTC: true, valueFormat: 'auto', tickLabel: { format: '%Y' },
      valuePrefix: null, valueSuffix: null
    }));
    expect(fmt(new Date(Date.UTC(2021, 5, 15)))).toBe('2021');
  });

  it('applies an explicit d3 number format', () => {
    const fmt = getCategoryFormat(categoryAxis({
      type: 'number', dateUTC: false, valueFormat: '.1f', valuePrefix: null, valueSuffix: null
    }));
    expect(fmt(3.14159)).toBe('3.1');
  });

  it('applies an explicit date format via timeFormat', () => {
    const fmt = getCategoryFormat(categoryAxis({
      type: 'date', dateUTC: true, valueFormat: '%Y', valuePrefix: null, valueSuffix: null
    }));
    expect(fmt(new Date(Date.UTC(2021, 5, 15)))).toBe('2021');
  });

  it('uses auto tickLabelFormat for numbers when valueFormat is auto', () => {
    const fmt = getCategoryFormat(categoryAxis({
      type: 'number', dateUTC: false, valueFormat: 'auto', tickLabel: { format: 'auto' },
      valuePrefix: null, valueSuffix: null
    }));
    // .2s SI-prefixed: 1500 -> "1.5k"
    expect(fmt(1500)).toBe('1.5k');
  });

  it('uses an explicit tickLabelFormat for numbers when valueFormat is auto', () => {
    const fmt = getCategoryFormat(categoryAxis({
      type: 'number', dateUTC: false, valueFormat: 'auto', tickLabel: { format: '.0f' },
      valuePrefix: null, valueSuffix: null
    }));
    expect(fmt(1234.9)).toBe('1235');
  });

  it('is an identity when valueFormat is auto and tickLabelFormat is none', () => {
    const fmt = getCategoryFormat(categoryAxis({
      type: 'number', dateUTC: false, valueFormat: 'auto', tickLabel: { format: null },
      valuePrefix: null, valueSuffix: null
    }));
    expect(fmt(1500)).toBe(1500);
  });

  it('applies prefix and suffix around the formatted value', () => {
    const fmt = getCategoryFormat(categoryAxis({
      type: 'number', dateUTC: false, valueFormat: '.0f', valuePrefix: '$', valueSuffix: ' USD'
    }));
    expect(fmt(5)).toBe('$5 USD');
  });

  it('applies a prefix only', () => {
    const fmt = getCategoryFormat(categoryAxis({
      type: 'number', dateUTC: false, valueFormat: '.0f', valuePrefix: '$', valueSuffix: null
    }));
    expect(fmt(5)).toBe('$5');
  });

  it('applies a suffix only', () => {
    const fmt = getCategoryFormat(categoryAxis({
      type: 'number', dateUTC: false, valueFormat: '.0f', valuePrefix: null, valueSuffix: '%'
    }));
    expect(fmt(5)).toBe('5%');
  });
});

describe('getSeriesFormat', () => {
  const scale = scaleLinear().domain([0, 100]);

  it('is an identity when valueFormat is none', () => {
    const fmt = getSeriesFormat(
      series({ valueFormat: null, valuePrefix: null, valueSuffix: null }),
      valueAxis({ tickLabel: { format: 'auto' } }),
      scale
    );
    expect(fmt(42)).toBe(42);
  });

  it('applies an explicit d3 format', () => {
    const fmt = getSeriesFormat(
      series({ valueFormat: '$.2f', valuePrefix: null, valueSuffix: null }),
      valueAxis({ tickLabel: { format: 'auto' } }),
      scale
    );
    expect(fmt(9.5)).toBe('$9.50');
  });

  it('derives an auto format from the axis scale', () => {
    const fmt = getSeriesFormat(
      series({ valueFormat: 'auto', valuePrefix: null, valueSuffix: null }),
      valueAxis({ tickLabel: { format: 'auto' } }),
      scale
    );
    // auto uses the scale's tickFormat; just assert it produces a string
    expect(typeof fmt(50)).toBe('string');
  });

  it('uses an explicit axis tickLabelFormat when valueFormat is auto', () => {
    const fmt = getSeriesFormat(
      series({ valueFormat: 'auto', valuePrefix: null, valueSuffix: null }),
      valueAxis({ tickLabel: { format: '.0f' } }),
      scale
    );
    expect(fmt(12.7)).toBe('13');
  });

  it('is an identity when valueFormat is auto and the axis tickLabelFormat is none', () => {
    const fmt = getSeriesFormat(
      series({ valueFormat: 'auto', valuePrefix: null, valueSuffix: null }),
      valueAxis({ tickLabel: { format: null } }),
      scale
    );
    expect(fmt(42)).toBe(42);
  });

  it('applies prefix and suffix', () => {
    const fmt = getSeriesFormat(
      series({ valueFormat: '.0f', valuePrefix: '<', valueSuffix: '>' }),
      valueAxis({ tickLabel: { format: 'auto' } }),
      scale
    );
    expect(fmt(7)).toBe('<7>');
  });
});

describe('getSeriesFormats', () => {
  it('builds a formatter per series keyed by series id', () => {
    const configs = [
      series({ id: 's1', valueFormat: '.0f', valuePrefix: null, valueSuffix: null,
        valueAxisConfig: valueAxis({ id: 'y' }) }),
      series({ id: 's2', valueFormat: null, valuePrefix: null, valueSuffix: null,
        valueAxisConfig: valueAxis({ id: 'y' }) })
    ];
    const axisConfigs = [valueAxis({ id: 'y', tickLabel: { format: 'auto' } })];
    const formats = getSeriesFormats(configs, axisConfigs, { y: [0, 100] });
    expect(Object.keys(formats)).toEqual(['s1', 's2']);
    expect(formats.s1(12.7)).toBe('13');
    expect(formats.s2(12.7)).toBe(12.7);
  });
});

describe('getSeriesLabelFormat', () => {
  const scale = scaleLinear().domain([0, 100]);

  it('is an identity when labelFormat is none', () => {
    const fmt = getSeriesLabelFormat(series({ label: { format: null } }), valueAxis({}), scale);
    expect(fmt(3)).toBe(3);
  });

  it('applies an explicit label format', () => {
    const fmt = getSeriesLabelFormat(series({ label: { format: '.1f' } }), valueAxis({}), scale);
    expect(fmt(3.14)).toBe('3.1');
  });

  it('reuses the series numeric format when labelFormat is auto', () => {
    const fmt = getSeriesLabelFormat(
      series({ label: { format: 'auto' }, valueFormat: '.0f', valuePrefix: null, valueSuffix: null }),
      valueAxis({ tickLabel: { format: 'auto' } }),
      scale
    );
    expect(fmt(8.6)).toBe('9');
  });

  // Regression: auto reused the series value format wholesale, dragging the prefix/suffix along —
  // labels render labelProperty, potentially a different quantity than those affixes describe.
  it('leaves the tooltip prefix and suffix off labels in auto mode', () => {
    const fmt = getSeriesLabelFormat(
      series({ label: { format: 'auto' }, valueFormat: '.0f', valuePrefix: '$', valueSuffix: ' USD' }),
      valueAxis({ tickLabel: { format: 'auto' } }),
      scale
    );
    expect(fmt(8.6)).toBe('9');
  });

  it('leaves them off with an explicit labelFormat too', () => {
    const fmt = getSeriesLabelFormat(
      series({ label: { format: '.1f' }, valuePrefix: '$', valueSuffix: ' USD' }),
      valueAxis({ tickLabel: { format: 'auto' } }),
      scale
    );
    expect(fmt(3.14)).toBe('3.1');
  });

  it('still leaves them off when labelFormat is none', () => {
    const fmt = getSeriesLabelFormat(
      series({ label: { format: null }, valuePrefix: '$', valueSuffix: ' USD' }),
      valueAxis({ tickLabel: { format: 'auto' } }),
      scale
    );
    expect(fmt(3)).toBe(3);
  });
});

describe('getSeriesLabelFormat prefix and suffix', () => {
  const scale = scaleLinear().domain([0, 100]);
  // labelPrefix/labelSuffix are independent of labelFormat, matching how
  // valuePrefix/valueSuffix are independent of valueFormat.
  it('applies them with an explicit labelFormat', () => {
    const fmt = getSeriesLabelFormat(
      series({ label: { format: '.1f', prefix: '~', suffix: ' kg' } }),
      valueAxis({ tickLabel: { format: 'auto' } }), scale);
    expect(fmt(3.14)).toBe('~3.1 kg');
  });

  it('applies them in auto mode', () => {
    const fmt = getSeriesLabelFormat(
      series({ label: { format: 'auto', prefix: '~', suffix: ' kg' }, valueFormat: '.0f' }),
      valueAxis({ tickLabel: { format: 'auto' } }), scale);
    expect(fmt(8.6)).toBe('~9 kg');
  });

  it('applies them with no labelFormat at all', () => {
    const fmt = getSeriesLabelFormat(
      series({ label: { format: null, prefix: '~', suffix: ' kg' } }),
      valueAxis({ tickLabel: { format: 'auto' } }), scale);
    expect(fmt(42)).toBe('~42 kg');
  });

  it('applies either one alone', () => {
    const prefixOnly = getSeriesLabelFormat(
      series({ label: { format: '.1f', prefix: '~', suffix: null } }),
      valueAxis({ tickLabel: { format: 'auto' } }), scale);
    expect(prefixOnly(3.14)).toBe('~3.1');

    const suffixOnly = getSeriesLabelFormat(
      series({ label: { format: '.1f', prefix: null, suffix: ' kg' } }),
      valueAxis({ tickLabel: { format: 'auto' } }), scale);
    expect(suffixOnly(3.14)).toBe('3.1 kg');
  });

  it('keeps the label pair off the tooltip value format', () => {
    const fmt = getSeriesFormat(
      series({ valueFormat: '.0f', valuePrefix: '$', valueSuffix: null, label: { prefix: '~', suffix: ' kg' } }),
      valueAxis({ tickLabel: { format: 'auto' } }), scale);
    expect(fmt(7)).toBe('$7');
  });
});
