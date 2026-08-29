import { describe, it, expect } from 'vitest';
import { deepClone, deepMerge, deepMergeAll, isPlainObject, withoutUndefined } from '../../src/config/core/deepMerge';
import { enhanceConfig } from '../../src/config/helper';
import { getConfigWithDefaults, getConfigWithoutDefaults } from '../../src/config/core/mochartConfig';
import { getDefaults } from '../../src/config/defaults/mochartConfig';
import { validateConfigDetailed } from '../../src/config/validation/mochartConfig';
import type { MochartInputConfig } from '../../src/types/config';

const V = '1.0.0';

function detailedFor(config: unknown) {
  const defaults = getDefaults(config as never);
  return validateConfigDetailed(config, defaults as never);
}

// ---------------------------------------------------------------------------
// the merge itself
// ---------------------------------------------------------------------------

describe('isPlainObject', () => {
  it('is true only for plain data objects', () => {
    expect(isPlainObject({})).toBe(true);
    expect(isPlainObject(Object.create(null))).toBe(true);
    expect(isPlainObject([])).toBe(false);
    expect(isPlainObject(null)).toBe(false);
    expect(isPlainObject(undefined)).toBe(false);
    expect(isPlainObject(new Date())).toBe(false);
    expect(isPlainObject(() => 0)).toBe(false);
    expect(isPlainObject('x')).toBe(false);
  });
});

describe('withoutUndefined', () => {
  it('drops undefined-valued keys and keeps the rest', () => {
    expect(withoutUndefined({ a: 1, b: undefined, c: null })).toEqual({ a: 1, c: null });
  });

  it('returns the same object when there is nothing to drop', () => {
    const object = { a: 1 };
    expect(withoutUndefined(object)).toBe(object);
  });
});

describe('deepMerge', () => {
  it('merges nested objects instead of replacing them', () => {
    expect(deepMerge({ style: { stroke: 'black', width: 2 } }, { style: { stroke: 'red' } }))
      .toEqual({ style: { stroke: 'red', width: 2 } });
  });

  it('treats undefined in the source as "not specified"', () => {
    expect(deepMerge({ a: 1 }, { a: undefined })).toEqual({ a: 1 });
  });

  it('drops undefined-valued keys coming from the target', () => {
    expect(Object.keys(deepMerge({ a: undefined, b: 1 }, {}))).toEqual(['b']);
  });

  it('treats null in the source as a real value that overrides', () => {
    expect(deepMerge({ a: 'black' }, { a: null })).toEqual({ a: null });
    expect(deepMerge({ style: { fill: 'black' } }, { style: { fill: null } }))
      .toEqual({ style: { fill: null } });
  });

  it('replaces arrays wholesale rather than merging them element-wise', () => {
    expect(deepMerge({ stops: [1, 2, 3] }, { stops: [9] })).toEqual({ stops: [9] });
    expect(deepMerge({ stops: [{ a: 1, b: 2 }] }, { stops: [{ a: 9 }] }))
      .toEqual({ stops: [{ a: 9 }] });
  });

  it('replaces an object with an array and an array with an object', () => {
    expect(deepMerge({ a: { x: 1 } }, { a: [1] })).toEqual({ a: [1] });
    expect(deepMerge({ a: [1] }, { a: { x: 1 } })).toEqual({ a: { x: 1 } });
  });

  it('does not recurse into class instances', () => {
    class Thing { constructor(public x = 1) {} }
    const instance = new Thing(2);
    const merged = deepMerge({ a: new Thing(1) }, { a: instance }) as { a: Thing };
    expect(merged.a).toBe(instance);
  });

  it('does not recurse into functions', () => {
    const fn = () => 1;
    const merged = deepMerge({ a: () => 0 }, { a: fn }) as { a: () => number };
    expect(merged.a).toBe(fn);
  });

  it('does not mutate either input', () => {
    const target = { style: { stroke: 'black' } };
    const source = { style: { fill: 'red' } };
    deepMerge(target, source);
    expect(target).toEqual({ style: { stroke: 'black' } });
    expect(source).toEqual({ style: { fill: 'red' } });
  });

  it('orders keys by the target first, then the source-only keys', () => {
    expect(Object.keys(deepMerge({ b: 1, a: 1 }, { c: 1, a: 2 }))).toEqual(['b', 'a', 'c']);
  });

  it('shares untouched values by reference rather than deep cloning', () => {
    const nested = { x: 1 };
    const merged = deepMerge({ nested, other: 1 }, { other: 2 }) as { nested: object };
    expect(merged.nested).toBe(nested);
  });

  it('tolerates a null or undefined side', () => {
    expect(deepMerge(null, { a: 1 })).toEqual({ a: 1 });
    expect(deepMerge({ a: 1 }, null)).toEqual({ a: 1 });
  });
});

describe('deepMergeAll', () => {
  it('layers each object over the ones before it, member by member', () => {
    expect(deepMergeAll({ s: { a: 1, b: 1, c: 1 } }, { s: { b: 2 } }, { s: { c: 3 } }))
      .toEqual({ s: { a: 1, b: 2, c: 3 } });
  });
});

describe('deepClone', () => {
  it('copies plain objects and arrays recursively', () => {
    const value = { a: { b: [1, { c: 2 }] } };
    const clone = deepClone(value);
    expect(clone).toEqual(value);
    expect(clone.a).not.toBe(value.a);
    expect(clone.a.b).not.toBe(value.a.b);
    expect(clone.a.b[1]).not.toBe(value.a.b[1]);
  });

  it('copies dates', () => {
    const date = new Date('2026-01-01T00:00:00Z');
    const clone = deepClone({ min: date });
    expect(clone.min).not.toBe(date);
    expect(clone.min.getTime()).toBe(date.getTime());
  });

  it('passes primitives and non-plain values through by reference', () => {
    const callback = () => 'x';
    const clone = deepClone({ a: 1, b: null, c: callback });
    expect(clone.a).toBe(1);
    expect(clone.b).toBe(null);
    expect(clone.c).toBe(callback);
  });

  it('throws on a circular reference instead of recursing forever', () => {
    const loop: Record<string, unknown> = { a: 1 };
    loop.self = loop;
    expect(() => deepClone(loop)).toThrow(/circular reference/);

    const list: unknown[] = [1];
    list.push(list);
    expect(() => deepClone(list)).toThrow(/circular reference/);
  });

  // the same object on two branches is a shared value, not a loop, and must still clone
  it('copies an object reached twice down separate branches', () => {
    const shared = { x: 1 };
    const clone = deepClone({ a: shared, b: shared });
    expect(clone).toEqual({ a: { x: 1 }, b: { x: 1 } });
    expect(clone.a).not.toBe(shared);
  });
});

// ---------------------------------------------------------------------------
// deep merge through the config pipeline
// ---------------------------------------------------------------------------

describe('partial nested config sections', () => {
  it('keeps the sibling defaults of a partially overridden style', () => {
    const config = enhanceConfig({
      version: V,
      categoryAxis: { property: 'p' },
      chart: { backgroundStyle: { fillColor: '#ff0000' } },
      series: [{ property: 'a' }]
    });
    expect(config.validation.valid).toBe(true);
    expect(config.chart.backgroundStyle)
      .toEqual({ strokeColor: 'currentColor', strokeOpacity: 0, strokeWidth: null, strokeDashArray: null, fillColor: '#ff0000', fillOpacity: 0 });
  });

  it('validates a partial style rather than demanding every member', () => {
    expect(detailedFor({
      version: V,
      categoryAxis: { property: 'p' },
      legend: { backgroundStyle: { fillOpacity: 0.5 } },
      series: [{ property: 'a' }]
    }).valid).toBe(true);
  });

  it('still rejects a partial style member whose value is invalid', () => {
    const detailed = detailedFor({
      version: V,
      categoryAxis: { property: 'p' },
      legend: { backgroundStyle: { fillOpacity: 5 } },
      series: [{ property: 'a' }]
    });
    expect(detailed.valid).toBe(false);
    expect(detailed.diagnostics.some(diagnostic =>
      diagnostic.severity === 'error' &&
      diagnostic.path.join('.') === 'legend.backgroundStyle.fillOpacity')).toBe(true);
  });

  it('lets an explicit null override a non-null default', () => {
    const config = enhanceConfig({
      version: V,
      categoryAxis: { property: 'p' },
      title: { textStyle: { fillColor: null } },
      series: [{ property: 'a' }]
    });
    expect(config.validation.valid).toBe(true);
    // the default fillColor is 'currentColor'; null means "omit the attribute"
    expect(config.title.textStyle.fillColor).toBeNull();
    expect('fillColor' in config.title.textStyle).toBe(true);
  });

  it('replaces an array-valued config member wholesale', () => {
    const config = enhanceConfig({
      version: V,
      categoryAxis: { property: 'p' },
      linearGradients: [{ id: 'G', stops: [{ offset: 0, color: '#ff0000', opacity: 1 }] }],
      series: [{ property: 'a' }]
    });
    expect(config.linearGradients[0]!.stops).toEqual([{ offset: 0, color: '#ff0000', opacity: 1 }]);
  });

  it('deep-merges a *Defaults section into each array entry', () => {
    const config = enhanceConfig({
      version: V,
      categoryAxis: { property: 'p' },
      seriesDefaults: { curve: { type: 'basis' } },
      series: [
        { property: 'a' },
        { property: 'b', curve: { type: 'natural' } }
      ]
    } as MochartInputConfig);
    expect(config.series[0]!.curve).toEqual({ type: 'basis' });
    expect(config.series[1]!.curve).toEqual({ type: 'natural' });
  });

  it('deep-merges a *Defaults section member into an entry that overrides a sibling member', () => {
    const config = enhanceConfig({
      version: V,
      categoryAxis: { property: 'p' },
      valueAxisDefaults: { backgroundStyle: { fillOpacity: 0.5 } },
      valueAxes: [{ id: 'A', backgroundStyle: { strokeOpacity: 0.25 } }],
      series: [{ property: 'a', axis: 'A' }]
    } as MochartInputConfig);
    expect(config.validation.valid).toBe(true);
    const { backgroundStyle } = config.valueAxes[0]!;
    expect(backgroundStyle.fillOpacity).toBe(0.5);
    expect(backgroundStyle.strokeOpacity).toBe(0.25);
    // the members neither layer named keep the built-in defaults
    expect(backgroundStyle.strokeColor).toBe('currentColor');
    expect(backgroundStyle.strokeWidth).toBeNull();
    expect(backgroundStyle.fillColor).toBeNull();
  });
});

describe('nested validation diagnostics', () => {
  it('warns about an unknown key inside a nested object, with the nested path', () => {
    const detailed = detailedFor({
      version: V,
      categoryAxis: { property: 'p' },
      legend: { backgroundStyle: { fillColour: 'red' } },
      series: [{ property: 'a' }]
    });
    expect(detailed.valid).toBe(false);
    const warning = detailed.diagnostics.find(diagnostic =>
      diagnostic.severity === 'warning' &&
      diagnostic.path.join('.') === 'legend.backgroundStyle');
    expect(warning).toBeDefined();
    expect(warning!.message).toContain('fillColour');
    expect(detailed.warnings.some(message =>
      message.includes('legend') && message.includes('backgroundStyle') && message.includes('fillColour')))
      .toBe(true);
  });

  it('warns about an unknown key inside a nested object of an array section entry', () => {
    const detailed = detailedFor({
      version: V,
      categoryAxis: { property: 'p' },
      series: [{ property: 'a', curve: { typo: 1 } }]
    });
    expect(detailed.diagnostics.some(diagnostic =>
      diagnostic.severity === 'warning' &&
      diagnostic.path.join('.') === 'series.0.curve')).toBe(true);
  });

  it('keeps reporting an unknown key at the top level of a section', () => {
    const detailed = detailedFor({
      version: V,
      categoryAxis: { property: 'p' },
      legend: { nonsense: 1 },
      series: [{ property: 'a' }]
    });
    expect(detailed.diagnostics.some(diagnostic =>
      diagnostic.severity === 'warning' && diagnostic.path.join('.') === 'legend')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// axis styles, which nest one level further: element -> focus state -> member
// ---------------------------------------------------------------------------

describe('axis focus-state styles', () => {
  it('keeps the sibling members and states of a partially overridden style', () => {
    const config = enhanceConfig({
      version: V,
      categoryAxis: { property: 'p', tickLabel: { textStyle: { focused: { fillColor: '#ff0000' } } } },
      series: [{ property: 'a' }]
    });
    expect(config.validation.valid).toBe(true);
    expect(config.categoryAxis.tickLabel.textStyle.focused)
      .toEqual({ strokeColor: 'same', strokeOpacity: 1, strokeWidth: 0, strokeDashArray: 'same', fillColor: '#ff0000', fillOpacity: 1 });
    expect(config.categoryAxis.tickLabel.textStyle.normal.fillColor).toBe('currentColor');
  });

  it('accepts "same" on a focused or defocused color but not on the normal one', () => {
    expect(detailedFor({
      version: V,
      categoryAxis: { property: 'p', axisLine: { style: { defocused: { strokeColor: 'same' } } } },
      series: [{ property: 'a' }]
    }).valid).toBe(true);

    const detailed = detailedFor({
      version: V,
      categoryAxis: { property: 'p', axisLine: { style: { normal: { strokeColor: 'same' } } } },
      series: [{ property: 'a' }]
    });
    expect(detailed.valid).toBe(false);
    expect(detailed.diagnostics.some(diagnostic =>
      diagnostic.severity === 'error' &&
      diagnostic.path.join('.') === 'categoryAxis.axisLine.style.normal.strokeColor')).toBe(true);
  });
});

describe('prototypes on merged and cloned configs', () => {
  const protoOf = (value: object) => Object.getPrototypeOf(value);

  it('gives merges and clones Object.prototype', () => {
    expect(protoOf(deepMerge({ a: 1 }, { b: 2 }))).toBe(Object.prototype);
    expect(protoOf(deepMergeAll({ a: 1 }, { b: 2 }))).toBe(Object.prototype);
    expect(protoOf(deepClone({ a: { b: 1 } }).a)).toBe(Object.prototype);
    expect(protoOf(withoutUndefined({ a: 1, b: undefined }))).toBe(Object.prototype);
  });

  it('keeps a JSON-owned __proto__ key as data instead of a prototype', () => {
    // __proto__ is the only accessor on Object.prototype, so it is the only name whose write matters
    const source = JSON.parse('{"__proto__":{"polluted":true},"a":1,"nested":{"__proto__":{"polluted":true}},"list":[{"__proto__":{"polluted":true}}]}');
    for (const merged of [deepMerge({}, source), deepClone(source), withoutUndefined({ ...source, b: undefined })]) {
      const record = merged as Record<string, Record<string, unknown>[] & Record<string, unknown>>;
      for (const object of [record, record['nested']!, record['list']![0]!]) {
        expect(protoOf(object)).toBe(Object.prototype);
        expect(Object.prototype.hasOwnProperty.call(object, '__proto__')).toBe(true);
      }
      expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    }
  });

  it('merges a key named after a prototype member from the source, not from Object.prototype', () => {
    // the target has no own `constructor`, so the inherited one must not be read as a merge target
    expect(deepMerge({ a: 1 }, { constructor: { x: 1 } })).toEqual({ a: 1, constructor: { x: 1 } });
    expect(deepMerge({ constructor: { x: 1 } }, { constructor: { y: 2 } })).toEqual({ constructor: { x: 1, y: 2 } });
    for (const name of ['toString', 'valueOf', 'hasOwnProperty', 'isPrototypeOf', 'propertyIsEnumerable', 'toLocaleString']) {
      expect(deepMerge({ a: 1 }, { [name]: { x: 1 } })).toEqual({ a: 1, [name]: { x: 1 } });
      expect(deepClone({ [name]: { x: 1 } })).toEqual({ [name]: { x: 1 } });
    }
  });

  it('gives every public config result Object.prototype, at every level', () => {
    const raw = { version: V, categoryAxis: { property: 'p' }, series: [{ property: 'a' }] } as unknown as MochartInputConfig;
    const enhanced = enhanceConfig(raw);
    expect(protoOf(enhanced.chart)).toBe(Object.prototype);
    expect(protoOf(enhanced.series[0]!)).toBe(Object.prototype);

    const withDefaults = getConfigWithDefaults(raw) as Record<string, Record<string, unknown>>;
    expect(protoOf(withDefaults)).toBe(Object.prototype);
    expect(protoOf(withDefaults['chart']!)).toBe(Object.prototype);
    // the idioms a host reaches for, all broken by a null prototype
    expect(Object.prototype.hasOwnProperty.call(withDefaults, 'chart')).toBe(true);
    expect((withDefaults as { hasOwnProperty(key: string): boolean }).hasOwnProperty('chart')).toBe(true);
    expect(withDefaults instanceof Object).toBe(true);

    expect(protoOf(getConfigWithoutDefaults(withDefaults))).toBe(Object.prototype);
  });
});
