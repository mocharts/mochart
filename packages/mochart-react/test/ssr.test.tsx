// @vitest-environment node
// Server rendering: no window, no document. The components must render their
// container without touching the DOM; the chart mounts client-side.
import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { enhanceConfig, ArrayOfObjectsDataProvider } from '@mochart/core';
import { Chart, DefaultChart } from '../src/index';

const config = {
  version: '1.0.0',
  title: { text: 'Test Chart' },
  categoryAxis: { property: 'name', type: 'string', scale: 'ordinal' },
  seriesDefaults: { renderer: 'bar' },
  series: [{ property: 'value', title: 'Value' }]
} as any;

const rows = [{ name: 'A', value: 10 }, { name: 'B', value: 20 }];

describe('server-side rendering', () => {
  it('renders Chart as an empty container div, without errors', () => {
    expect(typeof window).toBe('undefined');
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const html = renderToString(
      <Chart mochartConfig={enhanceConfig(config)} dataProvider={new ArrayOfObjectsDataProvider(rows)} width={400} height={300} className="host" />
    );
    expect(html).toMatch(/^<div[^>]*class="host"[^>]*><\/div>$/);
    expect(html).not.toContain('<svg');
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });

  it('renders DefaultChart as an empty container div, without errors', () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const html = renderToString(<DefaultChart config={config} data={rows} width={400} height={300} />);
    expect(html).toMatch(/^<div[^>]*><\/div>$/);
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });
});
