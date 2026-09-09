import { describe, expect, it } from 'vitest';
import { enhanceConfig } from '../../src/config/helper';
import type { MochartInputConfig } from '../../src/types/config';
import type { EnhancedMochartConfig } from '../../src/types/enhanced';

const base = {
  version: '1.0.0',
  categoryAxis: { property: 'c' },
  series: [{ property: 'v', renderer: 'bar' }]
};

const enhance = (config: unknown) => enhanceConfig(config as MochartInputConfig) as EnhancedMochartConfig;

describe('built-in pattern config', () => {
  it('applies common and type-specific defaults', () => {
    const config = enhance({ ...base, patterns: [
      { type: 'lines' },
      { type: 'crosshatch' },
      { type: 'dots' }
    ] });

    expect(config.validation).toEqual({ valid: true, errors: [], warnings: [] });
    expect(config.patterns).toEqual([
      expect.objectContaining({ id: 'P0', type: 'lines', spacing: 8, rotation: 45, lineWidth: 2,
        foregroundColor: 'series', foregroundOpacity: 1, backgroundColor: null, backgroundOpacity: 1 }),
      expect.objectContaining({ id: 'P1', type: 'crosshatch', spacing: 8, rotation: 45, lineWidth: 2 }),
      expect.objectContaining({ id: 'P2', type: 'dots', spacing: 8, radius: 2 })
    ]);
    expect(config.patterns[0]).not.toHaveProperty('radius');
    expect(config.patterns[2]).not.toHaveProperty('rotation');
    expect(config.patterns[2]).not.toHaveProperty('lineWidth');
  });

  it('applies common patternDefaults to every type', () => {
    const config = enhance({ ...base,
      patternDefaults: { spacing: 12, foregroundColor: 'currentColor', backgroundColor: 'var(--pattern-bg)' },
      patterns: [{ type: 'lines' }, { type: 'dots' }]
    });

    expect(config.validation.valid).toBe(true);
    expect(config.patterns.map(pattern => pattern.spacing)).toEqual([12, 12]);
    expect(config.patterns.map(pattern => pattern.foregroundColor)).toEqual(['currentColor', 'currentColor']);
  });

  it('rejects type-specific and entry-only properties in patternDefaults', () => {
    const config = enhance({ ...base,
      patternDefaults: { type: 'dots', radius: 3 },
      patterns: [{ type: 'dots' }]
    });

    expect(config.validation.errors).toEqual(expect.arrayContaining([
      expect.stringContaining('patternDefaults - type - entry-only properties cannot be set on an all config'),
      expect.stringContaining('patternDefaults - radius - entry-only properties cannot be set on an all config')
    ]));
  });

  it('rejects properties belonging to a different pattern type', () => {
    const config = enhance({ ...base, patterns: [{ type: 'dots', lineWidth: 2 }] });
    expect(config.validation.errors).toContain(
      'patterns[0] - lineWidth - should be equal to undefined when type is dots: 2'
    );
  });

  it('accepts svg colors, currentColor, series, and a null background', () => {
    const config = enhance({ ...base, patterns: [{
      type: 'lines', foregroundColor: 'series', backgroundColor: null
    }, {
      type: 'dots', foregroundColor: 'currentColor', backgroundColor: 'oklch(0.7 0.1 200)'
    }] });
    expect(config.validation).toEqual({ valid: true, errors: [], warnings: [] });
  });

  it('defaults a sole pattern, supports opt-out, and leaves pattern/gradient combinations explicit', () => {
    const sole = enhance({ ...base, patterns: [{ id: 'hatch', type: 'lines' }] });
    expect(sole.series[0].pattern).toBe('hatch');
    expect(sole.series[0].patternConfig).toBe(sole.patterns[0]);

    const optedOut = enhance({ ...base,
      patterns: [{ id: 'hatch', type: 'lines' }],
      series: [{ property: 'v', renderer: 'bar', pattern: null }]
    });
    expect(optedOut.series[0].pattern).toBeNull();
    expect(optedOut.series[0].patternConfig).toBeUndefined();

    const mixed = enhance({ ...base,
      patterns: [{ id: 'hatch', type: 'lines' }],
      linearGradients: [{ id: 'fade', stops: [{ offset: 0, color: '#000', opacity: 1 }] }]
    });
    expect(mixed.series[0].pattern).toBeNull();
    expect(mixed.series[0].gradient).toBeNull();
  });

  it('does not automatically apply patterns or gradients to incompatible series', () => {
    const line = enhance({ ...base,
      patterns: [{ type: 'lines' }],
      series: [{ property: 'v', renderer: 'line' }]
    });
    expect(line.validation.valid).toBe(true);
    expect(line.series[0].pattern).toBeNull();

    const colorProperty = enhance({ ...base,
      linearGradients: [{ stops: [{ offset: 0, color: '#000', opacity: 1 }] }],
      series: [{ property: 'v', renderer: 'bar', colorProperty: 'color' }]
    });
    expect(colorProperty.validation.valid).toBe(true);
    expect(colorProperty.series[0].gradient).toBeNull();
  });

  it('rejects patterns and gradients on non-fill renderers', () => {
    const pattern = enhance({ ...base,
      patterns: [{ id: 'hatch', type: 'lines' }],
      series: [{ property: 'v', renderer: 'line', pattern: 'hatch' }]
    });
    expect(pattern.validation.errors).toContain(
      'series[0] - pattern - should be equal to null when chart type is not pie and renderer is not area or bar: "hatch"'
    );

    const gradient = enhance({ ...base,
      linearGradients: [{ id: 'fade', stops: [{ offset: 0, color: '#000', opacity: 1 }] }],
      series: [{ property: 'v', renderer: 'none', gradient: 'fade' }]
    });
    expect(gradient.validation.errors).toContain(
      'series[0] - gradient - should be equal to null when chart type is not pie and renderer is not area or bar: "fade"'
    );
  });

  it('allows patterns and gradients on pie slices regardless of series renderer', () => {
    const pattern = enhance({ ...base,
      chart: { type: 'pie' },
      patterns: [{ id: 'hatch', type: 'lines' }],
      series: [{ property: 'v', renderer: 'line', pattern: 'hatch' }]
    });
    expect(pattern.validation.valid).toBe(true);

    const gradient = enhance({ ...base,
      chart: { type: 'pie' },
      linearGradients: [{ id: 'fade', stops: [{ offset: 0, color: '#000', opacity: 1 }] }],
      series: [{ property: 'v', renderer: 'none', gradient: 'fade' }]
    });
    expect(gradient.validation.valid).toBe(true);
  });

  // Regression: a categoryIndex fill colors each bar from the palette, which used to silently
  // overwrite the gradient reference the same series asked for
  it('rejects a gradient when a shapeStyle fillColor is categoryIndex', () => {
    for (const state of ['normal', 'focused', 'defocused']) {
      const gradient = enhance({ ...base,
        linearGradients: [{ id: 'fade', stops: [{ offset: 0, color: '#000', opacity: 1 }] }],
        series: [{ property: 'v', renderer: 'bar', gradient: 'fade', shapeStyle: { [state]: { fillColor: 'categoryIndex' } } }]
      });
      expect(gradient.validation.errors).toContain(
        'series[0] - gradient - should be equal to null when a shapeStyle fillColor is categoryIndex: "fade"'
      );
    }
  });

  it('does not adopt the sole gradient for a series whose fill is categoryIndex', () => {
    const gradient = enhance({ ...base,
      linearGradients: [{ id: 'fade', stops: [{ offset: 0, color: '#000', opacity: 1 }] }],
      series: [{ property: 'v', renderer: 'bar', shapeStyle: { normal: { fillColor: 'categoryIndex' } } }]
    });
    expect(gradient.validation.valid).toBe(true);
    expect(gradient.series[0].gradient).toBeNull();
  });

  it('still adopts the sole gradient when only the stroke is categoryIndex', () => {
    const gradient = enhance({ ...base,
      linearGradients: [{ id: 'fade', stops: [{ offset: 0, color: '#000', opacity: 1 }] }],
      series: [{ property: 'v', renderer: 'bar', shapeStyle: { normal: { strokeColor: 'categoryIndex' } } }]
    });
    expect(gradient.validation.valid).toBe(true);
    expect(gradient.series[0].gradient).toBe('fade');
  });

  it('rejects gradients but permits patterns when colorProperty is set', () => {
    const gradient = enhance({ ...base,
      linearGradients: [{ id: 'fade', stops: [{ offset: 0, color: '#000', opacity: 1 }] }],
      series: [{ property: 'v', renderer: 'bar', colorProperty: 'color', gradient: 'fade' }]
    });
    expect(gradient.validation.errors).toContain(
      'series[0] - gradient - should be equal to null when colorProperty is not null: "fade"'
    );

    const pattern = enhance({ ...base,
      patterns: [{ id: 'dots', type: 'dots' }],
      series: [{ property: 'v', renderer: 'bar', colorProperty: 'color', pattern: 'dots' }]
    });
    expect(pattern.validation.valid).toBe(true);
  });

  it('validates spacing, rotation, opacity, and radius bounds', () => {
    const config = enhance({ ...base, patterns: [
      { type: 'lines', spacing: 0, rotation: 400, foregroundOpacity: 2 },
      { type: 'dots', radius: -1 }
    ] });

    expect(config.validation.valid).toBe(false);
    expect(config.validation.errors).toEqual(expect.arrayContaining([
      expect.stringContaining('patterns[0] - spacing -'),
      expect.stringContaining('patterns[0] - rotation -'),
      expect.stringContaining('patterns[0] - foregroundOpacity -'),
      expect.stringContaining('patterns[1] - radius -')
    ]));
  });

  it('reports patternDefaults entry-only errors once regardless of entry count', () => {
    const config = enhance({ ...base,
      patternDefaults: { type: 'dots' },
      patterns: [{ type: 'dots' }, { type: 'dots' }, { type: 'lines' }]
    });

    const entryOnlyErrors = config.validation.errors
      .filter(error => error.includes('entry-only properties cannot be set on an all config'));
    expect(entryOnlyErrors).toHaveLength(1);
  });

  it('rejects dangling pattern references and series that specify both pattern and gradient', () => {
    const dangling = enhance({ ...base, series: [{ property: 'v', renderer: 'bar', pattern: 'missing' }] });
    expect(dangling.validation.errors).toContain(
      'series[0] - pattern - should equal the id property of one of the patterns: "missing"'
    );

    const both = enhance({ ...base,
      patterns: [{ id: 'hatch', type: 'lines' }],
      linearGradients: [{ id: 'fade', stops: [{ offset: 0, color: '#000', opacity: 1 }] }],
      series: [{ property: 'v', pattern: 'hatch', gradient: 'fade' }]
    });
    expect(both.validation.errors.some(error => error.startsWith('series[0] - pattern -'))).toBe(true);
  });
});
