// min and max set the axis domain outright. The 1400ms spike sits well outside
// max, so it is clipped to the plot instead of flattening everything else, and
// the clip indicator band marks the edge that is hiding it.
import type { MochartInputConfig } from '@mochart/core';

export const config: MochartInputConfig = {
  version: '1.0.0',
  title: { text: 'p95 Response Time' },
  categoryAxis: { property: 'time', type: 'string', scale: 'ordinal' },
  valueAxes: [{ id: 'VA0', title: { text: 'Response time (ms)' }, min: 0, max: 200 }],
  series: [
    {
      property: 'ms',
      title: 'p95',
      renderer: 'line',
      marker: { shape: 'circle' }
    }
  ]
};

export const data = [
  { time: '09:00', ms: 118 },
  { time: '09:05', ms: 124 },
  { time: '09:10', ms: 109 },
  { time: '09:15', ms: 132 },
  { time: '09:20', ms: 1408 },
  { time: '09:25', ms: 141 },
  { time: '09:30', ms: 116 },
  { time: '09:35', ms: 127 },
  { time: '09:40', ms: 105 },
  { time: '09:45', ms: 119 }
];
