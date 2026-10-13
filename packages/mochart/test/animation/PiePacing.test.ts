// a pie draws no axes, so its updates play no expansion or contraction
import { describe, it, expect } from 'vitest';
import { getChartAnimationData } from '../../src/animation/ChartAnimationData';
import { getChartData } from '../../src/data/ChartData';
import { createPie } from '../../src/data/Pie';
import { enhanceConfig } from '../../src/config/helper';
import { ArrayOfObjectsDataProvider } from '../../src/data/DataProvider';
import type { MochartInputConfig } from '../../src/types/config';
import type { EnhancedMochartConfig } from '../../src/types/enhanced';

const pie = (values: number[]) => createPie(values.map((value, index) => ({ label: 'L' + index, value })));

function animationDataFor(from: number[], to: number[]) {
  const { chart, pie: pieConfig, categoryAxis, series } = pie(from);
  const config = enhanceConfig({ version: '1.0.0', chart, pie: pieConfig, categoryAxis, series } as unknown as MochartInputConfig) as EnhancedMochartConfig;
  const prev = getChartData(config, new ArrayOfObjectsDataProvider(pie(from).data), {});
  const next = getChartData(config, new ArrayOfObjectsDataProvider(pie(to).data), {});
  return getChartAnimationData(config, prev, next);
}

describe('a pie slice value change', () => {
  it.each([['grows', [62, 20, 18], [80, 20, 18]], ['shrinks', [62, 20, 18], [40, 20, 18]]])('plays no expansion or contraction when a slice %s', (_name, from, to) => {
    const data = animationDataFor(from, to);
    expect(data.axisExpansionData.deltaPercentage).toBe(0);
    expect(data.axisContractionData.deltaPercentage).toBe(0);
    expect(data.valueChangeData.deltaPercentage).toBeGreaterThan(0);
  });
});
