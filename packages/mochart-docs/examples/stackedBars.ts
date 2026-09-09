// With exactly one entry in seriesStacks, every series defaults its
// `stack` to that stack's id — no per-series wiring needed.
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
  seriesStacks: [{ id: 'revenue' }]
};

export const data = [
  { quarter: 'Q1', starter: 10, pro: 14, enterprise: 8 },
  { quarter: 'Q2', starter: 12, pro: 18, enterprise: 11 },
  { quarter: 'Q3', starter: 11, pro: 22, enterprise: 16 },
  { quarter: 'Q4', starter: 13, pro: 25, enterprise: 22 }
];

export const altData = [
  { quarter: 'Q1', starter: 14, pro: 10, enterprise: 12 },
  { quarter: 'Q2', starter: 9, pro: 24, enterprise: 8 },
  { quarter: 'Q3', starter: 16, pro: 15, enterprise: 21 },
  { quarter: 'Q4', starter: 11, pro: 30, enterprise: 14 }
];
