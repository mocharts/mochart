import { describe, it, expect } from 'vitest';
import buildMochartConfig, {
  getConfigWithDefaults,
  getConfigWithoutDefaults,
  sectionKeyAllMap,
  hasConfigStructureChange
} from '../../src/config/core/mochartConfig';
import { configWithAll, filterConfig, filterConfigs } from '../../src/config/core/configUtils';
import { getDefaults } from '../../src/config/defaults/mochartConfig';
import { makeConfig } from '../data/fixtures';
import { enhanceConfig } from '../../src/config/helper';
import validateConfig from '../../src/config/validation/mochartConfig';
import type { MochartConfig } from '../../src/types/config';

// defaults have to cover every section, so fill the rest in from the real ones
const defaultsWith = (sections: Record<string, unknown>) => ({ ...getDefaults({}), ...sections });

describe('sectionKeyAllMap', () => {
  it('maps list section keys to their "all" config key', () => {
    expect(sectionKeyAllMap.series).toBe('seriesDefaults');
    expect(sectionKeyAllMap.valueAxes).toBe('valueAxisDefaults');
  });
});

describe('filterConfig / filterConfigs', () => {
  it('keeps objects that are not ignored', () => {
    expect(filterConfig({ id: 'a' })).toBe(true);
    expect(filterConfig({ id: 'a', ignore: true })).toBe(false);
    expect(filterConfig(5)).toBe(false);
  });

  it('filters a list down to non-ignored objects', () => {
    expect(filterConfigs([{ id: 'a' }, { id: 'b', ignore: true }, 3])).toEqual([{ id: 'a' }]);
    expect(filterConfigs('not-an-array')).toEqual([]);
  });
});

// getConfigWithDefaults filters every array section on `ignore`, though it used to be typed, validated and documented on `series` alone
describe('ignore across every list section', () => {
  const sections = ['valueAxes', 'seriesGroups', 'seriesStacks', 'linearGradients', 'radialGradients'] as const;
  const withSection = (section: string, entries: Record<string, unknown>[]) => makeConfig({
    categoryAxis: { property: 'month', type: 'string', scale: 'ordinal' },
    series: [{ property: 'sales' }],
    [section]: entries
  }) as unknown as Record<string, unknown>;

  it('drops an ignored entry from every list section', () => {
    for (const section of sections) {
      const built = withSection(section, [{ id: 'keep' }, { id: 'drop', ignore: true }]);
      expect((built[section] as { id: string }[]).map(entry => entry.id), section).toEqual(['keep']);
    }
  });

  // a gradient entry needs more than an id to be valid, so this asserts on the ignore warning
  // specifically rather than on overall validity
  it('treats ignore as a known property on every list section', () => {
    for (const section of sections) {
      const built = withSection(section, [{ id: 'a', ignore: false }]);
      const { warnings } = built.validation as { warnings: string[] };
      expect(warnings.filter(warning => warning.includes('ignore')), section).toEqual([]);
      expect(warnings.filter(warning => warning.includes('invalid propert')), section).toEqual([]);
    }
  });
});

describe('getConfigWithDefaults', () => {
  it('returns an empty object for a non-object config', () => {
    expect(getConfigWithDefaults(null, {})).toEqual({});
    expect(getConfigWithDefaults(5, { a: { x: 1 } })).toEqual({});
  });

  it('fills in a missing object section from defaults', () => {
    const result = getConfigWithDefaults({}, defaultsWith({ title: { size: 10 } }));
    expect(result.title).toEqual({ size: 10 });
  });

  it('merges defaults under the provided object section', () => {
    const result = getConfigWithDefaults({ title: { size: 20 } }, defaultsWith({ title: { size: 10, color: 'red' } }));
    expect(result.title).toEqual({ size: 20, color: 'red' });
  });

  it('drops undefined values from the defaults before merging', () => {
    const result = getConfigWithDefaults({}, defaultsWith({ title: { size: 10, color: undefined } }));
    expect(result.title).toEqual({ size: 10 });
  });

  it('applies list defaults element-wise and merges the all-config', () => {
    const result = getConfigWithDefaults(
      { series: [{ property: 'a' }], seriesDefaults: { renderer: 'bar' } },
      defaultsWith({ series: [{ order: 0 }] })
    );
    // per-element defaults, then allSection, then the element's own values
    expect(result.series).toEqual([{ order: 0, renderer: 'bar', property: 'a' }]);
  });

  // valueAxes is the one list section with an implicit entry, so its *Defaults section has to reach the defaults list when the user declares nothing
  it('merges the all-config into the defaults list when the section is not declared', () => {
    const result = getConfigWithDefaults(
      { valueAxisDefaults: { visible: false, title: { text: 'T' } } },
      defaultsWith({ valueAxes: [{ id: 'VA0', visible: true, title: { text: null } }] })
    );
    expect(result.valueAxes).toEqual([{ id: 'VA0', visible: false, title: { text: 'T' } }]);
  });

  it('merges the all-config into the defaults list when every entry is ignored', () => {
    const result = getConfigWithDefaults(
      { valueAxes: [{ ignore: true }], valueAxisDefaults: { visible: false } },
      defaultsWith({ valueAxes: [{ id: 'VA0', visible: true }] })
    );
    expect(result.valueAxes).toEqual([{ id: 'VA0', visible: false }]);
  });

  it('leaves the defaults list alone when there is no all-config', () => {
    const result = getConfigWithDefaults({}, defaultsWith({ valueAxes: [{ id: 'VA0', visible: true }] }));
    expect(result.valueAxes).toEqual([{ id: 'VA0', visible: true }]);
  });
});

describe('getConfigWithoutDefaults', () => {
  it('returns an empty object for a non-object config', () => {
    expect(getConfigWithoutDefaults(null, {})).toEqual({});
    expect(getConfigWithoutDefaults(5, { a: { x: 1 } })).toEqual({});
  });

  it('strips values equal to the defaults and keeps the rest', () => {
    expect(getConfigWithoutDefaults({ title: { size: 10, text: 'T' } }, defaultsWith({ title: { size: 10 } })))
      .toEqual({ title: { text: 'T' } });
  });

  it('drops a section holding nothing but defaults', () => {
    expect(getConfigWithoutDefaults({ title: { size: 10 } }, defaultsWith({ title: { size: 10 } }))).toEqual({});
  });

  it('strips list values equal to the config\'s own all-config section', () => {
    expect(getConfigWithoutDefaults(
      { series: [{ renderer: 'bar', property: 'a' }], seriesDefaults: { renderer: 'bar' } },
      defaultsWith({ series: [{}] })
    )).toEqual({ series: [{ property: 'a' }], seriesDefaults: { renderer: 'bar' } });
  });

  // Regression: an entry value equal to the base default was stripped even when the all-config
  // overrode that default, so re-applying defaults resolved it to the all-config value
  it('keeps an entry value equal to the default when the all-config overrides that default', () => {
    const config = {
      categoryAxis: { property: 'month', type: 'string', scale: 'ordinal' },
      seriesDefaults: { renderer: 'bar' },
      series: [{ property: 'a' }, { property: 'b', renderer: 'line' }],
      valueAxisDefaults: { visible: false },
      valueAxes: [{ visible: true }]
    };
    const defaults = getDefaults(config);
    const minimal = getConfigWithoutDefaults(config, defaults);
    expect(minimal.series).toEqual([{ property: 'a' }, { property: 'b', renderer: 'line' }]);
    expect(minimal.valueAxes).toEqual([{ visible: true }]);
    expect(getConfigWithDefaults(minimal, defaults)).toEqual(getConfigWithDefaults(config, defaults));
  });

  // Regression: a grouped key was compared whole, so overriding one member kept every default-equal
  // sibling — after the flat-keys-to-groups regrouping that was nearly every property in the config
  it('strips default-equal members inside a grouped key', () => {
    expect(getConfigWithoutDefaults(
      { categoryAxis: { property: 'x', tickLabel: { rotation: 45, size: 12, format: null } } },
      defaultsWith({ categoryAxis: { property: 'x', tickLabel: { rotation: 0, size: 12, format: null } } })
    )).toEqual({ categoryAxis: { tickLabel: { rotation: 45 } } });
  });

  it('drops a group whose members all match, and the section with it', () => {
    expect(getConfigWithoutDefaults(
      { categoryAxis: { property: 'x', tickLabel: { size: 12 } } },
      defaultsWith({ categoryAxis: { property: 'x', tickLabel: { size: 12 } } })
    )).toEqual({});
  });

  it('recurses through nested groups', () => {
    expect(getConfigWithoutDefaults(
      { series: [{ shapeStyle: { normal: { fillColor: '#ff0000', fillOpacity: 1 }, focused: { fillOpacity: 1 } } }] },
      defaultsWith({ series: [{ shapeStyle: { normal: { fillColor: '#000000', fillOpacity: 1 }, focused: { fillOpacity: 1 } } }] })
    )).toEqual({ series: [{ shapeStyle: { normal: { fillColor: '#ff0000' } } }] });
  });

  // an array is one value: dropping members would change what the remaining ones mean
  it('compares an array member whole rather than stripping its entries', () => {
    expect(getConfigWithoutDefaults(
      { categoryAxis: { thresholds: [{ value: 1 }, { value: 2 }] } },
      defaultsWith({ categoryAxis: { thresholds: [{ value: 1 }, { value: 9 }] } })
    )).toEqual({ categoryAxis: { thresholds: [{ value: 1 }, { value: 2 }] } });
  });

  it('keeps a group member equal to the base default when the all-config overrides it', () => {
    const config = {
      categoryAxis: { property: 'month', type: 'string', scale: 'ordinal' },
      seriesDefaults: { marker: { size: 10 } },
      series: [{ property: 'a', marker: { size: 6, minSize: 1 } }]
    };
    const defaults = getDefaults(config);
    const minimal = getConfigWithoutDefaults(config, defaults);
    // 6 is the base default, but the all-config would resolve it to 10 without it
    expect((minimal.series as Record<string, unknown>[])[0]).toEqual({ property: 'a', marker: { size: 6 } });
    expect(getConfigWithDefaults(minimal, defaults)).toEqual(getConfigWithDefaults(config, defaults));
  });

  it('keeps sections the defaults do not know about', () => {
    expect(getConfigWithoutDefaults({ id: 'x', title: { text: 'T' } }, defaultsWith({ title: {} })))
      .toEqual({ id: 'x', title: { text: 'T' } });
  });

  // getDefaults builds list defaults from the filtered entries, so ignored/non-object entries must not shift the pairing
  it('pairs each kept list entry with its own defaults when the raw list has ignored entries', () => {
    const config = {
      categoryAxis: { property: 'month', type: 'string', scale: 'ordinal' },
      series: [{ property: 'a', renderer: 'bar' }, { property: 'skip', ignore: true }, 7, { property: 'b', renderer: 'area' }]
    };
    const defaults = getDefaults(config);
    const minimal = getConfigWithoutDefaults(config, defaults);
    expect(minimal.series).toEqual([{ property: 'a', renderer: 'bar' }, { property: 'b', renderer: 'area' }]);
    expect(getConfigWithDefaults(minimal, defaults)).toEqual(getConfigWithDefaults(config, defaults));
  });

  it('leaves an empty valueAxes list out instead of pairing the implicit axis with nothing', () => {
    const config = {
      categoryAxis: { property: 'month', type: 'string', scale: 'ordinal' },
      series: [{ property: 'a' }],
      valueAxes: []
    };
    const minimal = getConfigWithoutDefaults(config, getDefaults(config));
    expect(minimal.valueAxes).toBeUndefined();
  });
});

// Regression: entries the given defaults did not cover were copied through with no defaults at all
describe('defaults built for a different config', () => {
  const oneSeries = { categoryAxis: { property: 'x' }, series: [{ id: 'S0', property: 'a' }] };
  const twoSeries = { categoryAxis: { property: 'x' }, series: [{ id: 'S0', property: 'a' }, { id: 'S1', property: 'b' }] };

  it('rejects defaults whose list is short for the config', () => {
    const stale = getDefaults(oneSeries);
    expect(() => getConfigWithDefaults(twoSeries, stale)).toThrow(/series has 2 entries, its defaults have 1/);
    expect(() => getConfigWithoutDefaults(twoSeries, stale)).toThrow(/series has 2 entries, its defaults have 1/);
    expect(() => buildMochartConfig(twoSeries, stale)).toThrow(/series has 2 entries, its defaults have 1/);
    expect(() => validateConfig(twoSeries, stale)).toThrow(/series has 2 entries, its defaults have 1/);
  });

  it('rejects defaults missing a section the config never names', () => {
    const withoutLegend = { ...getDefaults(twoSeries) } as Record<string, unknown>;
    delete withoutLegend.legend;
    expect(() => getConfigWithDefaults(twoSeries, withoutLegend)).toThrow(/missing the legend section/);
  });

  // an undeclared list takes an implicit entry: the one place the counts legitimately differ
  it('accepts defaults for a list the config leaves empty or ignores', () => {
    for (const aConfig of [{ ...twoSeries, valueAxes: [] }, { ...twoSeries, valueAxes: [{ ignore: true }] }]) {
      expect(() => getConfigWithDefaults(aConfig, getDefaults(aConfig))).not.toThrow();
    }
  });
});

describe('with/without defaults round-trip', () => {
  const config = {
    categoryAxis: { property: 'month', type: 'string', scale: 'ordinal' },
    series: [{ id: 's0', property: 'sales', renderer: 'bar' }, { id: 's1', property: 'costs' }],
    seriesDefaults: { styles: { normal: { fillColor: '#123456' } } },
    title: { text: 'T' }
  };

  it('re-applying defaults to the minimal config loses nothing', () => {
    const defaults = getDefaults(config);
    const configWithDefaults = getConfigWithDefaults(config, defaults);
    const minimal = getConfigWithoutDefaults(configWithDefaults, defaults);
    expect(getConfigWithDefaults(minimal, defaults)).toEqual(configWithDefaults);
  });

  it('a minimal config round-trips unchanged', () => {
    const defaults = getDefaults(config);
    const minimal = getConfigWithoutDefaults(getConfigWithDefaults(config, defaults), defaults);
    expect(getConfigWithoutDefaults(getConfigWithDefaults(minimal, defaults), defaults)).toEqual(minimal);
  });

  // the one-argument forms self-derive their defaults, so the pair only composes
  // if a fully-defaulted config derives the same defaults graph as its raw form
  it('derives the same defaults from a config and its fully-defaulted form', () => {
    const pieConfig = {
      chart: { type: 'pie' },
      categoryAxis: { property: 'label', type: 'string', scale: 'ordinal' },
      series: [{ property: 'value' }, { property: 'other' }]
    };
    for (const aConfig of [config, pieConfig]) {
      const defaults = getDefaults(aConfig);
      expect(getDefaults(getConfigWithDefaults(aConfig, defaults))).toEqual(defaults);
    }
  });

  it('the one-argument forms match the explicit-defaults forms', () => {
    const defaults = getDefaults(config);
    const configWithDefaults = getConfigWithDefaults(config, defaults);
    expect(getConfigWithDefaults(config)).toEqual(configWithDefaults);
    expect(getConfigWithoutDefaults(configWithDefaults)).toEqual(getConfigWithoutDefaults(configWithDefaults, defaults));
  });
});

describe('clone contracts', () => {
  it('getConfigWithDefaults shares nothing with either argument', () => {
    const config = { title: { text: 'T' }, series: [{ property: 'a', styles: { normal: { fillColor: 'red' } } }] };
    const defaults = defaultsWith({ title: { size: 10 }, series: [{ order: 0 }] }) as { title: { size: number }; series: { order: number }[] };
    const result = getConfigWithDefaults(config, defaults);
    config.title.text = 'changed';
    config.series[0]!.styles.normal.fillColor = 'blue';
    defaults.title.size = 99;
    defaults.series[0]!.order = 5;
    expect(result.title).toEqual({ size: 10, text: 'T' });
    expect((result.series as Record<string, unknown>[])[0]!.styles).toEqual({ normal: { fillColor: 'red' } });
  });

  it('getConfigWithoutDefaults shares nothing with its config', () => {
    const config = { title: { text: 'T', margin: { top: 1 } } };
    const result = getConfigWithoutDefaults(config, defaultsWith({ title: { size: 10 } }));
    config.title.margin.top = 99;
    expect(result.title).toEqual({ text: 'T', margin: { top: 1 } });
  });

  it('copies date values instead of sharing them', () => {
    const min = new Date('2026-01-01T00:00:00Z');
    const time = min.getTime();
    const result = getConfigWithDefaults({ categoryAxis: { min } }, getDefaults({}));
    const cloned = (result.categoryAxis as { min: Date }).min;
    expect(cloned).not.toBe(min);
    min.setTime(0);
    expect(cloned.getTime()).toBe(time);
  });
});

describe('buildMochartConfig leaves its inputs alone', () => {
  const inputConfig = () => ({
    categoryAxis: { property: 'month', type: 'string', scale: 'ordinal' },
    series: [{ id: 's0', property: 'sales' }, { id: 's1', property: 'costs', stack: 'st0' }],
    seriesStacks: [{ id: 'st0' }],
    valueAxes: [{ id: 'VA0' }],
    seriesDefaults: { styles: { normal: { fillColor: '#123456' } } }
  });

  it('does not mutate the input config or the defaults graph', () => {
    const config = inputConfig();
    const defaults = getDefaults(config);
    const configSnapshot = structuredClone(config);
    const defaultsSnapshot = structuredClone(defaults);
    buildMochartConfig(config, defaults);
    expect(config).toEqual(configSnapshot);
    expect(defaults).toEqual(defaultsSnapshot);
  });

  it('keeps the with-defaults view serializable after a build on the same defaults graph', () => {
    const config = inputConfig();
    const defaults = getDefaults(config);
    const configWithDefaults = getConfigWithDefaults(config, defaults);
    buildMochartConfig(config, defaults);
    expect(() => JSON.stringify(configWithDefaults)).not.toThrow();
  });

  it('mutating the input config after a build does not reach the built graph', () => {
    const config = inputConfig();
    const built = buildMochartConfig(config, getDefaults(config));
    config.series[0]!.property = 'changed';
    config.seriesDefaults.styles.normal.fillColor = 'changed';
    const series = built.series as unknown as { property: string, styles: { normal: { fillColor: string } } }[];
    expect(series[0]!.property).toBe('sales');
    expect(series[0]!.styles.normal.fillColor).toBe('#123456');
  });
});

describe('configWithAll', () => {
  it('merges the all-config under each config in a list', () => {
    expect(configWithAll([{ a: 1 }, { a: 2, b: 9 }], { b: 5 })).toEqual([{ a: 1, b: 5 }, { a: 2, b: 9 }]);
  });

  it('merges the all-config under a single config object', () => {
    expect(configWithAll({ a: 1 }, { b: 5 })).toEqual({ a: 1, b: 5 });
  });

  it('returns the config unchanged when the all-config is not an object', () => {
    expect(configWithAll({ a: 1 }, null)).toEqual({ a: 1 });
  });
});

describe('buildMochartConfig', () => {
  it('returns just the validation for a non-object config', () => {
    const validation = { valid: false, errors: ['bad'], warnings: [] };
    expect(buildMochartConfig(null, {}, validation)).toEqual({ validation });
  });

  it('defaults to a valid validation when none is supplied', () => {
    const built = buildMochartConfig(null, {});
    expect(built.validation).toEqual({ valid: true, errors: [], warnings: [] });
  });

  it('throws when the validation shape is invalid', () => {
    expect(() => buildMochartConfig({}, {}, { valid: 'nope' } as never)).toThrow();
  });

  it('orders series configs by their order property', () => {
    const built = buildMochartConfig({ series: [{ id: 'a', order: 2 }, { id: 'b', order: 1 }] });
    expect((built.series as { id: string }[]).map(s => s.id)).toEqual(['b', 'a']);
    expect((built as unknown as { seriesById: Record<string, unknown> }).seriesById).toHaveProperty('a');
    expect((built as unknown as { seriesById: Record<string, unknown> }).seriesById).toHaveProperty('b');
  });
});

describe('hasConfigStructureChange', () => {
  const base = () =>
    makeConfig({
      categoryAxis: { property: 'month', type: 'string', scale: 'ordinal' },
      series: [{ property: 'sales' }]
    });

  it('reports no change for two identical configs', () => {
    expect(hasConfigStructureChange(base(), base())).toBe(false);
  });

  // hosts hold no config while loading, so either side may be null
  it('treats a config appearing or disappearing as a change, but two nulls as none', () => {
    expect(hasConfigStructureChange(null, base())).toBe(true);
    expect(hasConfigStructureChange(base(), null)).toBe(true);
    expect(hasConfigStructureChange(null, null)).toBe(false);
  });

  // a non-object config is the only route to a sectionless build now that short defaults throw
  it('treats a config with no sections like no config at all', () => {
    const sectionless = [buildMochartConfig(null), buildMochartConfig(5)];
    for (const config of sectionless) {
      expect(hasConfigStructureChange(config, config)).toBe(false);
      expect(hasConfigStructureChange(config, base())).toBe(true);
      expect(hasConfigStructureChange(base(), config)).toBe(true);
    }
    expect(hasConfigStructureChange(sectionless[0], sectionless[1])).toBe(false);
  });

  it('reports a change when the new config is invalid', () => {
    const invalid = makeConfig({}) as MochartConfig;
    expect(hasConfigStructureChange(base(), invalid)).toBe(true);
  });

  it('reports a change when the category axis property differs', () => {
    const other = makeConfig({
      categoryAxis: { property: 'week', type: 'string', scale: 'ordinal' },
      series: [{ property: 'sales' }]
    });
    expect(hasConfigStructureChange(base(), other)).toBe(true);
  });

  // keyProperty is what identifies categories, so switching it re-keys every one of them
  it('reports a change when the category axis key property differs', () => {
    const withKey = (keyProperty: string | null) =>
      makeConfig({
        categoryAxis: { property: 'month', type: 'string', scale: 'ordinal', keyProperty },
        series: [{ property: 'sales' }]
      });
    expect(hasConfigStructureChange(withKey('id'), withKey('id'))).toBe(false);
    expect(hasConfigStructureChange(withKey(null), withKey('id'))).toBe(true);
    expect(hasConfigStructureChange(withKey('id'), withKey('other'))).toBe(true);
  });

  it('reports a change when the series count differs', () => {
    const other = makeConfig({
      categoryAxis: { property: 'month', type: 'string', scale: 'ordinal' },
      series: [{ property: 'sales' }, { property: 'costs' }]
    });
    expect(hasConfigStructureChange(base(), other)).toBe(true);
  });

  it('reports a change when a series property differs', () => {
    const other = makeConfig({
      categoryAxis: { property: 'month', type: 'string', scale: 'ordinal' },
      series: [{ property: 'costs' }]
    });
    expect(hasConfigStructureChange(base(), other)).toBe(true);
  });

  it('reports a change when a series id differs', () => {
    const withId = (id: string) =>
      makeConfig({
        categoryAxis: { property: 'month', type: 'string', scale: 'ordinal' },
        series: [{ id, property: 'sales' }]
      });
    expect(hasConfigStructureChange(withId('a'), withId('a'))).toBe(false);
    expect(hasConfigStructureChange(withId('a'), withId('b'))).toBe(true);
  });

  // every data property a series names is structural: the tween interpolates the arrays behind them,
  // so a swap would animate between two unrelated columns before landing on the new one
  it('reports a change when a series data property differs', () => {
    const withProperty = (key: string, value: string | null) =>
      makeConfig({
        categoryAxis: { property: 'month', type: 'string', scale: 'ordinal' },
        series: [{ property: 'sales', [key]: value }]
      });
    // colorProperty is left out: the validator ties colorScale to it, so it cannot be toggled alone
    for (const key of ['rangeProperty', 'errorLowProperty', 'errorHighProperty',
                       'markerProperty', 'labelProperty', 'tooltipProperty']) {
      expect(hasConfigStructureChange(withProperty(key, 'note'), withProperty(key, 'note'))).toBe(false);
      expect(hasConfigStructureChange(withProperty(key, null), withProperty(key, 'note'))).toBe(true);
      expect(hasConfigStructureChange(withProperty(key, 'note'), withProperty(key, null))).toBe(true);
      expect(hasConfigStructureChange(withProperty(key, 'note'), withProperty(key, 'other'))).toBe(true);
    }
  });

  // showInLegend only decides legend membership, so it must not tear the chart down and replay its opening animation
  it('reports no change when only a series showInLegend differs', () => {
    const withShowInLegend = (showInLegend: boolean) =>
      makeConfig({
        categoryAxis: { property: 'month', type: 'string', scale: 'ordinal' },
        series: [{ property: 'sales', showInLegend }]
      });
    expect(hasConfigStructureChange(withShowInLegend(true), withShowInLegend(true))).toBe(false);
    expect(hasConfigStructureChange(withShowInLegend(false), withShowInLegend(true))).toBe(false);
    expect(hasConfigStructureChange(withShowInLegend(true), withShowInLegend(false))).toBe(false);
  });
});

// a built config's series <-> axis references are cyclic, so re-feeding one used to overflow the stack in deepClone
describe('re-feeding a built config', () => {
  const built = () => makeConfig({
    categoryAxis: { property: 'month', type: 'string', scale: 'ordinal' },
    series: [{ property: 'sales' }]
  }) as unknown as Record<string, unknown>;

  it('rejects a built config in the functions that clone it', () => {
    expect(() => getConfigWithDefaults(built())).toThrow(/circular reference/);
    expect(() => getConfigWithoutDefaults(built())).toThrow(/circular reference/);
  });

  it('rejects a built config in the callers of those functions', () => {
    expect(() => validateConfig(built())).toThrow(/circular reference/);
    expect(() => enhanceConfig(built() as never)).toThrow(/circular reference/);
    expect(() => buildMochartConfig(built())).toThrow(/circular reference/);
  });

  it('accepts a config that merely carries a validation property', () => {
    const config = { version: '1.0.0', validation: { valid: true, errors: [], warnings: [] } };
    expect(() => getConfigWithDefaults(config)).not.toThrow();
  });
});
