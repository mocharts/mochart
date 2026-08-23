// a legend with no items (every series showInLegend: false) is no legend: it reserves no height and mounts nothing
import { describe, it, expect, beforeAll } from 'vitest';
import { installSvgMeasurementShims } from '../components/svgShims';
import { mountContainer, trackHandle } from '../components/helpers';
import { createDefaultChart } from '../../src/createChart';
import type { MochartInputConfig } from '../../src/types/config';
import { getCssSelector } from '../../src/utils/ChartDom';
import { createSpacingLayoutInfo } from '../../src/layout/SpacingLayoutInfo';

const rows = [{ c: 'a', v: 1, w: 2 }, { c: 'b', v: 2, w: 3 }];

function config(extra: Record<string, unknown>): MochartInputConfig {
  return {
    version: '1.0.0',
    animation: { enabled: false },
    categoryAxis: { property: 'c', type: 'string', scale: 'ordinal' },
    series: [{ id: 'v', property: 'v' }, { id: 'w', property: 'w' }],
    ...extra
  } as unknown as MochartInputConfig;
}

function mount(chartConfig: MochartInputConfig): Element {
  const container = mountContainer();
  trackHandle(createDefaultChart(container, { config: chartConfig, data: rows, width: 400, height: 300 }));
  return container;
}

function plotHeight(container: Element): number {
  return Number(container.querySelector(getCssSelector('plotBackground') + ' rect')!.getAttribute('height'));
}

beforeAll(() => { installSvgMeasurementShims(); });

describe('a legend whose series are all showInLegend: false', () => {
  const hidden = { series: [{ id: 'v', property: 'v', showInLegend: false }, { id: 'w', property: 'w', showInLegend: false }] };

  it('mounts no legend', () => {
    expect(mount(config(hidden)).querySelector(getCssSelector('legend'))).toBeNull();
    expect(mount(config({})).querySelector(getCssSelector('legend'))).not.toBeNull();
  });

  it('reserves no height, like legend.visible: false', () => {
    const withItems = plotHeight(mount(config({})));
    const noItems = plotHeight(mount(config(hidden)));
    const invisible = plotHeight(mount(config({ legend: { visible: false } })));
    expect(noItems).toBe(invisible);
    expect(noItems).toBeGreaterThan(withItems);
  });
});

describe('createSpacingLayoutInfo on a box with no area', () => {
  it('keeps the relative bounds relative to the box origin', () => {
    const info = createSpacingLayoutInfo({ x: 10, y: 20, width: 0, height: 5 }, { top: 1, right: 1, bottom: 1, left: 1 });
    expect(info.marginRelativeBounds).toEqual({ x: 0, y: 0, width: 0, height: 5 });
    expect(info.paddingRelativeBounds).toEqual({ x: 0, y: 0, width: 0, height: 5 });
  });
});
