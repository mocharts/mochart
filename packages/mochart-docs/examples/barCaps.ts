// cap.type draws a decorative cap on the value end of every bar in a series:
// 'round' rounds the corners, 'curve' bulges a dome, 'point' rises to a peak.
// The shared cap.size sits in seriesDefaults; each series picks its shape.
import type { MochartInputConfig } from '@mochart/core';

export const config: MochartInputConfig = {
  version: '1.0.0',
  title: { text: 'Cap Shapes' },
  categoryAxis: { property: 'quarter', type: 'string', scale: 'ordinal' },
  valueAxes: [{ id: 'VA0', min: 0 }],
  seriesDefaults: { renderer: 'bar', cap: { size: 10 } },
  series: [
    { property: 'round', title: 'round', cap: { type: 'round' } },
    { property: 'curve', title: 'curve', cap: { type: 'curve' } },
    { property: 'point', title: 'point', cap: { type: 'point' } }
  ],
  seriesGroups: [{ id: 'caps' }]
};

export const data = [
  { quarter: 'Q1', round: 38, curve: 31, point: 26 },
  { quarter: 'Q2', round: 44, curve: 36, point: 33 },
  { quarter: 'Q3', round: 41, curve: 42, point: 30 },
  { quarter: 'Q4', round: 49, curve: 39, point: 37 }
];
