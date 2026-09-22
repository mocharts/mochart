// A threshold line with a title on the value axis, plus a range series: the
// band spans from rangeProperty (low) to property (high), with the actual
// values drawn as a line on top.
import type { MochartInputConfig } from '@mochart/core';

export const config: MochartInputConfig = {
  version: '1.0.0',
  title: { text: 'Response Time' },
  categoryAxis: { property: 'day', type: 'string', scale: 'ordinal' },
  valueAxes: [
    {
      thresholds: [{
        value: 200,
        title: { text: 'SLA limit' },
        style: { normal: { strokeDashArray: '6 3' } }
      }]
    }
  ],
  series: [
    {
      property: 'p95',
      rangeProperty: 'p5',
      title: 'p5–p95 range',
      renderer: 'area',
      shapeStyle: { normal: { strokeOpacity: 0, fillOpacity: 0.25 } }
    },
    { property: 'median', title: 'Median', renderer: 'line' }
  ]
};

export const data = [
  { day: 'Mon', median: 120, p5: 80, p95: 170 },
  { day: 'Tue', median: 135, p5: 90, p95: 190 },
  { day: 'Wed', median: 150, p5: 95, p95: 230 },
  { day: 'Thu', median: 128, p5: 85, p95: 180 },
  { day: 'Fri', median: 160, p5: 100, p95: 250 },
  { day: 'Sat', median: 95, p5: 70, p95: 140 },
  { day: 'Sun', median: 88, p5: 65, p95: 130 }
];
