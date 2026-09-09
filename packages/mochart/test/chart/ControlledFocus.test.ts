/**
 * Controlled focus/filter props on createChart: set props override internal focus state on every
 * update (the controlled-chart contract, used to sync focus across charts); undefined = uncontrolled.
 */
import { describe, it, beforeAll, expect, vi } from 'vitest';
import { installSvgMeasurementShims } from '../components/svgShims';
import { installFakeFrameClock, runFrames, advanceFrames, mountContainer, barRects } from '../components/helpers';
import { getIdCssClass, getCssSelector, getCssClassMatchSelector } from '../../src/utils/ChartDom';

let mochart: typeof import('../../src');

beforeAll(async () => {
  installSvgMeasurementShims();
  installFakeFrameClock();
  mochart = await import('../../src');
});

const data = [
  { month: 'Jan', sales: 10, costs: 4 },
  { month: 'Feb', sales: 20, costs: 8 },
  { month: 'Mar', sales: 30, costs: 12 }
];

function mountChart() {
  const { createChart, enhanceConfig, ArrayOfObjectsDataProvider } = mochart;
  const mochartConfig = enhanceConfig({
    version: '1.0.0',
    animation: { enabled: false },
    categoryAxis: { property: 'month', type: 'string', scale: 'ordinal' },
    series: [
      { id: 'sales', property: 'sales', renderer: 'line' },
      { id: 'costs', property: 'costs', renderer: 'line' }
    ]
  });
  const container = mountContainer();
  const chart = createChart(container, {
    mochartConfig,
    dataProvider: new ArrayOfObjectsDataProvider(data),
    width: 300,
    height: 200
  });
  runFrames();
  return { chart, container };
}

/** Strip the per-instance numeric suffix from generated element/clipPath ids. */
function normalizedHtml(container: Element): string {
  return container.innerHTML.replace(/__(\d+)/g, '__X');
}

function seriesIds(container: Element): string[] {
  return Array.from(container.querySelectorAll(getCssSelector('series')))
    .map(el => Array.from(el.classList).find(c => c.startsWith(getIdCssClass('series', '')))!);
}

describe('controlled filteredSeriesIds', () => {
  it('filters and restores series through the prop alone', () => {
    const { chart, container } = mountChart();
    expect(seriesIds(container)).toEqual([getIdCssClass('series', 'sales'), getIdCssClass('series', 'costs')]);

    chart.update({ filteredSeriesIds: { costs: true } });
    runFrames();
    expect(seriesIds(container)).toEqual([getIdCssClass('series', 'sales')]);

    chart.update({ filteredSeriesIds: {} });
    runFrames();
    expect(seriesIds(container)).toEqual([getIdCssClass('series', 'sales'), getIdCssClass('series', 'costs')]);
  });

  // Regression: the map was read as "present" rather than "true", so a host
  // that spelled out the unfiltered series hid every one of them.
  // A host re-rendering with a fresh but equal object (the framework norm) must not re-run
  // getChartData: the provider read count is that pipeline's observable footprint.
  it.each([false, true])('does not recompute data for a value-identical fresh object (animate: %s)', animate => {
    const { createChart, enhanceConfig, ArrayOfObjectsDataProvider } = mochart;
    const dataProvider = new ArrayOfObjectsDataProvider(data);
    const reads = vi.spyOn(dataProvider, 'getPropertyValues');
    const container = mountContainer();
    const chart = createChart(container, {
      mochartConfig: enhanceConfig({
        version: '1.0.0',
        animation: { enabled: animate },
        categoryAxis: { property: 'month', type: 'string', scale: 'ordinal' },
        series: [
          { id: 'sales', property: 'sales', renderer: 'line' },
          { id: 'costs', property: 'costs', renderer: 'line' }
        ]
      }),
      dataProvider, width: 300, height: 200,
      filteredSeriesIds: { costs: true }
    });
    runFrames();
    expect(seriesIds(container)).toEqual([getIdCssClass('series', 'sales')]);

    reads.mockClear();
    chart.update({ filteredSeriesIds: { costs: true } });
    runFrames();
    expect(reads).not.toHaveBeenCalled();
    expect(seriesIds(container)).toEqual([getIdCssClass('series', 'sales')]);

    chart.update({ filteredSeriesIds: {} });
    runFrames();
    expect(reads).toHaveBeenCalled();
    expect(seriesIds(container)).toEqual([getIdCssClass('series', 'sales'), getIdCssClass('series', 'costs')]);
  });

  // Regression: reconcile took the host's echoed (fresh but equal) object as a host change and swapped
  // the identity applyExternal had deduped by value, so the legend toggle's data pipeline ran twice.
  it.each([false, true])('does not recompute data when a controlled host echoes a legend toggle (animate: %s)', animate => {
    const { createChart, enhanceConfig, ArrayOfObjectsDataProvider } = mochart;
    const dataProvider = new ArrayOfObjectsDataProvider(data);
    const reads = vi.spyOn(dataProvider, 'getPropertyValues');
    const container = mountContainer();
    let chart: ReturnType<typeof createChart> | null = null;
    const onSeriesFilter = vi.fn((filter: { filteredSeriesIds: Record<string, boolean> }) => {
      chart!.update({ filteredSeriesIds: { ...filter.filteredSeriesIds } });
    });
    chart = createChart(container, {
      mochartConfig: enhanceConfig({
        version: '1.0.0',
        animation: { enabled: animate },
        legend: { visible: true },
        categoryAxis: { property: 'month', type: 'string', scale: 'ordinal' },
        series: [
          { id: 'sales', property: 'sales', renderer: 'line' },
          { id: 'costs', property: 'costs', renderer: 'line' }
        ]
      }),
      dataProvider, width: 300, height: 200,
      filteredSeriesIds: {}, onSeriesFilter
    });
    runFrames();

    reads.mockClear();
    container.querySelector(getCssClassMatchSelector(getIdCssClass('legendItem', 'costs')))!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    runFrames();
    expect(onSeriesFilter).toHaveBeenCalledWith({ filteredSeriesIds: { costs: true } });
    // the toggle reads the provider once per property; the echo must not read it again
    expect(reads).toHaveBeenCalledTimes(3);
    expect(seriesIds(container)).toEqual([getIdCssClass('series', 'sales')]);
    chart.destroy();
  });

  it('treats an explicit false as not filtered', () => {
    const { chart, container } = mountChart();

    chart.update({ filteredSeriesIds: { sales: false, costs: false } });
    runFrames();
    expect(seriesIds(container)).toEqual([getIdCssClass('series', 'sales'), getIdCssClass('series', 'costs')]);

    chart.update({ filteredSeriesIds: { sales: false, costs: true } });
    runFrames();
    expect(seriesIds(container)).toEqual([getIdCssClass('series', 'sales')]);
  });
});

describe('synchronous host re-entrancy', () => {
  // Regression: reconcile fired onSeriesFilter before the new props were
  // committed, so a host that synchronously re-entered update() from the
  // callback (the vanilla demo) re-detected the same structural change forever.
  it('survives a host that re-enters update() from onSeriesFilter on a structural config change', () => {
    const { createChart, enhanceConfig, ArrayOfObjectsDataProvider } = mochart;
    const makeConfig = (categoryProperty: string) => enhanceConfig({
      version: '1.0.0',
      animation: { enabled: false },
      categoryAxis: { property: categoryProperty, type: 'string', scale: 'ordinal' },
      series: [
        { id: 'sales', property: 'sales', renderer: 'line' },
        { id: 'costs', property: 'costs', renderer: 'line' }
      ]
    });
    const rows = data.map((row, index) => ({ ...row, week: 'W' + index }));
    const container = mountContainer();

    const reported: Record<string, boolean>[] = [];
    const host = {
      chart: null as ReturnType<typeof createChart> | null,
      onSeriesFilter(filter: { filteredSeriesIds: Record<string, boolean> }) {
        reported.push(filter.filteredSeriesIds);
        // the demo pattern: clone (new identity) and synchronously push back
        host.chart!.update({ filteredSeriesIds: { ...filter.filteredSeriesIds } });
      }
    };
    host.chart = createChart(container, {
      mochartConfig: makeConfig('month'),
      dataProvider: new ArrayOfObjectsDataProvider(rows),
      width: 300, height: 200,
      filteredSeriesIds: {},
      onSeriesFilter: host.onSeriesFilter
    });
    runFrames();

    host.chart.update({ filteredSeriesIds: { costs: true } });
    runFrames();
    expect(seriesIds(container)).toEqual([getIdCssClass('series', 'sales')]);

    // structural change (new category property) with the filter carried along unchanged:
    // the reset must be reported exactly once, to a host that re-enters to echo it
    host.chart.update({
      mochartConfig: makeConfig('week'),
      dataProvider: new ArrayOfObjectsDataProvider(rows),
      filteredSeriesIds: { costs: true }
    });
    runFrames();

    expect(reported).toEqual([{}]);
    expect(seriesIds(container)).toEqual([getIdCssClass('series', 'sales'), getIdCssClass('series', 'costs')]);
  });

  // Regression: onSeriesFilter was invoked through the update() argument, so a host that
  // synchronously re-entered update() from onFocus with fresh closures had the superseded
  // onSeriesFilter notified and the newly committed one skipped.
  it('notifies the onSeriesFilter committed by a re-entrant update() from onFocus', () => {
    const { createChart, enhanceConfig, ArrayOfObjectsDataProvider } = mochart;
    const makeConfig = (categoryProperty: string) => enhanceConfig({
      version: '1.0.0',
      animation: { enabled: false },
      categoryAxis: { property: categoryProperty, type: 'string', scale: 'ordinal' },
      series: [
        { id: 'sales', property: 'sales', renderer: 'line' },
        { id: 'costs', property: 'costs', renderer: 'line' }
      ]
    });
    const rows = data.map((row, index) => ({ ...row, week: 'W' + index }));
    const container = mountContainer();
    const order: string[] = [];
    const staleFilter = vi.fn(() => order.push('stale'));
    const freshFilter = vi.fn(() => order.push('fresh'));
    let chart: ReturnType<typeof createChart> | null = null;
    const onFocus = vi.fn((focus: { focusedCategoryIndex: number }) => {
      order.push('focus');
      // the framework-adapter norm: echo the value back in a re-render that replaces every closure
      chart!.update({ focusedCategoryIndex: focus.focusedCategoryIndex, onSeriesFilter: freshFilter });
    });
    chart = createChart(container, {
      mochartConfig: makeConfig('month'),
      dataProvider: new ArrayOfObjectsDataProvider(rows),
      width: 300, height: 200,
      focusedCategoryIndex: 1, filteredSeriesIds: { costs: true },
      onFocus, onSeriesFilter: staleFilter
    });
    runFrames();

    // structural change with both controlled values carried along unchanged: both reset
    chart.update({
      mochartConfig: makeConfig('week'),
      dataProvider: new ArrayOfObjectsDataProvider(rows),
      focusedCategoryIndex: 1, filteredSeriesIds: { costs: true }
    });
    runFrames();

    expect(order).toEqual(['focus', 'fresh']);
    expect(staleFilter).not.toHaveBeenCalled();
    expect(freshFilter).toHaveBeenCalledWith({ filteredSeriesIds: {} });
    chart.destroy();
  });

  // Regression: the outer update() reported its pre-re-entry filter snapshot after a re-entrant
  // update() from onFocus had committed a newer host filter, so the host wrote the stale set back
  it('drops a pending filter report superseded by a re-entrant update() from onFocus', () => {
    const { createChart, enhanceConfig, ArrayOfObjectsDataProvider } = mochart;
    const makeConfig = (categoryProperty: string) => enhanceConfig({
      version: '1.0.0',
      animation: { enabled: false },
      categoryAxis: { property: categoryProperty, type: 'string', scale: 'ordinal' },
      series: [
        { id: 'sales', property: 'sales', renderer: 'line' },
        { id: 'costs', property: 'costs', renderer: 'line' }
      ]
    });
    const rows = data.map((row, index) => ({ ...row, week: 'W' + index }));
    const container = mountContainer();
    const onSeriesFilter = vi.fn();
    let chart: ReturnType<typeof createChart> | null = null;
    const onFocus = vi.fn(() => {
      chart!.update({ focusedCategoryIndex: -1, filteredSeriesIds: { sales: true } });
    });
    chart = createChart(container, {
      mochartConfig: makeConfig('month'),
      dataProvider: new ArrayOfObjectsDataProvider(rows),
      width: 300, height: 200,
      focusedCategoryIndex: 1, filteredSeriesIds: { costs: true },
      onFocus, onSeriesFilter
    });
    runFrames();

    // structural change resets focus and filters; the host picks a new filter from onFocus
    chart.update({
      mochartConfig: makeConfig('week'),
      dataProvider: new ArrayOfObjectsDataProvider(rows),
      focusedCategoryIndex: 1, filteredSeriesIds: { costs: true }
    });
    runFrames();

    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(onSeriesFilter).not.toHaveBeenCalled();
    expect(seriesIds(container)).toEqual([getIdCssClass('series', 'costs')]);
    chart.destroy();
  });

  // Regression: update() fired onFocus then onSeriesFilter with no destroyed check between them, so a
  // host tearing the chart down inside the first callback still heard the second from a destroyed chart
  it('stops notifying once the host destroys the chart from a callback', () => {
    const { createChart, enhanceConfig, ArrayOfObjectsDataProvider } = mochart;
    const makeConfig = (categoryProperty: string) => enhanceConfig({
      version: '1.0.0',
      animation: { enabled: false },
      categoryAxis: { property: categoryProperty, type: 'string', scale: 'ordinal' },
      series: [
        { id: 'sales', property: 'sales', renderer: 'line' },
        { id: 'costs', property: 'costs', renderer: 'line' }
      ]
    });
    const rows = data.map((row, index) => ({ ...row, week: 'W' + index }));
    const container = mountContainer();
    let chart: ReturnType<typeof createChart> | null = null;
    const onSeriesFilter = vi.fn();
    const onFocus = vi.fn(() => chart!.destroy());
    chart = createChart(container, {
      mochartConfig: makeConfig('month'),
      dataProvider: new ArrayOfObjectsDataProvider(rows),
      width: 300, height: 200,
      focusedCategoryIndex: 1, filteredSeriesIds: { costs: true },
      onFocus, onSeriesFilter
    });
    runFrames();

    chart.update({
      mochartConfig: makeConfig('week'),
      dataProvider: new ArrayOfObjectsDataProvider(rows),
      focusedCategoryIndex: 1, filteredSeriesIds: { costs: true }
    });
    runFrames();

    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(onSeriesFilter).not.toHaveBeenCalled();
  });

  it('stops notifying once the host destroys the chart from onSeriesFilter on a legend click', () => {
    const { chart, container } = mountChart();
    const onSeriesFilter = vi.fn(() => chart.destroy());
    const onFocus = vi.fn();
    chart.update({ focusedSeriesId: 'costs', onSeriesFilter, onFocus });
    runFrames();
    onFocus.mockClear();

    // filtering the focused series clears the focus, which used to be reported after the destroy
    const item = container.querySelector(getCssClassMatchSelector(getIdCssClass('legendItem', 'costs')))!;
    item.dispatchEvent(new MouseEvent('click'));
    runFrames();

    expect(onSeriesFilter).toHaveBeenCalledTimes(1);
    expect(onFocus).not.toHaveBeenCalled();
  });

  // Regression: the same click kept bubbling to the chart root's own click handler, which mapped the
  // point through the plot rect ref the destroy had already cleared, and threw
  it('ignores a pointer event that reaches the root after a child handler destroyed the chart', () => {
    const { chart, container } = mountChart();
    const onSeriesFilter = vi.fn(() => chart.destroy());
    chart.update({ onSeriesFilter });
    runFrames();
    const item = container.querySelector(getCssClassMatchSelector(getIdCssClass('legendItem', 'costs')))!;
    // jsdom reports a listener exception through window's error event rather than from dispatchEvent
    const errors: string[] = [];
    const onError = (event: ErrorEvent) => { errors.push(event.message); event.preventDefault(); };
    window.addEventListener('error', onError);
    try {
      item.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 10, clientY: 10 }));
      runFrames();
    }
    finally {
      window.removeEventListener('error', onError);
    }
    expect(errors).toEqual([]);
    expect(onSeriesFilter).toHaveBeenCalledTimes(1);
  });
});

describe('controlled focus props', () => {
  it('re-renders focus state from focusedSeriesId and focusedCategoryIndex', () => {
    const { chart, container } = mountChart();
    const unfocusedHtml = container.innerHTML;

    chart.update({ focusedSeriesId: 'sales', focusedCategoryIndex: 1 });
    runFrames();
    const focusedHtml = container.innerHTML;
    expect(focusedHtml).not.toBe(unfocusedHtml);

    chart.update({ focusedSeriesId: null, focusedCategoryIndex: -1 });
    runFrames();
    expect(container.innerHTML).toBe(unfocusedHtml);
  });

  // Regression: only focusedCategoryIndex was range-checked, so mirroring focus
  // between charts that do not share ids threw instead of rendering unfocused.
  it('ignores a focusedSeriesId or focusedValueAxisId that names nothing', () => {
    const { chart, container } = mountChart();
    const unfocusedHtml = container.innerHTML;

    chart.update({ focusedSeriesId: 'notASeries' });
    runFrames();
    expect(container.innerHTML).toBe(unfocusedHtml);

    chart.update({ focusedSeriesId: null, focusedValueAxisId: 'notAnAxis' });
    runFrames();
    expect(container.innerHTML).toBe(unfocusedHtml);

    chart.update({ focusedValueAxisId: null, focusedCategoryIndex: 99 });
    runFrames();
    expect(container.innerHTML).toBe(unfocusedHtml);
  });

  it('mounts with a focusedSeriesId that names nothing', () => {
    const { createChart, enhanceConfig, ArrayOfObjectsDataProvider } = mochart;
    const mochartConfig = enhanceConfig({
      version: '1.0.0',
      animation: { enabled: false },
      categoryAxis: { property: 'month', type: 'string', scale: 'ordinal' },
      series: [{ id: 'sales', property: 'sales', renderer: 'line' }]
    });
    const container = mountContainer();
    createChart(container, {
      mochartConfig,
      dataProvider: new ArrayOfObjectsDataProvider(data),
      width: 300,
      height: 200,
      focusedSeriesId: 'fromAnotherChart',
      focusedValueAxisId: 'alsoUnknown'
    });
    runFrames();
    expect(seriesIds(container)).toEqual([getIdCssClass('series', 'sales')]);
  });

  it('mirrors one chart\'s reported focus into another chart', () => {
    // The demo pattern: chart A reports focus via onFocus, the host passes the
    // snapshot into chart B as controlled props.
    const a = mountChart();
    const b = mountChart();
    const baseline = normalizedHtml(b.container);

    // drive A internally (as a pointer interaction would) and take the same
    // snapshot the onFocus callback reports
    const directlyFocused = mountChart();
    directlyFocused.chart.update({ focusedSeriesId: 'costs' });
    runFrames();

    b.chart.update({ focusedSeriesId: 'costs' });
    runFrames();
    expect(normalizedHtml(b.container)).not.toBe(baseline);
    expect(normalizedHtml(b.container)).toBe(normalizedHtml(directlyFocused.container));

    a.chart.destroy();
  });

  // Regression: reconcile-driven events fired at the PREVIOUS props' callbacks,
  // so a host replacing its closures in the render that changed the data (the
  // framework-adapter norm) had the stale closure notified and the new one skipped.
  it('notifies the callbacks committed in the same update, not the replaced ones', () => {
    const { createChart, enhanceConfig, ArrayOfObjectsDataProvider } = mochart;
    const mochartConfig = enhanceConfig({
      version: '1.0.0',
      animation: { enabled: false },
      categoryAxis: { property: 'month', type: 'string', scale: 'ordinal' },
      series: [{ id: 'sales', property: 'sales', renderer: 'line' }]
    });
    const container = mountContainer();
    const staleFocus = vi.fn();
    const freshFocus = vi.fn();
    const props = {
      mochartConfig,
      dataProvider: new ArrayOfObjectsDataProvider(data),
      width: 300,
      height: 200,
      onFocus: staleFocus
    };
    const chart = createChart(container, { ...props, focusedCategoryIndex: 1 });
    runFrames();
    chart.replace(props); // release the controlled value, keeping internal focus on Feb

    // one update swaps the data AND the callback, as a framework re-render does
    const [jan, feb, mar] = data;
    chart.update({
      dataProvider: new ArrayOfObjectsDataProvider([feb, jan, mar]),
      onFocus: freshFocus
    });
    runFrames();

    expect(staleFocus).not.toHaveBeenCalled();
    expect(freshFocus).toHaveBeenCalledTimes(1);
    expect(freshFocus).toHaveBeenCalledWith(expect.objectContaining({ focusedCategoryIndex: 0 }));
    chart.destroy();
  });

  // Regression: reconcile snapshotted its reset/remap before the new controlled props were
  // applied, so a host changing the data AND its controlled values in one update was told the
  // reset of its OLD values (-1, {}) and, echoing that back, lost the values it had just set.
  it('does not report a reset/remap of controlled values the host changed in the same update', () => {
    const { createChart, enhanceConfig, ArrayOfObjectsDataProvider } = mochart;
    const makeConfig = (categoryProperty: string) => enhanceConfig({
      version: '1.0.0',
      animation: { enabled: false },
      categoryAxis: { property: categoryProperty, type: 'string', scale: 'ordinal' },
      series: [
        { id: 'sales', property: 'sales', renderer: 'line' },
        { id: 'costs', property: 'costs', renderer: 'line' }
      ]
    });
    const rows = data.map((row, index) => ({ ...row, week: 'W' + index }));
    const container = mountContainer();
    const onFocus = vi.fn();
    const onSeriesFilter = vi.fn();
    const chart = createChart(container, {
      mochartConfig: makeConfig('month'),
      dataProvider: new ArrayOfObjectsDataProvider(rows),
      width: 300, height: 200,
      focusedCategoryIndex: 1, filteredSeriesIds: { sales: true },
      onFocus, onSeriesFilter
    });
    runFrames();

    // structural change (new category property) with new controlled values, as a host that
    // reset or remapped its own state in the same render does
    chart.update({
      mochartConfig: makeConfig('week'),
      dataProvider: new ArrayOfObjectsDataProvider(rows),
      focusedCategoryIndex: 2, filteredSeriesIds: { costs: true }
    });
    runFrames();

    expect(onFocus).not.toHaveBeenCalled();
    expect(onSeriesFilter).not.toHaveBeenCalled();
    expect(seriesIds(container)).toEqual([getIdCssClass('series', 'sales')]);

    // a data reorder with the controlled index carried along unchanged still reports the remap
    const [w0, w1, w2] = rows;
    chart.update({ dataProvider: new ArrayOfObjectsDataProvider([w2, w0, w1]), focusedCategoryIndex: 2 });
    runFrames();
    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(onFocus).toHaveBeenCalledWith(expect.objectContaining({ focusedCategoryIndex: 0 }));
    expect(onSeriesFilter).not.toHaveBeenCalled();
    chart.destroy();
  });

  // Regression: the reset was reported but then undone by re-applying the unchanged controlled
  // value, so the chart rendered the host's stale filter while telling the host it was empty
  it('renders the reset it reports when the host carries a controlled value along unchanged, until the host re-asserts it', () => {
    const { createChart, enhanceConfig, ArrayOfObjectsDataProvider } = mochart;
    const makeConfig = (categoryProperty: string) => enhanceConfig({
      version: '1.0.0',
      animation: { enabled: false },
      categoryAxis: { property: categoryProperty, type: 'string', scale: 'ordinal' },
      series: [
        { id: 'sales', property: 'sales', renderer: 'line' },
        { id: 'costs', property: 'costs', renderer: 'line' }
      ]
    });
    const rows = data.map((row, index) => ({ ...row, week: 'W' + index }));
    const container = mountContainer();
    const onSeriesFilter = vi.fn();
    const filtered = { costs: true };
    const chart = createChart(container, {
      mochartConfig: makeConfig('month'),
      dataProvider: new ArrayOfObjectsDataProvider(rows),
      width: 300, height: 200,
      filteredSeriesIds: filtered, onSeriesFilter
    });
    runFrames();
    expect(seriesIds(container)).toEqual([getIdCssClass('series', 'sales')]);

    // structural change, the same filter object carried along, and a host that does not echo
    chart.update({ mochartConfig: makeConfig('week'), dataProvider: new ArrayOfObjectsDataProvider(rows), filteredSeriesIds: filtered });
    runFrames();
    expect(onSeriesFilter).toHaveBeenCalledTimes(1);
    expect(onSeriesFilter).toHaveBeenCalledWith({ filteredSeriesIds: {} });
    expect(seriesIds(container)).toEqual([getIdCssClass('series', 'sales'), getIdCssClass('series', 'costs')]);

    // the host re-asserts its value on its next render: the chart follows it, silently
    chart.update({ filteredSeriesIds: filtered });
    runFrames();
    expect(onSeriesFilter).toHaveBeenCalledTimes(1);
    expect(seriesIds(container)).toEqual([getIdCssClass('series', 'sales')]);
    chart.destroy();
  });
});

describe('focusedCategoryIndex on mount with animation', () => {
  // Regression: the entrance delta lists every category as added, so the value-start focus
  // rebuild remapped the pinned category through an empty old index set and tweened it back
  // from unfocused over two focus durations.
  it('keeps the pinned category focused from the first frame', () => {
    const { createChart, enhanceConfig, ArrayOfObjectsDataProvider } = mochart;
    const mochartConfig = enhanceConfig({
      version: '1.0.0',
      animation: { enabled: true, focusDuration: 800 },
      categoryAxis: { property: 'month', type: 'string', scale: 'ordinal' },
      series: [{ id: 'sales', property: 'sales', renderer: 'bar' }]
    });
    const container = mountContainer();
    createChart(container, {
      mochartConfig,
      dataProvider: new ArrayOfObjectsDataProvider(data),
      width: 300,
      height: 200,
      focusedCategoryIndex: 1
    });
    const opacities = () => barRects(container, 'sales').map(bar => bar.path.getAttribute('fill-opacity'));
    advanceFrames(3);
    const early = opacities();
    runFrames();
    expect(early).toEqual(opacities());
    expect(early[1]).not.toBe(early[0]);
    expect(early[0]).toBe(early[2]);
  });
});
