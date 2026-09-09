// Grid lines stand on gridLine.visible alone: axis.visible hides the chrome in the gutter, not the
// marks an axis draws across the plot, which is how its base line and threshold lines already behave.
import { describe, it, expect, beforeAll } from 'vitest';
import { installSvgMeasurementShims } from './svgShims';
import { mountContainer, trackHandle } from './helpers';
import { createDefaultChart } from '../../src/createChart';
import type { DefaultChartProps } from '../../src/types/chart';
import type { MochartInputConfig } from '../../src/types/config';
import { getCssSelector } from '../../src/utils/ChartDom';

const WIDTH = 400;
const HEIGHT = 300;
const data = [{ c: 'a', v: 2 }, { c: 'b', v: 8 }];

function mount(valueAxis: Record<string, unknown>): Element {
  const container = mountContainer();
  trackHandle(createDefaultChart(container, {
    config: {
      version: '1.0.0',
      animation: { enabled: false },
      categoryAxis: { property: 'c', type: 'string', scale: 'ordinal' },
      valueAxes: [{ min: 0, max: 10, base: 0, ...valueAxis }],
      series: [{ id: 'v', property: 'v', renderer: 'bar' }]
    } as unknown as MochartInputConfig,
    data, width: WIDTH, height: HEIGHT
  } as DefaultChartProps));
  return container;
}

const gridLines = (container: Element) =>
  container.querySelectorAll(getCssSelector('valueAxisGrid') + ' ' + getCssSelector('axisGridLine')).length;
const axisTickLabels = (container: Element) =>
  container.querySelectorAll(getCssSelector('valueAxis') + ' ' + getCssSelector('axisTickLabel')).length;

beforeAll(() => {
  installSvgMeasurementShims();
});

describe('grid lines on a hidden axis', () => {
  it('draws them for a hidden axis that asks for them', () => {
    const container = mount({ visible: false, gridLine: { visible: true } });
    expect(axisTickLabels(container), 'the axis chrome should be hidden').toBe(0);
    expect(gridLines(container)).toBeGreaterThan(0);
  });

  it('still draws none when the grid is not asked for', () => {
    expect(gridLines(mount({ visible: false }))).toBe(0);
    expect(gridLines(mount({ visible: true }))).toBe(0);
    expect(gridLines(mount({ visible: true, gridLine: { visible: false } }))).toBe(0);
  });
});
