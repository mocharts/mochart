// @vitest-environment node
// Server rendering: no window, no document. A server renderer instantiates a
// directive and calls render(); ours must return noChange without touching the
// DOM (all DOM work is in update(), which only runs client-side).
import { describe, it, expect } from 'vitest';
import { noChange } from 'lit-html';
import { PartType } from 'lit-html/directive.js';
import type { Directive, DirectiveResult, PartInfo } from 'lit-html/directive.js';
import { enhanceConfig, ArrayOfObjectsDataProvider } from '@mochart/core';
import { chart, defaultChart } from '../src/index';

const config = {
  version: '1.0.0',
  title: { text: 'Test Chart' },
  categoryAxis: { property: 'name', type: 'string', scale: 'ordinal' },
  seriesDefaults: { renderer: 'bar' },
  series: [{ property: 'value', title: 'Value' }]
} as any;

const rows = [{ name: 'A', value: 10 }, { name: 'B', value: 20 }];

// what a server renderer does with a directive result: new up its class for the part, then render(values)
function serverRender(result: DirectiveResult): unknown {
  const { _$litDirective$: DirectiveClass, values } = result as unknown as { _$litDirective$: new (part: PartInfo) => Directive; values: unknown[] };
  const partInfo = { type: PartType.CHILD } as PartInfo;
  return new DirectiveClass(partInfo).render(...values);
}

describe('server-side rendering', () => {
  it('chart() renders noChange without touching the DOM', () => {
    expect(typeof document).toBe('undefined');
    const result = chart({ mochartConfig: enhanceConfig(config), dataProvider: new ArrayOfObjectsDataProvider(rows), width: 400, height: 300 });
    expect(serverRender(result)).toBe(noChange);
  });

  it('defaultChart() renders noChange without touching the DOM', () => {
    const result = defaultChart({ config, data: rows, width: 400, height: 300 });
    expect(serverRender(result)).toBe(noChange);
  });
});
