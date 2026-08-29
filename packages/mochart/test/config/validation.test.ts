import { describe, it, expect } from 'vitest';
import validateConfig, {
  getReferenceMessage,
  getCommonReferenceMessage,
  validateConfigDetailed
} from '../../src/config/validation/mochartConfig';
import { getAxisBoundsMessage } from '../../src/config/validation/axisConfig';
import { boundValue } from '../../src/config/validation/validators';
import { getDefaults } from '../../src/config/defaults/mochartConfig';
import { getConfigWithDefaults } from '../../src/config/core/mochartConfig';

const V = '1.0.0';

// Run the raw validator (input + derived defaults) the way enhanceConfig does,
// and return just the errors for assertion.
function errorsFor(config: unknown): string[] {
  const defaults = getDefaults(config as never);
  return validateConfig(config, defaults as never).errors;
}

function detailedFor(config: unknown) {
  const defaults = getDefaults(config as never);
  return validateConfigDetailed(config, defaults as never);
}

describe('validation message helpers', () => {

  it('getReferenceMessage names a single source section', () => {
    expect(getReferenceMessage('valueAxes', 'id'))
      .toBe('should equal the id property of one of the valueAxes');
  });

  it('getReferenceMessage joins multiple source sections with "or"', () => {
    expect(getReferenceMessage(['linearGradients', 'radialGradients'], 'id'))
      .toBe('should equal the id property of one of the linearGradients or radialGradients');
  });

  it('getCommonReferenceMessage mentions the shared property', () => {
    expect(getCommonReferenceMessage('seriesStacks', 'id', 'axis'))
      .toBe('should equal the id property of one of the seriesStacks that has the same axis property');
  });
});

describe('reference validation', () => {
  it('flags a value axis reference that matches no axis', () => {
    expect(errorsFor({ version: V, categoryAxis: { property: 'p' }, series: [{ property: 'a', axis: 'nope' }] }))
      .toContain('series[0] - axis - should equal the id property of one of the valueAxes: "nope"');
  });

  it('flags a gradient reference against the combined gradient sections', () => {
    expect(errorsFor({ version: V, categoryAxis: { property: 'p' }, series: [{ property: 'a', renderer: 'area', gradient: 'nope' }] }))
      .toContain('series[0] - gradient - should equal the id property of one of the linearGradients or radialGradients: "nope"');
  });

  it('accepts a value axis reference that resolves', () => {
    const errors = errorsFor({
      version: V,
      categoryAxis: { property: 'p' },
      valueAxes: [{ id: 'A' }],
      series: [{ property: 'a', axis: 'A' }]
    });
    expect(errors).toEqual([]);
  });

  // Regression: the sources map was a plain {}, so an id of "__proto__" could
  // never be stored and every reference to it was reported unresolved.
  it('accepts a reference to a source id of "__proto__"', () => {
    const errors = errorsFor({
      version: V,
      categoryAxis: { property: 'p' },
      valueAxes: [{ id: '__proto__' }],
      series: [{ property: 'a', axis: '__proto__' }]
    });
    expect(errors).toEqual([]);
  });
});

describe('common-reference validation', () => {
  it('flags a series whose stack lives on a different axis', () => {
    const errors = errorsFor({
      version: V,
      categoryAxis: { property: 'p' },
      valueAxes: [{ id: 'A' }, { id: 'B' }],
      seriesStacks: [{ id: 'S', axis: 'A' }],
      series: [{ property: 'a', stack: 'S', axis: 'B' }]
    });
    expect(errors).toContain(
      'series[0] - stack - should equal the id property of one of the seriesStacks that has the same axis property: "A" vs "B"'
    );
  });

  it('accepts a series whose stack shares its axis', () => {
    const errors = errorsFor({
      version: V,
      categoryAxis: { property: 'p' },
      valueAxes: [{ id: 'A' }],
      seriesStacks: [{ id: 'S', axis: 'A' }],
      series: [{ property: 'a', stack: 'S', axis: 'A' }]
    });
    expect(errors).toEqual([]);
  });

  it('flags a defaulted stack whose axis conflicts with an explicit value axis', () => {
    // stack is omitted, so the sole-stack default assigns 'S'; the conflict
    // only exists on the built entry (defaulted stack + explicit axis)
    const errors = errorsFor({
      version: V,
      categoryAxis: { property: 'p' },
      valueAxes: [{ id: 'A' }, { id: 'B' }],
      seriesStacks: [{ id: 'S', axis: 'A' }],
      series: [{ property: 'a', axis: 'B' }]
    });
    expect(errors).toContain(
      'series[0] - stack - should equal the id property of one of the seriesStacks that has the same axis property: "A" vs "B"'
    );
  });

  it('flags a stack/axis conflict inherited from seriesDefaults', () => {
    const errors = errorsFor({
      version: V,
      categoryAxis: { property: 'p' },
      valueAxes: [{ id: 'A' }, { id: 'B' }],
      seriesStacks: [{ id: 'S', axis: 'A' }],
      seriesDefaults: { axis: 'B' },
      series: [{ property: 'a', stack: 'S' }]
    });
    expect(errors).toContain(
      'series[0] - stack - should equal the id property of one of the seriesStacks that has the same axis property: "A" vs "B"'
    );
  });
});

// Regression: ids were unique per gradient list only, so a linear and a radial gradient sharing an id both
// validated and resolved for the same series (radial fill, linear swatch)
describe('gradient id validation across both lists', () => {
  const stops = [{ offset: 0, color: '#000000', opacity: 1 }, { offset: 1, color: '#ffffff', opacity: 1 }];

  it('flags an id shared by a linear and a radial gradient on both entries', () => {
    const errors = errorsFor({ version: V, categoryAxis: { property: 'p' }, series: [{ property: 'a', renderer: 'bar', gradient: 'G' }],
      linearGradients: [{ id: 'G', stops }], radialGradients: [{ id: 'H', stops }, { id: 'G', stops }] });
    expect(errors).toContain('linearGradients[0] - id - should be unique across linearGradients and radialGradients: "G"');
    expect(errors).toContain('radialGradients[1] - id - should be unique across linearGradients and radialGradients: "G"');
    expect(errors.filter(error => error.includes('across'))).toHaveLength(2);
  });

  it('reports at the raw index past an ignored entry and accepts distinct ids', () => {
    const errors = errorsFor({ version: V, categoryAxis: { property: 'p' }, series: [{ property: 'a', renderer: 'bar', gradient: 'G' }],
      linearGradients: [{ id: 'G', stops }], radialGradients: [{ ignore: true, id: 'X', stops }, { id: 'G', stops }] });
    expect(errors).toContain('radialGradients[1] - id - should be unique across linearGradients and radialGradients: "G"');
    expect(errorsFor({ version: V, categoryAxis: { property: 'p' }, series: [{ property: 'a', renderer: 'bar', gradient: 'G' }],
      linearGradients: [{ id: 'G', stops }], radialGradients: [{ id: 'H', stops }] })).toEqual([]);
  });
});

describe('id character validation', () => {
  const stops = [{ offset: 0, color: '#000000', opacity: 1 }, { offset: 1, color: '#ffffff', opacity: 1 }];
  const message = 'should be a string of letters, digits, dashes and underscores';

  it('flags a gradient id holding characters that url(#...) cannot carry', () => {
    for (const id of ['brand (blue)', 'has space', 'quote"id', 'semi;id']) {
      expect(errorsFor({ version: V, categoryAxis: { property: 'p' }, series: [{ property: 'a', renderer: 'bar', gradient: id }],
        linearGradients: [{ id, stops }] })).toContain(`linearGradients[0] - id - ${message}: ${JSON.stringify(id)}`);
    }
  });

  it('flags an unsafe id in every section that mints one', () => {
    const errors = errorsFor({ version: V, categoryAxis: { property: 'p' },
      valueAxes: [{ id: 'va 0' }],
      series: [{ id: 's 0', property: 'a', renderer: 'bar', axis: 'va 0', stack: 'ss 0', group: 'sg 0' }],
      seriesStacks: [{ id: 'ss 0', axis: 'va 0' }],
      seriesGroups: [{ id: 'sg 0' }],
      patterns: [{ id: 'p 0', type: 'dots' }] });
    for (const location of ['valueAxes[0]', 'series[0]', 'seriesStacks[0]', 'seriesGroups[0]', 'patterns[0]']) {
      expect(errors).toContainEqual(expect.stringContaining(`${location} - id - ${message}`));
    }
  });

  it('accepts letters, digits, dashes and underscores', () => {
    expect(errorsFor({ version: V, categoryAxis: { property: 'p' }, series: [{ property: 'a', renderer: 'bar', gradient: 'brand-blue_2' }],
      linearGradients: [{ id: 'brand-blue_2', stops }] })).toEqual([]);
  });
});

// Only the bar branch of Series.sync draws per-category colors, so a colorProperty anywhere else
// silently drew the flat series color while the legend swatch still showed the ramp.
describe('colorProperty renderer validation', () => {
  const colorSeries = (renderer: string, pie = false) => ({
    version: V, ...(pie ? { chart: { type: 'pie' } } : {}), categoryAxis: { property: 'p' },
    series: [{ property: 'a', renderer, colorProperty: 'temp' }]
  });
  const message = 'colorProperty - should be equal to null when chart type is not xy or renderer is not bar, or colorScale is null: "temp"';

  it('accepts colorProperty on a bar series', () => {
    expect(errorsFor(colorSeries('bar'))).toEqual([]);
  });

  it('rejects colorProperty on every other renderer', () => {
    for (const renderer of ['line', 'area', 'none']) {
      expect(errorsFor(colorSeries(renderer))).toContain(`series[0] - ${message}`);
    }
  });

  it('rejects colorProperty on a pie slice, which never draws it either', () => {
    expect(errorsFor(colorSeries('bar', true))).toContain(`series[0] - ${message}`);
  });

  // the colorScale members are gated on colorProperty being set, so an accompanying ramp does not pile on
  it('reports the colorProperty once, with no cascade from its colorScale', () => {
    expect(errorsFor({
      version: V, categoryAxis: { property: 'p' },
      series: [{ property: 'a', renderer: 'line', colorProperty: 'temp', colorScale: { min: '#0000ff', max: '#ff0000' } }]
    })).toEqual([`series[0] - ${message}`]);
  });

  // an explicit null and a group of nulls are the same absent ramp, so both are rejected alongside a colorProperty
  it('rejects a colorProperty whose colorScale is null', () => {
    expect(errorsFor({
      version: V, categoryAxis: { property: 'p' },
      series: [{ property: 'a', renderer: 'bar', colorProperty: 'temp', colorScale: null }]
    })).toEqual([`series[0] - ${message}`]);
  });

  it('rejects a colorProperty whose colorScale members are all null', () => {
    const errors = errorsFor({
      version: V, categoryAxis: { property: 'p' },
      series: [{ property: 'a', renderer: 'bar', colorProperty: 'temp', colorScale: { interpolation: null, min: null, max: null } }]
    });
    expect(errors).toContainEqual(expect.stringContaining('series[0] - colorScale.min - should be a valid color'));
  });

  it('resolves the colorScale to null on a series that draws none', () => {
    const config = {
      version: V, categoryAxis: { property: 'p' },
      series: [{ property: 'a', renderer: 'line' }, { property: 'b', renderer: 'bar' }]
    };
    const withDefaults = getConfigWithDefaults(config, getDefaults(config)) as Record<string, Record<string, unknown>[]>;
    expect(withDefaults.series[0].colorScale).toBeNull();
    expect(withDefaults.series[1].colorScale).not.toBeNull();
  });

  // and a ramp without a colorProperty was already rejected, on any renderer
  it('still rejects a colorScale with no colorProperty', () => {
    expect(errorsFor({
      version: V, categoryAxis: { property: 'p' },
      series: [{ property: 'a', renderer: 'line', colorScale: { min: '#0000ff', max: '#ff0000' } }]
    })).toContainEqual(expect.stringContaining('series[0] - colorScale.min - should be equal to null when colorProperty is null'));
  });
});

describe('unique-key validation', () => {
  it('flags duplicate series ids at both offending indices', () => {
    const errors = errorsFor({
      version: V,
      categoryAxis: { property: 'p' },
      series: [{ property: 'a', id: 'X' }, { property: 'b', id: 'X' }]
    });
    expect(errors).toEqual(expect.arrayContaining([
      'series[0] - id - should be unique: "X"',
      'series[1] - id - should be unique: "X"'
    ]));
  });

  it('flags duplicate value axis ids', () => {
    const errors = errorsFor({
      version: V,
      categoryAxis: { property: 'p' },
      valueAxes: [{ id: 'A' }, { id: 'A' }],
      series: [{ property: 'a', axis: 'A' }]
    });
    expect(errors).toEqual(expect.arrayContaining([
      'valueAxes[0] - id - should be unique: "A"',
      'valueAxes[1] - id - should be unique: "A"'
    ]));
  });

  // Regression: the seen map was a plain {}, so a single entry with an
  // Object.prototype member name as its id was reported as a duplicate.
  it('does not flag a sole prototype-member-named id as a duplicate', () => {
    const errors = errorsFor({
      version: V,
      categoryAxis: { property: 'p' },
      valueAxes: [{ id: 'constructor' }],
      seriesStacks: [{ id: 'toString' }],
      series: [{ property: 'a', id: 'valueOf' }]
    });
    expect(errors.filter(error => error.includes('should be unique'))).toEqual([]);
  });

  it('still flags real duplicates of prototype-member-named ids', () => {
    const errors = errorsFor({
      version: V,
      categoryAxis: { property: 'p' },
      series: [{ property: 'a', id: 'constructor' }, { property: 'b', id: 'constructor' }]
    });
    expect(errors).toContainEqual(expect.stringContaining('should be unique: "constructor"'));
  });
});

// Regression: JSON.parse creates __proto__ as an own key; the message builders
// resolved it against Object.prototype and crashed invoking it as a validator.
describe('prototype-key config validation', () => {
  it('does not crash on a JSON-owned top-level __proto__ key', () => {
    const config = JSON.parse(
      `{"version":"${V}","categoryAxis":{"property":"p"},"series":[{"property":"a"}],"__proto__":{"polluted":true}}`);
    expect(() => detailedFor(config)).not.toThrow();
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('does not crash on a JSON-owned __proto__ key inside a section or list entry', () => {
    const config = JSON.parse(
      `{"version":"${V}","categoryAxis":{"property":"p","__proto__":{"polluted":true}},` +
      '"series":[{"property":"a","__proto__":{"polluted":true}}]}');
    expect(() => detailedFor(config)).not.toThrow();
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

// Regression: an explicit undefined member was validated as a wrong value and again as missing, so a
// config the merge treats as "not specified" failed strict validation
describe('explicit undefined members', () => {
  it('read as not specified, in an entry, an all-config and a top-level section', () => {
    expect(errorsFor({ version: V, categoryAxis: { property: 'c' }, series: [{ property: 'p', marker: { shape: undefined } }] })).toEqual([]);
    expect(errorsFor({ version: V, categoryAxis: { property: 'c' }, seriesDefaults: { renderer: undefined }, series: [{ property: 'p' }] })).toEqual([]);
    expect(errorsFor({ version: V, categoryAxis: { property: 'c' }, chart: { type: undefined }, series: [{ property: 'p' }] })).toEqual([]);
    expect(errorsFor({ version: V, categoryAxis: { property: 'c' }, valueAxes: [{ min: undefined }], series: [{ property: 'p' }] })).toEqual([]);
  });

  it('still reports a required member set to undefined as missing, once', () => {
    const errors = errorsFor({ version: V, categoryAxis: { property: undefined }, series: [{ property: 'p' }] });
    expect(errors.filter(error => error.includes('categoryAxis') && error.includes('property'))).toHaveLength(1);
  });
});

// Regression: all-config values were validated only under the first entry's conditional rules, so a
// seriesDefaults gradient (or errorLowProperty, colorScale) that a later entry's renderer/stack forbids passed
describe('all-config values under later entries\' conditional rules', () => {
  it('reports a seriesDefaults gradient a later line series cannot take, once', () => {
    const errors = errorsFor({
      version: V, categoryAxis: { property: 'c' },
      linearGradients: [{ id: 'LG0', stops: [{ offset: 0, color: 'red', opacity: 1 }, { offset: 1, color: 'blue', opacity: 1 }] }],
      seriesDefaults: { gradient: 'LG0' },
      series: [{ property: 'p', renderer: 'bar' }, { property: 'q', renderer: 'line' }, { property: 'r', renderer: 'line' }]
    });
    const gradientErrors = errors.filter(error => error.includes('gradient'));
    expect(gradientErrors).toHaveLength(1);
    expect(gradientErrors[0]).toMatch(/^seriesDefaults - gradient/);
  });

  it('does not report an inherited value the entry itself overrides', () => {
    expect(errorsFor({
      version: V, categoryAxis: { property: 'c' },
      linearGradients: [{ id: 'LG0', stops: [{ offset: 0, color: 'red', opacity: 1 }, { offset: 1, color: 'blue', opacity: 1 }] }],
      seriesDefaults: { gradient: 'LG0' },
      series: [{ property: 'p', renderer: 'bar' }, { property: 'q', renderer: 'line', gradient: null }]
    })).toEqual([]);
  });
});

describe('non-strict validation', () => {
  it('treats warnings as acceptable when strict is false', () => {
    // an unknown extra property produces a warning, not an error
    const config = { version: V, categoryAxis: { property: 'p' }, unknownExtra: 1 };
    const defaults = getDefaults(config as never);
    const strict = validateConfig(config, defaults as never, true);
    const lenient = validateConfig(config, defaults as never, false);
    expect(strict.warnings.length).toBeGreaterThan(0);
    expect(strict.valid).toBe(false);
    expect(lenient.valid).toBe(true);
  });
});

describe('icon size config validation', () => {
  it('accepts automatic or numeric tooltip icon sizes and rejects other strings', () => {
    expect(errorsFor({
      version: V,
      categoryAxis: { property: 'p' },
      tooltip: { icon: { size: 'auto' } }
    })).toEqual([]);
    expect(errorsFor({
      version: V,
      categoryAxis: { property: 'p' },
      tooltip: { icon: { size: 20 } }
    })).toEqual([]);
    expect(errorsFor({
      version: V,
      categoryAxis: { property: 'p' },
      tooltip: { icon: { size: 'large' } }
    })).toContain('tooltip - icon.size - should be a number >= to 0 or be equal to "auto": "large"');
  });

  it('accepts automatic or numeric legend icon sizes and rejects other strings', () => {
    expect(errorsFor({
      version: V,
      categoryAxis: { property: 'p' },
      legend: { icon: { size: 'auto' } }
    })).toEqual([]);
    expect(errorsFor({
      version: V,
      categoryAxis: { property: 'p' },
      legend: { icon: { size: 20 } }
    })).toEqual([]);
    expect(errorsFor({
      version: V,
      categoryAxis: { property: 'p' },
      legend: { icon: { size: 'large' } }
    })).toContain('legend - icon.size - should be a number >= to 0 or be equal to "auto": "large"');
  });
});

describe('detailed validation', () => {
  it('keeps the legacy result shape unchanged', () => {
    const config = { version: V, categoryAxis: { property: 'p' } };
    const defaults = getDefaults(config as never);
    expect(Object.keys(validateConfig(config, defaults as never))).toEqual(['valid', 'errors', 'warnings']);
  });

  it('adds a precise path for a section property error', () => {
    const config = {
      version: V,
      categoryAxis: { property: 'p' },
      series: [{ property: 'a', axis: 'missing' }]
    };
    expect(detailedFor(config).diagnostics).toContainEqual(expect.objectContaining({
      path: ['series', 0, 'axis'],
      severity: 'error',
      source: 'mochart',
      message: 'should equal the id property of one of the valueAxes: "missing"'
    }));
  });

  it('reports unknown top-level properties as a root warning', () => {
    const config = { version: V, categoryAxis: { property: 'p' }, unknownExtra: true };
    expect(detailedFor(config).diagnostics).toContainEqual(expect.objectContaining({
      path: [],
      severity: 'warning',
      source: 'mochart'
    }));
  });

  it('locates a root type error at the document root', () => {
    expect(detailedFor(null).diagnostics).toEqual([
      {
        path: [],
        severity: 'error',
        message: 'should be an object: null',
        source: 'mochart'
      }
    ]);
  });

  it('locates warnings on the relevant list entry', () => {
    const config = {
      version: V,
      categoryAxis: { property: 'p' },
      series: [{ property: 'a', unknownExtra: true }]
    };
    expect(detailedFor(config).diagnostics).toContainEqual({
      path: ['series', 0],
      severity: 'warning',
      message: 'had 1 invalid property: unknownExtra',
      invalidProperties: ['unknownExtra'],
      source: 'mochart'
    });
  });

  it('locates every duplicate value independently', () => {
    const config = {
      version: V,
      categoryAxis: { property: 'p' },
      series: [{ property: 'a', id: 'X' }, { property: 'b', id: 'X' }]
    };
    const paths = detailedFor(config).diagnostics
      .filter(diagnostic => diagnostic.message === 'should be unique: "X"')
      .map(diagnostic => diagnostic.path);
    expect(paths).toEqual([
      ['series', 0, 'id'],
      ['series', 1, 'id']
    ]);
  });

  it('locates all-config properties without a synthetic list index', () => {
    const config = {
      version: V,
      categoryAxis: { property: 'p' },
      seriesDefaults: { id: 'shared' },
      series: [{ property: 'a' }]
    };
    expect(detailedFor(config).diagnostics).toContainEqual({
      path: ['seriesDefaults', 'id'],
      severity: 'error',
      message: 'unique properties cannot be set on an all config',
      source: 'mochart'
    });
  });

  it('locates a common-reference error at the target property', () => {
    const config = {
      version: V,
      categoryAxis: { property: 'p' },
      valueAxes: [{ id: 'A' }, { id: 'B' }],
      seriesStacks: [{ id: 'S', axis: 'A' }],
      series: [{ property: 'a', stack: 'S', axis: 'B' }]
    };
    expect(detailedFor(config).diagnostics).toContainEqual(expect.objectContaining({
      path: ['series', 0, 'stack'],
      severity: 'error',
      source: 'mochart'
    }));
  });
});

describe('pie chart config validation', () => {
  it('accepts a valid pie config with a pieConfig section', () => {
    const errors = errorsFor({
      version: V,
      chart: { type: 'pie' },
      pie: { innerRadiusFraction: 0.6, startAngle: 45, label: { visible: true, type: 'percent' } },
      categoryAxis: { property: 'p' },
      series: [{ property: 'a' }, { property: 'b' }]
    });
    expect(errors).toEqual([]);
  });

  it('flags an unknown chartConfig.type', () => {
    const errors = errorsFor({ version: V, chart: { type: 'radar' }, categoryAxis: { property: 'p' } });
    expect(errors.some(error => error.startsWith('chart - type - '))).toBe(true);
  });

  it('flags out-of-range pieConfig percent values', () => {
    const errors = errorsFor({
      version: V,
      chart: { type: 'pie' },
      pie: { innerRadiusFraction: 1.5, label: { minFraction: -1 } },
      categoryAxis: { property: 'p' }
    });
    expect(errors.some(error => error.startsWith('pie - innerRadiusFraction - '))).toBe(true);
    expect(errors.some(error => error.startsWith('pie - label.minFraction - '))).toBe(true);
  });

  it('flags an unknown pie label.type', () => {
    const errors = errorsFor({
      version: V,
      chart: { type: 'pie' },
      pie: { label: { type: 'nope' } },
      categoryAxis: { property: 'p' }
    });
    expect(errors.some(error => error.startsWith('pie - label.type - '))).toBe(true);
  });
});

// Regression: list-section validation paired built (filtered) entries with the raw array by position,
// so an ignore:true entry shifted later entries onto the wrong index — garbage passed, ignored entries errored.
describe('list-section validation with ignored entries', () => {
  it('validates entries after an ignored entry at their raw index', () => {
    const errors = errorsFor({
      version: V,
      categoryAxis: { property: 'g' },
      series: [{ ignore: true, property: 'x' }, { renderer: 'bogus', property: 'v', marker: { size: -5 } }]
    });
    expect(errors.some(error => error.startsWith('series[1] - renderer - '))).toBe(true);
    expect(errors.some(error => error.startsWith('series[1] - marker.size - '))).toBe(true);
    expect(errors.some(error => error.startsWith('series[0]'))).toBe(false);
  });

  it('does not validate ignored entries', () => {
    const errors = errorsFor({
      version: V,
      categoryAxis: { property: 'g' },
      series: [{ ignore: true, property: null }, { property: 'v' }]
    });
    expect(errors).toEqual([]);
  });

  // the single-object shorthand entry is "as though not specified" too, so its references are not cross-checked
  it('does not reference-check an ignored shorthand entry', () => {
    const shorthand = errorsFor({ version: V, categoryAxis: { property: 'c' }, series: { ignore: true, axis: 'nope', property: 'x' } });
    const listed = errorsFor({ version: V, categoryAxis: { property: 'c' }, series: [{ ignore: true, axis: 'nope', property: 'x' }] });
    expect(shorthand).toEqual([]);
    expect(listed).toEqual([]);
    expect(errorsFor({ version: V, categoryAxis: { property: 'c' }, series: { axis: 'nope', property: 'x' } })
      .some(error => error.includes('axis'))).toBe(true);
  });

  it('locates diagnostics after an ignored entry at the raw index', () => {
    const config = {
      version: V,
      categoryAxis: { property: 'g' },
      series: [{ ignore: true, property: 'x' }, { renderer: 'bogus', property: 'v' }]
    };
    expect(detailedFor(config).diagnostics).toContainEqual(expect.objectContaining({
      path: ['series', 1, 'renderer'],
      severity: 'error'
    }));
  });

  // Regression: with no entries the all-config was validated bare, so a rule conditioned on a defaulted
  // member (stack, renderer) read undefined and picked the wrong branch
  it('validates an all-config without entries against the entry defaults', () => {
    const seriesDefaults = { errorLowProperty: 'e', renderer: 'bar' };
    const empty = errorsFor({ version: V, categoryAxis: { property: 'c' }, seriesDefaults, series: [] });
    const listed = errorsFor({ version: V, categoryAxis: { property: 'c' }, seriesDefaults, series: [{ property: 'v' }] });
    expect(listed).toEqual([]);
    expect(empty).toEqual([]);
    // a rule that does hold for the built entry still fires
    expect(errorsFor({ version: V, categoryAxis: { property: 'c' }, seriesDefaults: { renderer: 'bogus' }, series: [] })
      .some(error => error.startsWith('seriesDefaults - renderer - '))).toBe(true);
  });

  it('still runs once-per-section all-config checks when the first entry is ignored', () => {
    const errors = errorsFor({
      version: V,
      categoryAxis: { property: 'g' },
      valueAxisDefaults: { id: 'shared' },
      valueAxes: [{ ignore: true, id: 'dead' }, { id: 'y' }],
      series: [{ property: 'v', axis: 'y' }]
    });
    expect(errors.some(error => error.includes('unique properties cannot be set on an all config'))).toBe(true);
  });
});

// Regression: movalid's object() accepts arrays, so a list-section array with
// invalid entries slipped past both halves of the shape guard unreported.
describe('list-section shape validation', () => {
  it('flags a list-section array containing a non-object entry', () => {
    const errors = errorsFor({
      version: V,
      categoryAxis: { property: 'g' },
      series: [{ property: 'v' }, 'garbage']
    });
    expect(errors).toContainEqual(expect.stringContaining('series - should be an array with elements that should be an object'));
  });

  it('flags a list section given an array of non-objects', () => {
    const errors = errorsFor({
      version: V,
      categoryAxis: { property: 'g' },
      valueAxes: ['x'],
      series: [{ property: 'v' }]
    });
    expect(errors).toContainEqual(expect.stringContaining('valueAxes - should be an array with elements that should be an object'));
  });

  it('still tolerates the single-object list-section shorthand', () => {
    const errors = errorsFor({
      version: V,
      categoryAxis: { property: 'g' },
      seriesGroups: {},
      series: [{ property: 'v' }]
    });
    expect(errors).toEqual([]);
  });

  it('flags an array given as a list-section entry', () => {
    const errors = errorsFor({
      version: V,
      categoryAxis: { property: 'g' },
      series: [{ property: 'v' }, []]
    });
    expect(errors).toContainEqual(expect.stringContaining('series - should be an array with elements that should be an object'));
  });

  it('still tolerates an empty array as an unspecified section', () => {
    const errors = errorsFor({
      version: V,
      categoryAxis: { property: 'g' },
      valueAxes: [],
      series: [{ property: 'v' }]
    });
    expect(errors).toEqual([]);
  });

  it('flags an array given as a *Defaults section', () => {
    const errors = errorsFor({
      version: V,
      categoryAxis: { property: 'g' },
      seriesDefaults: [],
      series: [{ property: 'v' }]
    });
    expect(errors).toContainEqual(expect.stringContaining('seriesDefaults - should be an object'));
  });
});

// Regression: the tooltip drop-shadow offsets rejected negative values, though
// negative css box-shadow offsets (shadow cast up/left) are legitimate.
describe('tooltip drop-shadow validation', () => {
  const base = { version: V, categoryAxis: { property: 'p' }, series: [{ property: 'v' }] };

  it('accepts negative shadow offsets', () => {
    expect(errorsFor({ ...base, tooltip: { dropShadow: { offsetX: -3, offsetY: -5 } } })).toEqual([]);
  });

  it('still rejects a negative blur radius', () => {
    expect(errorsFor({ ...base, tooltip: { dropShadow: { blurRadius: -1 } } }))
      .toContainEqual(expect.stringContaining('dropShadow.blurRadius'));
  });
});

// An ordinal axis has no value scale to place a threshold on.
describe('ordinal-scale thresholds validation', () => {
  const base = { version: V, series: [{ property: 'v' }] };

  it('rejects thresholds on an ordinal category axis', () => {
    expect(errorsFor({ ...base, categoryAxis: { property: 'p', thresholds: [{ value: 5 }] } }))
      .toContainEqual(expect.stringContaining('thresholds - should be an empty array when scale is ordinal'));
  });

  it('accepts thresholds on a linear category axis', () => {
    expect(errorsFor({ ...base, categoryAxis: { property: 'p', type: 'number', scale: 'linear', thresholds: [{ value: 5 }] } }))
      .toEqual([]);
  });

  it('accepts an empty thresholds array on an ordinal category axis', () => {
    expect(errorsFor({ ...base, categoryAxis: { property: 'p', thresholds: [] } }))
      .toEqual([]);
  });

  // a threshold value takes the axis's own primitive: a date string on a number axis would silently draw nothing
  it('rejects a date string threshold value on a number category axis and on a value axis', () => {
    expect(errorsFor({ ...base, categoryAxis: { property: 'p', type: 'number', scale: 'linear', thresholds: [{ value: '2020-01-01' }] } }))
      .toContainEqual(expect.stringContaining('thresholds'));
    expect(errorsFor({ ...base, categoryAxis: { property: 'p' }, valueAxes: [{ thresholds: [{ value: '2020-01-01' }] }] }))
      .toContainEqual(expect.stringContaining('thresholds'));
  });

  it('accepts a date string threshold value on a date category axis', () => {
    expect(errorsFor({ ...base, categoryAxis: { property: 'p', type: 'date', scale: 'linear', thresholds: [{ value: '2020-01-01' }] } }))
      .toEqual([]);
  });
});

// Regression: margin/padding (and categoryPaddingFraction) demanded all their keys at once, though
// nested configs deep-merge over their defaults and the DeepPartial input type promises partial objects.
describe('partial spacing validation', () => {
  const base = { version: V, categoryAxis: { property: 'p' }, series: [{ property: 'v' }] };

  it('accepts partial margin, padding, and categoryPaddingFraction objects', () => {
    const errors = errorsFor({
      ...base,
      chart: { margin: { top: 10 } },
      tooltip: { padding: { left: 4 } },
      categoryAxis: { property: 'p', categoryPaddingFraction: { inner: 0.5 } }
    });
    expect(errors).toEqual([]);
  });

  it('accepts a palette entry with only one color list', () => {
    const errors = errorsFor({
      ...base,
      colorPalette: { shape: { normal: { strokeColors: ['#336699'] } } }
    });
    expect(errors).toEqual([]);
  });

  it('still rejects invalid spacing member values', () => {
    expect(errorsFor({ ...base, chart: { margin: { top: -1 } } }))
      .toContainEqual(expect.stringContaining('margin'));
    expect(errorsFor({ ...base, categoryAxis: { property: 'p', categoryPaddingFraction: { inner: 2 } } }))
      .toContainEqual(expect.stringContaining('categoryPaddingFraction'));
  });

  it('reports an unknown spacing member as a warning only, not an error', () => {
    const detailed = detailedFor({ ...base, chart: { margin: { tpo: 1 } } });
    expect(detailed.errors.filter(error => error.includes('margin'))).toEqual([]);
    expect(detailed.warnings.some(warning => warning.includes('margin'))).toBe(true);
  });
});

// The null contract: plain styles accept null members (leave the svg attribute unset), while style
// states keep colors/opacities concrete (no css bleed-through, interpolable focus); widths and dash arrays stay nullable.
describe('style null semantics', () => {
  const base = { version: V, categoryAxis: { property: 'p' } };

  it('accepts null members on a plain style', () => {
    const errors = errorsFor({ ...base, chart: { backgroundStyle: { strokeColor: null, fillOpacity: null } }, series: [{ property: 'v' }] });
    expect(errors).toEqual([]);
  });

  it('accepts a null stroke width on axis and series style states', () => {
    const errors = errorsFor({
      ...base,
      categoryAxis: { property: 'p', axisLine: { style: { normal: { strokeWidth: null } } } },
      series: [{ property: 'v', shapeStyle: { normal: { strokeWidth: null }, focused: { strokeWidth: null } } }]
    });
    expect(errors).toEqual([]);
  });

  it('rejects null style-state colors on axis and series', () => {
    expect(errorsFor({ ...base, categoryAxis: { property: 'p', axisLine: { style: { normal: { strokeColor: null } } } }, series: [{ property: 'v' }] }))
      .toContainEqual(expect.stringContaining('strokeColor'));
    expect(errorsFor({ ...base, series: [{ property: 'v', shapeStyle: { normal: { fillColor: null } } }] }))
      .toContainEqual(expect.stringContaining('fillColor'));
  });

  it('rejects null style-state opacities', () => {
    expect(errorsFor({ ...base, series: [{ property: 'v', shapeStyle: { normal: { fillOpacity: null } } }] }))
      .toContainEqual(expect.stringContaining('fillOpacity'));
  });

  // Regression: the showColorInLegend/showColorInTooltip conditional defaults read shapeStyle.normal
  // unguarded, so a non-object shapeStyle threw from getDefaults before the validator could report it.
  it.each([null, 'red', [], { normal: null }])('reports a non-object series shapeStyle %j instead of throwing', shapeStyle => {
    expect(errorsFor({ ...base, series: [{ property: 'v', shapeStyle }] }))
      .toContainEqual(expect.stringContaining('shapeStyle'));
    expect(errorsFor({ ...base, seriesDefaults: { shapeStyle }, series: [{ property: 'v' }] }))
      .toContainEqual(expect.stringContaining('shapeStyle'));
  });
});

// Regression: curve alone used the exact-shape validator, so { param } (type from the default) was
// rejected and unknown members were hard errors instead of the single unknown-key warning.
describe('series curve validation', () => {
  it('accepts param on the two curve types that read it', () => {
    for (const type of ['cardinal', 'catmullRom']) {
      expect(errorsFor({ version: V, categoryAxis: { property: 'p' }, series: [{ property: 'a', curve: { type, param: 0.5 } }] }))
        .toEqual([]);
    }
  });

  it('rejects param on a curve type that ignores it, including the linear default', () => {
    // the eight other types have no tension/alpha configurator, so param would silently do nothing
    expect(errorsFor({ version: V, categoryAxis: { property: 'p' }, series: [{ property: 'a', curve: { type: 'step', param: 0.5 } }] }))
      .toContainEqual(expect.stringContaining('curve.param'));
    // an omitted type defaults to linear, which is one of the eight
    expect(errorsFor({ version: V, categoryAxis: { property: 'p' }, series: [{ property: 'a', curve: { param: 0.5 } }] }))
      .toContainEqual(expect.stringContaining('curve.param'));
    expect(errorsFor({ version: V, categoryAxis: { property: 'p' }, series: [{ property: 'a', curve: { type: 'step' } }] }))
      .toEqual([]);
  });

  it('still rejects invalid curve member values', () => {
    expect(errorsFor({ version: V, categoryAxis: { property: 'p' }, series: [{ property: 'a', curve: { type: 'bogus' } }] }))
      .toContainEqual(expect.stringContaining('curve'));
    expect(errorsFor({ version: V, categoryAxis: { property: 'p' }, series: [{ property: 'a', curve: { param: 2 } }] }))
      .toContainEqual(expect.stringContaining('curve'));
  });

  it('reports an unknown curve member as a warning only, not an error', () => {
    const detailed = detailedFor({
      version: V,
      categoryAxis: { property: 'p' },
      series: [{ property: 'a', curve: { typo: 1 } }]
    });
    expect(detailed.errors.filter(error => error.includes('curve'))).toEqual([]);
    expect(detailed.warnings.some(warning => warning.includes('curve'))).toBe(true);
  });
});

// a follower must not itself be followed: self-references, cycles and chains all
// lose the keyboard tab stop and report a leader's id from onSeriesClick
describe('followSeries depth validation', () => {
  const withSeries = (series: unknown[]) => errorsFor({ version: V, categoryAxis: { property: 'p' }, series });
  const followError = expect.stringContaining('does not itself set followSeries');

  it('accepts the intended shape: several followers on one leader', () => {
    expect(withSeries([
      { id: 'a', property: 'a' },
      { id: 'b', property: 'b', followSeries: 'a' },
      { id: 'c', property: 'c', followSeries: 'a' }
    ])).toEqual([]);
  });

  it('rejects a series following itself', () => {
    expect(withSeries([{ id: 'a', property: 'a', followSeries: 'a' }])).toContainEqual(followError);
  });

  it('rejects a cycle', () => {
    const errors = withSeries([
      { id: 'a', property: 'a', followSeries: 'b' },
      { id: 'b', property: 'b', followSeries: 'a' }
    ]);
    expect(errors.filter(error => error.includes('does not itself set followSeries'))).toHaveLength(2);
  });

  it('rejects a chain, whose tail never reaches the head', () => {
    expect(withSeries([
      { id: 'a', property: 'a' },
      { id: 'b', property: 'b', followSeries: 'a' },
      { id: 'c', property: 'c', followSeries: 'b' }
    ])).toContainEqual(followError);
  });

  it('still rejects a followSeries naming no series at all', () => {
    expect(withSeries([{ id: 'a', property: 'a', followSeries: 'ghost' }]))
      .toContainEqual(expect.stringContaining('followSeries'));
  });
});

// a stack's members must share a group: sub-slots are assigned per group, so a stack spanning
// two groups would accumulate values across different columns
describe('stack group validation', () => {
  const stackGroupError = expect.stringContaining('whose series all share this series\' group property');
  const withSeries = (series: unknown[], seriesStacks: unknown[] = [{ id: 'A' }]) => errorsFor({
    version: V, categoryAxis: { property: 'p' }, seriesGroups: [{ id: 'g1' }, { id: 'g2' }], seriesStacks, series
  });

  it('accepts one stack per group', () => {
    expect(withSeries([
      { id: 's1', property: 'a', stack: 'A', group: 'g1' },
      { id: 's2', property: 'b', stack: 'A', group: 'g1' },
      { id: 's3', property: 'c', stack: 'B', group: 'g2' },
      { id: 's4', property: 'd', stack: 'B', group: 'g2' }
    ], [{ id: 'A' }, { id: 'B' }])).toEqual([]);
  });

  it('accepts a stack whose members are all ungrouped', () => {
    expect(errorsFor({
      version: V, categoryAxis: { property: 'p' }, seriesStacks: [{ id: 'A' }],
      series: [{ id: 's1', property: 'a' }, { id: 's2', property: 'b' }]
    })).toEqual([]);
  });

  it('rejects a stack spanning two groups, reporting the later member', () => {
    const errors = withSeries([
      { id: 's1', property: 'a', stack: 'A', group: 'g1' },
      { id: 'other', property: 'b', stack: null, group: 'g2' },
      { id: 's2', property: 'c', stack: 'A', group: 'g2' }
    ]);
    expect(errors).toEqual([expect.stringContaining('series[2] - stack')]);
    expect(errors).toContainEqual(stackGroupError);
  });

  it('rejects a grouped member alongside an ungrouped one', () => {
    expect(withSeries([
      { id: 's1', property: 'a', stack: 'A', group: null },
      { id: 's2', property: 'b', stack: 'A', group: 'g1' }
    ])).toContainEqual(stackGroupError);
  });

  it('catches the defaulted case: a sole stack fills in on series spread across groups', () => {
    expect(withSeries([
      { id: 's1', property: 'a', group: 'g1' },
      { id: 's2', property: 'b', group: 'g2' }
    ])).toContainEqual(stackGroupError);
  });
});

// Regression: uniqueness was checked on the raw config and the defaults separately, so an explicit
// id colliding with another entry's defaulted id passed and collapsed the id-lookup maps.
describe('merged unique-key validation', () => {
  it('flags an explicit id colliding with a defaulted id', () => {
    const errors = errorsFor({
      version: V,
      categoryAxis: { property: 'p' },
      series: [{ property: 'a', id: 'S1' }, { property: 'b' }]
    });
    expect(errors).toEqual(expect.arrayContaining([
      'series[0] - id - should be unique: "S1"',
      'series[1] - id - should be unique: "S1"'
    ]));
  });

  it('does not count ignored entries toward uniqueness', () => {
    const errors = errorsFor({
      version: V,
      categoryAxis: { property: 'p' },
      series: [{ property: 'a', id: 'X', ignore: true }, { property: 'b', id: 'X' }]
    });
    expect(errors).toEqual([]);
  });

  it('reports raw indices when an ignored entry shifts the section', () => {
    const errors = errorsFor({
      version: V,
      categoryAxis: { property: 'p' },
      series: [{ ignore: true, property: 'x' }, { property: 'a', id: 'X' }, { property: 'b', id: 'X' }]
    });
    expect(errors).toEqual(expect.arrayContaining([
      'series[1] - id - should be unique: "X"',
      'series[2] - id - should be unique: "X"'
    ]));
  });
});

// Regression: an array as the root config validated fully valid because the
// error branch re-checked with movalid's object(), which accepts arrays.
describe('non-object root configs', () => {
  it('rejects an array root config with an error', () => {
    const result = detailedFor([{ version: V }]);
    expect(result.valid).toBe(false);
    expect(result.diagnostics.length).toBeGreaterThan(0);
    expect(result.diagnostics[0].message).toContain('should be an object');
  });
});

// Regression: the dash-array pattern was unanchored, so any string containing
// a digit passed.
describe('dash array validation', () => {
  it('rejects non-dash-array strings containing digits', () => {
    const errors = errorsFor({
      version: V,
      categoryAxis: { property: 'p', gridLine: { visible: true, style: { normal: { strokeDashArray: 'abc5' } } } },
      series: [{ property: 'a' }]
    });
    expect(errors.some(error => error.includes('strokeDashArray'))).toBe(true);
  });

  it('accepts comma- and space-separated dash arrays', () => {
    for (const dashArray of ['5,3', '5, 3', '6 3', '0.5, 2', '5 , 3']) {
      const errors = errorsFor({
        version: V,
        categoryAxis: { property: 'p', gridLine: { visible: true, style: { normal: { strokeDashArray: dashArray } } } },
        series: [{ property: 'a' }]
      });
      expect(errors).toEqual([]);
    }
  });

  it("accepts 'same' for focus-state width and dash but not on the normal state", () => {
    const valid = errorsFor({
      version: V,
      categoryAxis: { property: 'p', gridLine: { visible: true, style: { focused: { strokeWidth: 'same', strokeDashArray: 'same' } } } },
      series: [{ property: 'a' }]
    });
    expect(valid).toEqual([]);
    const invalid = errorsFor({
      version: V,
      categoryAxis: { property: 'p', gridLine: { visible: true, style: { normal: { strokeWidth: 'same' } } } },
      series: [{ property: 'a' }]
    });
    expect(invalid.some(error => error.includes('strokeWidth'))).toBe(true);
  });
});

// valueDomainChange/categoryDomainChange are closed enums: staged | combined | auto
describe('animation domain change validation', () => {
  const withAnimation = (animation: unknown) => ({
    version: V,
    categoryAxis: { property: 'p' },
    series: [{ property: 'a' }],
    animation
  });

  it('accepts each mode on both properties', () => {
    for (const mode of ['auto', 'combined', 'staged']) {
      expect(errorsFor(withAnimation({ valueDomainChange: mode }))).toEqual([]);
      expect(errorsFor(withAnimation({ categoryDomainChange: mode }))).toEqual([]);
    }
  });

  it('rejects an unknown mode on either property', () => {
    expect(errorsFor(withAnimation({ valueDomainChange: 'sideways' })).some(error => error.includes('valueDomainChange'))).toBe(true);
    expect(errorsFor(withAnimation({ categoryDomainChange: 'sideways' })).some(error => error.includes('categoryDomainChange'))).toBe(true);
  });
});

describe('axis bounds validation', () => {
  const BOUNDS = 'should not be above the max property of the same axis: ';
  const withValueAxes = (valueAxes: unknown, valueAxisDefaults?: unknown) => ({
    version: V,
    categoryAxis: { property: 'p' },
    series: [{ property: 'a' }],
    valueAxes,
    ...(valueAxisDefaults === undefined ? {} : { valueAxisDefaults })
  });
  const withCategoryAxis = (categoryAxis: unknown) => ({ version: V, categoryAxis, series: [{ property: 'a' }] });
  const boundsErrors = (config: unknown) => errorsFor(config).filter(error => error.includes(BOUNDS));

  it('getAxisBoundsMessage quotes the max it was compared against', () => {
    expect(getAxisBoundsMessage('max', 5)).toBe(BOUNDS + '5');
    expect(getAxisBoundsMessage('max', '2020-01-01')).toBe(BOUNDS + '"2020-01-01"');
  });

  // Regression: the soft pair was never cross-checked, and softMin above softMax silently inverts an auto domain
  it('reports softMin above softMax, on softMin, wherever the pair can be authored', () => {
    const SOFT = 'should not be above the softMax property of the same axis: ';
    const softErrors = (config: unknown) => errorsFor(config).filter(error => error.includes(SOFT));
    expect(softErrors(withValueAxes([{ id: 'A', softMin: 100, softMax: 0 }]))).toEqual([
      'valueAxes[0] - softMin - ' + SOFT + '0'
    ]);
    expect(softErrors(withValueAxes([{ id: 'A' }], { softMin: 100, softMax: 0 })).length).toBe(1);
    expect(softErrors(withCategoryAxis({ property: 'p', type: 'number', scale: 'linear', softMin: 100, softMax: 0 })).length).toBe(1);
  });

  it('accepts a legal or one-sided soft pair', () => {
    const SOFT = 'should not be above the softMax property of the same axis: ';
    const softErrors = (config: unknown) => errorsFor(config).filter(error => error.includes(SOFT));
    expect(softErrors(withValueAxes([{ id: 'A', softMin: 0, softMax: 100 }]))).toEqual([]);
    expect(softErrors(withValueAxes([{ id: 'A', softMin: 5, softMax: 5 }]))).toEqual([]);
    expect(softErrors(withValueAxes([{ id: 'A', softMin: 100 }]))).toEqual([]);
    expect(softErrors(withValueAxes([{ id: 'A', softMin: 100, softMax: null }]))).toEqual([]);
  });

  describe('boundValue', () => {
    it('takes finite numbers on any axis and rejects non-finite ones', () => {
      expect(boundValue(5, false)).toBe(5);
      expect(boundValue(-2.5, true)).toBe(-2.5);
      expect(boundValue(Infinity, false)).toBeNull();
      expect(boundValue(NaN, true)).toBeNull();
    });

    it('reads Date objects and parseable strings only on a date axis', () => {
      const date = new Date('2020-06-01T00:00:00Z');
      expect(boundValue(date, true)).toBe(date.getTime());
      expect(boundValue('2020-06-01T00:00:00Z', true)).toBe(date.getTime());
      expect(boundValue(date, false)).toBeNull();
      expect(boundValue('2020-06-01T00:00:00Z', false)).toBeNull();
    });

    it('leaves invalid dates, unparseable strings and other types to the type rules', () => {
      expect(boundValue(new Date('nope'), true)).toBeNull();
      expect(boundValue('not a date', true)).toBeNull();
      expect(boundValue(null, true)).toBeNull();
      expect(boundValue({ time: 1 }, true)).toBeNull();
    });
  });

  it('flags a value axis whose min is above its max, at the min property', () => {
    const config = withValueAxes([{ id: 'A', min: 10, max: 5 }]);
    expect(errorsFor(config)).toEqual(['valueAxes[0] - min - ' + BOUNDS + '5']);
    expect(detailedFor(config).diagnostics).toContainEqual(expect.objectContaining({
      path: ['valueAxes', 0, 'min'], severity: 'error', message: BOUNDS + '5'
    }));
  });

  it('accepts min below max, and min equal to max as auto bounds on flat data produce it', () => {
    expect(errorsFor(withValueAxes([{ id: 'A', min: 5, max: 10 }]))).toEqual([]);
    expect(errorsFor(withValueAxes([{ id: 'A', min: 5, max: 5 }]))).toEqual([]);
    expect(errorsFor(withValueAxes([{ id: 'A', min: -1, max: -1 }]))).toEqual([]);
  });

  it('skips the comparison while either end is auto', () => {
    expect(errorsFor(withValueAxes([{ id: 'A', min: 10, max: 'auto' }]))).toEqual([]);
    expect(errorsFor(withValueAxes([{ id: 'A', min: 'auto', max: -10 }]))).toEqual([]);
    expect(errorsFor(withValueAxes([{ id: 'A', min: 10 }]))).toEqual([]);
  });

  it('checks every authored value axis independently', () => {
    const errors = errorsFor({
      ...withValueAxes([{ id: 'A', min: 0, max: 1 }, { id: 'B', min: 3, max: 2 }, { id: 'C', min: 9, max: 8 }]),
      series: [{ property: 'a', axis: 'A' }]
    });
    expect(errors).toEqual([
      'valueAxes[1] - min - ' + BOUNDS + '2',
      'valueAxes[2] - min - ' + BOUNDS + '8'
    ]);
  });

  it('reports at the raw index when an earlier entry is ignored', () => {
    const config = withValueAxes([{ ignore: true, id: 'dead' }, { id: 'A', min: 10, max: 5 }]);
    expect(errorsFor(config)).toEqual(['valueAxes[1] - min - ' + BOUNDS + '5']);
    expect(detailedFor(config).diagnostics).toContainEqual(expect.objectContaining({ path: ['valueAxes', 1, 'min'] }));
  });

  it('reports the implicit value axis against valueAxisDefaults', () => {
    const expectDefaultsError = (config: unknown) => {
      expect(errorsFor(config)).toEqual(['valueAxisDefaults - min - ' + BOUNDS + '5']);
      expect(detailedFor(config).diagnostics).toContainEqual(expect.objectContaining({
        path: ['valueAxisDefaults', 'min'], severity: 'error', message: BOUNDS + '5'
      }));
    };
    // no valueAxes at all, an empty list, and a list of only ignored entries all leave the implicit axis
    expectDefaultsError({ version: V, categoryAxis: { property: 'p' }, series: [{ property: 'a' }], valueAxisDefaults: { min: 10, max: 5 } });
    expectDefaultsError(withValueAxes([], { min: 10, max: 5 }));
    expectDefaultsError(withValueAxes([{ ignore: true, id: 'dead' }], { min: 10, max: 5 }));
  });

  it('reports authored axes that inherit bad bounds from valueAxisDefaults at their own index', () => {
    const errors = errorsFor({ ...withValueAxes([{ id: 'A' }, { id: 'B', min: 0 }], { min: 10, max: 5 }), series: [{ property: 'a', axis: 'A' }] });
    // B overrides min and is fine; A inherits both ends and is reported on the list, not the defaults
    expect(errors).toEqual(['valueAxes[0] - min - ' + BOUNDS + '5']);
  });

  it('flags a linear number category axis with min above max', () => {
    const config = withCategoryAxis({ property: 'p', type: 'number', scale: 'linear', min: 10, max: 5 });
    expect(errorsFor(config)).toEqual(['categoryAxis - min - ' + BOUNDS + '5']);
    expect(detailedFor(config).diagnostics).toContainEqual(expect.objectContaining({ path: ['categoryAxis', 'min'] }));
    expect(errorsFor(withCategoryAxis({ property: 'p', type: 'number', scale: 'linear', min: 5, max: 5 }))).toEqual([]);
  });

  it('compares date category axis bounds given as timestamps or ISO strings, in either mix', () => {
    // the date rule takes epoch numbers and iso strings (Date objects fail it), so those are the config-level forms
    const dateAxis = (min: unknown, max: unknown) => withCategoryAxis({ property: 'p', type: 'date', scale: 'linear', min, max });
    const early = '2020-01-01T00:00:00.000Z';
    const late = '2021-01-01T00:00:00.000Z';
    const earlyTime = new Date(early).getTime();
    const lateTime = new Date(late).getTime();

    expect(errorsFor(dateAxis(lateTime, earlyTime))).toEqual(['categoryAxis - min - ' + BOUNDS + earlyTime]);
    expect(errorsFor(dateAxis(late, early))).toEqual(['categoryAxis - min - ' + BOUNDS + '"' + early + '"']);
    expect(errorsFor(dateAxis(late, earlyTime))).toEqual(['categoryAxis - min - ' + BOUNDS + earlyTime]);
    expect(errorsFor(dateAxis(lateTime, early))).toEqual(['categoryAxis - min - ' + BOUNDS + '"' + early + '"']);
    // in order, and the same instant in two forms, both stay legal
    expect(errorsFor(dateAxis(early, late))).toEqual([]);
    expect(errorsFor(dateAxis(earlyTime, late))).toEqual([]);
    expect(errorsFor(dateAxis(early, earlyTime))).toEqual([]);
  });

  it('adds no bounds error on top of a type error for an unreadable bound', () => {
    // a string on a number axis and an unparseable string on a date axis both fail their type rule alone
    expect(boundsErrors(withValueAxes([{ id: 'A', min: '2021-01-01', max: 5 }]))).toEqual([]);
    expect(errorsFor(withValueAxes([{ id: 'A', min: '2021-01-01', max: 5 }])).some(error => error.startsWith('valueAxes[0] - min - '))).toBe(true);
    expect(boundsErrors(withCategoryAxis({ property: 'p', type: 'date', scale: 'linear', min: 'later', max: '2020-01-01' }))).toEqual([]);
    expect(boundsErrors(withCategoryAxis({ property: 'p', type: 'date', scale: 'linear', min: new Date('nope'), max: 0 }))).toEqual([]);
  });
});
