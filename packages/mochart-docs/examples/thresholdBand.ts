// A threshold range: rangeValue turns a thresholds entry into a band between
// two axis values, filled by the style fill members and edged by its stroke
// members, with a title centred inside it.
import type { MochartInputConfig } from '@mochart/core';

export const config: MochartInputConfig = {
  version: '1.0.0',
  title: { text: 'Response Time' },
  categoryAxis: { property: 'day', type: 'string', scale: 'ordinal' },
  valueAxes: [
    {
      thresholds: [
        {
          value: 100,
          rangeValue: 150,
          front: false,
          style: { normal: { fillColor: '#1baf7a', fillOpacity: 0.15, strokeColor: '#1baf7a', strokeOpacity: 0.8 } },
          title: { text: 'Target', side: 'inside', align: 'middle' }
        },
        { value: 200, title: { text: 'SLA limit' }, style: { normal: { strokeDashArray: '6 3' } } }
      ]
    }
  ],
  series: [{ property: 'median', title: 'Median', renderer: 'line' }]
};

export const data = [
  { day: 'Mon', median: 120 },
  { day: 'Tue', median: 135 },
  { day: 'Wed', median: 150 },
  { day: 'Thu', median: 128 },
  { day: 'Fri', median: 160 },
  { day: 'Sat', median: 95 },
  { day: 'Sun', median: 88 }
];
