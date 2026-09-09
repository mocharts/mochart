/**
 * Unit tests for the createDefaultChart input adapter (previously exercised
 * through the DefaultChart component; now a plain class, no DOM required).
 */
import { describe, it, expect } from 'vitest';
import { DefaultChartInput } from '../../src/chart/DefaultChartInput';
import { isDataProviderValid } from '../../src/data/ChartData';
import type { DefaultChartProps } from '../../src/types/chart';
import type { MochartInputConfig } from '../../src/types/config';

const VERSION = '1.0.0';

/** config whose single series reads numeric values — valid against `rows` */
function salesConfig(): MochartInputConfig {
  return {
    version: VERSION,
    categoryAxis: { property: 'month', type: 'string', scale: 'ordinal' },
    series: [{ property: 'sales' }]
  } as unknown as MochartInputConfig;
}

/** config whose single series reads string values — invalid against `rows` */
function labelConfig(): MochartInputConfig {
  return {
    version: VERSION,
    categoryAxis: { property: 'month', type: 'string', scale: 'ordinal' },
    series: [{ property: 'label' }]
  } as unknown as MochartInputConfig;
}

const rows = [
  { month: 'Jan', sales: 10, label: 'ten' },
  { month: 'Feb', sales: 20, label: 'twenty' },
  { month: 'Mar', sales: 30, label: 'thirty' }
];

function props(config: MochartInputConfig, data: unknown): DefaultChartProps {
  return { config, data, width: 800, height: 600 } as DefaultChartProps;
}

function startInput(config: MochartInputConfig, data: unknown): { input: DefaultChartInput; props: DefaultChartProps } {
  const input = new DefaultChartInput();
  const initial = props(config, data);
  input.start(initial);
  return { input, props: initial };
}

describe('DefaultChartInput in-place data mutation', () => {
  it('does not detect an in-place mutation through update (identity contract)', () => {
    const data = rows.map(row => ({ ...row }));
    const { input, props: initial } = startInput(salesConfig(), data);
    const provider = input.dataProvider;

    data.push({ month: 'Apr', sales: 40, label: 'forty' });
    input.update(initial, initial);

    // the stateless provider reads live; the identity staying put is what keeps the chart from re-reading
    expect(input.dataProvider).toBe(provider);
  });

  it('refresh rebuilds the provider over the mutated array', () => {
    const data = rows.map(row => ({ ...row }));
    const { input, props: initial } = startInput(salesConfig(), data);
    const provider = input.dataProvider;

    data.push({ month: 'Apr', sales: 40, label: 'forty' });
    input.refresh(initial);

    expect(input.dataProvider).not.toBe(provider);
    expect(input.dataProvider!.getPropertyValues('month')).toEqual(['Jan', 'Feb', 'Mar', 'Apr']);
  });
});

describe('DefaultChartInput data validation', () => {
  it('exposes a valid provider for matching config and data', () => {
    const { input } = startInput(salesConfig(), rows);
    expect(isDataProviderValid(input.dataProvider)).toBe(true);
    expect(input.dataProvider!.getPropertyValues('month')).toEqual(['Jan', 'Feb', 'Mar']);
  });

  it('exposes an error provider when the data does not satisfy the config', () => {
    const { input } = startInput(labelConfig(), rows);
    expect(isDataProviderValid(input.dataProvider)).toBe(false);
  });

  it('re-validates when only the config changes and invalidates the data', () => {
    const { input, props: prev } = startInput(salesConfig(), rows);
    expect(isDataProviderValid(input.dataProvider)).toBe(true);

    input.update(prev, props(labelConfig(), rows));
    expect(isDataProviderValid(input.dataProvider)).toBe(false);
  });

  it('re-validates when only the config changes and restores validity, reusing the provider', () => {
    const { input, props: first } = startInput(salesConfig(), rows);
    const validProvider = input.dataProvider;

    const second = props(labelConfig(), rows);
    input.update(first, second);
    expect(isDataProviderValid(input.dataProvider)).toBe(false);

    input.update(second, props(salesConfig(), rows));
    expect(input.dataProvider).toBe(validProvider);
  });

  it('keeps a stable error provider identity while the data stays invalid', () => {
    const { input, props: prev } = startInput(labelConfig(), rows);
    const errorProvider = input.dataProvider;

    input.update(prev, props(labelConfig(), rows));
    expect(input.dataProvider).toBe(errorProvider);
  });

  it('rebuilds the provider when the data changes', () => {
    const { input, props: prev } = startInput(salesConfig(), rows);
    const firstProvider = input.dataProvider;

    const nextRows = [...rows, { month: 'Apr', sales: 40, label: 'forty' }];
    input.update(prev, props(salesConfig(), nextRows));
    expect(input.dataProvider).not.toBe(firstProvider);
    expect(input.dataProvider!.getPropertyValues('month')).toEqual(['Jan', 'Feb', 'Mar', 'Apr']);
  });

  it('exposes an error provider for data that is not an array of objects', () => {
    const { input } = startInput(salesConfig(), [1, 2, 3]);
    expect(isDataProviderValid(input.dataProvider)).toBe(false);
  });
});

describe('DefaultChartInput object-of-arrays data', () => {
  const arrays = {
    month: ['Jan', 'Feb', 'Mar'],
    sales: [10, 20, 30],
    label: ['ten', 'twenty', 'thirty']
  };

  it('wraps an object of arrays in a valid provider', () => {
    const { input } = startInput(salesConfig(), arrays);
    expect(isDataProviderValid(input.dataProvider)).toBe(true);
    expect(input.dataProvider!.getPropertyValues('month')).toEqual(['Jan', 'Feb', 'Mar']);
    expect(input.dataProvider!.getPropertyValues('sales')).toEqual([10, 20, 30]);
  });

  it('exposes an error provider when a property holds a non-array value', () => {
    const { input } = startInput(salesConfig(), { ...arrays, sales: 10 });
    expect(isDataProviderValid(input.dataProvider)).toBe(false);
  });

  it('exposes an error provider when the arrays do not satisfy the config', () => {
    const { input } = startInput(salesConfig(), { month: arrays.month, sales: [10, 20] });
    expect(isDataProviderValid(input.dataProvider)).toBe(false);
  });

  it('rebuilds the provider when the data changes shape between updates', () => {
    const { input, props: prev } = startInput(salesConfig(), rows);
    const firstProvider = input.dataProvider;

    input.update(prev, props(salesConfig(), arrays));
    expect(input.dataProvider).not.toBe(firstProvider);
    expect(isDataProviderValid(input.dataProvider)).toBe(true);
    expect(input.dataProvider!.getPropertyValues('sales')).toEqual([10, 20, 30]);
  });

  it('refresh rebuilds the provider over mutated arrays', () => {
    const mutable = { month: [...arrays.month], sales: [...arrays.sales] };
    const { input, props: initial } = startInput(salesConfig(), mutable);
    const provider = input.dataProvider;

    mutable.month.push('Apr');
    mutable.sales.push(40);
    input.refresh(initial);

    expect(input.dataProvider).not.toBe(provider);
    expect(input.dataProvider!.getPropertyValues('month')).toEqual(['Jan', 'Feb', 'Mar', 'Apr']);
  });
});
