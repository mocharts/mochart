// The homepage chart: stacked bars with an interactive legend, so the first
// chart a visitor sees shows off staged animation and legend focus/filtering.
import type { MochartInputConfig } from '@mochart/core';

export const config: MochartInputConfig = {
  version: '1.0.0',
  title: { text: 'Monthly Active Users' },
  categoryAxis: { property: 'month', type: 'string', scale: 'ordinal' },
  seriesDefaults: { renderer: 'bar' },
  series: [
    { property: 'web', title: 'Web' },
    { property: 'ios', title: 'iOS' },
    { property: 'android', title: 'Android' }
  ],
  seriesStacks: [{ id: 'users' }],
  legend: {
    filterOnClick: true,
    focusOnHover: true
  }
};

export const data = [
  { month: 'Jan', web: 14, ios: 8, android: 6 },
  { month: 'Feb', web: 16, ios: 10, android: 8 },
  { month: 'Mar', web: 15, ios: 13, android: 11 },
  { month: 'Apr', web: 18, ios: 15, android: 14 },
  { month: 'May', web: 17, ios: 19, android: 16 },
  { month: 'Jun', web: 21, ios: 22, android: 19 }
];

export const altData = [
  { month: 'Jan', web: 19, ios: 12, android: 9 },
  { month: 'Feb', web: 13, ios: 16, android: 12 },
  { month: 'Mar', web: 21, ios: 11, android: 17 },
  { month: 'Apr', web: 15, ios: 21, android: 10 },
  { month: 'May', web: 23, ios: 14, android: 20 },
  { month: 'Jun', web: 17, ios: 25, android: 13 }
];
