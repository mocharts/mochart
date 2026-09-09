/**
 * The mount-time measure pass rebuilds axis data for whichever axis layout the measured text changed.
 * Regression: it compared only the plot extents, so a value axis whose extent held while its measured
 * tick label height shrank kept the tick set computed for the default label bounds until the first
 * config/size change forced a full rebuild.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { installTextMetrics, getRenderedText } from '../golden/textMetrics';
import { mountContainer, trackHandle, mockBoundingClientRect } from './helpers';
import { createDefaultChart } from '../../src/createChart';
import type { DefaultChartProps } from '../../src/types/chart';
import type { MochartInputConfig } from '../../src/types/config';
import { getCssSelector } from '../../src/utils/ChartDom';

const WIDTH = 800;
const HEIGHT = 150;
const LABEL_HEIGHT = 12;

const rows = [{ c: 'a', v: 5 }, { c: 'b', v: 25 }];

// no category axis, title or legend: the value extent is fixed by the chart height alone
const config = {
  version: '1.0.0',
  animation: { enabled: false },
  categoryAxis: { property: 'c', type: 'string', scale: 'ordinal', visible: false },
  valueAxes: [{ min: 0, max: 30 }],
  series: [{ property: 'v', renderer: 'bar' }],
  legend: { visible: false }
} as unknown as MochartInputConfig;

function valueTicks(container: Element): string[] {
  return [...container.querySelectorAll(getCssSelector('valueAxis') + ' ' + getCssSelector('axisTickLabel') + ' text')]
    .map(text => text.textContent ?? '');
}

beforeAll(() => {
  installTextMetrics();
  mockBoundingClientRect(WIDTH, HEIGHT);
  // labels shorter than the 20px default bounds, so the measured pass fits more value ticks
  const svgProto = globalThis.SVGElement.prototype as unknown as { getBBox: (this: SVGGraphicsElement) => DOMRect };
  const measured = svgProto.getBBox;
  svgProto.getBBox = function (this: SVGGraphicsElement) {
    const bounds = measured.call(this);
    return bounds.height > 0 ? { ...bounds, height: LABEL_HEIGHT } as DOMRect : bounds;
  };
});

// Regression: the mount pass measured the tick labels before they truncated and nothing remeasured afterwards, so
// the axis stayed sized for the full labels (a blank band under them) until the first config, size or data change
describe('mount-time remeasure after tick label truncation', () => {
  it('reserves the same axis space at mount as a later full remeasure', () => {
    const svgProto = globalThis.SVGElement.prototype as unknown as { getBBox: (this: SVGGraphicsElement) => DOMRect };
    const shortened = svgProto.getBBox;
    // this case wants the synthetic font's own heights back
    svgProto.getBBox = function (this: SVGGraphicsElement) {
      const bounds = shortened.call(this);
      return bounds.height === LABEL_HEIGHT ? { ...bounds, height: 16 * 1.2 } as DOMRect : bounds;
    };
    try {
      const rows = Array.from({ length: 12 }, (_, i) => ({ c: 'Month number ' + (i + 1), v: 10 + i }));
      const rotated = {
        version: '1.0.0',
        animation: { enabled: false },
        categoryAxis: { property: 'c', type: 'string', scale: 'ordinal', tickLabel: { rotation: 45 } },
        series: [{ property: 'v', renderer: 'bar' }]
      } as unknown as MochartInputConfig;
      const container = mountContainer();
      const handle = trackHandle(createDefaultChart(container, { config: rotated, data: rows, width: WIDTH, height: 300 } as DefaultChartProps));
      const plotHeight = () => Number(container.querySelector(getCssSelector('seriesBackground') + ' rect')!.getAttribute('height'));
      const labels = () => [...container.querySelectorAll(getCssSelector('categoryAxis') + ' ' + getCssSelector('axisTickLabel') + ' text')].map(text => getRenderedText(text));
      const mounted = plotHeight();
      // the labels did truncate at mount
      expect(labels()[0]).toMatch(/…$/);
      handle.update({ config: JSON.parse(JSON.stringify(rotated)) as MochartInputConfig } as Partial<DefaultChartProps>);
      expect(mounted).toBe(plotHeight());
    }
    finally {
      svgProto.getBBox = shortened;
    }
  });
});

describe('mount-time axis rebuild', () => {
  it('sizes the value axis ticks from the measured labels at mount, the same as a later full rebuild', () => {
    const container = mountContainer();
    const handle = trackHandle(createDefaultChart(container, { config, data: rows, width: WIDTH, height: HEIGHT } as DefaultChartProps));
    const mounted = valueTicks(container);
    handle.update({ config: JSON.parse(JSON.stringify(config)) as MochartInputConfig } as Partial<DefaultChartProps>);
    expect(mounted).toEqual(valueTicks(container));
    expect(mounted).toEqual(['0', '5', '10', '15', '20', '25', '30']);
  });
});
