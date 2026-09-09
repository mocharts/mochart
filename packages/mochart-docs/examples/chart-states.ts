import type { ChartFactoryContext, MochartInputConfig } from '@mochart/core';

export const config: MochartInputConfig = {
  version: '1.0.0',
  categoryAxis: { property: 'month', type: 'string', scale: 'ordinal' },
  seriesDefaults: { renderer: 'bar' },
  series: [
    { property: 'subscriptions', title: 'Subscriptions' },
    { property: 'services', title: 'Services' }
  ]
};

export const data = [
  { month: 'Jan', subscriptions: 42, services: 21 },
  { month: 'Feb', subscriptions: 48, services: 25 },
  { month: 'Mar', subscriptions: 45, services: 30 },
  { month: 'Apr', subscriptions: 54, services: 28 }
];

// Deliberately fails validation to demo the config-error state (checkExamples
// validates only the canonical `config`/`data` pair above).
export const invalidConfig = {
  version: '1.0.0',
  categoryAxis: { property: 'month', type: 'string', scale: 'ordinal' },
  series: [{ property: 'subscriptions', axis: 'missing' }]
} as MochartInputConfig;

// An empty series list is valid config — it renders the no-series state.
export const noSeriesConfig: MochartInputConfig = {
  version: '1.0.0',
  categoryAxis: { property: 'month', type: 'string', scale: 'ordinal' },
  series: []
};

export const noData: Record<string, unknown>[] = [];

// A custom loading placeholder: fills the chart area, spins via the Web
// Animations API (no stylesheet needed), and reads its size from the context.
export function getLoadingComponent({ width = 0, height = 0 }: ChartFactoryContext): Node {
  const el = document.createElement('div');
  el.style.cssText = `width:${width}px;height:${height}px;display:flex;align-items:center;` +
    'justify-content:center;gap:10px;font-size:14px;' +
    'backdrop-filter:blur(3px);background:color-mix(in srgb, currentColor 4%, transparent);';
  const spinner = document.createElement('div');
  spinner.style.cssText = 'width:18px;height:18px;border-radius:50%;' +
    'border:3px solid color-mix(in srgb, currentColor 25%, transparent);border-top-color:currentColor;';
  spinner.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }], { duration: 900, iterations: Infinity });
  el.append(spinner, 'Fetching the latest numbers…');
  return el;
}
