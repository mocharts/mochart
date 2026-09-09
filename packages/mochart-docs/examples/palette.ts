// Replace the normal series palette with Paul Tol's compact high-contrast
// qualitative scheme. Default focused/defocused styles keep the normal color.
import type { MochartInputConfig } from '@mochart/core';

const colors = ['#004488', '#ddaa33', '#bb5566'];

export const config: MochartInputConfig = {
  version: '1.0.0',
  title: { text: 'Support Requests by Channel' },
  categoryAxis: { property: 'month', type: 'string', scale: 'ordinal' },
  valueAxes: [{ title: { text: 'requests' }, gridLine: { visible: true } }],
  colorPalette: {
    shape: {
      normal: {
        strokeColors: colors,
        fillColors: colors
      }
    }
  },
  seriesDefaults: { renderer: 'line', marker: { shape: 'circle' } },
  series: [
    { property: 'web', title: 'Web' },
    { property: 'email', title: 'Email' },
    { property: 'phone', title: 'Phone' }
  ]
};

export const data = [
  { month: 'Jan', web: 48, email: 31, phone: 18 },
  { month: 'Feb', web: 55, email: 28, phone: 21 },
  { month: 'Mar', web: 51, email: 35, phone: 17 },
  { month: 'Apr', web: 63, email: 38, phone: 23 },
  { month: 'May', web: 68, email: 34, phone: 20 },
  { month: 'Jun', web: 72, email: 41, phone: 25 }
];
