// The random step id the galleries carry in /random/:demoId/:randomId and the
// showcase in ?seed=: a whole number from 0 to MAX_RANDOM_ID. Stepping wraps at
// both ends, so playback never runs out and back and forward reach the same ids.

export const MAX_RANDOM_ID = 9999;

/** The id a URL names, or null for anything that is not a whole number in range. */
export function parseRandomId(value: string | null | undefined): number | null {
  return typeof value === 'string' && /^\d{1,4}$/.test(value) ? Number(value) : null;
}

export function nextRandomId(randomId: number): number {
  return randomId >= MAX_RANDOM_ID ? 0 : randomId + 1;
}

export function previousRandomId(randomId: number): number {
  return randomId <= 0 ? MAX_RANDOM_ID : randomId - 1;
}
