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

  it('accepts every css font-size form as a string', () => {
    for (const size of ['0.85em', '1.25rem', '120%', '14px', '11pt', '2vw', 'large', 'smaller', 'calc(1em + 2px)', 'var(--chart-size)']) {
      expect(errorsFor(withFont({ chart: { font: { size } } })), size).toEqual([]);
    }
  });

  it('rejects a string that is not a css font-size', () => {
    for (const size of ['0em', '-1rem', '12', 'big', 'px', '']) {
      expect(errorsFor(withFont({ chart: { font: { size } } })), size)
        .toContainEqual(expect.stringContaining('chart - font.size - should be a number of pixels greater than 0, or a css font-size string'));
    }
  });

  it('rejects a font size that is not above 0', () => {
    expect(errorsFor(withFont({ chart: { font: { size: 0 } } })))
      .toContainEqual(expect.stringContaining('chart - font.size - should be a number of pixels greater than 0'));
    expect(errorsFor(withFont({ legend: { item: { font: { size: -12 } } } })))
      .toContainEqual(expect.stringContaining('legend - item.font.size - should be a number of pixels greater than 0'));
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
    expect(errorsFor(withFont({ valueAxes: [{ id: 'A', thresholds: [{ value: 1 }, { value: 2, title: { text: 'T', font: { style: 'upright' } } }] }] })))
      .toContainEqual(expect.stringContaining('valueAxes[0] - thresholds[1].title.font.style - should be one of'));
  });
});
