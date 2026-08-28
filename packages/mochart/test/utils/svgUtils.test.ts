import { describe, it, expect } from 'vitest';
import { getCutoutRectanglePath, getClipPathReference } from '../../src/utils/svgUtils';

describe('getCutoutRectanglePath', () => {

  it('places the outer rectangle corners at the expected coordinates', () => {
    const d = getCutoutRectanglePath(5, 6, 100, 50, 10, 10, 20, 20);
    expect(d.startsWith('M5,6')).toBe(true);
    // x+width, y+height corner
    expect(d).toContain('L105,56');
  });
});

describe('getClipPathReference', () => {
  it('wraps the id in a url() reference', () => {
    expect(getClipPathReference('clip1')).toBe('url(#clip1)');
  });
});
