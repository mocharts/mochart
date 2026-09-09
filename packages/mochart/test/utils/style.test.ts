import { describe, it, expect } from 'vitest';

import { cssStyleColor, styleToAttributes } from '../../src/utils/style';

// cssStyleColor is the html half of the style contract: a div has no fill-opacity/stroke-opacity
// attribute, so color and opacity must be composited into one css color.
describe('cssStyleColor', () => {
  it('returns the color untouched when the opacity is null', () => {
    expect(cssStyleColor('rgba(255,255,255,0.9)', null)).toBe('rgba(255,255,255,0.9)');
    expect(cssStyleColor('#ff0000', null)).toBe('#ff0000');
  });

  it('returns null when the color is null, whatever the opacity', () => {
    expect(cssStyleColor(null, null)).toBeNull();
    expect(cssStyleColor(null, 0.5)).toBeNull();
  });

  it('composites an opacity into the color', () => {
    expect(cssStyleColor('#ff0000', 0.5)).toBe('rgba(255, 0, 0, 0.5)');
  });

  it('multiplies the opacity into the color\'s own alpha', () => {
    expect(cssStyleColor('rgba(0,0,255,0.4)', 0.5)).toBe('rgba(0, 0, 255, 0.2)');
  });

  // a keyword d3 cannot parse used to have its opacity silently dropped, so { fillColor: 'currentColor', fillOpacity: 0.9 } validated and then rendered opaque
  it('composites an opacity into a keyword color with color-mix', () => {
    expect(cssStyleColor('currentColor', 0.5)).toBe('color-mix(in srgb, currentColor 50%, transparent)');
    expect(cssStyleColor('currentColor', 0.9)).toBe('color-mix(in srgb, currentColor 90%, transparent)');
    expect(cssStyleColor('currentColor', 0)).toBe('color-mix(in srgb, currentColor 0%, transparent)');
  });

  it('leaves a fully opaque keyword color alone rather than wrapping it', () => {
    expect(cssStyleColor('currentColor', 1)).toBe('currentColor');
  });
});

describe('styleToAttributes', () => {
  it('writes only the members the style has, so a line style never writes a fill', () => {
    expect(styleToAttributes({ strokeColor: 'currentColor', strokeOpacity: 0.3, strokeWidth: 3 }))
      .toEqual({ stroke: 'currentColor', strokeOpacity: 0.3, strokeWidth: 3 });
  });
});
