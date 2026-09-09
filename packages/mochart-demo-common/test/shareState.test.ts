import { describe, it, expect } from 'vitest';

import { encodeShareState, decodeShareState } from '../src/shareState';
import type { ShareState } from '../src/shareState';

const singleState: ShareState = {
  mode: 'single',
  config: {
    version: '1.0.0',
    title: { text: 'Ünïcode — dashes & “quotes”' },
    categoryAxis: { property: 'month', type: 'string', scale: 'ordinal' },
    series: [{ property: 'revenue', title: 'Revenue' }]
  },
  data: [
    { month: 'Jan', revenue: 10 },
    { month: 'Fév', revenue: 20.5 },
    { month: 'Mär', revenue: null }
  ]
};

const multiState: ShareState = { mode: 'multi', rows: 2, cols: 3, step: 5, interval: 1500 };

const randomState = {
  mode: 'random',
  randomConfig: { category: { count: 10 }, series: {} },
  applyReuse: false,
  interval: 2000
} as unknown as ShareState;

describe('shareState codec', () => {
  it('round-trips single-mode config and data', () => {
    const decoded = decodeShareState(encodeShareState(singleState));
    expect(decoded).toEqual(singleState);
  });

  it('round-trips multi-mode view state', () => {
    expect(decodeShareState(encodeShareState(multiState))).toEqual(multiState);
  });

  it('round-trips random-mode generator state', () => {
    expect(decodeShareState(encodeShareState(randomState))).toEqual(randomState);
  });

  it('clamps a hand-edited interval into the input limits', () => {
    expect(decodeShareState(encodeShareState({ ...multiState, interval: 0 } as ShareState))).toMatchObject({ interval: 5 });
    expect(decodeShareState(encodeShareState({ ...multiState, interval: 999999 } as ShareState))).toMatchObject({ interval: 60000 });
    expect(decodeShareState(encodeShareState({ ...randomState, interval: -100 } as ShareState))).toMatchObject({ interval: 5 });
  });

  it('normalizes a hand-edited step to a non-negative integer', () => {
    expect(decodeShareState(encodeShareState({ ...multiState, step: -3.7 } as ShareState))).toMatchObject({ step: 0 });
    expect(decodeShareState(encodeShareState({ ...multiState, step: 4.4 } as ShareState))).toMatchObject({ step: 4 });
  });

  it('clamps a hand-edited grid size into the stepper limits', () => {
    expect(decodeShareState(encodeShareState({ ...multiState, rows: 0, cols: 9 } as ShareState))).toMatchObject({ rows: 1, cols: 4 });
    expect(decodeShareState(encodeShareState({ ...multiState, rows: 2.6, cols: -5 } as ShareState))).toMatchObject({ rows: 3, cols: 1 });
  });

  it('produces URL-safe output', () => {
    const encoded = encodeShareState(singleState);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('returns null for malformed payloads', () => {
    expect(decodeShareState('not base64!!!')).toBeNull();
    expect(decodeShareState(btoa('not json'))).toBeNull();
    expect(decodeShareState('')).toBeNull();
  });

  it('returns null for payloads with an unknown or missing mode', () => {
    expect(decodeShareState(encodeShareState({ config: {}, data: [] } as unknown as ShareState))).toBeNull();
    expect(decodeShareState(encodeShareState({ mode: 'bogus' } as unknown as ShareState))).toBeNull();
  });

  it('returns null for a single payload with the wrong shape', () => {
    expect(decodeShareState(encodeShareState({ mode: 'single', config: 5, data: [] } as unknown as ShareState))).toBeNull();
    expect(decodeShareState(encodeShareState({ mode: 'single', config: {}, data: {} } as unknown as ShareState))).toBeNull();
    expect(decodeShareState(encodeShareState({ mode: 'single', config: {}, data: [1, 2] } as unknown as ShareState))).toBeNull();
  });

  it('accepts an empty single dataset', () => {
    const empty: ShareState = { mode: 'single', config: { version: '1.0.0' }, data: [] };
    expect(decodeShareState(encodeShareState(empty))).toEqual(empty);
  });
});
