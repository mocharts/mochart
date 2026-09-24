// Regression: measured tick-label truncation state must survive unrelated prop
// updates instead of being wiped and re-measured (with one untruncated frame).
import { describe, it, expect, beforeAll } from 'vitest';
import { mountContainer, trackHandle } from './helpers';
import { getRenderedText } from '../golden/textMetrics';
import { createDefaultChart } from '../../src/createChart';
import type { ChartHandle } from '../../src/createChart';
import type { DefaultChartProps } from '../../src/types/chart';
import type { MochartInputConfig } from '../../src/types/config';
import { getDescendantCssSelector } from '../../src/utils/ChartDom';

const PX_PER_CHAR = 9.7;
let measureCalls = 0;

// a bold font measures wider, so a font-only update has a visible effect on the fit
function pxPerChar(element: Element): number {
  return (element as SVGElement).style.fontWeight === 'bold' ? PX_PER_CHAR * 1.5 : PX_PER_CHAR;
}

function rows(offset: number): Record<string, unknown>[] {
  return [
    { month: 'an-extremely-long-january-label-that-cannot-possibly-fit', sales: 10 + offset },
    { month: 'an-extremely-long-february-label-that-cannot-possibly-fit', sales: 20 + offset },
    { month: 'an-extremely-long-march-label-that-cannot-possibly-fit', sales: 30 + offset }
  ];
}

function config(categoryAxis: Record<string, unknown> = {}): MochartInputConfig {
  return {
    version: '1.0.0',
    animation: { enabled: false },
    categoryAxis: { property: 'month', type: 'string', scale: 'ordinal', ...categoryAxis },
    series: [{ property: 'sales' }]
  } as unknown as MochartInputConfig;
}

function mountChart(categoryAxis: Record<string, unknown> = {}): { container: Element; handle: ChartHandle<DefaultChartProps> } {
  const container = mountContainer();
  const handle = trackHandle(createDefaultChart(container, {
    config: config(categoryAxis),
    data: rows(0), width: 500, height: 400
  } as DefaultChartProps));
  return { container, handle };
}

function labelTextsOf(container: Element): string[] {
  return [...container.querySelectorAll(getDescendantCssSelector('categoryAxis', 'axisTickLabel') + ' text')]
    .map(label => getRenderedText(label));
}

beforeAll(() => {
  // Character-proportional measurements (instead of the usual zero-size shims)
  // so tick-label truncation actually engages in jsdom.
  const svgProto = (globalThis as any).SVGElement.prototype;
  svgProto.getComputedTextLength = function (this: SVGTextContentElement) {
    measureCalls++;
    return getRenderedText(this).length * pxPerChar(this);
  };
  svgProto.getSubStringLength = function (this: SVGTextContentElement, _start: number, count: number) {
    measureCalls++;
    return count * pxPerChar(this);
  };
  // proportional like the text lengths: zero-size bboxes would keep the
  // default-bounds re-measure marker set, which wipes truncation every update
  svgProto.getBBox = function (this: SVGGraphicsElement) {
    return { x: 0, y: 0, width: getRenderedText(this).length * pxPerChar(this), height: 12 };
  };
});

describe('tick-label truncation state across updates', () => {
  it('keeps the measured truncation and stops measuring once settled', () => {
    const { container, handle } = mountChart();
    const labelTexts = () => [...container.querySelectorAll(getDescendantCssSelector('categoryAxis', 'axisTickLabel') + ' text')]
      .map(label => getRenderedText(label));

    // a real prop change flushes the tail of the mount-time measurement passes
    handle.update({ focusedCategoryIndex: 0 } as Partial<DefaultChartProps>);
    const truncated = labelTexts();
    expect(truncated.length).toBeGreaterThan(0);
    expect(truncated.every(text => text.includes('…'))).toBe(true);

    // focus updates reach the axis props; the retained truncation state must
    // hold steady with no re-measuring (pre-fix every update re-measured)
    measureCalls = 0;
    for (let i = 0; i < 5; i++) {
      handle.update({ focusedCategoryIndex: (i + 1) % 3 } as Partial<DefaultChartProps>);
      expect(labelTexts()).toEqual(truncated);
    }
    expect(measureCalls).toBe(0);
  });

  it('re-truncates from the new labels when a data update replaces them', () => {
    const { container, handle } = mountChart();
    const labelTexts = () => [...container.querySelectorAll(getDescendantCssSelector('categoryAxis', 'axisTickLabel') + ' text')]
      .map(label => getRenderedText(label));
    const isTruncationOf = (rendered: string, full: string) =>
      rendered.endsWith('…') && rendered.length > 1 && full.startsWith(rendered.slice(0, -1));

    const originals = rows(0).map(row => String(row.month));
    handle.update({ focusedCategoryIndex: 0 } as Partial<DefaultChartProps>);
    expect(labelTexts().map((text, i) => isTruncationOf(text, originals[i]))).toEqual([true, true, true]);

    // same tick count, entirely new labels, and the truncation cache must adopt
    // them instead of converging on truncations of the previous labels
    const replacements = [
      'replacement-lengthy-monday-label-that-cannot-possibly-fit',
      'replacement-lengthy-tuesday-label-that-cannot-possibly-fit',
      'replacement-lengthy-wednesday-label-that-cannot-possibly-fit'
    ];
    handle.update({ data: replacements.map((month, i) => ({ month, sales: 11 + 10 * i })) } as Partial<DefaultChartProps>);
    handle.update({ focusedCategoryIndex: 1 } as Partial<DefaultChartProps>);
    expect(labelTexts().map((text, i) => isTruncationOf(text, replacements[i]))).toEqual([true, true, true]);

    // labels that now fit must render whole, not as stale truncations
    handle.update({ data: [
      { month: 'Jan', sales: 12 },
      { month: 'Feb', sales: 22 },
      { month: 'Mar', sales: 32 }
    ] } as Partial<DefaultChartProps>);
    handle.update({ focusedCategoryIndex: 2 } as Partial<DefaultChartProps>);
    expect(labelTexts()).toEqual(['Jan', 'Feb', 'Mar']);
  });
});

// Regression: the fitted prefix survived a config update that changed only the truncation text or the
// font, so the old prefix got the new suffix, and a new font kept the old font's fit
describe('tick-label truncation reset on a text or font change', () => {
  it('fits the label again from the full text when the truncation text changes', () => {
    const { container, handle } = mountChart();
    handle.update({ focusedCategoryIndex: 0 } as Partial<DefaultChartProps>);
    expect(labelTextsOf(container).every(text => text.endsWith('…'))).toBe(true);

    handle.update({ config: config({ tickLabel: { truncation: { text: ' (more)' } } }) } as Partial<DefaultChartProps>);
    handle.update({ focusedCategoryIndex: 1 } as Partial<DefaultChartProps>);
    const updated = labelTextsOf(container);
    expect(updated.every(text => text.endsWith(' (more)'))).toBe(true);

    // the same labels as a chart mounted with that text: a shorter prefix, since the suffix is wider
    const fresh = mountChart({ tickLabel: { truncation: { text: ' (more)' } } });
    fresh.handle.update({ focusedCategoryIndex: 0 } as Partial<DefaultChartProps>);
    expect(updated).toEqual(labelTextsOf(fresh.container));
  });

  it('fits the label again from the full text when only its font changes', () => {
    const { container, handle } = mountChart();
    handle.update({ focusedCategoryIndex: 0 } as Partial<DefaultChartProps>);
    const regular = labelTextsOf(container);

    // the bold font measures wider, so the same room holds fewer characters
    handle.update({ config: config({ tickLabel: { font: { weight: 'bold' } } }) } as Partial<DefaultChartProps>);
    handle.update({ focusedCategoryIndex: 1 } as Partial<DefaultChartProps>);
    const bold = labelTextsOf(container);
    expect(bold.map(text => text.length < regular[0].length)).toEqual([true, true, true]);
    const fresh = mountChart({ tickLabel: { font: { weight: 'bold' } } });
    fresh.handle.update({ focusedCategoryIndex: 0 } as Partial<DefaultChartProps>);
    expect(bold).toEqual(labelTextsOf(fresh.container));
  });
});

// Regression: a title (or legend text) narrower than the ellipsis shrank to '' and then jumped back to
// the whole text, re-entering measure() forever until the stack overflowed
describe('truncation narrower than the ellipsis', () => {
  it('settles a chart too narrow for even the ellipsis', () => {
    const container = mountContainer();
    expect(() => trackHandle(createDefaultChart(container, {
      config: {
        version: '1.0.0',
        animation: { enabled: false },
        title: { text: 'A long chart title', prefix: { text: 'Prefix' }, suffix: { text: 'Suffix' } },
        categoryAxis: { property: 'month', type: 'string', scale: 'ordinal' },
        series: [{ property: 'sales' }]
      } as unknown as MochartInputConfig,
      data: rows(0), width: 12, height: 150
    } as DefaultChartProps))).not.toThrow();
  });
});

