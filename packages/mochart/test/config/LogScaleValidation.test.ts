// scale: 'log' on the value axis and a number category axis: what it rejects, and the one error a stacked or pie axis gets.
import { describe, it, expect } from 'vitest';
import validateConfig, { validateConfigDetailed } from '../../src/config/validation/mochartConfig';
import { getDefaults } from '../../src/config/defaults/mochartConfig';
import { CONFIG_VERSION as V } from '../../src/config/core/constants';

function errorsFor(config: Record<string, unknown>): string[] {
  return validateConfig({ version: V, categoryAxis: { property: 'c' }, series: [{ property: 'v' }], ...config }).errors;
}

function valueAxisErrors(axis: Record<string, unknown>, extra: Record<string, unknown> = {}): string[] {
  return errorsFor({ valueAxes: [{ id: 'A', scale: 'log', ...axis }], ...extra });
}

const logNumberCategoryAxis = { property: 'c', type: 'number', scale: 'log' };

describe('value axis scale', () => {
  it('accepts log with the defaults', () => {
    expect(valueAxisErrors({})).toEqual([]);
  });

  it('accepts a base, bounds, explicit ticks and thresholds above 0', () => {
    expect(valueAxisErrors({ base: 1, min: 0.5, max: 1000, softMin: 1, softMax: 100, ticks: [{ value: 1 }, { value: 10 }],
      thresholds: [{ value: 5 }] })).toEqual([]);
  });

  it.each([
    ['base', 0, 'valueAxes[0] - base - should be a number greater than 0 or be equal to null when scale is log: 0'],
    ['min', 0, 'valueAxes[0] - min - should be a number greater than 0 or be equal to "auto" when scale is log: 0'],
    ['max', -1, 'valueAxes[0] - max - should be a number greater than 0 or be equal to "auto" when scale is log: -1'],
    ['softMin', 0, 'valueAxes[0] - softMin - should be a number greater than 0 or be equal to null when scale is log: 0'],
    ['softMax', -5, 'valueAxes[0] - softMax - should be a number greater than 0 or be equal to null when scale is log: -5'],
    ['minOffset', 1, 'valueAxes[0] - minOffset - should be equal to 0 when scale is log: 1'],
    ['maxOffset', -1, 'valueAxes[0] - maxOffset - should be equal to 0 when scale is log: -1'],
    ['minTickInterval', 10, 'valueAxes[0] - minTickInterval - should be equal to 0 when scale is log: 10']
  ])('rejects %s %s', (member, value, message) => {
    expect(valueAxisErrors({ [member]: value })).toContain(message);
  });

  it('rejects an explicit tick at or below 0', () => {
    expect(valueAxisErrors({ ticks: [{ value: 0 }] })).toContain('valueAxes[0] - ticks[0].value - should be a number greater than 0 when scale is log: 0');
  });

  it('rejects a tickStep or thresholdStep interval', () => {
    expect(valueAxisErrors({ tickStep: { interval: 10 } })).toContain('valueAxes[0] - tickStep.interval - should be equal to null when scale is log: 10');
    expect(valueAxisErrors({ thresholdStep: { interval: 10 } })).toContain('valueAxes[0] - thresholdStep.interval - should be equal to null when scale is log: 10');
  });

  it('says why a step count is rejected on a log axis', () => {
    expect(valueAxisErrors({ tickStep: { count: 2 } })).toContain('valueAxes[0] - tickStep.count - should be left at its default on a log axis, where interval must be null');
  });

  it('gives count and offset the log message beside a rejected interval, not the linear one', () => {
    const errors = valueAxisErrors({ tickStep: { interval: 10, count: 2, offset: 1 } });
    expect(errors).toContain('valueAxes[0] - tickStep.interval - should be equal to null when scale is log: 10');
    expect(errors).toContain('valueAxes[0] - tickStep.count - should be left at its default on a log axis, where interval must be null');
    expect(errors).toContain('valueAxes[0] - tickStep.offset - should be left at its default on a log axis, where interval must be null');
    expect(errors.some(error => error.includes('on a linear axis'))).toBe(false);
  });

  it('rejects minorSteps once, on either axis, without telling the user to set an interval', () => {
    const valueErrors = valueAxisErrors({ tickStep: { minorSteps: 5 } });
    expect(valueErrors).toEqual(['valueAxes[0] - tickStep.minorSteps - should be equal to null when scale is log: 5']);
    const categoryErrors = errorsFor({ categoryAxis: { ...logNumberCategoryAxis, tickStep: { minorSteps: 5 } } });
    expect(categoryErrors).toEqual(['categoryAxis - tickStep.minorSteps - should be equal to null when scale is log: 5']);
  });

  it('rejects a threshold line at or below 0', () => {
    expect(valueAxisErrors({ thresholds: [{ value: 0 }] })).toContain('valueAxes[0] - thresholds[0].value - should be a number greater than 0 when scale is log');
  });

  it('accepts a threshold range with one end at or below 0, and rejects one with none above 0', () => {
    expect(valueAxisErrors({ thresholds: [{ value: 0, rangeValue: 10 }, { value: 10, rangeValue: -5 }] })).toEqual([]);
    expect(valueAxisErrors({ thresholds: [{ value: -1, rangeValue: 0 }] })).toContain(
      'valueAxes[0] - thresholds[0].value - should be a number greater than 0 when scale is log and rangeValue is not greater than 0');
  });

  it('keeps the linear rules on a linear axis', () => {
    expect(errorsFor({ valueAxes: [{ id: 'A', base: 0, min: -5, minOffset: 2, tickStep: { interval: 10 }, thresholds: [{ value: -1 }] }] })).toEqual([]);
  });

  it('gives a stacked log axis the one scale error, not a second one for its base of 0', () => {
    const errors = valueAxisErrors({}, { seriesStacks: [{ id: 'S' }], series: [{ property: 'v', stack: 'S' }] });
    expect(errors).toEqual(['valueAxes[0] - scale - should be equal to "linear" when a series stack uses the axis: "log"']);
  });

  it('rejects log in pie mode, on the value axis and a number category axis', () => {
    const errors = errorsFor({ chart: { type: 'pie' }, categoryAxis: logNumberCategoryAxis, valueAxes: [{ id: 'A', scale: 'log' }] });
    expect(errors).toContain('valueAxes[0] - scale - should be equal to "linear" when chart type is not xy: "log"');
    expect(errors).toContain('categoryAxis - scale - should be one of [ "linear", "ordinal" ] when chart type is not xy: "log"');
    expect(errors.some(error => error.includes(' - base - '))).toBe(false);
  });
});

describe('category axis scale', () => {
  it('accepts log on a number axis', () => {
    expect(errorsFor({ categoryAxis: logNumberCategoryAxis })).toEqual([]);
  });

  it('rejects log on a date or string axis', () => {
    expect(errorsFor({ categoryAxis: { property: 'c', type: 'date', scale: 'log' } }))
      .toContain('categoryAxis - scale - should be one of [ "linear", "ordinal" ] when type is date: "log"');
    expect(errorsFor({ categoryAxis: { property: 'c', type: 'string', scale: 'log' } }))
      .toContain('categoryAxis - scale - should be equal to "ordinal" when type is string: "log"');
  });

  it.each([
    ['min', 0, 'categoryAxis - min - should be a number greater than 0 or be equal to "auto" when scale is log: 0'],
    ['max', -1, 'categoryAxis - max - should be a number greater than 0 or be equal to "auto" when scale is log: -1'],
    ['softMin', 0, 'categoryAxis - softMin - should be a number greater than 0 or be equal to null when scale is log: 0'],
    ['softMax', -1, 'categoryAxis - softMax - should be a number greater than 0 or be equal to null when scale is log: -1'],
    ['minOffset', 2, 'categoryAxis - minOffset - should be equal to 0 when scale is log: 2'],
    ['maxOffset', 1, 'categoryAxis - maxOffset - should be equal to 0 when scale is log: 1'],
    ['minTickInterval', 1, 'categoryAxis - minTickInterval - should be equal to 0 when scale is log: 1'],
    ['categoryValueInterval', 3, 'categoryAxis - categoryValueInterval - should be equal to "auto" when scale is log: 3']
  ])('rejects %s %s', (member, value, message) => {
    expect(errorsFor({ categoryAxis: { ...logNumberCategoryAxis, [member]: value } })).toContain(message);
  });

  it('rejects truncation, a step interval, minorSteps and includeFirst', () => {
    const errors = errorsFor({ categoryAxis: { ...logNumberCategoryAxis, tickLabel: { truncation: { enabled: true } },
      tickStep: { interval: 10, minorSteps: 2, includeFirst: true } } });
    expect(errors).toContain('categoryAxis - tickLabel.truncation.enabled - should be equal to false when scale is log: true');
    expect(errors).toContain('categoryAxis - tickStep.interval - should be equal to null when scale is log: 10');
    expect(errors).toContain('categoryAxis - tickStep.minorSteps - should be equal to null when scale is log: 2');
    expect(errors).toContain('categoryAxis - tickStep.includeFirst - should be equal to false when scale is log: true');
  });

  it('rejects an explicit tick, a threshold line and a thresholdStep interval at or below 0', () => {
    const errors = errorsFor({ categoryAxis: { ...logNumberCategoryAxis, ticks: [{ value: 0 }], thresholds: [{ value: -1 }], thresholdStep: { interval: 10 } } });
    expect(errors).toContain('categoryAxis - ticks[0].value - should be a number greater than 0 when scale is log: 0');
    expect(errors.some(error => error.startsWith('categoryAxis - thresholds[0].value - should be a number greater than 0 when scale is log'))).toBe(true);
    expect(errors).toContain('categoryAxis - thresholdStep.interval - should be equal to null when scale is log: 10');
  });

  it('rejects bar series on a log category axis', () => {
    expect(errorsFor({ categoryAxis: logNumberCategoryAxis, series: [{ property: 'v', renderer: 'bar' }] }))
      .toContain('series[0] - renderer - should not be "bar" when categoryAxis.scale is "log", since equal value distances take unequal widths there');
  });

  // the inherited bar was reported at series[0].renderer and series[1].renderer, paths the config does not have
  it('reports a bar renderer from seriesDefaults once, at seriesDefaults', () => {
    const { diagnostics } = validateConfigDetailed({ version: V, categoryAxis: logNumberCategoryAxis, seriesDefaults: { renderer: 'bar' },
      series: [{ property: 'v' }, { property: 'w' }, { property: 'x', renderer: 'line' }, { property: 'y', renderer: 'bar' }] });
    expect(diagnostics.filter(diagnostic => diagnostic.path[diagnostic.path.length - 1] === 'renderer').map(diagnostic => diagnostic.path))
      .toEqual([['series', 3, 'renderer'], ['seriesDefaults', 'renderer']]);
  });
});

describe('minor tick defaults', () => {
  it('shows minor tick marks and grid lines on a log axis, following the major setting, and keeps minor labels off', () => {
    const [valueAxis] = getDefaults({ categoryAxis: { property: 'c' }, valueAxes: [{ scale: 'log' }], series: [{ property: 'v' }] }).valueAxes as Record<string, Record<string, unknown>>[];
    expect(valueAxis!.minorTickMark!.visible).toBe('major');
    expect(valueAxis!.minorGridLine!.visible).toBe('major');
    expect(valueAxis!.minorTickLabel!.visible).toBe(false);
  });

  it('keeps minor labels off on a log axis when only minorTickLabel.format is set, since labels that do not fit would hide the marks', () => {
    const axes = (scale: string) => getDefaults({ categoryAxis: { property: 'c' }, valueAxes: [{ scale, minorTickLabel: { format: '~s' } }], series: [{ property: 'v' }] }).valueAxes as Record<string, Record<string, unknown>>[];
    expect(axes('log')[0]!.minorTickLabel!.visible).toBe(false);
    expect(axes('linear')[0]!.minorTickLabel!.visible).toBe('major');
    const listed = getDefaults({ categoryAxis: { property: 'c' }, valueAxes: [{ scale: 'log', ticks: [{ value: 1 }, { value: 5, minor: true }] }], series: [{ property: 'v' }] }).valueAxes as Record<string, Record<string, unknown>>[];
    expect(listed[0]!.minorTickLabel!.visible).toBe('major');
  });

  it('keeps them off on a linear axis with no minor ticks asked for', () => {
    const [valueAxis] = getDefaults({ categoryAxis: { property: 'c' }, valueAxes: [{}], series: [{ property: 'v' }] }).valueAxes as Record<string, Record<string, unknown>>[];
    expect(valueAxis!.minorTickMark!.visible).toBe(false);
    expect(valueAxis!.minorGridLine!.visible).toBe(false);
  });
});
