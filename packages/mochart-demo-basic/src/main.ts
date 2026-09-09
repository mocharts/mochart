import {
  createChart,
  migrateConfig,
  enhanceConfig,
  ArrayOfObjectsDataProvider
} from '@mochart/core';
import type { ChartHandle } from '@mochart/core';
import '@mochart/core/mochart.css';
import { exportPNG, exportSVG } from '@mochart/export';
import demoData from '@mochart/demo-data';
import type { Demo } from '@mochart/demo-data';

interface SeriesBounds {
  min: number;
  max: number;
  round: boolean;
}

const demoSections: { section: string; entries: Demo[] }[] = [
  { section: 'Demos', entries: demoData.demoIds.map((id) => demoData.demoObjectMap[id]) },
  { section: 'Test Demos', entries: demoData.testDemoIds.map((id) => demoData.demoObjectMap[id]) }
];

const demoList = document.getElementById('demo-list') as HTMLDivElement;
const demoTitle = document.getElementById('demo-title') as HTMLSpanElement;
const chartHost = document.getElementById('chart-host') as HTMLDivElement;
const errorsPane = document.getElementById('errors') as HTMLPreElement;
const randomizeButton = document.getElementById('randomize') as HTMLButtonElement;
const addCategoryButton = document.getElementById('add-category') as HTMLButtonElement;
const removeCategoryButton = document.getElementById('remove-category') as HTMLButtonElement;
const autoplayButton = document.getElementById('autoplay') as HTMLButtonElement;
const resetButton = document.getElementById('reset') as HTMLButtonElement;
const exportPngButton = document.getElementById('export-png') as HTMLButtonElement;
const exportSvgButton = document.getElementById('export-svg') as HTMLButtonElement;

let chart: ChartHandle | null = null;
let mochartConfig: any = null;
let categoryProperty: string | undefined;
let seriesProperties: string[] = [];
let seriesBounds: Record<string, SeriesBounds> = {};
let originalData: any[] = [];
let currentData: any[] = [];
let autoplayTimer: number | null = null;
let categoryCounter = 0;

function showErrors(messages: string[]): void {
  errorsPane.hidden = messages.length === 0;
  errorsPane.textContent = messages.join('\n');
}

// Per-property value bounds from the demo's random spec, clamped to the
// value axis config (when limitToAxisConfig) so random values never land
// outside a fixed axis range.
function computeSeriesBounds(config: any, randomSpec: any): Record<string, SeriesBounds> {
  const numberSpec = randomSpec?.series?.number ?? {};
  const { min = -500, max = 500, round = true, limitToAxisConfig = true } = numberSpec;
  const bounds: Record<string, SeriesBounds> = {};
  for (const seriesConfig of config.series || []) {
    const axisConfig = seriesConfig.valueAxisConfig || {};
    for (const key of ['property', 'rangeProperty']) {
      const property = seriesConfig[key];
      if (!property) {
        continue;
      }
      bounds[property] = {
        min: limitToAxisConfig && typeof axisConfig.min === 'number' ? axisConfig.min : min,
        max: limitToAxisConfig && typeof axisConfig.max === 'number' ? axisConfig.max : max,
        round
      };
    }
  }
  return bounds;
}

function randomValue({ min, max, round }: SeriesBounds): number {
  const value = min + Math.random() * (max - min);
  return round ? Math.round(value) : value;
}

function makeDataProvider(): any {
  return new ArrayOfObjectsDataProvider(currentData);
}

function mountDemo(demo: Demo): void {
  demoTitle.textContent = demo.title;
  stopAutoplay();

  const config = migrateConfig(JSON.parse(JSON.stringify(demo.config)));
  mochartConfig = enhanceConfig(config);
  const { valid, errors, warnings } = mochartConfig.validation;
  showErrors(valid ? [] : [...errors, ...warnings]);

  categoryProperty = mochartConfig.categoryAxis ? mochartConfig.categoryAxis.property : undefined;
  seriesBounds = computeSeriesBounds(mochartConfig, demo.random);
  seriesProperties = Object.keys(seriesBounds);
  originalData = demo.data as any[];
  currentData = originalData.map((row) => ({ ...row }));
  categoryCounter = 0;

  if (chart) {
    chart.destroy();
    chart = null;
  }
  chartHost.innerHTML = '';

  const { width, height } = chartHost.getBoundingClientRect();
  chart = createChart(chartHost, {
    mochartConfig,
    dataProvider: makeDataProvider(),
    width: Math.floor(width),
    height: Math.floor(height),
    // makes pie slices interactive (like the framework demos' slice panels);
    // the stamped id doubles as the e2e observation point
    onSliceClick: (payload) => { chartHost.dataset.lastSliceClick = payload.seriesId; }
  });

  for (const button of demoList.querySelectorAll('button')) {
    button.classList.toggle('active', button.dataset.id === demo.id);
  }
  location.hash = demo.id;
}

function randomizeValues(): void {
  currentData = currentData.map((row) => {
    const next = { ...row };
    for (const property of seriesProperties) {
      if (typeof next[property] === 'number') {
        next[property] = randomValue(seriesBounds[property]);
      }
    }
    return next;
  });
  chart?.update({ dataProvider: makeDataProvider() });
}

function nextCategoryValue(): any {
  const values = currentData.map((row) => row[categoryProperty as string]);
  const last = values[values.length - 1];
  categoryCounter++;
  if (typeof last === 'number') {
    return Math.max(...values.filter((v) => typeof v === 'number')) + 1;
  }
  if (typeof last === 'string' && !Number.isNaN(Date.parse(last)) && last.includes('-')) {
    const maxTime = Math.max(...values.map((v) => Date.parse(v)));
    return new Date(maxTime + 24 * 3600 * 1000).toISOString();
  }
  return 'NEW' + categoryCounter;
}

function addCategory(): void {
  if (!categoryProperty || currentData.length === 0) {
    return;
  }
  const template = currentData[currentData.length - 1];
  const row: any = { ...template, [categoryProperty]: nextCategoryValue() };
  for (const property of seriesProperties) {
    if (typeof row[property] === 'number') {
      row[property] = randomValue(seriesBounds[property]);
    }
  }
  currentData = [...currentData, row];
  chart?.update({ dataProvider: makeDataProvider() });
}

function removeCategory(): void {
  if (currentData.length <= 2) {
    return;
  }
  const index = Math.floor(Math.random() * currentData.length);
  currentData = currentData.filter((_, i) => i !== index);
  chart?.update({ dataProvider: makeDataProvider() });
}

function resetData(): void {
  stopAutoplay();
  currentData = originalData.map((row) => ({ ...row }));
  chart?.update({ dataProvider: makeDataProvider() });
}

function stopAutoplay(): void {
  if (autoplayTimer !== null) {
    clearInterval(autoplayTimer);
    autoplayTimer = null;
    autoplayButton.textContent = 'Play';
    autoplayButton.classList.remove('on');
  }
}

function toggleAutoplay(): void {
  if (autoplayTimer !== null) {
    stopAutoplay();
    return;
  }
  autoplayButton.textContent = 'Stop';
  autoplayButton.classList.add('on');
  autoplayTimer = window.setInterval(() => {
    const roll = Math.random();
    if (roll < 0.15) {
      addCategory();
    }
    else if (roll < 0.3) {
      removeCategory();
    }
    else {
      randomizeValues();
    }
  }, 1600);
}

randomizeButton.addEventListener('click', randomizeValues);
exportPngButton.addEventListener('click', () => { void exportPNG(chartHost); });
exportSvgButton.addEventListener('click', () => { exportSVG(chartHost); });
addCategoryButton.addEventListener('click', addCategory);
removeCategoryButton.addEventListener('click', removeCategory);
autoplayButton.addEventListener('click', toggleAutoplay);
resetButton.addEventListener('click', resetData);

new ResizeObserver(() => {
  if (chart) {
    const { width, height } = chartHost.getBoundingClientRect();
    chart.update({ width: Math.floor(width), height: Math.floor(height) });
  }
}).observe(chartHost);

// build the sidebar
for (const { section, entries } of demoSections) {
  const heading = document.createElement('div');
  heading.className = 'section';
  heading.textContent = section;
  demoList.appendChild(heading);
  for (const demo of entries) {
    const button = document.createElement('button');
    button.textContent = demo.title;
    button.dataset.id = demo.id;
    button.addEventListener('click', () => mountDemo(demo));
    demoList.appendChild(button);
  }
}

const allDemos = demoSections.flatMap((s) => s.entries);
const initial = allDemos.find((demo) => demo.id === location.hash.slice(1)) || allDemos[0];
if (initial) {
  mountDemo(initial);
}
