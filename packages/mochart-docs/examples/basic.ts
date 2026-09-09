import type { MochartInputConfig } from '@mochart/core';

export const config: MochartInputConfig = {
  version: '1.0.0',
  title: { text: 'Monthly Revenue' },
  categoryAxis: { property: 'month', type: 'string', scale: 'ordinal' },
  seriesDefaults: { renderer: 'bar' },
  series: [{ property: 'revenue', title: 'Revenue' }]
};

export const data = [
  { month: 'Jan', revenue: 12 },
  { month: 'Feb', revenue: 18 },
  { month: 'Mar', revenue: 15 },
  { month: 'Apr', revenue: 24 },
  { month: 'May', revenue: 21 },
  { month: 'Jun', revenue: 28 }
];

export const altData = [
  { month: 'Jan', revenue: 16 },
  { month: 'Feb', revenue: 11 },
  { month: 'Mar', revenue: 22 },
  { month: 'Apr', revenue: 19 },
  { month: 'May', revenue: 30 },
  { month: 'Jun', revenue: 25 }
];
