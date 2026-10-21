import { beforeAll, describe, expect, it } from 'vitest';
import { createDefaultChart } from '../../src/createChart';
import { installSvgMeasurementShims } from './svgShims';
import { mountContainer, trackHandle } from './helpers';
import type { DefaultChartProps } from '../../src/types/chart';
import type { MochartInputConfig } from '../../src/types/config';

const rows = [
  { c: 'A', a: 10, b: 15 },
  { c: 'B', a: 20, b: 5 }
];

function mount(config: MochartInputConfig): Element {
  const container = mountContainer();
  trackHandle(createDefaultChart(container, { config, data: rows, width: 600, height: 400 } as DefaultChartProps));
  return container;
}

beforeAll(() => installSvgMeasurementShims());

describe('gradient rotation', () => {
  it('turns linear and radial gradients around the center of the shape', () => {
    const stops = [{ offset: 0, color: '#f00', opacity: 1 }, { offset: 1, color: '#00f', opacity: 1 }];
    const container = mount({
      version: '1.0.0',
      animation: { enabled: false },
      categoryAxis: { property: 'c' },
      linearGradients: [{ id: 'LG', rotation: 180, stops }],
      radialGradients: [{ id: 'RG', rotation: 90, stops }],
      series: [
        { id: 'A', property: 'a', renderer: 'bar', gradient: 'LG' },
        { id: 'B', property: 'b', renderer: 'bar', gradient: 'RG' }
      ]
    } as unknown as MochartInputConfig);

    expect(container.querySelector('svg > defs > linearGradient')!.getAttribute('gradientTransform')).toBe('rotate(180, 0.5, 0.5)');
    expect(container.querySelector('svg > defs > radialGradient')!.getAttribute('gradientTransform')).toBe('rotate(90, 0.5, 0.5)');
  });
});
