// onSeriesLayoutBoundsChange used to fire inside derive() — invoking the previous render's closure and letting a re-entrant host update be overwritten — so it now flushes from the post-commit measure hook.
import { describe, it, expect, beforeAll } from 'vitest';
import { installSvgMeasurementShims } from './svgShims';
import { mountContainer, trackHandle } from './helpers';
import { createDefaultChart } from '../../src/createChart';
import type { ChartHandle } from '../../src/createChart';
import type { Bounds } from '../../src/types/geometry';
import type { DefaultChartProps } from '../../src/types/chart';
import type { MochartInputConfig } from '../../src/types/config';

const rows = [
  { month: 'Jan', sales: 10 },
  { month: 'Feb', sales: 20 },
  { month: 'Mar', sales: 30 }
];

const config = {
  version: '1.0.0',
  animation: { enabled: false },
  categoryAxis: { property: 'month', type: 'string', scale: 'ordinal' },
  series: [{ property: 'sales' }]
} as unknown as MochartInputConfig;

function mountChart(props: Partial<DefaultChartProps>) {
  const container = mountContainer();
  const handle = trackHandle(createDefaultChart(container, {
    config, data: rows, width: 800, height: 600, ...props
  } as DefaultChartProps));
  return { container, handle };
}

function svgSize(container: Element) {
  const svg = container.querySelector('svg')!;
  return { width: svg.getAttribute('width'), height: svg.getAttribute('height') };
}

beforeAll(() => {
  installSvgMeasurementShims();
});

describe('onSeriesLayoutBoundsChange', () => {
  it('invokes the callback from the latest update, not the previous render closure', () => {
    const calledA: Bounds[] = [];
    const calledB: Bounds[] = [];
    const { container, handle } = mountChart({
      onSeriesLayoutBoundsChange: bounds => { calledA.push(bounds); }
    });
    expect(calledA.length).toBe(1);
    expect(container).not.toBeNull();

    handle.update({
      config, data: rows, width: 400, height: 300,
      onSeriesLayoutBoundsChange: bounds => { calledB.push(bounds); }
    } as DefaultChartProps);

    // the resize changed the series area, so exactly one notification is due — on the new closure
    expect(calledB.length).toBe(1);
    expect(calledA.length).toBe(1);
  });

  it('does not discard an update the host makes from inside the callback', () => {
    // a host that resizes in response to new bounds — the classic responsive-container pattern
    let reacted = false;
    let chart: ChartHandle<DefaultChartProps> | null = null;
    const { container, handle } = mountChart({
      onSeriesLayoutBoundsChange: () => {
        if (chart !== null && !reacted) {
          reacted = true;
          chart.update({ config, data: rows, width: 500, height: 500 } as DefaultChartProps);
        }
      }
    });
    chart = handle;

    handle.update({ config, data: rows, width: 400, height: 300 } as DefaultChartProps);
    expect(reacted).toBe(true);

    // the host's most recent instruction (500x500) must win over the outer update (400x300)
    expect(svgSize(container)).toEqual({ width: '500', height: '500' });
  });

  it('still reports the mount bounds and the bounds after a resize', () => {
    const bounds: Bounds[] = [];
    const { handle } = mountChart({
      onSeriesLayoutBoundsChange: next => { bounds.push(next); }
    });
    handle.update({ config, data: rows, width: 400, height: 300 } as DefaultChartProps);

    expect(bounds.length).toBe(2);
    expect(bounds[0].width).toBeGreaterThan(bounds[1].width);
    for (const entry of bounds) {
      expect(Number.isFinite(entry.x) && Number.isFinite(entry.y)).toBe(true);
      expect(entry.width).toBeGreaterThan(0);
      expect(entry.height).toBeGreaterThan(0);
    }
  });
});
