import { describe, it, expect } from 'vitest';
import validateConfig from '../../src/config/validation/mochartConfig';
import { getDefaults } from '../../src/config/defaults/mochartConfig';

const V = '1.0.0';

function errorsFor(config: unknown): string[] {
  const defaults = getDefaults(config as never);
  return validateConfig(config, defaults as never).errors;
}

function withFont(section: Record<string, unknown>): Record<string, unknown> {
  return { version: V, categoryAxis: { property: 'p' }, ...section };
}

describe('font validation', () => {
  it('accepts every member set, and every member null', () => {
    expect(errorsFor(withFont({ chart: { font: { family: 'Georgia', size: 14, weight: 700, style: 'italic' } } }))).toEqual([]);
    expect(errorsFor(withFont({ chart: { font: { family: null, size: null, weight: null, style: null } } }))).toEqual([]);
    expect(errorsFor(withFont({ title: { text: 'T', font: { weight: 'bolder' } }, tooltip: { font: { style: 'oblique' } } }))).toEqual([]);
  });

  it('rejects a font size that is not above 0', () => {
    expect(errorsFor(withFont({ chart: { font: { size: 0 } } })))
      .toContainEqual(expect.stringContaining('chart - font.size - should be a number greater than 0'));
    expect(errorsFor(withFont({ legend: { item: { font: { size: -12 } } } })))
      .toContainEqual(expect.stringContaining('legend - item.font.size - should be a number greater than 0'));
  });

  it('rejects a weight outside the hundreds and the keywords', () => {
    expect(errorsFor(withFont({ chart: { font: { weight: 450 } } })))
      .toContainEqual(expect.stringContaining('chart - font.weight - should be one of'));
    expect(errorsFor(withFont({ series: [{ property: 'a', label: { font: { weight: 'heavy' } } }] })))
      .toContainEqual(expect.stringContaining('series[0] - label.font.weight - should be one of'));
  });

  it('rejects an unknown style keyword', () => {
    expect(errorsFor(withFont({ chart: { font: { style: 'slanted' } } })))
      .toContainEqual(expect.stringContaining('chart - font.style - should be one of'));
    // a thresholds entry is reported as a whole, with the entry shape the font rule is part of
    const thresholdErrors = errorsFor(withFont({ valueAxes: [{ id: 'A', thresholds: [{ value: 1, title: { text: 'T', font: { style: 'upright' } } }] }] }));
    expect(thresholdErrors).toHaveLength(1);
    expect(thresholdErrors[0]).toContain('valueAxes[0] - thresholds - should be an array');
    expect(thresholdErrors[0]).toContain('style: should be one of [ "normal", "italic", "oblique" ] or be equal to null');
  });
});
