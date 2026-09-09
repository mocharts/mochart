import { createChart, enhanceConfig, ArrayOfObjectsDataProvider } from '@mochart/core';
import type { ChartHandle } from '@mochart/core';
import {
  makeConfig, makeData, randomizeData, scenarioLabel, scenarioSize, scenarioPoints,
  SUITE_ROWS, DASHBOARD_SERIES, DASHBOARD_CATEGORIES
} from './scenarios';
import type { ScenarioSpec, ScenarioOptions, ScenarioType } from './scenarios';
import { afterPaint, sleep, FrameSampler, startFpsMeter, formatMs } from './metrics';
import type { FrameStats } from './metrics';

const scenarioSelect = document.getElementById('scenario') as HTMLSelectElement;
const seriesInput = document.getElementById('series') as HTMLInputElement;
const categoriesInput = document.getElementById('categories') as HTMLInputElement;
const chartsInput = document.getElementById('charts') as HTMLInputElement;
const animateCheck = document.getElementById('animate') as HTMLInputElement;
const legendCheck = document.getElementById('legend') as HTMLInputElement;
const mountButton = document.getElementById('mount') as HTMLButtonElement;
const randomizeButton = document.getElementById('randomize') as HTMLButtonElement;
const stressButton = document.getElementById('stress') as HTMLButtonElement;
const suiteButton = document.getElementById('suite') as HTMLButtonElement;
const copyButton = document.getElementById('copy') as HTMLButtonElement;
const statusText = document.getElementById('status') as HTMLSpanElement;
const chartHost = document.getElementById('chart-host') as HTMLDivElement;
const resultsPane = document.getElementById('results') as HTMLDivElement;
const resultsBody = document.querySelector('#results-table tbody') as HTMLTableSectionElement;
const fpsMeter = document.getElementById('fps-meter') as HTMLElement;

const stat = {
  points: document.getElementById('stat-points') as HTMLElement,
  nodes: document.getElementById('stat-nodes') as HTMLElement,
  mount: document.getElementById('stat-mount') as HTMLElement,
  settle: document.getElementById('stat-settle') as HTMLElement,
  update: document.getElementById('stat-update') as HTMLElement
};

interface MountedChart {
  handle: ChartHandle;
  data: any[];
  seriesCount: number;
}

interface MountResult {
  createMs: number;
  settleMs: number;
  nodes: number;
}

interface SuiteResult {
  spec: ScenarioSpec;
  mount: MountResult;
  updateMs: number;
  frames: FrameStats;
}

let mounted: MountedChart[] = [];
const suiteResults: SuiteResult[] = [];

function destroyCharts(): void {
  for (const chart of mounted) {
    chart.handle.destroy();
  }
  mounted = [];
  chartHost.innerHTML = '';
  chartHost.classList.remove('grid');
}

async function mountScenario(spec: ScenarioSpec, options: ScenarioOptions): Promise<MountResult> {
  destroyCharts();
  const grid = spec.chartCount > 1;
  chartHost.classList.toggle('grid', grid);

  const cells: HTMLDivElement[] = [];
  for (let i = 0; i < spec.chartCount; i++) {
    const cell = document.createElement('div');
    cell.className = 'cell';
    chartHost.appendChild(cell);
    cells.push(cell);
  }

  const rawConfig = makeConfig(spec.type, spec.seriesCount, options);
  const mochartConfig = enhanceConfig(rawConfig);
  if (!mochartConfig.validation.valid) {
    throw new Error('invalid benchmark config: ' + mochartConfig.validation.errors.join('; '));
  }
  const datasets = cells.map(() => makeData(spec.seriesCount, spec.categoryCount));
  const sizes = cells.map((cell) => cell.getBoundingClientRect());

  const start = performance.now();
  for (let i = 0; i < cells.length; i++) {
    const handle = createChart(cells[i], {
      mochartConfig,
      dataProvider: new ArrayOfObjectsDataProvider(datasets[i]),
      width: Math.floor(sizes[i].width),
      height: Math.floor(sizes[i].height)
    });
    mounted.push({ handle, data: datasets[i], seriesCount: spec.seriesCount });
  }
  const created = performance.now();
  await afterPaint();
  const settled = performance.now();

  const result: MountResult = {
    createMs: created - start,
    settleMs: settled - start,
    nodes: chartHost.querySelectorAll('*').length
  };
  stat.points.textContent = String(scenarioPoints(spec));
  stat.nodes.textContent = String(result.nodes);
  stat.mount.textContent = formatMs(result.createMs) + ' ms';
  stat.settle.textContent = formatMs(result.settleMs) + ' ms';
  stat.update.textContent = '–';
  return result;
}

function randomizeAll(): void {
  for (const chart of mounted) {
    chart.data = randomizeData(chart.data, chart.seriesCount);
    chart.handle.update({ dataProvider: new ArrayOfObjectsDataProvider(chart.data) });
  }
}

/** Average wall time of `count` randomize-update-paint cycles across all mounted charts. */
async function measureUpdates(count: number): Promise<number> {
  let total = 0;
  for (let i = 0; i < count; i++) {
    const start = performance.now();
    randomizeAll();
    await afterPaint();
    total += performance.now() - start;
  }
  const average = total / count;
  stat.update.textContent = formatMs(average) + ' ms';
  return average;
}

/** Randomize on an interval for `seconds` while sampling frame times. */
async function measureStress(seconds: number): Promise<FrameStats> {
  const sampler = new FrameSampler();
  sampler.start();
  const interval = window.setInterval(randomizeAll, 500);
  await sleep(seconds * 1000);
  window.clearInterval(interval);
  return sampler.stop();
}

function specFromControls(): ScenarioSpec {
  const type = scenarioSelect.value as ScenarioType;
  if (type === 'dashboard') {
    return {
      type,
      seriesCount: DASHBOARD_SERIES,
      categoryCount: DASHBOARD_CATEGORIES,
      chartCount: Math.max(1, Number(chartsInput.value) || 1)
    };
  }
  return {
    type,
    seriesCount: Math.max(1, Number(seriesInput.value) || 1),
    categoryCount: Math.max(2, Number(categoriesInput.value) || 2),
    chartCount: 1
  };
}

function optionsFromControls(): ScenarioOptions {
  return { animate: animateCheck.checked, legend: legendCheck.checked };
}

function setBusy(busy: boolean, message: string): void {
  for (const button of [mountButton, randomizeButton, stressButton, suiteButton, copyButton]) {
    button.disabled = busy;
  }
  statusText.textContent = message;
}

/** Disable the controls while `work` runs; its return value becomes the final status line. */
async function run(message: string, work: () => Promise<string | void>): Promise<void> {
  setBusy(true, message);
  try {
    const done = await work();
    setBusy(false, done ?? 'Idle');
  }
  catch (error) {
    setBusy(false, 'Error: ' + (error instanceof Error ? error.message : String(error)));
    throw error;
  }
}

function appendResultRow(result: SuiteResult): void {
  resultsPane.hidden = false;
  const row = document.createElement('tr');
  const cells = [
    scenarioLabel(result.spec),
    scenarioSize(result.spec),
    String(scenarioPoints(result.spec)),
    String(result.mount.nodes),
    formatMs(result.mount.createMs),
    formatMs(result.mount.settleMs),
    formatMs(result.updateMs),
    result.frames.fps.toFixed(1),
    formatMs(result.frames.p95Ms),
    formatMs(result.frames.maxMs),
    String(result.frames.over33)
  ];
  for (const text of cells) {
    const cell = document.createElement('td');
    cell.textContent = text;
    row.appendChild(cell);
  }
  resultsBody.appendChild(row);
}

async function runSuiteRow(spec: ScenarioSpec, options: ScenarioOptions): Promise<SuiteResult> {
  // mount + updates without animation so update cost is measured, not tweening
  const mount = await mountScenario(spec, { ...options, animate: false });
  const updateMs = await measureUpdates(5);
  // remount with animation on and sample frame times under continuous updates
  await mountScenario(spec, { ...options, animate: true });
  const frames = await measureStress(3);
  return { spec, mount, updateMs, frames };
}

async function runSuite(): Promise<void> {
  suiteResults.length = 0;
  resultsBody.innerHTML = '';
  const options = optionsFromControls();
  for (let i = 0; i < SUITE_ROWS.length; i++) {
    const spec = SUITE_ROWS[i];
    statusText.textContent =
      'Suite ' + (i + 1) + '/' + SUITE_ROWS.length + ': ' + scenarioLabel(spec) + ' ' + scenarioSize(spec);
    const result = await runSuiteRow(spec, options);
    suiteResults.push(result);
    appendResultRow(result);
    await sleep(200);
  }
  destroyCharts();
}

function resultsAsMarkdown(): string {
  const header = '| scenario | size | points | nodes | mount ms | settle ms | update ms | fps | p95 ms | max ms | >33ms |';
  const divider = '|---|---|---|---|---|---|---|---|---|---|---|';
  const rows = suiteResults.map((result) => '| ' + [
    scenarioLabel(result.spec),
    scenarioSize(result.spec),
    scenarioPoints(result.spec),
    result.mount.nodes,
    formatMs(result.mount.createMs),
    formatMs(result.mount.settleMs),
    formatMs(result.updateMs),
    result.frames.fps.toFixed(1),
    formatMs(result.frames.p95Ms),
    formatMs(result.frames.maxMs),
    result.frames.over33
  ].join(' | ') + ' |');
  const environment = navigator.userAgent + ' — dpr ' + window.devicePixelRatio +
    ' — ' + new Date().toISOString();
  return [environment, '', header, divider, ...rows].join('\n');
}

mountButton.addEventListener('click', () => {
  void run('Mounting…', async () => {
    await mountScenario(specFromControls(), optionsFromControls());
  });
});

randomizeButton.addEventListener('click', () => {
  if (mounted.length === 0) {
    statusText.textContent = 'Mount a scenario first';
    return;
  }
  void run('Measuring updates…', async () => {
    await measureUpdates(5);
  });
});

stressButton.addEventListener('click', () => {
  if (mounted.length === 0) {
    statusText.textContent = 'Mount a scenario first';
    return;
  }
  void run('Stressing…', async () => {
    const frames = await measureStress(5);
    return 'Stress: ' + frames.fps.toFixed(1) + ' fps, p95 ' +
      formatMs(frames.p95Ms) + ' ms, max ' + formatMs(frames.maxMs) + ' ms';
  });
});

suiteButton.addEventListener('click', () => {
  void run('Running suite…', runSuite);
});

copyButton.addEventListener('click', () => {
  if (suiteResults.length === 0) {
    statusText.textContent = 'Run the suite first';
    return;
  }
  void navigator.clipboard.writeText(resultsAsMarkdown()).then(() => {
    statusText.textContent = 'Results copied as markdown';
  });
});

scenarioSelect.addEventListener('change', () => {
  const dashboard = scenarioSelect.value === 'dashboard';
  chartsInput.disabled = !dashboard;
  seriesInput.disabled = dashboard;
  categoriesInput.disabled = dashboard;
});

startFpsMeter(fpsMeter);
