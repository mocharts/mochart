import { enhanceConfig, buildMochartConfig, getDefaults, validateConfig } from '../../src';
import type { MochartInputConfig } from '../../src';

const VERSION_STRING = "1.0.0";

// enhanceConfig validates untrusted input at runtime, so these tests
// deliberately feed malformed values that the static type would reject.
const enhance = (config: unknown) => enhanceConfig(config as MochartInputConfig);

describe('config validation', () => {
  it('should validate a null config', () => {
    const mochartConfig = enhance(null);
    expect(mochartConfig).toEqual({
      validation: {
        valid: false,
        errors: ['config - should be an object: null'],
        warnings: []
      }
    });
  });

  it('should validate a string config', () => {
    const mochartConfig = enhance("a");
    expect(mochartConfig).toEqual({
      validation: {
        valid: false,
        errors: ['config - should be an object: "a"'],
        warnings: []
      }
    });
  });

  it('should validate an empty object config', () => {
    const mochartConfig = enhance({});
    expect(mochartConfig.validation).toEqual({
      valid: false,
      errors: [
        'categoryAxis - property - should be a string naming a data property: undefined'
      ],
      warnings: []
    });
  });

  it('accepts a config with no version, reading it as the current format', () => {
    const mochartConfig = enhance({
      categoryAxis: { property: 'month' },
      series: [{ property: 'sales' }]
    });
    expect(mochartConfig.validation).toEqual({ valid: true, errors: [], warnings: [] });
  });

  it('migrates on the way in, so the built config always carries a version', () => {
    // enhanceConfig is where a stored config enters, so it migrates first: a versionless config
    // means "written for the current format" and comes back stamped with it
    const series = [{ property: 'sales' }];
    const categoryAxis = { property: 'month' };
    expect(enhance({ version: VERSION_STRING, categoryAxis, series }).version).toBe(VERSION_STRING);
    expect(enhance({ categoryAxis, series }).version).toBe(VERSION_STRING);
  });

  it('does not mutate the config it was given', () => {
    const input = { categoryAxis: { property: 'month' }, series: [{ property: 'sales' }] };
    enhance(input);
    expect('version' in input).toBe(false);
  });

  it('rejects an unknown version', () => {
    const mochartConfig = enhance({
      version: '0.9.0',
      categoryAxis: { property: 'month' },
      series: [{ property: 'sales' }]
    });
    expect(mochartConfig.validation.valid).toBe(false);
    expect(mochartConfig.validation.errors.some(error => error.includes('version'))).toBe(true);
  });

  it('should validate a minimal valid config object', () => {
    const mochartConfig = enhance({
      version: VERSION_STRING,
      categoryAxis: {
        property: "p"
      }
    });
    expect(mochartConfig.validation).toEqual({
      valid: true,
      errors: [],
      warnings: []
    });
  });

  it('should validate a config object with extra properties', () => {
    const mochartConfig = enhance({
      version: VERSION_STRING,
      categoryAxis: {
        property: "p"
      },
      bad: true
    });
    expect(mochartConfig.validation).toEqual({
      valid: false,
      errors: [],
      warnings: [
        'config - had 1 invalid property: bad'
      ]
    });
  });

  it('should validate a config object with extra properties in a section', () => {
    const mochartConfig = enhance({
      version: VERSION_STRING,
      categoryAxis: {
        property: "p",
        bad: true
      }
    });
    expect(mochartConfig.validation).toEqual({
      valid: false,
      errors: [],
      warnings: [
        'categoryAxis - had 1 invalid property: bad'
      ]
    });
  });

  it('should validate a config object with a single empty series', () => {
    const mochartConfig = enhance({
      version: VERSION_STRING,
      categoryAxis: {
        property: "p"
      },
      series: {

      }
    });
    expect(mochartConfig.validation).toEqual({
      valid: false,
      errors: [
        'series[0] - property - should be a string naming a data property: undefined'
      ],
      warnings: []
    });
  });

  it('should validate a config object with an empty all section', () => {
    const mochartConfig = enhance({
      version: VERSION_STRING,
      categoryAxis: {
        property: "p"
      },
      seriesDefaults: {

      }
    });
    expect(mochartConfig.validation).toEqual({
      valid: true,
      errors: [],
      warnings: []
    });
  });

  it('should validate a config object with a string all section', () => {
    const mochartConfig = enhance({
      version: VERSION_STRING,
      categoryAxis: {
        property: "p"
      },
      seriesDefaults: "123"
    });
    expect(mochartConfig.validation).toEqual({
      valid: false,
      errors: [
        'seriesDefaults - should be an object: "123"'
      ],
      warnings: []
    });
  });

  it('should validate a config object with a non empty all section', () => {
    const mochartConfig = enhance({
      version: VERSION_STRING,
      categoryAxis: {
        property: "p"
      },
      seriesDefaults: {
        shapeStyle: { normal: { fillColor: '#fff' } }
      }
    });
    expect(mochartConfig.validation).toEqual({
      valid: true,
      errors: [],
      warnings: []
    });
  });

  it('should validate a config object with an invalid all section and empty list section', () => {
    const mochartConfig = enhance({
      version: VERSION_STRING,
      categoryAxis: {
        property: "p"
      },
      seriesDefaults: {
        shapeStyle: { normal: { fillColor: '#WWW' } }
      }
    });
    expect(mochartConfig.validation).toEqual({
      valid: false,
      errors: [
        'seriesDefaults - shapeStyle.normal.fillColor - should be a valid svg color (or "none" / "currentColor") or be one of [ "seriesIndex", "categoryIndex" ]: "#WWW"'
      ],
      warnings: []
    });
  });

  it('should validate a config object with an invalid all section and non empty valid list section', () => {
    const mochartConfig = enhance({
      version: VERSION_STRING,
      categoryAxis: {
        property: "p"
      },
      seriesDefaults: {
        shapeStyle: { normal: { fillColor: '#WWW' } }
      },
      series: {
        property: "p",
        shapeStyle: { normal: { fillColor: '#fff' } }
      }
    });
    expect(mochartConfig.validation).toEqual({
      valid: false,
      errors: [
        'seriesDefaults - shapeStyle.normal.fillColor - should be a valid svg color (or "none" / "currentColor") or be one of [ "seriesIndex", "categoryIndex" ]: "#WWW"'
      ],
      warnings: []
    });
  });

  it('should validate a config object with an invalid all section and non empty invalid list section', () => {
    const mochartConfig = enhance({
      version: VERSION_STRING,
      categoryAxis: {
        property: "p"
      },
      seriesDefaults: {
        shapeStyle: { normal: { fillColor: '#WWW' } }
      },
      series: {
        property: "p",
        shapeStyle: { normal: { fillColor: '#ZZZ' } }
      }
    });
    expect(mochartConfig.validation).toEqual({
      valid: false,
      errors: [
        'seriesDefaults - shapeStyle.normal.fillColor - should be a valid svg color (or "none" / "currentColor") or be one of [ "seriesIndex", "categoryIndex" ]: "#WWW"',
        'series[0] - shapeStyle.normal.fillColor - should be a valid svg color (or "none" / "currentColor") or be one of [ "seriesIndex", "categoryIndex" ]: "#ZZZ"'
      ],
      warnings: []
    });
  });

  it('should validate a config object with an all section that specifies unique keys', () => {
    const mochartConfig = enhance({
      version: VERSION_STRING,
      categoryAxis: {
        property: "p"
      },
      seriesDefaults: {
        id: 'id',
        order: 'order'
      },
      series: []
    });
    expect(mochartConfig.validation).toEqual({
      valid: false,
      errors: [
        'seriesDefaults - id - unique properties cannot be set on an all config',
        'seriesDefaults - order - unique properties cannot be set on an all config'
      ],
      warnings: []
    });
  });

  it('names the defaults object without an entry index when the section has entries', () => {
    const mochartConfig = enhance({
      version: VERSION_STRING,
      categoryAxis: { property: 'c' },
      seriesDefaults: { id: 'id' },
      series: [{ property: 'p' }]
    });
    expect(mochartConfig.validation.errors).toEqual(['seriesDefaults - id - unique properties cannot be set on an all config']);
  });
});
// Regression: sole-id defaults read the raw section arrays, so ignored entries
// blocked the sole-entry semantics; and a fully-ignored list section built zero
// entries instead of falling back to defaults like an unspecified section.
// Regression: ignore was only excluded from patternDefaults, so ignore: true on any other *Defaults section
// validated, stamped every built entry with ignore: true and made getConfigWithoutDefaults drop the whole list
describe('ignore on a *Defaults section', () => {
  const base = { version: VERSION_STRING, categoryAxis: { property: 'g' }, series: [{ property: 'v' }] };
  const cases: [string, Record<string, unknown>][] = [
    ['seriesDefaults', { seriesDefaults: { ignore: true } }],
    ['valueAxisDefaults', { valueAxisDefaults: { ignore: true } }],
    ['seriesStackDefaults', { seriesStackDefaults: { ignore: true } }],
    ['seriesGroupDefaults', { seriesGroupDefaults: { ignore: true } }],
    ['linearGradientDefaults', { linearGradientDefaults: { ignore: true } }],
    ['radialGradientDefaults', { radialGradientDefaults: { ignore: true } }]
  ];
  for (const [section, overrides] of cases) {
    it(`rejects ignore on ${section}`, () => {
      const result = validateConfig({ ...base, ...overrides } as never);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(section + ' - ignore - entry-only properties cannot be set on an all config');
    });
  }
});

describe('ignored entries and sole-id defaults', () => {
  const base = { version: VERSION_STRING, categoryAxis: { property: 'g' } };

  it('an ignored second axis does not block the sole-axis default', () => {
    const mochartConfig = enhance({ ...base,
      series: [{ property: 'v' }],
      valueAxes: [{ id: 'a' }, { id: 'b', ignore: true }]
    });
    expect(mochartConfig.validation.valid).toBe(true);
    expect(mochartConfig.valueAxes.map(axisConfig => axisConfig.id)).toEqual(['a']);
    expect(mochartConfig.series[0].axis).toBe('a');
  });

  it('a fully-ignored axis section behaves like an unspecified one', () => {
    for (const valueAxisConfigs of [[{ id: 'X', ignore: true }], [], { id: 'X', ignore: true }]) {
      const mochartConfig = enhance({ ...base, series: [{ property: 'v' }], valueAxes: valueAxisConfigs });
      expect(mochartConfig.validation.valid).toBe(true);
      expect(mochartConfig.valueAxes.map(axisConfig => axisConfig.id)).toEqual(['VA0']);
      expect(mochartConfig.series[0].axis).toBe('VA0');
    }
  });

  // validateReferences used to run over the unfiltered raw list, so a disabled entry's dangling reference invalidated the whole config
  it('does not cross-reference-validate an ignored entry', () => {
    const mochartConfig = enhance({ ...base,
      series: [{ property: 'v', axis: 'main' }, { property: 'w', ignore: true, axis: 'nope' }],
      valueAxes: [{ id: 'main' }]
    });
    expect(mochartConfig.validation.errors).toEqual([]);
    expect(mochartConfig.validation.valid).toBe(true);
    expect(mochartConfig.series.map(seriesConfig => seriesConfig.property)).toEqual(['v']);
  });

  it('still reports a real dangling reference at its raw index', () => {
    const mochartConfig = enhance({ ...base,
      series: [{ property: 'v', ignore: true, axis: 'main' }, { property: 'w', axis: 'nope' }],
      valueAxes: [{ id: 'main' }]
    });
    // index 1 is where the offending entry sits in the user's own array, ignored entry included
    expect(mochartConfig.validation.errors).toEqual([
      'series[1] - axis - should equal the id property of one of the valueAxes: "nope"'
    ]);
  });

  it('an ignored second stack does not block the sole-stack default', () => {
    const mochartConfig = enhance({ ...base,
      series: [{ property: 'v' }, { property: 'w' }],
      seriesStacks: [{ id: 'st' }, { id: 'dead', ignore: true }]
    });
    expect(mochartConfig.validation.valid).toBe(true);
    expect(mochartConfig.series.map(seriesConfig => seriesConfig.stack)).toEqual(['st', 'st']);
  });

  it('two active axes still require an explicit value axis', () => {
    const mochartConfig = enhance({ ...base,
      series: [{ property: 'v' }],
      valueAxes: [{ id: 'a' }, { id: 'b' }]
    });
    expect(mochartConfig.validation.valid).toBe(false);
    expect(mochartConfig.validation.errors).toEqual(['series[0] - axis - should be a string: undefined']);
  });
});

// Regression: the single-object list-section shape merged only defaults +
// entry, dropping the *Defaults layer that the array shape applies.
describe('single-object sections with a *Defaults section', () => {
  const base = { version: VERSION_STRING, categoryAxis: { property: 'g' } };

  it('applies the all config to a single-object section like an array of one', () => {
    const single = enhance({ ...base, series: [{ property: 'v', axis: 'y' }],
      valueAxes: { id: 'y' }, valueAxisDefaults: { gridLine: { visible: true } } });
    expect(single.validation.valid).toBe(true);
    expect(single.valueAxes[0].gridLine.visible).toBe(true);
  });

  it('keeps conditional defaults consistent with the all config values', () => {
    const single = enhance({ ...base, series: { property: 'v' }, seriesDefaults: { renderer: 'bar' } });
    const array = enhance({ ...base, series: [{ property: 'v' }], seriesDefaults: { renderer: 'bar' } });
    expect(single.series[0].renderer).toBe('bar');
    expect(single.series[0].marker.shape).toBe(array.series[0].marker.shape);
  });

  it('applies gradient all configs to a single-object gradient section', () => {
    const single = enhance({ ...base, series: [{ property: 'v', renderer: 'area', gradient: 'lg' }],
      linearGradients: { id: 'lg' }, linearGradientDefaults: { x2: 0.25 } });
    expect(single.linearGradients[0].x2).toBe(0.25);
  });

  it('keeps the entry winning over the all config', () => {
    const single = enhance({ ...base, series: { property: 'v', renderer: 'area' }, seriesDefaults: { renderer: 'bar' } });
    expect(single.series[0].renderer).toBe('area');
  });
});

// Regression: the stack-axis map was keyed by raw axis ids, so a stack
// explicitly referencing a defaulted axis id (VA0) missed the base: 0 stacked
// default that the implicit reference received.
describe('stack referencing a defaulted axis id', () => {
  it('applies the stacked base default to the explicit VA0 reference', () => {
    const base = { version: VERSION_STRING, categoryAxis: { property: 'g' } };
    const explicit = enhance({ ...base,
      series: [{ property: 'a', stack: 'st' }, { property: 'b', stack: 'st' }],
      seriesStacks: [{ id: 'st', axis: 'VA0' }]
    });
    const implicit = enhance({ ...base,
      series: [{ property: 'a', stack: 'st' }, { property: 'b', stack: 'st' }],
      seriesStacks: [{ id: 'st' }]
    });
    expect(explicit.validation.valid).toBe(true);
    expect(explicit.valueAxes[0].base).toBe(0);
    expect(explicit.valueAxes[0].base).toBe(implicit.valueAxes[0].base);
  });
});

// Regression: order is meant to be an integer (the sorter coerces anything
// else to 0), but validation accepted any number, silently ignoring the value.
describe('non-integer order values', () => {
  it('rejects fractional orders instead of silently sorting them as 0', () => {
    const mochartConfig = enhance({
      version: VERSION_STRING,
      categoryAxis: { property: 'g' },
      series: [{ property: 'a', order: 1.5 }, { property: 'b', order: 0.5 }]
    });
    expect(mochartConfig.validation.valid).toBe(false);
    expect(mochartConfig.validation.errors.some(error =>
      error.includes('order') && error.includes('should be an integer'))).toBe(true);
  });

  it('sorts integer orders', () => {
    const mochartConfig = enhance({
      version: VERSION_STRING,
      categoryAxis: { property: 'g' },
      series: [{ property: 'a', order: 2 }, { property: 'b', order: 1 }]
    });
    expect(mochartConfig.validation.valid).toBe(true);
    expect(mochartConfig.series.map(seriesConfig => seriesConfig.id)).toEqual(['S1', 'S0']);
  });
});

// Regression: the id maps were plain {} objects, so ids and references named
// after Object.prototype members hit inherited values — a sole axis id of
// "constructor" crashed the build, and lookups returned functions.
describe('prototype-member-named ids', () => {
  it('accepts a prototype member name as an id end to end', () => {
    const mochartConfig = enhance({
      version: VERSION_STRING,
      categoryAxis: { property: 'g' },
      valueAxes: [{ id: 'constructor' }],
      series: [{ property: 'v' }]
    });
    expect(mochartConfig.validation.valid).toBe(true);
    expect(mochartConfig.series[0].axis).toBe('constructor');
  });

  it('reports (instead of crashing on) a reference naming a prototype member', () => {
    const mochartConfig = enhance({
      version: VERSION_STRING,
      categoryAxis: { property: 'g' },
      series: [{ property: 'v', axis: 'constructor' }]
    });
    expect(mochartConfig.validation.valid).toBe(false);
    expect(mochartConfig.validation.errors).toContainEqual(
      expect.stringContaining('axis - should equal the id property of one of the valueAxes'));
  });
});

// Regression: id/order/reference slots holding an object were String()-coerced by the uniqueness, reference
// and build maps; the deep clone makes them null-proto objects, so the coercion threw instead of the type error
describe('object-valued ids and references', () => {
  const base = { version: VERSION_STRING, categoryAxis: { property: 'g' } };
  const cases: [string, Record<string, unknown>, string][] = [
    ['valueAxes id', { valueAxes: [{ id: {} }], series: [{ property: 'v' }] }, 'valueAxes[0] - id - should be a string of letters'],
    ['series order', { series: [{ property: 'v', order: {} }] }, 'series[0] - order - should be an integer'],
    ['series axis', { series: [{ property: 'v', axis: {} }] }, 'series[0] - axis - should be a string'],
    ['series stack', { series: [{ property: 'v', stack: {} }] }, 'series[0] - stack - should be a string'],
    ['stack axis + group', { series: [{ property: 'v', stack: 'S', group: {} }], seriesStacks: [{ id: 'S', axis: {} }] }, 'seriesStacks[0] - axis - should be a string'],
    ['followSeries + id', { series: [{ property: 'v', id: {}, followSeries: {} }] }, 'series[0] - id - should be a string of letters']
  ];
  for (const [name, overrides, error] of cases) {
    it(`reports an object-valued ${name} instead of throwing`, () => {
      let mochartConfig: ReturnType<typeof enhance> | undefined;
      expect(() => { mochartConfig = enhance({ ...base, ...overrides }); }).not.toThrow();
      expect(mochartConfig!.validation.valid).toBe(false);
      expect(mochartConfig!.validation.errors).toContainEqual(expect.stringContaining(error));
    });
  }
});

// Regression: sections absent from the user config installed the defaults' own
// entry objects into the built config, so the reference wiring mutated the
// caller-supplied defaults and re-validating with them flipped valid to false.
describe('caller-supplied defaults immutability', () => {
  it('buildMochartConfig leaves the defaults untouched', () => {
    // no valueAxes/seriesStacks/seriesGroups sections — all come from the defaults
    const config = { version: VERSION_STRING, categoryAxis: { property: 'g' }, series: [{ property: 'v' }] };
    const defaults = getDefaults(config);
    const snapshot = JSON.parse(JSON.stringify(defaults));
    const validation = validateConfig(config, defaults as never);
    expect(validation.valid).toBe(true);
    buildMochartConfig(config, defaults as never, validation);
    expect(defaults).toEqual(snapshot);
    expect(validateConfig(config, defaults as never).valid).toBe(true);
  });
});

// an axis whose min is above its max would run backwards; `reversed` is the supported way to invert, so an inverted domain is a mistake rather than a spelling of it
describe('axis min/max bounds', () => {
  const base = { version: VERSION_STRING, series: [{ property: 'v' }] };
  const ordinal = { property: 'c', type: 'string', scale: 'ordinal' };

  it('rejects a value axis whose min is above its max', () => {
    const mochartConfig = enhance({ ...base, categoryAxis: ordinal, valueAxes: [{ min: 10, max: 0 }] });
    expect(mochartConfig.validation.errors).toEqual([
      'valueAxes[0] - min - should not be above the max property of the same axis: 0'
    ]);
  });

  it('accepts min === max, which auto already produces from flat data', () => {
    expect(enhance({ ...base, categoryAxis: ordinal, valueAxes: [{ min: 5, max: 5 }] }).validation.valid).toBe(true);
  });

  it('accepts an ordinary range, and one reversed with `reversed`', () => {
    expect(enhance({ ...base, categoryAxis: ordinal, valueAxes: [{ min: 0, max: 10 }] }).validation.valid).toBe(true);
    expect(enhance({ ...base, categoryAxis: ordinal, valueAxes: [{ min: 0, max: 10, reversed: true }] }).validation.valid).toBe(true);
  });

  it('skips the check when either bound is auto', () => {
    for (const valueAxis of [{ min: 10 }, { max: 0 }, { min: 10, max: 'auto' }, { min: 'auto', max: 0 }, {}]) {
      expect(enhance({ ...base, categoryAxis: ordinal, valueAxes: [valueAxis] }).validation.valid, JSON.stringify(valueAxis)).toBe(true);
    }
  });

  it('reports the offending axis at its own index', () => {
    const mochartConfig = enhance({ ...base,
      categoryAxis: ordinal,
      series: [{ property: 'v', axis: 'a' }],
      valueAxes: [{ id: 'a', min: 0, max: 10 }, { id: 'b', min: 9, max: 1 }]
    });
    expect(mochartConfig.validation.errors).toEqual([
      'valueAxes[1] - min - should not be above the max property of the same axis: 1'
    ]);
  });

  it('attributes an implicit-axis violation to valueAxisDefaults', () => {
    const mochartConfig = enhance({ ...base, categoryAxis: ordinal, valueAxisDefaults: { min: 10, max: 0 } });
    expect(mochartConfig.validation.errors).toEqual([
      'valueAxisDefaults - min - should not be above the max property of the same axis: 0'
    ]);
  });

  it('checks a numeric category axis', () => {
    const mochartConfig = enhance({ ...base,
      categoryAxis: { property: 'c', type: 'number', scale: 'linear', min: 10, max: 0 } });
    expect(mochartConfig.validation.errors).toEqual([
      'categoryAxis - min - should not be above the max property of the same axis: 0'
    ]);
  });

  it('does not date-parse string bounds on a non-date axis', () => {
    const mochartConfig = enhance({ ...base,
      categoryAxis: { property: 'c', type: 'number', scale: 'linear', min: '2020-06-01', max: 0 } });
    // the type error stands alone — no bounds comparison against a date-parsed string
    expect(mochartConfig.validation.errors).toHaveLength(1);
    expect(mochartConfig.validation.errors[0]).toContain('categoryAxis - min');
  });

  it('compares date bounds by their instant, not their text', () => {
    const dateAxis = (min: string, max: string) => enhance({ ...base,
      categoryAxis: { property: 'c', type: 'date', scale: 'linear', min, max } });
    expect(dateAxis('2020-06-01', '2020-01-01').validation.errors).toEqual([
      'categoryAxis - min - should not be above the max property of the same axis: "2020-01-01"'
    ]);
    expect(dateAxis('2020-01-01', '2020-06-01').validation.valid).toBe(true);
    expect(dateAxis('2020-01-01', '2020-01-01').validation.valid).toBe(true);
  });
});
