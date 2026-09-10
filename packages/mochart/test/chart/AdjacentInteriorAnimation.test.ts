/**
 * animateBaseFromAdjacent for interior categories: a line point that enters or
 * leaves animates from or onto the line between its neighbours, so the series
 * never spikes to the axis base and its removal at the end of the value phase
 * is invisible. Bars keep the base (animateBaseFromAdjacent false by default).
 */
import { describe, it, beforeAll, expect } from 'vitest';
import { installSvgMeasurementShims } from '../components/svgShims';
import { installFakeFrameClock, runFrames, advanceFrames, mountContainer } from '../components/helpers';
import { getCssSelector, getIdCssSelector } from '../../src/utils/ChartDom';

let mochart: typeof import('../../src');

beforeAll(async () => {
  installSvgMeasurementShims();
  installFakeFrameClock();
  mochart = await import('../../src');
});

/** The line path's points, from its M/L commands. */
function linePoints(container: Element): { x: number; y: number }[] {
  const path = container.querySelector(getIdCssSelector('series', 's') + ' path' + getCssSelector('seriesLine'))!;
  const numbers = (path.getAttribute('d') ?? '').match(/-?\d+(\.\d+)?/g)!.map(Number);
  const points: { x: number; y: number }[] = [];
  for (let i = 0; i + 1 < numbers.length; i += 2) {
    points.push({ x: numbers[i]!, y: numbers[i + 1]! });
  }
  return points;
}

describe('an interior line point that leaves', () => {
  it('collapses onto the segment between its neighbours instead of the base', () => {
    const { createChart, enhanceConfig, ArrayOfObjectsDataProvider } = mochart;
    const mochartConfig = enhanceConfig({
      version: '1.0.0',
      categoryAxis: { property: 'label', type: 'string', scale: 'ordinal' },
      valueAxes: [{ id: 'va', min: 0, max: 100 }],
      series: [{ id: 's', property: 'v', axis: 'va', renderer: 'line' }]
    });
    const container = mountContainer();
    const props = { mochartConfig, width: 400, height: 200 };
    const chart = createChart(container, {
      ...props,
      dataProvider: new ArrayOfObjectsDataProvider([{ label: 'A', v: 60 }, { label: 'B', v: 80 }, { label: 'C', v: 40 }])
    });
    runFrames();
    expect(linePoints(container)).toHaveLength(3);

    // B leaves. The old behaviour animated it to the base (0), a spike below both neighbours.
    chart.update({
      ...props,
      dataProvider: new ArrayOfObjectsDataProvider([{ label: 'A', v: 60 }, { label: 'C', v: 40 }])
    });
    let tweenFrames = 0;
    for (let frame = 0; frame < 80; frame++) {
      const points = linePoints(container);
      if (points.length === 3) {
        tweenFrames++;
        // B starts above both neighbours (80 over 60 and 40) and must end on the
        // segment between them; it may never pass below them toward the base.
        const [a, b, c] = points as [{ y: number }, { y: number }, { y: number }];
        expect(b.y).toBeLessThanOrEqual(Math.max(a.y, c.y) + 1);
      }
      advanceFrames(1);
    }
    expect(tweenFrames).toBeGreaterThan(0);
    runFrames();
    expect(linePoints(container)).toHaveLength(2);
    chart.destroy();
  });
});
