/**
 * Smoke tests for config changes on a mounted chart. Oracle is convergence: after A -> B settles,
 * the retained DOM must match a fresh mount of B — catching stale derived data, layout, retained
 * list items, and animation state.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { installSvgMeasurementShims } from '../components/svgShims';
import { installFakeFrameClock, runFrames, advanceFrames, mountContainer, trackHandle } from '../components/helpers';
import type { ChartHandle, DefaultChartProps, MochartInputConfig } from '../../src';
import { getIdCssClass, getCssSelector, getDescendantCssSelector, mochartVersionAttribute } from '../../src/utils/ChartDom';

const WIDTH = 640;
const HEIGHT = 420;
const MAX_FRAMES = 100;

type Row = Record<string, string | number>;

interface EndpointExpectation {
  categoryLabels?: string[];
  seriesIds?: string[];
  valueAxisIds?: string[];
  pie?: boolean;
  state?: 'chart' | 'configError' | 'dataError';
}

interface Endpoint {
  config: MochartInputConfig;
  data: readonly Row[];
  expected: EndpointExpectation;
}

interface TransitionScenario {
  name: string;
  a: Endpoint;
  b: Endpoint;
  structural: boolean;
}

interface MountedDefaultChart {
  container: HTMLDivElement;
  handle: ChartHandle<DefaultChartProps>;
}

let mochart: typeof import('../../src');

const rows: readonly Row[] = [
  { month: 'Jan', week: 'W1', when: '2026-01-01T00:00:00Z', position: 1, sales: 10, costs: 4, profit: 6, low: 2, high: 12, bad: 'ten' },
  { month: 'Feb', week: 'W2', when: '2026-02-01T00:00:00Z', position: 3, sales: 28, costs: 9, profit: 19, low: 7, high: 31, bad: 'twenty-eight' },
  { month: 'Mar', week: 'W3', when: '2026-03-01T00:00:00Z', position: 8, sales: 17, costs: 14, profit: 3, low: 11, high: 21, bad: 'seventeen' }
];

const singleRow: readonly Row[] = [rows[0]!];

function config(options: {
  categoryAxis?: Record<string, unknown>;
  series?: Array<Record<string, unknown>>;
  valueAxes?: Array<Record<string, unknown>>;
  seriesStacks?: Array<Record<string, unknown>>;
  seriesGroups?: Array<Record<string, unknown>>;
  chart?: Record<string, unknown>;
  plot?: Record<string, unknown>;
  legend?: Record<string, unknown>;
  title?: Record<string, unknown>;
  animate?: boolean;
} = {}): MochartInputConfig {
  const animate = options.animate ?? false;
  return {
    version: '1.0.0',
    animation: {
      enabled: animate,
      initialDuration: 64,
      expansionDuration: 64,
      valueChangeDuration: 64,
      contractionDuration: 64,
      focusDuration: 64
    },
    categoryAxis: options.categoryAxis ?? { property: 'month', type: 'string', scale: 'ordinal' },
    valueAxes: options.valueAxes ?? [{ id: 'value' }],
    series: options.series ?? [{ id: 'primary', property: 'sales', axis: 'value', renderer: 'bar', title: 'Primary' }],
    ...(options.seriesStacks === undefined ? {} : { seriesStacks: options.seriesStacks }),
    ...(options.seriesGroups === undefined ? {} : { seriesGroups: options.seriesGroups }),
    ...(options.chart === undefined ? {} : { chart: options.chart }),
    ...(options.plot === undefined ? {} : { plot: options.plot }),
    ...(options.legend === undefined ? {} : { legend: options.legend }),
    ...(options.title === undefined ? {} : { title: options.title })
  } as MochartInputConfig;
}

function endpoint(
  configValue: MochartInputConfig,
  expected: EndpointExpectation,
  data: readonly Row[] = rows
): Endpoint {
  return { config: configValue, data, expected };
}

const monthEndpoint = () => endpoint(config(), {
  categoryLabels: ['Jan', 'Feb', 'Mar'], seriesIds: ['primary'], valueAxisIds: ['value'], pie: false
});

const weekEndpoint = () => endpoint(config({
  categoryAxis: { property: 'week', type: 'string', scale: 'ordinal' }
}), {
  categoryLabels: ['W1', 'W2', 'W3'], seriesIds: ['primary'], valueAxisIds: ['value'], pie: false
});

const salesEndpoint = () => monthEndpoint();

const costsEndpoint = () => endpoint(config({
  series: [{ id: 'primary', property: 'costs', axis: 'value', renderer: 'bar', title: 'Primary' }]
}), {
  categoryLabels: ['Jan', 'Feb', 'Mar'], seriesIds: ['primary'], valueAxisIds: ['value'], pie: false
});

const oneSeriesEndpoint = () => monthEndpoint();

const twoSeriesEndpoint = () => endpoint(config({
  series: [
    { id: 'primary', property: 'sales', axis: 'value', renderer: 'bar', title: 'Primary' },
    { id: 'secondary', property: 'costs', axis: 'value', renderer: 'line', title: 'Secondary' }
  ]
}), {
  categoryLabels: ['Jan', 'Feb', 'Mar'], seriesIds: ['primary', 'secondary'], valueAxisIds: ['value'], pie: false
});

const leftAxisEndpoint = () => endpoint(config({
  valueAxes: [{ id: 'left' }],
  series: [{ id: 'primary', property: 'sales', axis: 'left', renderer: 'bar', title: 'Primary' }]
}), {
  categoryLabels: ['Jan', 'Feb', 'Mar'], seriesIds: ['primary'], valueAxisIds: ['left'], pie: false
});

const rightAxisEndpoint = () => endpoint(config({
  valueAxes: [{ id: 'right' }],
  series: [{ id: 'primary', property: 'sales', axis: 'right', renderer: 'bar', title: 'Primary' }]
}), {
  categoryLabels: ['Jan', 'Feb', 'Mar'], seriesIds: ['primary'], valueAxisIds: ['right'], pie: false
});

const unstackedEndpoint = () => endpoint(config({
  series: [
    { id: 'primary', property: 'sales', axis: 'value', stack: null, renderer: 'bar', title: 'Primary' },
    { id: 'secondary', property: 'costs', axis: 'value', stack: null, renderer: 'bar', title: 'Secondary' }
  ]
}), {
  categoryLabels: ['Jan', 'Feb', 'Mar'], seriesIds: ['primary', 'secondary'], valueAxisIds: ['value'], pie: false
});

const stackedEndpoint = () => endpoint(config({
  seriesStacks: [{ id: 'combined', axis: 'value' }],
  series: [
    { id: 'primary', property: 'sales', axis: 'value', stack: 'combined', renderer: 'bar', title: 'Primary' },
    { id: 'secondary', property: 'costs', axis: 'value', stack: 'combined', renderer: 'bar', title: 'Secondary' }
  ]
}), {
  categoryLabels: ['Jan', 'Feb', 'Mar'], seriesIds: ['primary', 'secondary'], valueAxisIds: ['value'], pie: false
});

const plainValueEndpoint = () => monthEndpoint();

const rangedValueEndpoint = () => endpoint(config({
  series: [{ id: 'primary', property: 'high', rangeProperty: 'low', axis: 'value', renderer: 'bar', title: 'Primary' }]
}), {
  categoryLabels: ['Jan', 'Feb', 'Mar'], seriesIds: ['primary'], valueAxisIds: ['value'], pie: false
});

const ordinalDateTextEndpoint = () => endpoint(config({
  categoryAxis: { property: 'when', type: 'string', scale: 'ordinal' }
}), {
  categoryLabels: ['2026-01-01T00:00:00Z', '2026-02-01T00:00:00Z', '2026-03-01T00:00:00Z'],
  seriesIds: ['primary'], valueAxisIds: ['value'], pie: false
});

const linearDateEndpoint = () => endpoint(config({
  categoryAxis: { property: 'when', type: 'date', scale: 'linear', dateUTC: true, tickLabel: { format: '%Y-%m' } }
}), {
  seriesIds: ['primary'], valueAxisIds: ['value'], pie: false
});

const xyEndpoint = () => endpoint(config({
  series: [
    { id: 'primary', property: 'sales', axis: 'value', renderer: 'bar', title: 'Primary' },
    { id: 'secondary', property: 'costs', axis: 'value', renderer: 'bar', title: 'Secondary' }
  ]
}), {
  categoryLabels: ['Jan'], seriesIds: ['primary', 'secondary'], valueAxisIds: ['value'], pie: false
}, singleRow);

const pieEndpoint = () => endpoint(config({
  chart: { type: 'pie' },
  series: [
    { id: 'primary', property: 'sales', title: 'Primary' },
    { id: 'secondary', property: 'costs', title: 'Secondary' }
  ]
}), {
  seriesIds: ['primary', 'secondary'], pie: true
}, singleRow);

const lineEndpoint = () => endpoint(config({
  series: [{ id: 'primary', property: 'sales', axis: 'value', renderer: 'line', title: 'Primary' }]
}), {
  categoryLabels: ['Jan', 'Feb', 'Mar'], seriesIds: ['primary'], valueAxisIds: ['value'], pie: false
});

const areaEndpoint = () => endpoint(config({
  series: [{ id: 'primary', property: 'sales', axis: 'value', renderer: 'area', title: 'Primary' }]
}), {
  categoryLabels: ['Jan', 'Feb', 'Mar'], seriesIds: ['primary'], valueAxisIds: ['value'], pie: false
});

const reversedSeriesEndpoint = () => endpoint(config({
  series: [
    { id: 'secondary', property: 'costs', axis: 'value', renderer: 'line', title: 'Secondary' },
    { id: 'primary', property: 'sales', axis: 'value', renderer: 'bar', title: 'Primary' }
  ]
}), {
  categoryLabels: ['Jan', 'Feb', 'Mar'], seriesIds: ['secondary', 'primary'], valueAxisIds: ['value'], pie: false
});

const groupedEndpoint = () => endpoint(config({
  seriesGroups: [{ id: 'cluster' }],
  series: [
    { id: 'primary', property: 'sales', axis: 'value', group: 'cluster', renderer: 'bar', title: 'Primary' },
    { id: 'secondary', property: 'costs', axis: 'value', group: 'cluster', renderer: 'bar', title: 'Secondary' }
  ]
}), {
  categoryLabels: ['Jan', 'Feb', 'Mar'], seriesIds: ['primary', 'secondary'], valueAxisIds: ['value'], pie: false
});

const auxiliaryPropertiesEndpoint = () => endpoint(config({
  series: [{
    id: 'primary', property: 'sales', axis: 'value', renderer: 'bar', title: 'Primary',
    errorLowProperty: 'low', errorHighProperty: 'high', markerProperty: 'costs',
    colorProperty: 'profit', labelProperty: 'profit'
  }]
}), {
  categoryLabels: ['Jan', 'Feb', 'Mar'], seriesIds: ['primary'], valueAxisIds: ['value'], pie: false
});

const multiAxisEndpoint = () => endpoint(config({
  valueAxes: [{ id: 'left' }, { id: 'right' }],
  series: [
    { id: 'primary', property: 'sales', axis: 'left', renderer: 'bar', title: 'Primary' },
    { id: 'secondary', property: 'costs', axis: 'right', renderer: 'line', title: 'Secondary' }
  ]
}), {
  categoryLabels: ['Jan', 'Feb', 'Mar'], seriesIds: ['primary', 'secondary'], valueAxisIds: ['left', 'right'], pie: false
});

const invertedEndpoint = () => endpoint(config({ plot: { inverted: true } }), {
  categoryLabels: ['Jan', 'Feb', 'Mar'], seriesIds: ['primary'], valueAxisIds: ['value'], pie: false
});

const configErrorEndpoint = () => endpoint({ ...config(), unknownSection: true } as MochartInputConfig, {
  state: 'configError'
});

const dataErrorEndpoint = () => endpoint(config({
  series: [{ id: 'primary', property: 'bad', axis: 'value', renderer: 'bar', title: 'Primary' }]
}), {
  state: 'dataError'
});

// parts that measure text must survive being turned on after mounting hidden — a hidden part has no measurement to carry into the frame where it becomes visible
const legendHiddenEndpoint = () => endpoint(config({ legend: { visible: false } }), {
  categoryLabels: ['Jan', 'Feb', 'Mar'], seriesIds: ['primary'], valueAxisIds: ['value'], pie: false
});

const legendVisibleEndpoint = () => endpoint(config({ legend: { visible: true } }), {
  categoryLabels: ['Jan', 'Feb', 'Mar'], seriesIds: ['primary'], valueAxisIds: ['value'], pie: false
});

const titleHiddenEndpoint = () => endpoint(config({ title: { text: null } }), {
  categoryLabels: ['Jan', 'Feb', 'Mar'], seriesIds: ['primary'], valueAxisIds: ['value'], pie: false
});

const titleVisibleEndpoint = () => endpoint(config({ title: { text: 'Smoke Title' } }), {
  categoryLabels: ['Jan', 'Feb', 'Mar'], seriesIds: ['primary'], valueAxisIds: ['value'], pie: false
});

const categoryAxisHiddenEndpoint = () => endpoint(config({
  categoryAxis: { property: 'month', type: 'string', scale: 'ordinal', title: { text: 'Months' }, visible: false }
}), { seriesIds: ['primary'], valueAxisIds: ['value'], pie: false });

const categoryAxisVisibleEndpoint = () => endpoint(config({
  categoryAxis: { property: 'month', type: 'string', scale: 'ordinal', title: { text: 'Months' }, visible: true }
}), { categoryLabels: ['Jan', 'Feb', 'Mar'], seriesIds: ['primary'], valueAxisIds: ['value'], pie: false });

const valueAxisHiddenEndpoint = () => endpoint(config({
  valueAxes: [{ id: 'value', title: { text: 'Sales' }, visible: false }]
}), { categoryLabels: ['Jan', 'Feb', 'Mar'], seriesIds: ['primary'], pie: false });

const valueAxisVisibleEndpoint = () => endpoint(config({
  valueAxes: [{ id: 'value', title: { text: 'Sales' }, visible: true }]
}), { categoryLabels: ['Jan', 'Feb', 'Mar'], seriesIds: ['primary'], valueAxisIds: ['value'], pie: false });

const scenarios: TransitionScenario[] = [
  { name: 'categoryAxis.property', a: monthEndpoint(), b: weekEndpoint(), structural: true },
  { name: 'series.property', a: salesEndpoint(), b: costsEndpoint(), structural: true },
  { name: 'series add/remove', a: oneSeriesEndpoint(), b: twoSeriesEndpoint(), structural: true },
  { name: 'value axis id and series.axis', a: leftAxisEndpoint(), b: rightAxisEndpoint(), structural: true },
  { name: 'series stack membership', a: unstackedEndpoint(), b: stackedEndpoint(), structural: true },
  { name: 'series.rangeProperty', a: plainValueEndpoint(), b: rangedValueEndpoint(), structural: true },
  { name: 'category type and scale', a: ordinalDateTextEndpoint(), b: linearDateEndpoint(), structural: true },
  { name: 'chart.type xy/pie', a: xyEndpoint(), b: pieEndpoint(), structural: true },
  { name: 'renderer line/area', a: lineEndpoint(), b: areaEndpoint(), structural: false },
  { name: 'series reorder', a: twoSeriesEndpoint(), b: reversedSeriesEndpoint(), structural: true },
  { name: 'series group membership', a: unstackedEndpoint(), b: groupedEndpoint(), structural: true },
  { name: 'series auxiliary data properties', a: lineEndpoint(), b: auxiliaryPropertiesEndpoint(), structural: true },
  { name: 'value axis add/remove and reassignment', a: twoSeriesEndpoint(), b: multiAxisEndpoint(), structural: true },
  { name: 'plot.inverted', a: monthEndpoint(), b: invertedEndpoint(), structural: false },
  { name: 'config validity', a: monthEndpoint(), b: configErrorEndpoint(), structural: true },
  { name: 'data validity from series.property', a: monthEndpoint(), b: dataErrorEndpoint(), structural: true },
  { name: 'legend.visible', a: legendHiddenEndpoint(), b: legendVisibleEndpoint(), structural: false },
  { name: 'title.text null/set', a: titleHiddenEndpoint(), b: titleVisibleEndpoint(), structural: false },
  { name: 'categoryAxis.visible', a: categoryAxisHiddenEndpoint(), b: categoryAxisVisibleEndpoint(), structural: false },
  { name: 'valueAxes.visible', a: valueAxisHiddenEndpoint(), b: valueAxisVisibleEndpoint(), structural: false }
];

beforeAll(async () => {
  installSvgMeasurementShims();
  installFakeFrameClock();
  mochart = await import('../../src');
});

function withAnimation(configValue: MochartInputConfig, animate: boolean): MochartInputConfig {
  return {
    ...configValue,
    animation: { ...configValue.animation, enabled: animate }
  };
}

function animated(endpointValue: Endpoint): Endpoint {
  return { ...endpointValue, config: withAnimation(endpointValue.config, true) };
}

function mountDefault(endpointValue: Endpoint): MountedDefaultChart {
  const container = mountContainer();
  const handle = trackHandle(mochart.createDefaultChart(container, {
    config: endpointValue.config,
    data: endpointValue.data,
    width: WIDTH,
    height: HEIGHT
  }));
  return { container, handle };
}

function settle(): void {
  runFrames(MAX_FRAMES);
  expect(vi.getTimerCount(), `animation did not settle within ${MAX_FRAMES} frames`).toBe(0);
}

const UNIQUE_ID_PREFIXES = [
  '__mochart__chart__', 'tooltip__clippath__', 'title__clippath__', 'legend__clippath__',
  'categoryaxistitle__clippath__', 'categoryaxisticklabel__clippath__', 'seriesaxistitle__clippath__',
  'series__clippath__', 'clipindicator__pattern__', 'linear__gradient__', 'radial__gradient__',
  'series__pattern__', 'seriescolor__gradient__'
];
const uniqueIdPattern = new RegExp('(' + UNIQUE_ID_PREFIXES.join('|') + ')(\\d+)', 'g');

function chartSignature(container: Element): string {
  function canonicalNode(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) {
      return JSON.stringify(node.textContent ?? '');
    }
    if (!(node instanceof Element)) {
      return '';
    }
    const attributes = Array.from(node.attributes)
      .filter(attribute => attribute.name !== mochartVersionAttribute && !(attribute.name === 'style' && attribute.value === ''))
      .map(attribute => `${attribute.name}=${JSON.stringify(attribute.value.replace(uniqueIdPattern, '$1N'))}`)
      .sort()
      .join(' ');
    const children = Array.from(node.childNodes).map(canonicalNode).join('');
    return `<${node.tagName.toLowerCase()}${attributes ? ' ' + attributes : ''}>${children}</${node.tagName.toLowerCase()}>`;
  }

  return Array.from(container.childNodes).map(canonicalNode).join('');
}

function idsFor(container: Element, selector: string, prefix: string): string[] {
  const ids = Array.from(container.querySelectorAll(selector)).map(element => {
    const idClass = Array.from(element.classList).find(className => className.startsWith(prefix));
    return idClass?.slice(prefix.length) ?? '';
  });
  // Axes may be rendered in both the plot's back and front layers.
  return Array.from(new Set(ids));
}

function expectEndpoint(container: Element, endpointValue: Endpoint): void {
  const { expected } = endpointValue;
  const state = expected.state ?? 'chart';
  if (state === 'configError') {
    expect(container.querySelector(getCssSelector('chartError'))).not.toBeNull();
    expect(container.textContent).toContain('Mochart Config Error');
    return;
  }
  if (state === 'dataError') {
    expect(container.querySelector(getCssSelector('error'))).not.toBeNull();
    expect(container.textContent).toContain('Invalid Data');
    return;
  }
  expect(container.querySelector('svg')).not.toBeNull();
  expect(container.querySelector(getCssSelector('error'))).toBeNull();
  expect(container.querySelector(getCssSelector('noData'))).toBeNull();
  expect(container.querySelector(getCssSelector('loading'))).toBeNull();

  if (expected.categoryLabels) {
    const labels = Array.from(container.querySelectorAll(getDescendantCssSelector('categoryAxis', 'axisTickLabels') + ' text'))
      .map(label => label.textContent ?? '');
    for (const label of expected.categoryLabels) {
      expect(labels).toContain(label);
    }
  }
  if (expected.seriesIds) {
    expect(idsFor(container, getCssSelector('series'), getIdCssClass('series', ''))).toEqual(expected.seriesIds);
  }
  if (expected.valueAxisIds) {
    expect(idsFor(container, getCssSelector('valueAxis'), getIdCssClass('valueAxis', ''))).toEqual(expected.valueAxisIds);
  }
  if (expected.pie !== undefined) {
    expect(container.querySelector(getCssSelector('seriesSlice')) !== null).toBe(expected.pie);
  }
}

function expectValid(endpointValue: Endpoint): void {
  const enhanced = mochart.enhanceConfig(endpointValue.config);
  const state = endpointValue.expected.state ?? 'chart';
  if (state === 'configError') {
    expect(enhanced.validation.valid).toBe(false);
    return;
  }
  expect(enhanced.validation.errors).toEqual([]);
  const provider = new mochart.ArrayOfObjectsDataProvider(endpointValue.data);
  const dataErrors = mochart.getDataErrors(enhanced, provider);
  if (state === 'dataError') {
    expect(dataErrors.length).toBeGreaterThan(0);
  }
  else {
    expect(dataErrors).toEqual([]);
  }
}

function directions(scenario: TransitionScenario) {
  return [
    { name: 'A -> B', from: scenario.a, to: scenario.b },
    { name: 'B -> A', from: scenario.b, to: scenario.a }
  ];
}

describe('config update convergence (animation disabled)', () => {
  for (const scenario of scenarios) {
    describe(scenario.name, () => {
      for (const direction of directions(scenario)) {
        it(direction.name, () => {
          expectValid(direction.from);
          expectValid(direction.to);
          const fromEnhanced = mochart.enhanceConfig(direction.from.config);
          const toEnhanced = mochart.enhanceConfig(direction.to.config);
          expect(mochart.hasConfigStructureChange(fromEnhanced, toEnhanced)).toBe(scenario.structural);

          const updated = mountDefault(direction.from);
          const sourceSignature = chartSignature(updated.container);
          expectEndpoint(updated.container, direction.from);

          updated.handle.update({ config: direction.to.config, data: direction.to.data });
          settle();
          expectEndpoint(updated.container, direction.to);

          const fresh = mountDefault(direction.to);
          settle();
          expectEndpoint(fresh.container, direction.to);
          const targetSignature = chartSignature(fresh.container);

          expect(targetSignature).not.toBe(sourceSignature);
          expect(chartSignature(updated.container)).toBe(targetSignature);
        });
      }
    });
  }
});

describe('public update variants', () => {
  it('replace() converges after a category property change', () => {
    const from = monthEndpoint();
    const to = weekEndpoint();
    const updated = mountDefault(from);

    updated.handle.replace({
      config: to.config,
      data: to.data,
      width: WIDTH,
      height: HEIGHT
    });
    settle();

    const fresh = mountDefault(to);
    settle();
    expectEndpoint(updated.container, to);
    expect(chartSignature(updated.container)).toBe(chartSignature(fresh.container));
  });

  it('createChart() converges when config and its matching provider change atomically', () => {
    const from = monthEndpoint();
    const to = weekEndpoint();
    const container = mountContainer();
    const fromConfig = mochart.enhanceConfig(from.config);
    const handle = trackHandle(mochart.createChart(container, {
      mochartConfig: fromConfig,
      dataProvider: new mochart.ArrayOfObjectsDataProvider(from.data),
      width: WIDTH,
      height: HEIGHT
    }));

    const toConfig = mochart.enhanceConfig(to.config);
    handle.update({
      mochartConfig: toConfig,
      dataProvider: new mochart.ArrayOfObjectsDataProvider(to.data)
    });
    settle();

    const freshContainer = mountContainer();
    trackHandle(mochart.createChart(freshContainer, {
      mochartConfig: toConfig,
      dataProvider: new mochart.ArrayOfObjectsDataProvider(to.data),
      width: WIDTH,
      height: HEIGHT
    }));
    settle();

    expectEndpoint(container, to);
    expect(chartSignature(container)).toBe(chartSignature(freshContainer));
  });
});

describe('repeated structural updates', () => {
  for (const scenario of scenarios.filter(candidate =>
    ['categoryAxis.property', 'series add/remove', 'value axis add/remove and reassignment'].includes(candidate.name))) {
    it(`${scenario.name} converges after A -> B -> A on the same handle`, () => {
      const updated = mountDefault(scenario.a);
      const fresh = mountDefault(scenario.a);

      updated.handle.update({ config: scenario.b.config, data: scenario.b.data });
      settle();
      expectEndpoint(updated.container, scenario.b);

      updated.handle.update({ config: scenario.a.config, data: scenario.a.data });
      settle();
      expectEndpoint(updated.container, scenario.a);
      expect(chartSignature(updated.container)).toBe(chartSignature(fresh.container));
    });
  }
});

describe('animated structural config updates', () => {
  for (const scenario of scenarios.filter(candidate =>
    ['categoryAxis.property', 'series.property', 'series add/remove', 'series stack membership'].includes(candidate.name))) {
    it(`${scenario.name} converges after settling`, () => {
      const from = animated(scenario.a);
      const to = animated(scenario.b);
      const updated = mountDefault(from);
      settle();

      updated.handle.update({ config: to.config, data: to.data });
      settle();

      const fresh = mountDefault(to);
      settle();
      expectEndpoint(updated.container, to);
      expect(chartSignature(updated.container)).toBe(chartSignature(fresh.container));
    });
  }

  it('converges after a second structural update interrupts the first', () => {
    const first = animated(monthEndpoint());
    const interrupted = animated(twoSeriesEndpoint());
    const target = animated(weekEndpoint());
    const updated = mountDefault(first);
    settle();

    updated.handle.update({ config: interrupted.config, data: interrupted.data });
    advanceFrames(1);
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    updated.handle.update({ config: target.config, data: target.data });
    settle();

    const fresh = mountDefault(target);
    settle();
    expectEndpoint(updated.container, target);
    expect(chartSignature(updated.container)).toBe(chartSignature(fresh.container));
  });
});
