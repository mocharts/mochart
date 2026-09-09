// Markers draw a shape at each value of a line series; labels render the
// value of labelProperty next to each shape — point it at the series'
// own property to show value labels.
import type { MochartInputConfig } from '@mochart/core';

export const config: MochartInputConfig = {
  version: '1.0.0',
  title: { text: 'Release Velocity' },
  categoryAxis: { property: 'sprint', type: 'string', scale: 'ordinal' },
  series: [
    {
      property: 'planned',
      title: 'Planned',
      renderer: 'bar',
      labelProperty: 'planned',
      label: {
        format: ',.0f',
        position: 'inside',
        // Only the colors of the normal state are overridden — the opacities,
        // the stroke width, and the focused/defocused states keep their defaults.
        textStyle: { normal: { strokeColor: '#ffffff', fillColor: '#ffffff' } },
        minRangeFraction: 0.05
      }
    },
    {
      property: 'shipped',
      title: 'Shipped',
      renderer: 'line',
      marker: {
        shape: 'circle',
        size: 5
      }
    }
  ]
};

export const data = [
  { sprint: 'S1', planned: 12, shipped: 9 },
  { sprint: 'S2', planned: 14, shipped: 13 },
  { sprint: 'S3', planned: 11, shipped: 12 },
  { sprint: 'S4', planned: 15, shipped: 14 },
  { sprint: 'S5', planned: 13, shipped: 11 }
];
