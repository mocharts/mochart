// @vitest-environment node
// Server rendering: no window, no document, components compiled for the server.
// They must render their container without touching the DOM; the chart mounts client-side.
import { describe, it, expect, vi } from 'vitest';
import { render } from 'svelte/server';
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
    const { body } = render(Chart, {
      props: { mochartConfig: enhanceConfig(config), dataProvider: new ArrayOfObjectsDataProvider(rows), width: 400, height: 300, class: 'host' }
    });
    expect(body).toContain('class="host"');
    expect(body).not.toContain('<svg');
    // nothing but the (empty) container div and svelte's hydration markers
    expect(body.replace(/<!--[^>]*-->/g, '')).toMatch(/^<div[^>]*><\/div>$/);
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });

  it('renders DefaultChart as an empty container div, without errors', () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { body } = render(DefaultChart, { props: { config, data: rows, width: 400, height: 300 } });
    expect(body.replace(/<!--[^>]*-->/g, '')).toMatch(/^<div[^>]*><\/div>$/);
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });
});
