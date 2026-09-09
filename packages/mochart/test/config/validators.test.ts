import { describe, it, expect } from 'vitest';
import configValidators from '../../src/config/validation/validators';

// The config validators wrap movalid; a validator returns true when the value
// is acceptable. These tests pin the mochart-specific validators only.

describe('svgColor', () => {
  const validate = configValidators.svgColor();

  it('accepts hex and rgb colors and the keywords "none" and "currentColor"', () => {
    expect(validate('#fff')).toBe(true);
    expect(validate('#ffffff')).toBe(true);
    expect(validate('rgb(1,2,3)')).toBe(true);
    expect(validate('none')).toBe(true);
    expect(validate('currentColor')).toBe(true);
  });

  // an svg color goes straight to a dom attribute, so the browser is the authority
  it('accepts every css color form, including ones d3-color predates', () => {
    for (const value of ['red', 'rebeccapurple', 'transparent', '#ff000080', 'rgb(255 0 0)',
      'rgb(100%,0%,0%)', 'hsl(200,50%,50%)', 'hsl(200 50% 50%)', 'oklch(0.7 0.1 200)',
      'lab(50% 40 59.5)', 'color(display-p3 1 0 0)', 'var(--brand)']) {
      expect(validate(value), value).toBe(true);
    }
  });

  it('rejects malformed colors', () => {
    expect(validate('#WWW')).toBe(false);
    expect(validate('not-a-color')).toBe(false);
    expect(validate('')).toBe(false);
    expect(validate(42)).toBe(false);
  });
});

describe('cssColor', () => {
  const validate = configValidators.cssColor();

  it('accepts hex and rgb colors and the keyword "currentColor"', () => {
    expect(validate('#fff')).toBe(true);
    expect(validate('rgba(0,0,0,0.3)')).toBe(true);
    expect(validate('currentColor')).toBe(true);
  });

  it('rejects "none", which is not a css color', () => {
    // in a css declaration 'none' is dropped as invalid, it does not switch the style off
    expect(validate('none')).toBe(false);
  });

  it('accepts named, hsl and modern-space colors', () => {
    for (const value of ['red', 'hsl(200,50%,50%)', 'oklch(0.7 0.1 200)', 'var(--brand)']) {
      expect(validate(value), value).toBe(true);
    }
  });

  it('rejects malformed colors', () => {
    expect(validate('#WWW')).toBe(false);
    expect(validate('not-a-color')).toBe(false);
  });
});

// the ramp bounds are handed to d3 scale ranges, so they must stay parseable by d3-color — no keywords or css-only forms
describe('color (series color-scale bounds)', () => {
  const validate = configValidators.color();

  it('accepts anything d3-color can interpolate', () => {
    for (const value of ['red', 'rebeccapurple', '#f00', '#ff000080', 'rgb(1,2,3)',
      'rgba(0,0,0,0.3)', 'hsl(200,50%,50%)', 'transparent']) {
      expect(validate(value), value).toBe(true);
    }
  });

  it('rejects keywords and css forms d3-color cannot resolve to a value', () => {
    for (const value of ['currentColor', 'none', 'var(--brand)', 'oklch(0.7 0.1 200)', 'not-a-color', '']) {
      expect(validate(value), value).toBe(false);
    }
  });
});

describe('cssStyle', () => {
  const validate = configValidators.cssStyle();

  it('accepts a partial style with currentColor', () => {
    expect(validate({ fillColor: 'currentColor' })).toBe(true);
    expect(validate({ strokeColor: 'rgba(0,0,0,0.3)', strokeWidth: 2 })).toBe(true);
    expect(validate({ fillColor: null })).toBe(true);
  });

  it('rejects "none" in either color member', () => {
    expect(validate({ fillColor: 'none' })).toBe(false);
    expect(validate({ strokeColor: 'none' })).toBe(false);
  });
});

describe('dashArray', () => {
  const validate = configValidators.dashArray();

  it('accepts comma-separated numbers', () => {
    expect(validate('5, 5')).toBe(true);
    expect(validate('4')).toBe(true);
  });

  it('accepts decimals and mixed comma/whitespace separators', () => {
    expect(validate('0.5, 2')).toBe(true);
    expect(validate('.5 2.25')).toBe(true);
    expect(validate('5 , 3')).toBe(true);
    expect(validate(' 5,3 ')).toBe(true);
  });

  it('rejects non-numeric dash arrays and malformed separators', () => {
    expect(validate('dash')).toBe(false);
    expect(validate('5,,3')).toBe(false);
    expect(validate('5,')).toBe(false);
    expect(validate('5.')).toBe(false);
    expect(validate('5px 3px')).toBe(false);
  });
});

describe('numberFormat', () => {
  const validate = configValidators.numberFormat();

  it('accepts valid d3 format specifiers', () => {
    expect(validate('$,.2f')).toBe(true);
    expect(validate('.0%')).toBe(true);
  });

  it('rejects invalid specifiers', () => {
    expect(validate('nonsense!!')).toBe(false);
  });

  // Regression: the transcribed d3 regex lacked the trim group, rejecting the core's own auto format
  it('accepts the d3 trim flag', () => {
    expect(validate('~s')).toBe(true);
    expect(validate('.3~f')).toBe(true);
    expect(validate('~~s')).toBe(false);
  });

  it('agrees with d3-format on a sweep of specifiers', async () => {
    const { formatSpecifier } = await import('d3-format');
    for (const specifier of ['~s', '$,.2~f', '.0%', '~%', 's~', '(,.2~e', 'nonsense!!', '~']) {
      let d3Accepts = true;
      try { formatSpecifier(specifier); } catch { d3Accepts = false; }
      expect(validate(specifier), specifier).toBe(d3Accepts);
    }
  });
});

describe('propertyRequired', () => {
  const validate = configValidators.propertyRequired();

  it('rejects undefined and null', () => {
    expect(validate(undefined)).toBe(false);
    expect(validate(null)).toBe(false);
  });

  it('accepts a defined value', () => {
    expect(validate('property')).toBe(true);
  });
});

describe('propertyOptional', () => {
  const validate = configValidators.propertyOptional();

  it('accepts null (an explicitly-absent property)', () => {
    expect(validate(null)).toBe(true);
  });

  it('accepts a defined value', () => {
    expect(validate('property')).toBe(true);
  });

  it('rejects undefined', () => {
    expect(validate(undefined)).toBe(false);
  });
});

describe('opacity', () => {
  const validate = configValidators.opacity();

  it('accepts values within [0, 1]', () => {
    expect(validate(0)).toBe(true);
    expect(validate(0.5)).toBe(true);
    expect(validate(1)).toBe(true);
  });

  it('rejects values out of range', () => {
    expect(validate(-0.1)).toBe(false);
    expect(validate(1.5)).toBe(false);
  });
});

describe('margin / padding', () => {
  it('accepts an object of non-negative sides', () => {
    const validate = configValidators.margin();
    expect(validate({ top: 0, right: 1, bottom: 2, left: 3 })).toBe(true);
  });

  it('rejects negative sides', () => {
    const validate = configValidators.padding();
    expect(validate({ top: -1, right: 0, bottom: 0, left: 0 })).toBe(false);
  });
});
