// On a stack, capping every segment looks broken — the stack's outerCap.type
// caps only its outer end instead. No per-series cap config needed: any
// series without its own cap.type wears the stack cap when it is the outer
// segment, so the cap follows legend filtering.
import type { MochartInputConfig } from '@mochart/core';

export const config: MochartInputConfig = {
  version: '1.0.0',
  title: { text: 'Revenue by Product' },
  categoryAxis: { property: 'quarter', type: 'string', scale: 'ordinal' },
  seriesDefaults: { renderer: 'bar' },
  series: [
    { property: 'starter', title: 'Starter' },
    { property: 'pro', title: 'Pro' },
    { property: 'enterprise', title: 'Enterprise' }
  ],
  seriesStacks: [{ id: 'revenue', outerCap: { type: 'round', size: 8 } }]
};

export const data = [
  { quarter: 'Q1', starter: 10, pro: 14, enterprise: 8 },
  { quarter: 'Q2', starter: 12, pro: 18, enterprise: 11 },
  { quarter: 'Q3', starter: 11, pro: 22, enterprise: 16 },
  { quarter: 'Q4', starter: 13, pro: 25, enterprise: 22 }
];
