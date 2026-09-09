import { describe, it, expect } from 'vitest';

import { copyDemoConfig, demoConfigFromText, isConfigSectionActive, parseConfigFromText, slowAnimationConfig, toggleConfigFromText, toggleConfigProperty, toggleConfigSection } from '../src/configEditing';
import { getJsonError } from '../src/json';
import { restoreHiddenDataProperties } from '../src/unusedDataProperties';
import { applyDataEdit, formatData, getConfigDataError, getSeriesValuesText, stringifyWithSpacedCommas } from '../src/dataEditing';
import buildMochartDemoConfig from '../src/mochartDemoConfig';
import { applyTransitionConfigEdit } from '../src/transition';
import { demoText } from '../src/demoText';
import type { DemoConfig, MochartDemoConfig } from '../src/types';

// Regression: the Slow toggle detected its state by object identity with the
// module constant, which every Apply's JSON-clone destroyed — the button read
// unpressed while slow animations stayed active, and only Reset recovered.
describe('toggleConfigSection across the clone boundary', () => {
  const original = { enabled: true, initialDuration: 700 };
  const baseDemoConfig = () => ({
    configWithDefaults: { animation: { ...original } },
    configWithoutDefaults: { animation: { ...original } }
  }) as unknown as MochartDemoConfig;

  it('stays active and toggles back off after a clone', () => {
    const mochartDemoConfig = baseDemoConfig();
    const on = toggleConfigSection(mochartDemoConfig, copyDemoConfig(mochartDemoConfig), 'animationConfig', slowAnimationConfig);
    expect(isConfigSectionActive(on, 'animationConfig', slowAnimationConfig)).toBe(true);

    // Apply round-trips the config through JSON, losing object identity
    const applied = copyDemoConfig(on);
    expect(isConfigSectionActive(applied, 'animationConfig', slowAnimationConfig)).toBe(true);

    const off = toggleConfigSection(mochartDemoConfig, applied, 'animationConfig', slowAnimationConfig);
    expect(isConfigSectionActive(off, 'animationConfig', slowAnimationConfig)).toBe(false);
    expect(off.configWithoutDefaults.animation).toEqual(original);
  });
});

// The Invert/Slow pressed states and Reference links used to read the last APPLIED config, so after any edit they described the previous one.
describe('demoConfigFromText', () => {
  const baseText = JSON.stringify({
    categoryAxis: { property: 'month' },
    series: [{ property: 'sales' }]
  });
  const view = (text: string) => demoConfigFromText(text, previous);
  const previous = demoConfigFromText(baseText, {
    configWithDefaults: {}, configWithoutDefaults: {}
  } as unknown as MochartDemoConfig);

  it('tracks an edit that has not been applied yet', () => {
    const edited = JSON.stringify({
      categoryAxis: { property: 'month' },
      plot: { inverted: true },
      series: [{ property: 'sales' }]
    });
    expect(isConfigSectionActive(previous, 'plot', { inverted: true })).toBe(false);
    expect(isConfigSectionActive(view(edited), 'plot', { inverted: true })).toBe(true);
  });

  it('keeps the previous view while the text is mid-keystroke and does not parse', () => {
    expect(view('{ "categoryAxis": { "property": "mon')).toBe(previous);
  });

  it('keeps the previous view when the text parses but does not build', () => {
    expect(view(JSON.stringify({ series: [{ property: 'sales' }] }))).toBe(previous);
  });
});

// Regression: formatData spaced every comma via regex, corrupting commas
// inside string values on each view/apply round trip.
describe('formatData', () => {
  it('keeps the historical layout for plain rows', () => {
    expect(formatData([{ month: 'Jan', sales: 10 }, { month: 'Feb', sales: 20 }]))
      .toBe('[{"month":"Jan", "sales":10},\n {"month":"Feb", "sales":20}]');
  });

  it('leaves commas inside string values untouched', () => {
    const rows = [{ city: 'Boston, MA', value: 1 }];
    const text = formatData(rows);
    expect(text).toContain('"Boston, MA"');
    expect(JSON.parse(text)).toEqual(rows);
    // stable across repeated view/format round trips
    expect(formatData(JSON.parse(text))).toBe(text);
  });

  it('spaces structural commas in nested values only', () => {
    expect(stringifyWithSpacedCommas({ label: 'a,b', tags: [1, 2] }))
      .toBe('{"label":"a,b", "tags":[1, 2]}');
  });
});

// Regression: hidden (unused) properties were restored purely by row index, so
// deleting or reordering rows in the filtered view grafted the wrong rows'
// hidden columns onto the result.
describe('restoreHiddenDataProperties row identity', () => {
  const used = new Set(['month', 'sales']);
  const fullRows = [
    { month: 'Jan', sales: 1, hidden: 'jan-extra' },
    { month: 'Feb', sales: 2, hidden: 'feb-extra' },
    { month: 'Mar', sales: 3, hidden: 'mar-extra' }
  ];

  it('keeps hidden columns with their row when a view row is deleted', () => {
    const viewRows = [{ month: 'Jan', sales: 1 }, { month: 'Mar', sales: 3 }];
    const restored = restoreHiddenDataProperties(viewRows, fullRows, used, 'month');
    expect(restored).toEqual([
      { month: 'Jan', sales: 1, hidden: 'jan-extra' },
      { month: 'Mar', sales: 3, hidden: 'mar-extra' }
    ]);
  });

  it('keeps hidden columns with their row when view rows are reordered', () => {
    const viewRows = [{ month: 'Mar', sales: 3 }, { month: 'Jan', sales: 1 }];
    const restored = restoreHiddenDataProperties(viewRows, fullRows, used, 'month');
    expect(restored[0]!.hidden).toBe('mar-extra');
    expect(restored[1]!.hidden).toBe('jan-extra');
  });

  it('falls back to index matching for an in-place category edit', () => {
    const viewRows = [{ month: 'January', sales: 1 }, { month: 'Feb', sales: 2 }, { month: 'Mar', sales: 3 }];
    const restored = restoreHiddenDataProperties(viewRows, fullRows, used, 'month');
    expect(restored[0]!.hidden).toBe('jan-extra');
  });

  it('falls back to index matching without a category property', () => {
    const viewRows = [{ month: 'Jan', sales: 10 }];
    const restored = restoreHiddenDataProperties(viewRows, fullRows, used);
    expect(restored[0]!.hidden).toBe('jan-extra');
  });
});

// Regression: toggleConfigProperty toggled from the raw section only, so a
// property whose core default is true would uselessly write true on the first
// press; the effective (defaulted) value drives the toggle now.
describe('toggleConfigProperty effective defaults', () => {
  it('switches a defaulted-true property off on the first press', () => {
    const view = {
      configWithDefaults: { plot: { inverted: true } },
      configWithoutDefaults: {}
    };
    const toggled = toggleConfigProperty(view, 'plot', 'inverted', true);
    expect(toggled.configWithoutDefaults.plot).toEqual({ inverted: false });
    expect(toggled.configWithDefaults.plot).toEqual({ inverted: false });
  });

  it('uses the provided default when no effective value exists', () => {
    const view = { configWithDefaults: {}, configWithoutDefaults: {} };
    const toggled = toggleConfigProperty(view, 'plot', 'inverted', true);
    expect(toggled.configWithoutDefaults.plot).toEqual({ inverted: true });
  });

  it('still round-trips an explicit raw value', () => {
    const view = {
      configWithDefaults: { plot: { inverted: true, other: 1 } },
      configWithoutDefaults: { plot: { inverted: true } }
    };
    const toggled = toggleConfigProperty(view, 'plot', 'inverted', true);
    expect(toggled.configWithoutDefaults.plot).toEqual({ inverted: false });
    expect(toggled.configWithDefaults.plot).toEqual({ inverted: false, other: 1 });
  });
});

// Regression: the Invert/Slow toggles rebuilt the textarea from the last built
// snapshot, silently discarding unapplied edits and reverting applied ones.
describe('toggleConfigFromText', () => {
  const baseText = JSON.stringify({
    categoryAxis: { property: 'month' },
    series: [{ property: 'sales' }]
  });
  const invert = (current: Parameters<typeof toggleConfigProperty>[0]) =>
    toggleConfigProperty(current, 'plot', 'inverted', true);

  it('keeps an unapplied edit through a toggle', () => {
    const edited = JSON.stringify({
      categoryAxis: { property: 'month' },
      title: { text: 'Edited title' },
      series: [{ property: 'sales' }]
    });
    const result = toggleConfigFromText(edited, false, invert);
    expect(result.error).toBeNull();
    const toggled = JSON.parse(result.text!);
    expect(toggled.title.text).toBe('Edited title');
    expect(toggled.plot).toEqual({ inverted: true });
  });

  it('reports invalid JSON without toggling', () => {
    const result = toggleConfigFromText('{ not json', false, invert);
    expect(result.demoConfig).toBeNull();
    expect(result.text).toBeNull();
    expect(typeof result.error).toBe('string');
  });

  it('reports an invalid chart config without toggling', () => {
    const invalid = JSON.stringify({
      categoryAxis: { property: 'month' },
      series: [{ property: 'sales', axis: 'nope' }]
    });
    const result = toggleConfigFromText(invalid, false, invert);
    expect(result.demoConfig).toBeNull();
    expect(typeof result.error).toBe('string');
  });

  it('formats the with-defaults view when defaults are shown', () => {
    const result = toggleConfigFromText(baseText, true, invert);
    expect(result.error).toBeNull();
    const toggled = JSON.parse(result.text!);
    expect(toggled.plot.inverted).toBe(true);
    // with-defaults view carries defaulted keys the raw text never had
    expect(toggled.legend).toBeDefined();
  });
});

// Regression: Apply hardcoded its own copy, so the same invalid data showed
// "Invalid Data — should be an array of objects" on live edits but
// "Invalid Data — details in the browser console" on Apply.
describe('applyDataEdit error copy', () => {
  const config = {
    version: '1.0.0',
    categoryAxis: { property: 'month', type: 'string', scale: 'ordinal' },
    series: [{ property: 'sales' }]
  } as unknown as DemoConfig;

  it('uses the shared live-edit copy for non-array data', () => {
    const result = applyDataEdit('{"not": "an array"}', [], null, config);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorMessage).toBe(demoText.errors.invalidDataArray);
      expect(result.callbackError).toBe(demoText.errors.invalidData);
    }
  });

  // Regression: arrays are objects, so array rows skipped this shape error and failed later as chart content.
  it('reports the shape error for array rows, whole or mixed in', () => {
    for (const text of ['[[]]', '[[1, 2]]', '[{"month": "Jan", "sales": 1}, []]', '[null]', '[1]']) {
      const result = applyDataEdit(text, [], null, config);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errorMessage).toBe(demoText.errors.invalidDataArray);
      }
    }
  });

  it('uses the shared copy for invalid JSON', () => {
    const result = applyDataEdit('not json', [], null, config);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorMessage).toBe(demoText.errors.invalidJson);
      expect(result.callbackError).toBe(demoText.errors.invalidData);
    }
  });
});

// Regression: config edits (and the initial demo load) never validated the
// data against the config, so a wrong categoryAxis.property rendered a chart
// of undefined categories with no error.
describe('getConfigDataError', () => {
  const makeConfig = (categoryProperty: string) => ({
    version: '1.0.0',
    categoryAxis: { property: categoryProperty, type: 'string', scale: 'ordinal' },
    series: [{ property: 'sales' }]
  } as unknown as DemoConfig);
  const rows = [{ month: 'Jan', sales: 1 }, { month: 'Feb', sales: 2 }];

  it('is false for a config/data pair that validates', () => {
    expect(getConfigDataError(makeConfig('month'), rows)).toBe(false);
  });

  it('reports the shared data content copy when the data fails validation', () => {
    // numeric category values against a string-typed category axis
    const numericRows = [{ month: 1, sales: 1 }, { month: 2, sales: 2 }];
    expect(getConfigDataError(makeConfig('month'), numericRows)).toBe(demoText.errors.invalidDataContent);
  });

  // getDataErrors defers this case to the provider's getError guard; the demo
  // layer folds that back in so the Data tab and chart keep the shared copy
  it('reports the shared copy for a category property missing from the data', () => {
    expect(getConfigDataError(makeConfig('wrong'), rows)).toBe(demoText.errors.invalidDataContent);
  });

  it('is false when the config itself is invalid (config errors have their own display)', () => {
    const invalidConfig = { version: '1.0.0', categoryAxis: { property: 'month' } } as unknown as DemoConfig;
    expect(getConfigDataError(invalidConfig, rows)).toBe(false);
  });
});

describe('applyTransitionConfigEdit error copy', () => {
  it('uses the shared copy for each failure path', () => {
    expect(applyTransitionConfigEdit('not json')).toEqual({ ok: false, errorMessage: demoText.errors.invalidJson });
    expect(applyTransitionConfigEdit('[1]')).toEqual({ ok: false, errorMessage: demoText.errors.transitionObject });
    expect(applyTransitionConfigEdit('{"config": 5}')).toEqual({ ok: false, errorMessage: demoText.errors.transitionConfigObject });
    const validConfig = JSON.stringify({
      config: { version: '1.0.0', categoryAxis: { property: 'month', type: 'string', scale: 'ordinal' }, series: [{ property: 'sales' }] },
      data: [{ month: 'Jan' }]
    });
    expect(applyTransitionConfigEdit(validConfig)).toEqual({ ok: false, errorMessage: demoText.errors.transitionDataArrays });
  });
});

// JSON.parse keeps the last of repeated keys silently; every editor tab's parse path names the repeat instead
describe('duplicate JSON keys', () => {
  const config = { version: '1.0.0', categoryAxis: { property: 'month', type: 'string', scale: 'ordinal' }, series: [{ property: 'sales' }] } as unknown as DemoConfig;

  it('is reported by getJsonError with the duplicate named, unlike plain syntax errors', () => {
    expect(getJsonError('{"a": 1}')).toBeNull();
    expect(getJsonError('{"a": 1')).toBe(demoText.errors.invalidJson);
    expect(getJsonError('{"a": 1, "a": 2}')).toBe('Duplicate key "a"');
    expect(getJsonError('{"a": [{"b": 1, "b": 2}], "c": {"d": 1, "d": 2}}')).toBe('Duplicate key "b" in a[0]; Duplicate key "d" in c');
  });

  it('blocks a config apply', () => {
    const result = parseConfigFromText('{"version": "1.0.0", "categoryAxis": {"property": "month", "type": "string", "scale": "ordinal"}, "series": [{"property": "sales", "property": "high"}]}');
    expect(result).toEqual({ config: null, build: null, error: 'Duplicate key "property" in series[0]' });
  });

  it('blocks a data apply and keeps the short chart error state', () => {
    const result = applyDataEdit('[{"month": "Jan", "sales": 1, "sales": 2}]', [], null, config);
    expect(result).toEqual({ ok: false, errorMessage: 'Duplicate key "sales" in [0]', callbackError: demoText.errors.invalidData });
  });

  it('blocks a transition apply', () => {
    expect(applyTransitionConfigEdit('{"config": {}, "data": [], "data": []}')).toEqual({ ok: false, errorMessage: 'Duplicate key "data"' });
  });
});

// Every port carried its own byte-identical copy of this.
describe('getSeriesValuesText', () => {
  const rows = [{ month: 'Jan', sales: 10, high: 12, label: 'ten', tint: '#333' }];
  const config = (series: Record<string, unknown>) => ({
    version: '1.0.0',
    categoryAxis: { property: 'month', type: 'string', scale: 'ordinal' },
    series: [{ property: 'sales', ...series }]
  }) as unknown as DemoConfig;
  const text = (series: Record<string, unknown>) => getSeriesValuesText(buildMochartDemoConfig(config(series)), rows, 0, 0);

  it('carries only the position value when the series declares nothing optional', () => {
    expect(JSON.parse(text({}))).toEqual({ p: 10 });
  });

  it('adds a key per optional property the series declares', () => {
    expect(JSON.parse(text({ rangeProperty: 'high', labelProperty: 'label', colorProperty: 'tint' })))
      .toEqual({ p: 10, r: 12, l: 'ten', c: '#333' });
  });

  it('is empty for a config with no series', () => {
    const noSeries = { version: '1.0.0', categoryAxis: { property: 'month' }, series: [] } as unknown as DemoConfig;
    expect(getSeriesValuesText(buildMochartDemoConfig(noSeries), rows, 0, 0)).toBe('');
  });
});
