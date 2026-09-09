export type ScenarioType = 'bar' | 'line' | 'line-markers' | 'area' | 'dashboard';

export interface ScenarioSpec {
  type: ScenarioType;
  seriesCount: number;
  categoryCount: number;
  /** Number of charts mounted side by side; 1 for everything except dashboard. */
  chartCount: number;
}

export interface ScenarioOptions {
  animate: boolean;
  legend: boolean;
}

export const seriesProperty = (index: number): string => 's' + index;

/** Dashboard cells render the simple scenario below, many times over. */
export const DASHBOARD_SERIES = 3;
export const DASHBOARD_CATEGORIES = 50;

export function scenarioLabel(spec: ScenarioSpec): string {
  if (spec.type === 'dashboard') {
    return 'dashboard ×' + spec.chartCount;
  }
  return spec.type;
}

export function scenarioSize(spec: ScenarioSpec): string {
  return spec.seriesCount + '×' + spec.categoryCount + (spec.chartCount > 1 ? ' ×' + spec.chartCount : '');
}

export function scenarioPoints(spec: ScenarioSpec): number {
  return spec.seriesCount * spec.categoryCount * spec.chartCount;
}

/** Build a raw (unenhanced) mochart config for a generated scenario. */
export function makeConfig(type: ScenarioType, seriesCount: number, options: ScenarioOptions): any {
  const renderer = type === 'bar' ? 'bar' : type === 'area' ? 'area' : 'line';
  const seriesDefaults: any = { axis: 'VA0', renderer };
  if (type === 'line-markers') {
    seriesDefaults.marker = { shape: 'circle' };
  }
  else if (renderer === 'line') {
    seriesDefaults.marker = { shape: null };
  }
  const series: any[] = [];
  for (let i = 0; i < seriesCount; i++) {
    series.push({ property: seriesProperty(i), title: 'Series ' + (i + 1) });
  }
  return {
    // current CONFIG_VERSION; configs are generated in current shape, no migration
    version: '1.0.0',
    title: { text: 'Benchmark' },
    animation: {
      enabled: options.animate,
      expansionDuration: 300,
      valueChangeDuration: 300,
      contractionDuration: 300,
      focusDuration: 300
    },
    legend: { visible: options.legend },
    categoryAxis: {
      valueLabel: 'Category',
      property: 'category',
      type: 'number',
      scale: 'ordinal'
    },
    valueAxes: [{ id: 'VA0', side: 'start', min: 0, max: 500 }],
    seriesGroups: {},
    seriesDefaults,
    series
  };
}

export function makeData(seriesCount: number, categoryCount: number): any[] {
  const rows: any[] = [];
  for (let c = 0; c < categoryCount; c++) {
    const row: any = { category: c };
    for (let s = 0; s < seriesCount; s++) {
      row[seriesProperty(s)] = Math.round(Math.random() * 500);
    }
    rows.push(row);
  }
  return rows;
}

/** New random values for every series in every category (fresh data objects). */
export function randomizeData(data: any[], seriesCount: number): any[] {
  return data.map((row) => {
    const next: any = { ...row };
    for (let s = 0; s < seriesCount; s++) {
      next[seriesProperty(s)] = Math.round(Math.random() * 500);
    }
    return next;
  });
}

/** The default matrix the "Run suite" button executes, small to large. */
export const SUITE_ROWS: ScenarioSpec[] = [
  { type: 'bar', seriesCount: 5, categoryCount: 50, chartCount: 1 },
  { type: 'bar', seriesCount: 10, categoryCount: 200, chartCount: 1 },
  { type: 'bar', seriesCount: 10, categoryCount: 500, chartCount: 1 },
  { type: 'bar', seriesCount: 10, categoryCount: 1000, chartCount: 1 },
  { type: 'line', seriesCount: 10, categoryCount: 1000, chartCount: 1 },
  { type: 'line-markers', seriesCount: 10, categoryCount: 1000, chartCount: 1 },
  { type: 'area', seriesCount: 10, categoryCount: 1000, chartCount: 1 },
  { type: 'dashboard', seriesCount: DASHBOARD_SERIES, categoryCount: DASHBOARD_CATEGORIES, chartCount: 24 }
];
