/**
 * Tooltip row hot path: a series row re-syncs only when its own inputs change. The content's
 * handlers and row styles keep their identity across syncs, so rows for untouched series skip.
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { installSvgMeasurementShims } from './svgShims';
import { mockBoundingClientRect, mountContainer, trackHandle } from './helpers';
import { createDefaultChart } from '../../src/createChart';
import { TooltipSeriesLine } from '../../src/components/TooltipContent';
import type { ChartFocus, ChartSeriesFilter, DefaultChartProps } from '../../src/types/chart';
import type { MochartInputConfig } from '../../src/types/config';
import { getCssSelector, getChartRootCssSelector, getCssClassMatchSelector, getIdCssClass } from '../../src/utils/ChartDom';

const WIDTH = 800;
const HEIGHT = 600;

const rows = [
  { month: 'Jan', sales: 10, costs: 5 },
  { month: 'Feb', sales: 20, costs: 8 },
  { month: 'Mar', sales: 30, costs: 13 }
];

// only costs changes, and only at Jan (the tooltip's category); the axis domain is unchanged
const salesChanged = [
  { month: 'Jan', sales: 11, costs: 5 },
  { month: 'Feb', sales: 20, costs: 8 },
  { month: 'Mar', sales: 30, costs: 13 }
];
const costsChanged = [
  { month: 'Jan', sales: 10, costs: 6 },
  { month: 'Feb', sales: 20, costs: 8 },
  { month: 'Mar', sales: 30, costs: 13 }
];

function makeConfig(tooltip: Record<string, unknown> = {}): MochartInputConfig {
  return {
    version: '1.0.0',
    animation: { enabled: false },
    tooltip,
    categoryAxis: { property: 'month', type: 'string', scale: 'ordinal' },
    valueAxes: [{ min: 0, max: 40 }],
    series: [
      { id: 'S0', property: 'sales', renderer: 'bar' },
      { id: 'S1', property: 'costs', renderer: 'bar' }
    ]
  } as unknown as MochartInputConfig;
}

const syncSpy = vi.spyOn(TooltipSeriesLine.prototype, 'sync');

/** series ids of the rows synced since the last mockClear */
function syncedSeriesIds(): string[] {
  return syncSpy.mock.contexts.map(line => (line as TooltipSeriesLine).props.seriesConfig.id);
}

function mountChart(config: MochartInputConfig, callbacks: Partial<DefaultChartProps> = {}) {
  const container = mountContainer();
  const handle = trackHandle(createDefaultChart(container, {
    config, data: rows, width: WIDTH, height: HEIGHT, ...callbacks
  } as DefaultChartProps));
  return { container, handle };
}

function mouse(target: Element, type: string, clientX: number, clientY: number): void {
  target.dispatchEvent(new MouseEvent(type, { clientX, clientY, bubbles: true }));
}

function openTooltip(container: Element): void {
  const root = container.querySelector(getChartRootCssSelector())!;
  mouse(root, 'mouseenter', 100, 100);
  mouse(root, 'click', 100, 100);
  expect(container.querySelector(getCssSelector('tooltip'))).not.toBeNull();
}

function tooltipRow(container: Element, seriesId: string): HTMLElement {
  return container.querySelector<HTMLElement>(getCssSelector('tooltip') + ' '
    + getCssClassMatchSelector(getIdCssClass('tooltipSeriesLine', seriesId)))!;
}

beforeAll(() => {
  installSvgMeasurementShims();
  mockBoundingClientRect(WIDTH, HEIGHT);
});

describe('tooltip row sync', () => {
  it('re-syncs only the rows whose series changed on a data update', () => {
    const { container, handle } = mountChart(makeConfig());
    openTooltip(container);
    expect(syncedSeriesIds()).toContain('S0');
    syncSpy.mockClear();

    handle.update({ data: costsChanged } as Partial<DefaultChartProps>);

    const synced = syncedSeriesIds();
    expect(synced).toContain('S1');
    expect(synced).not.toContain('S0');
    expect(container.querySelector(getCssSelector('tooltip'))!.textContent).toContain('6');
  });

  // Regression: the collapsed sizer style was spread fresh each sync, so with showFiltered off the
  // filtered series' collapsed rows re-synced on every content sync even when nothing of theirs changed
  it('skips collapsed filtered rows when a data update touches only a visible series', () => {
    const { container, handle } = mountChart(makeConfig({ showFiltered: false }));
    handle.update({ filteredSeriesIds: { S1: true } } as Partial<DefaultChartProps>);
    openTooltip(container);
    const tooltip = container.querySelector(getCssSelector('tooltip'))!;
    expect(tooltip.textContent).not.toContain('costs');

    syncSpy.mockClear();
    handle.update({ data: salesChanged } as Partial<DefaultChartProps>);
    expect(tooltip.textContent).toContain('11');
    const synced = syncedSeriesIds();
    expect(synced).toContain('S0');
    expect(synced).not.toContain('S1');
  });

  it('still routes row hover and click to the row series through the shared handlers', () => {
    const focuses: ChartFocus[] = [];
    const filters: ChartSeriesFilter[] = [];
    const { container } = mountChart(makeConfig({ focusSeriesOnHover: true, filterSeriesOnClick: true }),
      { onFocus: focus => { focuses.push(focus); }, onSeriesFilter: filter => { filters.push(filter); } });
    openTooltip(container);

    const row = tooltipRow(container, 'S1');
    row.dispatchEvent(new MouseEvent('pointerenter'));
    expect(focuses[focuses.length - 1].focusedSeriesId).toBe('S1');

    row.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(filters[filters.length - 1].filteredSeriesIds).toEqual({ S1: true });
  });
});
