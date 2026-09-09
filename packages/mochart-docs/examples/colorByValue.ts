// colorProperty reads a color value per data row and maps it through the
// series colorScale ramp — here bar height is revenue while fill encodes
// margin, a second measure on the same bars. The row without a margin value
// falls back to colorScale.missing.
import type { MochartInputConfig } from '@mochart/core';

export const config: MochartInputConfig = {
  version: '1.0.0',
  title: { text: 'Revenue Shaded by Margin' },
  legend: { visible: true },
  categoryAxis: { property: 'product', type: 'string', scale: 'ordinal' },
  valueAxes: [{ id: 'VA0', title: { text: 'Revenue ($k)' } }],
  series: [
    {
      property: 'revenue',
      title: 'Revenue (shaded by margin %)',
      renderer: 'bar',
      // Bar fills and strokes default to 0.8 opacity; full opacity keeps the ramp true.
      shapeStyle: { normal: { strokeOpacity: 1, fillOpacity: 1 } },
      colorProperty: 'margin',
      colorScale: { interpolation: 'lab', min: '#cde2fb', max: '#0d366b' }
    }
  ]
};

export const data = [
  { product: 'Laptops', revenue: 840, margin: 9 },
  { product: 'Phones', revenue: 720, margin: 14 },
  { product: 'Tablets', revenue: 310, margin: 12 },
  { product: 'Monitors', revenue: 260, margin: 21 },
  { product: 'Audio', revenue: 190, margin: 28 },
  { product: 'Accessories', revenue: 130, margin: 34 },
  // No margin reported — colorScale.missing (default gray) colors this bar.
  { product: 'Services', revenue: 110 }
];
