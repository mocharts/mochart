/**
 * A web font finishing loading (document.fonts 'loadingdone') bumps fontsVersion, and every truncating host must
 * see it: a fitted prefix belongs to the font it was measured in. Regression: Plot.ts never passed fontsVersion
 * to the axes, so an axis title kept the fallback font's fit while the title and legend refit.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { installFakeFrameClock, runFrames, mountContainer, trackHandle } from './helpers';
import { installTextMetrics, getRenderedText } from '../golden/textMetrics';
import { mochartCssClasses, getDescendantCssSelector } from '../../src/utils/ChartDom';
import type { DefaultChartProps } from '../../src/types/chart';
import type { MochartInputConfig } from '../../src/types/config';

const WIDTH = 500;
const HEIGHT = 400;

/** The axis titles alone draw this much wider, so their room along the axis stands still and only fontsVersion can refit them. */
let axisTitleScale = 1;

let createDefaultChart: typeof import('../../src/createChart').createDefaultChart;
let fonts: EventTarget;

beforeAll(async () => {
  installTextMetrics();
  const svgProto = globalThis.SVGElement.prototype as any;
  const axisTitle = '.' + mochartCssClasses['axisTitle'];
  const scaleOf = (element: Element): number => element.closest(axisTitle) !== null ? axisTitleScale : 1;
  const computedTextLength = svgProto.getComputedTextLength as (this: SVGElement) => number;
  svgProto.getComputedTextLength = function (this: SVGElement): number { return computedTextLength.call(this) * scaleOf(this); };
  const subStringLength = svgProto.getSubStringLength as (this: SVGElement, charnum: number, nchars: number) => number;
  svgProto.getSubStringLength = function (this: SVGElement, charnum: number, nchars: number): number { return subStringLength.call(this, charnum, nchars) * scaleOf(this); };
  const bBox = svgProto.getBBox as (this: SVGElement) => { x: number; y: number; width: number; height: number };
  svgProto.getBBox = function (this: SVGElement) { const box = bBox.call(this); return { ...box, width: box.width * scaleOf(this) }; };
  // jsdom has no document.fonts; the controller listens on whatever stands there when the chart is created
  fonts = new EventTarget();
  Object.defineProperty(document, 'fonts', { value: fonts, configurable: true });
  installFakeFrameClock();
  ({ createDefaultChart } = await import('../../src/createChart'));
});

const rows = [
  { month: 'Jan', sales: 10 },
  { month: 'Feb', sales: 20 },
  { month: 'Mar', sales: 15 }
];

const config = {
  version: '1.0.0',
  animation: { enabled: false },
  title: { text: 'Sales' },
  categoryAxis: {
    property: 'month', type: 'string', scale: 'ordinal',
    title: { text: 'A category axis title long enough to truncate well before the axis ends', truncation: { enabled: true, text: '...' } }
  },
  valueAxes: [{ id: 'VA0', title: { text: 'A value axis title long enough to truncate well before the axis ends', truncation: { enabled: true, text: '...' } } }],
  series: [{ id: 'S0', property: 'sales', title: 'Sales' }]
} as unknown as MochartInputConfig;

function axisTitleTexts(container: Element): string[] {
  return [...container.querySelectorAll(getDescendantCssSelector('categoryAxis', 'axisTitle') + ' text, ' + getDescendantCssSelector('valueAxis', 'axisTitle') + ' text')]
    .map(element => getRenderedText(element));
}

describe('fontsVersion', () => {
  it('refits the axis titles when a web font finishes loading', () => {
    axisTitleScale = 1;
    const container = mountContainer();
    trackHandle(createDefaultChart(container, { config, data: rows, width: WIDTH, height: HEIGHT } as DefaultChartProps));
    runFrames();
    const fitted = axisTitleTexts(container);
    expect(fitted).toHaveLength(2);
    for (const text of fitted) {
      expect(text.endsWith('...')).toBe(true);
    }

    axisTitleScale = 2;
    fonts.dispatchEvent(new Event('loadingdone'));
    runFrames();
    const refitted = axisTitleTexts(container);
    for (let i = 0; i < fitted.length; i++) {
      expect(refitted[i].endsWith('...')).toBe(true);
      expect(refitted[i].length).toBeLessThan(fitted[i].length);
    }
  });
});
