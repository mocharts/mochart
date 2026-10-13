// an update that only changes label or tooltip values animates them straight away, with no still phase before or after
import { describe, it, beforeAll, expect } from 'vitest';
import { installSvgMeasurementShims } from '../components/svgShims';
import { installFakeFrameClock, runFrames, advanceFrames, mountContainer, mockBoundingClientRect } from '../components/helpers';
import { mochartCssClasses } from '../../src/utils/ChartDom';
import type { MochartInputConfig } from '../../src/types/config';

let mochart: typeof import('../../src');

beforeAll(async () => {
  installSvgMeasurementShims();
  mockBoundingClientRect(300, 200);
  installFakeFrameClock();
  mochart = await import('../../src');
});

// the label moves 38 on a 0 to 100 axis, so it takes 38% of the 50 value change frames
const LABEL_FRAMES = Math.ceil(50 * 38 / 100);

function mountChart(rows: Record<string, unknown>[]) {
  const container = mountContainer();
  const mochartConfig = mochart.enhanceConfig({
    version: '1.0.0',
    animation: { enabled: true, easing: 'linear', initialDuration: 800, valueChangeDuration: 800, expansionDuration: 800, contractionDuration: 800 },
    categoryAxis: { property: 'month', type: 'string', scale: 'ordinal' },
    valueAxes: [{ id: 'value', min: 0, max: 100 }],
    series: [{ id: 'sales', property: 'sales', axis: 'value', renderer: 'bar', labelProperty: 'net' }]
  } as MochartInputConfig);
  const chart = mochart.createChart(container, { mochartConfig, dataProvider: new mochart.ArrayOfObjectsDataProvider(rows), width: 300, height: 200 });
  runFrames();
  return { chart, container };
}

function labelTexts(container: Element): string {
  return Array.from(container.querySelectorAll(`.${mochartCssClasses.seriesLabels} text`), text => text.textContent).join('|');
}

const narrow = [{ month: 'Jan', sales: 50, net: 2 }, { month: 'Feb', sales: 60, net: 1 }];
const wide = [{ month: 'Jan', sales: 50, net: 40 }, { month: 'Feb', sales: 60, net: 1 }];

describe.each([['widens', narrow, wide], ['narrows', wide, narrow]])('a label-only update whose range %s', (_name, from, to) => {
  it('changes the label text on the first frame and settles when the label move does', () => {
    const { chart, container } = mountChart(from);
    const before = labelTexts(container);
    chart.update({ dataProvider: new mochart.ArrayOfObjectsDataProvider(to) });
    advanceFrames(2);
    expect(labelTexts(container)).not.toBe(before);
    const frames = 2 + runFrames();
    expect(frames).toBeLessThanOrEqual(LABEL_FRAMES + 2);
    chart.destroy();
    container.remove();
  });
});
