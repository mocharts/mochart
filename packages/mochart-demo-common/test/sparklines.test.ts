import { describe, it, expect } from 'vitest';

import { enhanceConfig, getDataErrors } from '@mochart/core';
import type { DataProvider } from '@mochart/core';

import { inlineSparklineMetrics, tableSparklineMetrics } from '../src/sparklines';
import { demoText } from '../src/demoText';

const allMetrics = [...inlineSparklineMetrics, ...tableSparklineMetrics];

describe('sparkline metrics', () => {
  for (const metric of allMetrics) {
    it(`${metric.id}: config is valid and generated data has no errors`, () => {
      const mochartConfig = enhanceConfig(metric.config);
      expect(mochartConfig.validation.valid).toBe(true);
      expect(mochartConfig.validation.warnings).toEqual([]);
      // The preset must reach every axis: valueAxisDefaults only merges
      // into declared axes, so an undeclared axis would render its stub.
      for (const valueAxisConfig of mochartConfig.valueAxes) {
        expect(valueAxisConfig.visible).toBe(false);
      }
      for (const step of [0, 1, 5]) {
        const rows = metric.generate(step);
        expect(rows.length).toBeGreaterThan(0);
        const provider = {
          getPropertyValues: (property: string) => rows.map(row => row[property])
        };
        expect(getDataErrors(mochartConfig, provider as unknown as DataProvider)).toEqual([]);
        expect(metric.latestText(rows)).toBeTruthy();
      }
    });

    it(`${metric.id}: the same step reproduces the same data`, () => {
      expect(metric.generate(3)).toEqual(metric.generate(3));
    });
  }

  it('inline metrics line up with the intro copy segments', () => {
    expect(demoText.sparklinePage.intro.length).toBe(inlineSparklineMetrics.length + 1);
  });
});
