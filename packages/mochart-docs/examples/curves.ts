// Both series read the same property: 'Raw' draws it with the default
// linear curve (dashed, markers at the data points), 'monotoneX' smooths it.
// monotoneX passes through every point and never overshoots the data.
import type { MochartInputConfig } from '@mochart/core';

export const config: MochartInputConfig = {
  version: '1.0.0',
  title: { text: 'Sensor Readings' },
  categoryAxis: { title: { text: 'Hour' }, property: 'hour', type: 'number', scale: 'linear' },
  valueAxes: [{ id: 'VA0', title: { text: 'Temperature (°C)' } }],
  seriesDefaults: { renderer: 'line' },
  series: [
    {
      property: 'reading',
      title: 'Raw (linear)',
      shapeStyle: { normal: { strokeDashArray: '4 3' } }
    },
    {
      property: 'reading',
      title: 'Smoothed (monotoneX)',
      curve: { type: 'monotoneX' },
      marker: { shape: null }
    }
  ]
};

export const data = [
  { hour: 0, reading: 52 },
  { hour: 2, reading: 47 },
  { hour: 4, reading: 61 },
  { hour: 6, reading: 55 },
  { hour: 8, reading: 70 },
  { hour: 10, reading: 64 },
  { hour: 12, reading: 76 },
  { hour: 14, reading: 58 },
  { hour: 16, reading: 66 },
  { hour: 18, reading: 49 },
  { hour: 20, reading: 57 },
  { hour: 22, reading: 51 }
];
