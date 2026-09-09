// Error bars are first-class series config: point errorLowProperty and
// errorHighProperty at the properties holding each point's absolute bounds and
// the chart draws a capped whisker per bar (or line point).
import type { MochartInputConfig } from '@mochart/core';

export const config: MochartInputConfig = {
  version: '1.0.0',
  title: { text: 'Monthly Output with 95% CI (fictional)' },
  categoryAxis: { property: 'month', type: 'string', scale: 'ordinal' },
  valueAxes: [{ title: { text: 'units per day' } }],
  seriesGroups: [{ id: 'plants' }],
  series: [
    { id: 'a', title: 'Plant A', property: 'a', renderer: 'bar', group: 'plants',
      errorLowProperty: 'aLow', errorHighProperty: 'aHigh', valueFormat: ',.1f' },
    { id: 'b', title: 'Plant B', property: 'b', renderer: 'bar', group: 'plants',
      errorLowProperty: 'bLow', errorHighProperty: 'bHigh', valueFormat: ',.1f' },
    { id: 'target', title: 'Target', property: 'target', renderer: 'line', group: null,
      errorLowProperty: 'targetLow', errorHighProperty: 'targetHigh', valueFormat: ',.1f' }
  ]
};

export const data = [
  { month: 'Jan', a: 52.1, aLow: 46.1, aHigh: 58.1, b: 47.7, bLow: 44.0, bHigh: 52.4, target: 52.0, targetLow: 50.0, targetHigh: 53.8 },
  { month: 'Feb', a: 64.1, aLow: 58.5, aHigh: 68.2, b: 50.1, bLow: 43.6, bHigh: 55.9, target: 56.5, targetLow: 54.6, targetHigh: 59.5 },
  { month: 'Mar', a: 69.6, aLow: 64.6, aHigh: 75.2, b: 47.1, bLow: 42.7, bHigh: 51.3, target: 59.8, targetLow: 57.7, targetHigh: 61.5 },
  { month: 'Apr', a: 65.5, aLow: 58.6, aHigh: 69.5, b: 54.4, bLow: 50.0, bHigh: 60.3, target: 61.0, targetLow: 58.5, targetHigh: 62.7 },
  { month: 'May', a: 59.7, aLow: 55.4, aHigh: 64.3, b: 51.5, bLow: 46.6, bHigh: 55.9, target: 59.8, targetLow: 57.6, targetHigh: 62.3 },
  { month: 'Jun', a: 55.7, aLow: 49.2, aHigh: 60.4, b: 45.6, bLow: 40.4, bHigh: 51.1, target: 56.5, targetLow: 53.9, targetHigh: 58.6 }
];
