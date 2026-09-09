import type { MochartInputConfig } from '@mochart/core';

export const config: MochartInputConfig = {
  version: '1.0.0',
  title: { text: 'Signups by Quarter' },
  categoryAxis: { property: 'quarter', type: 'string', scale: 'ordinal' },
  valueAxes: [{ title: { text: 'signups' }, gridLine: { visible: true } }],
  seriesDefaults: { renderer: 'bar' },
  series: [
    { property: 'organic', title: 'Organic' },
    { property: 'referral', title: 'Referral' }
  ],
  seriesStacks: [{ id: 'signups' }]
};

export const data = [
  { quarter: 'Q1', organic: 38, referral: 22 },
  { quarter: 'Q2', organic: 44, referral: 27 },
  { quarter: 'Q3', organic: 41, referral: 35 },
  { quarter: 'Q4', organic: 52, referral: 40 }
];
