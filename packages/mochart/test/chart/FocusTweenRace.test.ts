/**
 * Focus changes racing the animated data source's tweens.
 *
 * Regression: a series-only focus change landing inside the focus tween's cancel-window delay built
 * its target from focusData's stale pre-pin category index, silently dropping the category pin.
 * The tween target must always derive from the input focus.
 *
 * Mid-data-tween remap: the rendered category index space moves through old → merged → new as the
 * data tween runs. External focus (new space) must land on the rendered bar for that category, and
 * hovers on rendered bars must report back in new space (or no focus for a category being removed).
 */
import { describe, it, beforeAll, expect } from 'vitest';
import { installSvgMeasurementShims } from '../components/svgShims';
import { installFakeFrameClock, runFrames, advanceFrames, mountContainer, mockBoundingClientRect } from '../components/helpers';
import { getIdCssSelector, getDescendantCssSelector } from '../../src/utils/ChartDom';
import type { ChartFocus } from '../../src/types/chart';
import type { MochartInputConfig } from '../../src/types/config';

let mochart: typeof import('../../src');

beforeAll(async () => {
  installSvgMeasurementShims();
  mockBoundingClientRect(300, 200);
  installFakeFrameClock();
  mochart = await import('../../src');
});

const data = [
  { month: 'Jan', sales: 10, costs: 4 },
  { month: 'Feb', sales: 20, costs: 8 },
  { month: 'Mar', sales: 30, costs: 12 }
];

interface MountOptions {
  config?: Partial<MochartInputConfig>;
  series?: Record<string, unknown>;
  onFocus?: (focus: ChartFocus) => void;
}

function mountChart({ config = {}, series = {}, onFocus }: MountOptions = {}) {
  const { createChart, enhanceConfig, ArrayOfObjectsDataProvider } = mochart;
  const mochartConfig = enhanceConfig({
    version: '1.0.0',
    categoryAxis: { property: 'month', type: 'string', scale: 'ordinal' },
    series: [
      { id: 'sales', property: 'sales', renderer: 'bar', ...series },
      { id: 'costs', property: 'costs', renderer: 'bar', ...series }
    ],
    ...config
  } as MochartInputConfig);
  const container = mountContainer();
  const chart = createChart(container, {
    mochartConfig,
    dataProvider: new ArrayOfObjectsDataProvider(data),
    width: 300,
    height: 200,
    onFocus
  });
  runFrames();
  return { chart, container };
}

function barOpacities(container: Element, seriesId: string): (string | null)[] {
  return Array.from(container.querySelectorAll(getIdCssSelector('series', seriesId) + ' path'))
    .map(path => path.getAttribute('fill-opacity'));
}

describe('focus tween target', () => {
  it('keeps the category pin when a series focus lands inside the cancel window', () => {
    const { chart, container } = mountChart();

    // pin the category, then focus a series before any frame runs — the
    // category tween is still inside its start delay when it gets canceled
    chart.update({ focusedCategoryIndex: 1 });
    chart.update({ focusedCategoryIndex: 1, focusedSeriesId: 'sales' });
    runFrames();

    // costs is series-defocused (0.5), but its bar at the pinned category
    // still combines in the category focus (1); losing the pin renders 0.5,0.5,0.5
    expect(barOpacities(container, 'costs')).toEqual(['0.5', '1', '0.5']);
    // the focused series is fully focused throughout
    expect(barOpacities(container, 'sales')).toEqual(['1', '1', '1']);

    // clearing the series focus alone leaves the pure category-pinned state
    chart.update({ focusedCategoryIndex: 1, focusedSeriesId: null });
    runFrames();
    expect(barOpacities(container, 'costs')).toEqual(['0.5', '1', '0.5']);
    expect(barOpacities(container, 'sales')).toEqual(['0.5', '1', '0.5']);
  });
});

describe('mid-tween focus remap', () => {
  // long data phases so several focus tweens (16ms) fit inside each; the tick labels name the rendered category space
  const slowData = { animation: { expansionDuration: 3200, valueChangeDuration: 3200, contractionDuration: 1600, focusDuration: 16 } };
  const NORMAL = '0.8', FOCUSED = '1', DEFOCUSED = '0.5';

  function tickLabels(container: Element): string[] {
    return Array.from(container.querySelectorAll(getDescendantCssSelector('categoryAxis', 'axisTickLabels', 'axisTickLabel') + ' text'))
      .map(text => text.textContent ?? '');
  }

  function hoverBar(container: Element, index: number): void {
    const bar = container.querySelector(getIdCssSelector('series', 'sales') + ' ' + getIdCssSelector('seriesBar', index));
    expect(bar, 'bar ' + index).not.toBeNull();
    bar!.dispatchEvent(new MouseEvent('pointerenter', { bubbles: true }));
  }

  /** Step frames until the rendered categories match; fails rather than spinning past the tween. */
  function advanceUntilCategories(container: Element, categories: string[]): void {
    for (let frame = 0; frame < 400; frame++) {
      if (tickLabels(container).join() === categories.join()) {
        return;
      }
      advanceFrames(1);
    }
    expect.fail('never rendered categories ' + categories.join());
  }

  /** Let the (16ms + 5ms delay) focus tween land without leaving the current data phase. */
  function settleFocus(): void {
    advanceFrames(3);
  }

  function mountRemapChart() {
    const focuses: ChartFocus[] = [];
    const mounted = mountChart({ config: slowData, series: { focusCategoryOnHover: true }, onFocus: focus => focuses.push(focus) });
    const lastFocusedCategory = () => focuses[focuses.length - 1].focusedCategoryIndex;
    return { ...mounted, lastFocusedCategory };
  }

  it('maps focus through old, merged and new category spaces across additions and removals', () => {
    const { chart, container, lastFocusedCategory } = mountRemapChart();
    const { ArrayOfObjectsDataProvider } = mochart;

    // Jan,Feb,Mar → Feb,Mar,Apr: Jan leaves, Apr arrives, and Apr's larger value expands the axis
    chart.update({ dataProvider: new ArrayOfObjectsDataProvider([
      { month: 'Feb', sales: 20, costs: 8 },
      { month: 'Mar', sales: 30, costs: 12 },
      { month: 'Apr', sales: 40, costs: 16 }
    ]) });
    advanceFrames(1);
    // expansion phase renders the old categories
    expect(tickLabels(container)).toEqual(['Jan', 'Feb', 'Mar']);

    // external focus is in new space: Feb (0) is the second rendered bar
    chart.update({ focusedCategoryIndex: 0 });
    settleFocus();
    expect(tickLabels(container)).toEqual(['Jan', 'Feb', 'Mar']);
    expect(barOpacities(container, 'sales')).toEqual([DEFOCUSED, FOCUSED, DEFOCUSED]);

    // hovering the rendered Mar bar (old 2) reports Mar's new index (1) and focuses that bar
    hoverBar(container, 2);
    expect(lastFocusedCategory()).toBe(1);
    settleFocus();
    expect(barOpacities(container, 'sales')).toEqual([DEFOCUSED, DEFOCUSED, FOCUSED]);

    // hovering the departing Jan bar has no new-space index: focus clears
    hoverBar(container, 0);
    expect(lastFocusedCategory()).toBe(-1);
    settleFocus();
    expect(barOpacities(container, 'sales')).toEqual([NORMAL, NORMAL, NORMAL]);

    // pinning Apr (2) before it renders focuses nothing yet...
    chart.update({ focusedCategoryIndex: 2 });
    settleFocus();
    expect(tickLabels(container)).toEqual(['Jan', 'Feb', 'Mar']);
    expect(barOpacities(container, 'sales')).toEqual([NORMAL, NORMAL, NORMAL]);

    // ...and lands on Apr's merged bar (3) once the value phase adds it
    advanceUntilCategories(container, ['Jan', 'Feb', 'Mar', 'Apr']);
    settleFocus();
    expect(barOpacities(container, 'sales')).toEqual([DEFOCUSED, DEFOCUSED, DEFOCUSED, FOCUSED]);

    // hovering the merged Feb bar (1) reports Feb's new index (0)
    hoverBar(container, 1);
    expect(lastFocusedCategory()).toBe(0);
    settleFocus();
    expect(barOpacities(container, 'sales')).toEqual([DEFOCUSED, FOCUSED, DEFOCUSED, DEFOCUSED]);

    // the departing Jan bar still clears focus in merged space
    hoverBar(container, 0);
    expect(lastFocusedCategory()).toBe(-1);
    settleFocus();
    expect(barOpacities(container, 'sales')).toEqual([NORMAL, NORMAL, NORMAL, NORMAL]);

    // external Mar (1) is the third merged bar
    chart.update({ focusedCategoryIndex: 1 });
    settleFocus();
    expect(tickLabels(container)).toEqual(['Jan', 'Feb', 'Mar', 'Apr']);
    expect(barOpacities(container, 'sales')).toEqual([DEFOCUSED, DEFOCUSED, FOCUSED, DEFOCUSED]);

    // the contraction phase renders new space directly: Mar keeps its focus at index 1
    advanceUntilCategories(container, ['Feb', 'Mar', 'Apr']);
    settleFocus();
    expect(barOpacities(container, 'sales')).toEqual([DEFOCUSED, FOCUSED, DEFOCUSED]);
    hoverBar(container, 0);
    expect(lastFocusedCategory()).toBe(0);
    runFrames();
    expect(barOpacities(container, 'sales')).toEqual([FOCUSED, DEFOCUSED, DEFOCUSED]);
  });

  it('maps focus through a reordered merged space with a removal', () => {
    const { chart, container, lastFocusedCategory } = mountRemapChart();
    const { ArrayOfObjectsDataProvider } = mochart;

    // Jan,Feb,Mar → Mar,Feb: Jan leaves and the survivors swap; the ordered merge renders Mar,Jan,Feb
    chart.update({ dataProvider: new ArrayOfObjectsDataProvider([
      { month: 'Mar', sales: 30, costs: 12 },
      { month: 'Feb', sales: 20, costs: 8 }
    ]) });
    advanceFrames(1);
    expect(tickLabels(container)).toEqual(['Mar', 'Jan', 'Feb']);

    // external Feb (1) is the third merged bar
    chart.update({ focusedCategoryIndex: 1 });
    settleFocus();
    expect(tickLabels(container)).toEqual(['Mar', 'Jan', 'Feb']);
    expect(barOpacities(container, 'sales')).toEqual([DEFOCUSED, DEFOCUSED, FOCUSED]);

    // hovering the merged Mar bar (0) reports Mar's new index (0)
    hoverBar(container, 0);
    expect(lastFocusedCategory()).toBe(0);
    settleFocus();
    expect(barOpacities(container, 'sales')).toEqual([FOCUSED, DEFOCUSED, DEFOCUSED]);

    // hovering the merged Feb bar (2) reports Feb's new index (1)
    hoverBar(container, 2);
    expect(lastFocusedCategory()).toBe(1);
    settleFocus();
    expect(barOpacities(container, 'sales')).toEqual([DEFOCUSED, DEFOCUSED, FOCUSED]);

    // the departing Jan bar sits between them and clears focus
    hoverBar(container, 1);
    expect(lastFocusedCategory()).toBe(-1);
    settleFocus();
    expect(barOpacities(container, 'sales')).toEqual([NORMAL, NORMAL, NORMAL]);

    // focus Mar (0) and ride the removal into new space
    chart.update({ focusedCategoryIndex: 0 });
    settleFocus();
    expect(barOpacities(container, 'sales')).toEqual([FOCUSED, DEFOCUSED, DEFOCUSED]);
    advanceUntilCategories(container, ['Mar', 'Feb']);
    settleFocus();
    expect(barOpacities(container, 'sales')).toEqual([FOCUSED, DEFOCUSED]);
    hoverBar(container, 1);
    expect(lastFocusedCategory()).toBe(1);
    runFrames();
    expect(barOpacities(container, 'sales')).toEqual([DEFOCUSED, FOCUSED]);
  });
});
