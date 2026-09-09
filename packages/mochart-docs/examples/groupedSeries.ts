// With exactly one entry in seriesGroups, every series defaults its
// `group` to that group's id and the bars lay out side by side.
import type { MochartInputConfig } from '@mochart/core';

export const config: MochartInputConfig = {
  version: '1.0.0',
  title: { text: 'Signups by Channel' },
  categoryAxis: { property: 'quarter', type: 'string', scale: 'ordinal' },
  seriesDefaults: { renderer: 'bar' },
  series: [
    { property: 'organic', title: 'Organic' },
    { property: 'paid', title: 'Paid' },
    { property: 'referral', title: 'Referral' }
  ],
  seriesGroups: [{ id: 'channels' }]
};

export const data = [
  { quarter: 'Q1', organic: 18, paid: 12, referral: 6 },
  { quarter: 'Q2', organic: 22, paid: 15, referral: 9 },
  { quarter: 'Q3', organic: 26, paid: 13, referral: 12 },
  { quarter: 'Q4', organic: 31, paid: 18, referral: 14 }
];

export const altData = [
  { quarter: 'Q1', organic: 24, paid: 9, referral: 10 },
  { quarter: 'Q2', organic: 17, paid: 21, referral: 7 },
  { quarter: 'Q3', organic: 29, paid: 16, referral: 15 },
  { quarter: 'Q4', organic: 25, paid: 23, referral: 11 }
];
