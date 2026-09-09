// The fraction guards that hide series labels which would not fit: by position within the value domain, and by the extent of the value itself.
import { describe, it, expect, beforeAll } from 'vitest';
import { installSvgMeasurementShims } from './svgShims';
import { mountContainer, trackHandle, mockBoundingClientRect } from './helpers';
import { createDefaultChart } from '../../src/createChart';
import type { DefaultChartProps } from '../../src/types/chart';
import type { MochartInputConfig } from '../../src/types/config';
import { getCssSelector } from '../../src/utils/ChartDom';

const WIDTH = 800;
const HEIGHT = 600;

const rows = [
  { month: 'Jan', sales: 10, floor: 8 },
  { month: 'Feb', sales: 50, floor: 10 },
  { month: 'Mar', sales: 100, floor: 20 }
];

function surviving(container: Element): string[] {
  return [...container.querySelectorAll(getCssSelector('seriesLabel'))].map((label) => label.textContent ?? '');
}

function labelTexts(seriesOverrides: Record<string, unknown>, valueAxes?: unknown[], data: object[] = rows): string[] {
  const container = mountContainer();
  const config = {
    version: '1.0.0',
    animation: { enabled: false },
    categoryAxis: { property: 'month', type: 'string', scale: 'ordinal' },
    series: [{ property: 'sales', renderer: 'bar', labelProperty: 'sales', ...seriesOverrides }],
    ...(valueAxes ? { valueAxes } : {})
  } as unknown as MochartInputConfig;
  trackHandle(createDefaultChart(container, {
    config, data, width: WIDTH, height: HEIGHT
  } as DefaultChartProps));
  return surviving(container);
}

// symmetric around a base of 0: domain −100–100 (extent 200), so a fraction f is 200f value units from the base or the far edge
const basedRows = [-100, -50, -10, 0, 10, 50, 100].map((sales, i) => ({ month: 'M' + i, sales }));

function basedLabelTexts(seriesOverrides: Record<string, unknown>): string[] {
  return labelTexts(seriesOverrides, [{ base: 0 }], basedRows);
}

beforeAll(() => {
  installSvgMeasurementShims();
  mockBoundingClientRect(WIDTH, HEIGHT);
});

describe('series label fraction guards', () => {
  it('labels every category when no guard is set', () => {
    expect(labelTexts({})).toEqual(['10.00', '50.00', '100.00']);
  });

  it('hides labels below labelMinPositionFraction', () => {
    // domain 10–100, so the guard hides everything positioned below 55
    expect(labelTexts({ label: { minPositionFraction: 0.5 } })).toEqual(['100.00']);
  });

  it('hides labels above labelMaxPositionFraction', () => {
    expect(labelTexts({ label: { maxPositionFraction: 0.5 } })).toEqual(['10.00', '50.00']);
  });

  it('hides labels whose value spans less than labelMinRangeFraction', () => {
    // no axis base, so each unstacked value measures from the domain minimum: domain 10-100, extent 90,
    // so the guard is 45 and only the 100 bar (spanning 90) survives
    expect(labelTexts({ label: { minRangeFraction: 0.5 } }, [{ base: null }])).toEqual(['100.00']);
  });

  // Regression: an unstacked value measured its span from zero, so the guard was inert on any chart
  // whose bars do not start there — a 55 bar on a 50-100 axis counted as spanning 55, not 5
  it('measures an unstacked value from the axis base, not from zero', () => {
    const rowsAboveBase = [{ month: 'Jan', sales: 55 }, { month: 'Feb', sales: 90 }];
    expect(labelTexts({ label: { minRangeFraction: 0.2 } }, [{ base: 50, min: 50, max: 100 }], rowsAboveBase))
      .toEqual(['90.00']);
  });

  it('falls back to the domain minimum when the axis has no base', () => {
    const rowsAboveBase = [{ month: 'Jan', sales: 55 }, { month: 'Feb', sales: 90 }];
    expect(labelTexts({ label: { minRangeFraction: 0.2 } }, [{ base: null, min: 50, max: 100 }], rowsAboveBase))
      .toEqual(['90.00']);
  });

  it('measures a stacked series against the domain minimum when the axis has no base', () => {
    const container = mountContainer();
    trackHandle(createDefaultChart(container, {
      config: {
        version: '1.0.0',
        animation: { enabled: false },
        categoryAxis: { property: 'month', type: 'string', scale: 'ordinal' },
        valueAxes: [{ id: 'VA0', base: null }],
        seriesStacks: [{ id: 'S', axis: 'VA0' }],
        series: [
          { property: 'floor', renderer: 'bar', stack: 'S', axis: 'VA0' },
          { property: 'sales', renderer: 'bar', stack: 'S', axis: 'VA0',
            labelProperty: 'sales', label: { minRangeFraction: 0.5 } }
        ]
      } as unknown as MochartInputConfig,
      data: rows, width: WIDTH, height: HEIGHT
    } as DefaultChartProps));
    // stack extents 10/50/100 against a threshold of half the stacked domain: only Mar survives
    expect(surviving(container)).toEqual(['100.00']);
  });

  it('measures below-base stacked segments by their extent', () => {
    const container = mountContainer();
    trackHandle(createDefaultChart(container, {
      config: {
        version: '1.0.0',
        animation: { enabled: false },
        categoryAxis: { property: 'month', type: 'string', scale: 'ordinal' },
        valueAxes: [{ id: 'VA0' }],
        seriesStacks: [{ id: 'S', axis: 'VA0' }],
        series: [
          { property: 'sales', renderer: 'bar', stack: 'S', axis: 'VA0',
            labelProperty: 'sales', label: { minRangeFraction: 0.45 } }
        ]
      } as unknown as MochartInputConfig,
      data: rows.map((row) => ({ ...row, sales: -row.sales })), width: WIDTH, height: HEIGHT
    } as DefaultChartProps));
    // segments extend 10/50/100 below the base; the negative sign must not hide the two that clear the threshold
    expect(surviving(container)).toEqual(['−50.00', '−100.00']);
  });

  it('measures a ranged series against its own range property', () => {
    // range extents 2/40/80 against half of the 8–100 domain: only Mar survives
    expect(labelTexts(
      { rangeProperty: 'floor', label: { minRangeFraction: 0.5 } },
      [{ base: null }]
    )).toEqual(['100.00']);
  });
});

describe('series label fraction guards split at the axis base', () => {
  it('labels every category when only the base is set', () => {
    expect(basedLabelTexts({})).toEqual(['−100.00', '−50.00', '−10.00', '0.00', '10.00', '50.00', '100.00']);
  });

  it('measures labelAboveBaseMinPositionFraction up from the base and leaves below-base labels alone', () => {
    // 0.2 × 200 = 40 above the base hides 0 (which counts as above) and 10
    expect(basedLabelTexts({ label: { aboveBase: { minPositionFraction: 0.2 } } }))
      .toEqual(['−100.00', '−50.00', '−10.00', '50.00', '100.00']);
  });

  it('measures labelAboveBaseMaxPositionFraction down from the domain maximum', () => {
    // 100 − 0.3 × 200 = 40 hides 50 and 100
    expect(basedLabelTexts({ label: { aboveBase: { maxPositionFraction: 0.3 } } }))
      .toEqual(['−100.00', '−50.00', '−10.00', '0.00', '10.00']);
  });

  it('measures labelBelowBaseMinPositionFraction down from the base, keeping only the values that reach it', () => {
    // 0 − 0.2 × 200 = −40: the guard inverts below the base, so −10 hides and −50/−100 stay
    expect(basedLabelTexts({ label: { belowBase: { minPositionFraction: 0.2 } } }))
      .toEqual(['−100.00', '−50.00', '0.00', '10.00', '50.00', '100.00']);
  });

  it('measures labelBelowBaseMaxPositionFraction up from the domain minimum', () => {
    // −100 + 0.3 × 200 = −40 hides −50 and −100
    expect(basedLabelTexts({ label: { belowBase: { maxPositionFraction: 0.3 } } }))
      .toEqual(['−10.00', '0.00', '10.00', '50.00', '100.00']);
  });

  it('applies labelMinPositionFraction on both sides of the base when the base fractions are auto', () => {
    // 40 units either side of the base rather than 40 above the domain minimum
    expect(basedLabelTexts({ label: { minPositionFraction: 0.2 } }))
      .toEqual(['−100.00', '−50.00', '50.00', '100.00']);
  });

  it('applies labelMaxPositionFraction from both domain edges when the base fractions are auto', () => {
    expect(basedLabelTexts({ label: { maxPositionFraction: 0.3 } }))
      .toEqual(['−10.00', '0.00', '10.00']);
  });

  it('lets a null base fraction exempt one side from the inherited bound', () => {
    expect(basedLabelTexts({ label: { minPositionFraction: 0.2, belowBase: { minPositionFraction: null } } }))
      .toEqual(['−100.00', '−50.00', '−10.00', '50.00', '100.00']);
  });

  it('lets an explicit base fraction override the inherited bound on its side only', () => {
    // above uses 0.2 (40), below uses 0.4 (−80)
    expect(basedLabelTexts({ label: { minPositionFraction: 0.2, belowBase: { minPositionFraction: 0.4 } } }))
      .toEqual(['−100.00', '50.00', '100.00']);
  });

  it('ignores the base fractions when the axis has no base', () => {
    expect(labelTexts({ label: { aboveBase: { minPositionFraction: 0.9 }, belowBase: { minPositionFraction: 0.9 } } }, [{ base: null }], basedRows))
      .toEqual(['−100.00', '−50.00', '−10.00', '0.00', '10.00', '50.00', '100.00']);
  });
});
