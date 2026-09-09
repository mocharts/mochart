import { describe, expect, it } from 'vitest';
import { resolveLegendIconSize } from '../../src/layout/LegendLayout';
import type { LegendConfig } from '../../src/types/config';

describe('legend icon sizing', () => {
  it('uses the measured font size for auto and preserves the placeholder fallback', () => {
    const automatic = { icon: { size: 'auto' } } as LegendConfig;

    expect(resolveLegendIconSize(automatic, { width: 80, height: 20, fontSize: 16 })).toBe(16);
    expect(resolveLegendIconSize(automatic, { width: 80, height: 18, fontSize: 15.2 })).toBe(15);
    expect(resolveLegendIconSize(automatic, { width: 20, height: 20, fontSize: 16, default: true })).toBe(14);
    expect(resolveLegendIconSize(automatic, { width: 0, height: 0, empty: true })).toBe(14);
  });

  it('falls back to the measured text height when no font size was captured', () => {
    const automatic = { icon: { size: 'auto' } } as LegendConfig;

    expect(resolveLegendIconSize(automatic, { width: 80, height: 18 })).toBe(18);
  });

  it('preserves an explicit pixel size', () => {
    const fixed = { icon: { size: 12 } } as LegendConfig;

    expect(resolveLegendIconSize(fixed, { width: 80, height: 18 })).toBe(12);
  });
});
