import { describe, it, expect } from 'vitest';
import { isObject, getValueOrDefault } from '../../src/config/defaults/utils';
import { conditionalDefault, getActualDefaults, defaultRule } from '../../src/config/defaults/conditionalDefault';
import { deepMerge } from '../../src/config/core/deepMerge';
import { getDefaults } from '../../src/config/defaults/mochartConfig';

describe('isObject', () => {
  it('is true for plain objects and arrays', () => {
    expect(isObject({})).toBe(true);
    expect(isObject([])).toBe(true);
  });

  it('is false for null, undefined and primitives', () => {
    expect(isObject(null)).toBe(false);
    expect(isObject(undefined)).toBe(false);
    expect(isObject(5)).toBe(false);
    expect(isObject('x')).toBe(false);
  });
});

describe('getValueOrDefault', () => {
  const defaults = { a: 1, b: 2 };

  it('returns the configured value when present', () => {
    expect(getValueOrDefault({ a: 9 }, defaults, 'a')).toBe(9);
  });

  it('falls back to the default when the key is undefined', () => {
    expect(getValueOrDefault({ a: 9 }, defaults, 'b')).toBe(2);
  });

  it('falls back to the default when the config is null or undefined', () => {
    expect(getValueOrDefault(null, defaults, 'a')).toBe(1);
    expect(getValueOrDefault(undefined, defaults, 'a')).toBe(1);
  });

  it('treats an explicit undefined value as absent but keeps other falsy values', () => {
    expect(getValueOrDefault({ a: undefined }, defaults, 'a')).toBe(1);
    expect(getValueOrDefault({ a: 0 }, { a: 1 }, 'a')).toBe(0);
  });
});

describe('conditionalDefault', () => {
  it('returns the default of the first matching rule', () => {
    const fn = conditionalDefault(
      [
        { condition: (c: { big: boolean }) => c.big, suffix: null, default: 'large' },
        { ...defaultRule, default: 'small' }
      ],
      { big: true },
      undefined
    );
    expect(fn()).toBe('large');
  });

  it('falls through to the always-true default rule', () => {
    const fn = conditionalDefault(
      [
        { condition: (c: { big: boolean }) => c.big, suffix: null, default: 'large' },
        { ...defaultRule, default: 'small' }
      ],
      { big: false },
      undefined
    );
    expect(fn()).toBe('small');
  });

  it('exposes the rules on the returned function', () => {
    const rules = [{ ...defaultRule, default: 1 }];
    const fn = conditionalDefault(rules, {}, undefined);
    expect(fn.rules).toBe(rules);
  });

  it('passes the extra argument through to conditions', () => {
    const fn = conditionalDefault(
      [
        { condition: (_c: object, threshold: number) => threshold > 10, suffix: null, default: 'high' },
        { ...defaultRule, default: 'low' }
      ],
      {},
      20
    );
    expect(fn()).toBe('high');
  });
});

describe('getActualDefaults', () => {
  it('invokes each default thunk and collects the results', () => {
    const actual = getActualDefaults({
      a: () => 1,
      b: () => 'two'
    });
    expect(actual).toEqual({ a: 1, b: 'two' });
  });

  it('recurses into a nested map so a conditional default can target a nested path', () => {
    const actual = getActualDefaults({
      renderer: () => 'bar',
      shapeStyle: {
        normal: { fillOpacity: () => 0.8 },
        focused: { fillOpacity: () => 1 }
      }
    });
    expect(actual).toEqual({
      renderer: 'bar',
      shapeStyle: { normal: { fillOpacity: 0.8 }, focused: { fillOpacity: 1 } }
    });
  });

  it('evaluates conditional members inside a conditional group', () => {
    const group = (colored: boolean) => getActualDefaults({
      colorScale: conditionalDefault(
        [
          { condition: (c: { colored: boolean }) => c.colored, suffix: null, default: { min: () => '#0000ff', max: () => '#ff0000' } },
          { ...defaultRule, default: null }
        ],
        { colored },
        undefined
      )
    });
    expect(group(true)).toEqual({ colorScale: { min: '#0000ff', max: '#ff0000' } });
    expect(group(false)).toEqual({ colorScale: null });
  });

  it('leaves the members of a nested default the recursion does not name alone', () => {
    // the conditional map names one member and deepMerge keeps the siblings
    const regularDefaults = { shapeStyle: { normal: { strokeColor: '#000000', fillOpacity: 0.5 } } };
    const conditionalDefaults = getActualDefaults({
      shapeStyle: { normal: { fillOpacity: () => 0.9 } }
    });
    expect(deepMerge(regularDefaults, conditionalDefaults))
      .toEqual({ shapeStyle: { normal: { strokeColor: '#000000', fillOpacity: 0.9 } } });
  });
});

describe('tooltip defaults', () => {
  it('matches icon size to the font by default', () => {
    const automatic = getDefaults({
      version: '1.0.0',
      categoryAxis: { property: 'p' }
    }) as { tooltip: { icon: { size: string | number } } };

    expect(automatic.tooltip.icon.size).toBe('auto');
  });
});

describe('legend defaults', () => {
  it('matches icon size to the measured text height by default', () => {
    const defaults = getDefaults({
      version: '1.0.0',
      categoryAxis: { property: 'p' }
    }) as { legend: { icon: { size: string | number } } };

    expect(defaults.legend.icon.size).toBe('auto');
  });
});

describe('color palette defaults', () => {
  it('uses the Tol Bright palette for every element and focus state', () => {
    const defaults = getDefaults({
      version: '1.0.0',
      categoryAxis: { property: 'p' }
    }) as { colorPalette: Record<string, Record<string, { strokeColors: string[]; fillColors: string[] }>> };
    const tolBright = ['#4477aa', '#ee6677', '#228833', '#ccbb44', '#66ccee', '#aa3377', '#bbbbbb'];

    for (const palettes of Object.values(defaults.colorPalette)) {
      for (const palette of Object.values(palettes)) {
        expect(palette.strokeColors).toEqual(tolBright);
        expect(palette.fillColors).toEqual(tolBright);
      }
    }
  });

  // getDefaults is public: a consumer mutating one list must not change another state's list or a later call's defaults
  it('hands out a fresh color list per state and per call', () => {
    const config = { version: '1.0.0', categoryAxis: { property: 'p' } };
    const first = getDefaults(config) as { colorPalette: Record<string, Record<string, { strokeColors: string[]; fillColors: string[] }>> };
    const lists = Object.values(first.colorPalette).flatMap(palettes => Object.values(palettes).flatMap(palette => [palette.strokeColors, palette.fillColors]));
    expect(new Set(lists).size).toBe(lists.length);
    first.colorPalette.shape.normal.strokeColors.push('#000000');
    const second = getDefaults(config) as typeof first;
    expect(second.colorPalette.shape.normal.strokeColors).toHaveLength(7);
  });
});

describe('series color-icon defaults', () => {
  function showColorFlags(shapeStyle?: Record<string, unknown>) {
    const defaults = getDefaults({
      version: '1.0.0',
      categoryAxis: { property: 'p' },
      series: [{ property: 'a', ...(shapeStyle ? { shapeStyle } : {}) }]
    }) as { series: { showColorInLegend: boolean; showColorInTooltip: boolean }[] };
    const { showColorInLegend, showColorInTooltip } = defaults.series[0]!;
    return { showColorInLegend, showColorInTooltip };
  }

  it('shows the color icon for a series with a color of its own', () => {
    expect(showColorFlags()).toEqual({ showColorInLegend: true, showColorInTooltip: true });
  });

  it('hides the color icon for a series colored by category index', () => {
    // every category styles it differently, so a single swatch would be arbitrary
    expect(showColorFlags({ normal: { strokeColor: 'categoryIndex', fillColor: 'categoryIndex' } }))
      .toEqual({ showColorInLegend: false, showColorInTooltip: false });
    // either member is enough
    expect(showColorFlags({ normal: { fillColor: 'categoryIndex' } }))
      .toEqual({ showColorInLegend: false, showColorInTooltip: false });
    expect(showColorFlags({ normal: { strokeColor: 'categoryIndex' } }))
      .toEqual({ showColorInLegend: false, showColorInTooltip: false });
  });

  it('keeps the icon when only a focus state names the category index', () => {
    expect(showColorFlags({ focused: { fillColor: 'categoryIndex' } }))
      .toEqual({ showColorInLegend: true, showColorInTooltip: true });
  });
});

describe('pie-mode conditional defaults', () => {
  it('hides the axes and unsnaps the tooltip when chartConfig.type is pie', () => {
    const defaults = getDefaults({ version: '1.0.0', chart: { type: 'pie' }, categoryAxis: { property: 'p' } }) as {
      categoryAxis: { visible: boolean };
      valueAxes: { visible: boolean }[];
      tooltip: { snapToCategory: boolean; showCategory: boolean };
      pie: { innerRadiusFraction: number; label: { type: string } };
    };
    expect(defaults.categoryAxis.visible).toBe(false);
    expect(defaults.valueAxes[0]!.visible).toBe(false);
    expect(defaults.tooltip.snapToCategory).toBe(false);
    expect(defaults.tooltip.showCategory).toBe(false);
    expect(defaults.pie).toEqual(expect.objectContaining({ innerRadiusFraction: 0, label: expect.objectContaining({ type: 'percent' }) }));
  });

  it('derives pieConfig.endAngle from startAngle so rotation never truncates the pie', () => {
    const rotated = getDefaults({ version: '1.0.0', chart: { type: 'pie' }, pie: { startAngle: -90 }, categoryAxis: { property: 'p' } }) as {
      pie: { endAngle: number };
    };
    expect(rotated.pie.endAngle).toBe(270);
    const plain = getDefaults({ version: '1.0.0', chart: { type: 'pie' }, categoryAxis: { property: 'p' } }) as {
      pie: { endAngle: number };
    };
    expect(plain.pie.endAngle).toBe(360);
  });

  it('keeps the xy defaults when chartConfig.type is omitted', () => {
    const defaults = getDefaults({ version: '1.0.0', categoryAxis: { property: 'p' } }) as {
      categoryAxis: { visible: boolean };
      valueAxes: { visible: boolean }[];
      tooltip: { snapToCategory: boolean; showCategory: boolean };
    };
    expect(defaults.categoryAxis.visible).toBe(true);
    expect(defaults.valueAxes[0]!.visible).toBe(true);
    expect(defaults.tooltip.snapToCategory).toBe(true);
    expect(defaults.tooltip.showCategory).toBe(true);
  });
});

// Regression: the seriesStackConfigs stack-axis map iterated the raw section
// unfiltered, so junk that validation is supposed to report (a number, a null
// entry) threw inside getDefaults before validation could run.
describe('getDefaults with malformed seriesStackConfigs', () => {
  it('does not throw on junk section shapes', () => {
    expect(() => getDefaults({ seriesStacks: 5 })).not.toThrow();
    expect(() => getDefaults({ seriesStacks: [null] })).not.toThrow();
    expect(() => getDefaults({ seriesStacks: 'junk' })).not.toThrow();
    expect(() => getDefaults({ seriesStacks: { ignore: true } })).not.toThrow();
  });

  it('still marks the stacked axis for a valid stack section', () => {
    const defaults = getDefaults({
      seriesStacks: [{ id: 's' }],
      series: [{ property: 'v', stack: 's' }]
    }) as { valueAxes: { base: unknown }[] };
    expect(defaults.valueAxes[0].base).toBe(0);
  });

  // Regression: a stack whose axis came from seriesStackDefaults read as axis-less and marked the
  // first value axis stacked, so the actually stacked axis got the no-stack base default
  it('marks the axis named by seriesStackDefaults as the stacked one', () => {
    const defaults = getDefaults({
      valueAxes: [{ id: 'A' }, { id: 'B' }],
      seriesStackDefaults: { axis: 'B' },
      seriesStacks: [{ id: 's' }],
      series: [{ property: 'v', axis: 'B', stack: 's' }]
    }) as { valueAxes: { base: unknown }[] };
    expect(defaults.valueAxes.map(axis => axis.base)).toEqual([null, 0]);
  });
});
