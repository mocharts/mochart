// colorScale.base.value splits the ramp in two: values above the base
// interpolate through the above pair, values below through the below pair.
// Each min/max anchors to its half's data domain — belowMin sits at the most
// negative value, so the saturated color goes there for the classic
// palest-at-the-base diverging look.
import type { MochartInputConfig } from '@mochart/core';

export const config: MochartInputConfig = {
  version: '1.0.0',
  title: { text: 'Revenue Shaded by Growth' },
  legend: { visible: true },
  categoryAxis: { property: 'region', type: 'string', scale: 'ordinal' },
  valueAxes: [{ id: 'VA0', title: { text: 'Revenue ($k)' } }],
  series: [
    {
      property: 'revenue',
      title: 'Revenue (shaded by YoY growth)',
      renderer: 'bar',
      shapeStyle: { normal: { strokeOpacity: 1, fillOpacity: 1 } },
      colorProperty: 'growth',
      colorScale: {
        interpolation: 'hcl',
        base: {
          value: 0,
          aboveMin: '#8f8fff',
          aboveMax: '#0000ff',
          belowMin: '#ff0000',
          belowMax: '#ff8f8f'
        }
      }
    }
  ]
};

export const data = [
  { region: 'North', revenue: 620, growth: 12 },
  { region: 'South', revenue: 540, growth: -4 },
  { region: 'East', revenue: 480, growth: 22 },
  { region: 'West', revenue: 450, growth: -11 },
  { region: 'Central', revenue: 300, growth: 3 },
  { region: 'Export', revenue: 210, growth: 35 }
];
