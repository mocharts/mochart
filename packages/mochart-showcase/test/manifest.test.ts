import { describe, it, expect } from 'vitest';

import { validateRandomConfig } from '@mochart/demo-common';

import { defaultWallSlugs, getEntry, getSections } from '../src/content/manifest';
import { randomForSeed } from '../src/content/randomForSeed';

const entries = getSections().flatMap(section => section.entries);

describe('showcase manifest', () => {
  it('gives every entry a unique slug', () => {
    expect(new Set(entries.map(entry => entry.slug)).size).toBe(entries.length);
  });

  it('ships a valid random spec on every randomizable entry, on the curated step and every seed after', () => {
    for (const entry of entries) {
      if (entry.random === undefined) {
        continue;
      }
      expect(validateRandomConfig(entry.random, entry.generator), entry.slug).toBe(true);
      for (let seed = 1; seed <= 40; seed++) {
        expect(validateRandomConfig(randomForSeed(entry.random, seed, entry.walkBounds), entry.generator), `${entry.slug} seed ${seed}`).toBe(true);
      }
    }
  });

  it('keeps a bounded entry\'s category window inside its bounds on every seed', () => {
    const bounded = entries.filter(entry => entry.walkBounds !== undefined);
    expect(bounded.map(entry => entry.slug)).toEqual(['clipped', 'easing']);
    for (const entry of bounded) {
      for (let seed = 0; seed <= 200; seed++) {
        const random = randomForSeed(entry.random!, seed, entry.walkBounds);
        const { min, max } = (random as { category: { number: { min: number; max: number } } }).category.number;
        expect(min, `${entry.slug} seed ${seed}`).toBeGreaterThanOrEqual(entry.walkBounds!.min);
        expect(max, `${entry.slug} seed ${seed}`).toBeLessThanOrEqual(entry.walkBounds!.max);
      }
    }
  });

  it('marks an entry wall-eligible only with a random spec and no special body', () => {
    for (const entry of entries) {
      expect(entry.wall, entry.slug).toBe(entry.random !== undefined && entry.special === undefined);
    }
    for (const slug of defaultWallSlugs) {
      expect(getEntry(slug)?.wall, slug).toBe(true);
    }
  });
});
