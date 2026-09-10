import { describe, it, expect } from 'vitest';

import { decodeShareState, encodeShareState } from '../src/state/share';
import type { ShowcaseShareState } from '../src/state/share';

describe('share payload', () => {
  it('round-trips config and data edits, including characters that matter in a URL', () => {
    const state: ShowcaseShareState = {
      v: 1,
      slug: 'stacked',
      config: { title: { text: 'a/b?c#d&e=f "quoted" \\ back' }, series: [{ property: 'v', title: 'ünïcödé 日本' }] },
      data: [{ label: 'A', v: 1 }, { label: 'B', v: null }]
    };
    const encoded = encodeShareState(state);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeShareState(encoded)).toEqual(state);
  });

  it('carries only the parts that were edited', () => {
    expect(decodeShareState(encodeShareState({ v: 1, slug: 'pie' }))).toEqual({ v: 1, slug: 'pie' });
    expect(decodeShareState(encodeShareState({ v: 1, slug: 'pie', data: [] }))).toEqual({ v: 1, slug: 'pie', data: [] });
  });

  it('returns null for anything malformed', () => {
    expect(decodeShareState('')).toBeNull();
    expect(decodeShareState('not base64 at all!')).toBeNull();
    expect(decodeShareState(encodeShareState({ v: 2, slug: 'pie' } as unknown as ShowcaseShareState))).toBeNull();
    expect(decodeShareState(encodeShareState({ v: 1 } as unknown as ShowcaseShareState))).toBeNull();
    expect(decodeShareState(encodeShareState({ v: 1, slug: 'pie', config: 'nope' } as unknown as ShowcaseShareState))).toBeNull();
    expect(decodeShareState(encodeShareState({ v: 1, slug: 'pie', data: [1] } as unknown as ShowcaseShareState))).toBeNull();
  });
});
