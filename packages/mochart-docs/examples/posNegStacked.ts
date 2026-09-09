// In a stack, each sign accumulates separately from the shared zero base:
// positive segments stack upward, negative segments stack downward. An axis
// with stacks defaults its base to 0 — no pinning needed.
import type { MochartInputConfig } from '@mochart/core';

export const config: MochartInputConfig = {
  version: '1.0.0',
  title: { text: 'Quarterly Cash Flow' },
  categoryAxis: { property: 'quarter', type: 'string', scale: 'ordinal' },
  valueAxes: [{ id: 'VA0', title: { text: 'Cash flow ($k)' } }],
  seriesDefaults: { renderer: 'bar' },
  series: [
    { property: 'sales', title: 'Sales' },
    { property: 'services', title: 'Services' },
    { property: 'payroll', title: 'Payroll' },
    { property: 'infrastructure', title: 'Infrastructure' }
  ],
  seriesStacks: [{ id: 'cashflow' }]
};

export const data = [
  { quarter: 'Q1', sales: 68, services: 22, payroll: -48, infrastructure: -18 },
  { quarter: 'Q2', sales: 75, services: 26, payroll: -50, infrastructure: -21 },
  { quarter: 'Q3', sales: 71, services: 31, payroll: -52, infrastructure: -19 },
  { quarter: 'Q4', sales: 83, services: 34, payroll: -55, infrastructure: -23 }
];
