import { describe, it, expect } from 'vitest';
import { enhanceConfig, getDataErrors } from '@mochart/core';
import type { DataProvider, MochartInputConfig } from '@mochart/core';
import demoData from '@mochart/demo-data';

import { generateDemoDataProvider } from '../src/chartTypeGenerators';
import { validateRandomConfig, neutralizeRandomReuse } from '../src/randomConfig';
import { rotationConfigs } from '../src/rotationConfigs';
import { defaultTransitionConfig, getTransitionMochartConfig, getTransitionDataProviders } from '../src/transition';

// These paths only run in the browser (random mode, the rotation and
// transition showcases), so nothing else feeds their configs through
// enhanceConfig — a rename that misses one of them ships a runtime crash
// behind a green board. This suite crosses each seam the way the demo UIs do.

const demos = demoData.demoIds.map(id => demoData.demoObjectMap[id]!);

describe('random mode generation for every demo', () => {
  const randomDemos = demos.filter(demo => demo.random !== undefined);

  it('has demos with random configs', () => {
    expect(randomDemos.length).toBeGreaterThan(0);
  });

  for (const demo of randomDemos) {
    it(`${demo.id}: random config validates and generates error-free data`, () => {
      const mochartConfig = enhanceConfig(demo.config);
      expect(mochartConfig.validation.valid).toBe(true);
      expect(validateRandomConfig(demo.random, demo.generator)).toBe(true);

      for (const random of [demo.random!, neutralizeRandomReuse(demo.random!)]) {
        for (const randomId of [0, 3]) {
          const provider = generateDemoDataProvider(demo.generator, mochartConfig, random, randomId);
          expect(provider.categoryValues!.length).toBeGreaterThan(0);
          expect(getDataErrors(mochartConfig, provider as unknown as DataProvider)).toEqual([]);
        }
      }
    });
  }
});

describe('rotation showcase configs', () => {
  it('every rotation config enhances valid', () => {
    expect(rotationConfigs.length).toBeGreaterThan(0);
    for (const [index, config] of rotationConfigs.entries()) {
      const enhanced = enhanceConfig(config as MochartInputConfig);
      expect(enhanced.validation.errors, `rotation config ${index}`).toEqual([]);
      expect(enhanced.validation.valid, `rotation config ${index}`).toBe(true);
    }
  });
});

describe('transition showcase config', () => {
  it('enhances valid and generates error-free providers', () => {
    const mochartConfig = getTransitionMochartConfig(defaultTransitionConfig);
    expect(mochartConfig.validation.errors).toEqual([]);
    expect(mochartConfig.validation.valid).toBe(true);

    const providers = getTransitionDataProviders(defaultTransitionConfig);
    expect(providers.length).toBeGreaterThan(0);
    for (const provider of providers) {
      expect(provider.getPropertyValues(mochartConfig.categoryAxis.property!)!.length).toBeGreaterThan(0);
      expect(getDataErrors(mochartConfig, provider as unknown as DataProvider)).toEqual([]);
    }
  });
});
