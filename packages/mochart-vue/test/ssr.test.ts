// @vitest-environment node
// Server rendering: no window, no document. The components must render their
// container without touching the DOM; the chart mounts client-side.
import { describe, it, expect, vi } from 'vitest';
import { createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
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
  it('renders Chart as an empty container div, without warnings', async () => {
    expect(typeof window).toBe('undefined');
    const warnings = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const app = createSSRApp({
      render: () => h(Chart, { mochartConfig: enhanceConfig(config), dataProvider: new ArrayOfObjectsDataProvider(rows), width: 400, height: 300, class: 'host' })
    });
    const html = await renderToString(app);
    expect(html).toMatch(/^<div[^>]*class="host"[^>]*><\/div>$/);
    expect(html).not.toContain('<svg');
    expect(warnings).not.toHaveBeenCalled();
    expect(errors).not.toHaveBeenCalled();
    warnings.mockRestore();
    errors.mockRestore();
  });

  it('renders DefaultChart as an empty container div, without warnings', async () => {
    const warnings = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const app = createSSRApp({ render: () => h(DefaultChart, { config, data: rows, width: 400, height: 300 }) });
    const html = await renderToString(app);
    expect(html).toMatch(/^<div[^>]*><\/div>$/);
    expect(warnings).not.toHaveBeenCalled();
    warnings.mockRestore();
  });
});
