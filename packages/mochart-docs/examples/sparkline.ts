// createSparklineConfig turns an ordinary chart config into a sparkline
// preset: axes, legend, tooltip, crosshairs and point markers hidden and
// margins collapsed, leaving only the plotted shape.
import { createSparklineConfig } from '@mochart/core';
import type { MochartInputConfig } from '@mochart/core';

export const config: MochartInputConfig = createSparklineConfig({
  version: '1.0.0',
  categoryAxis: { property: 'day', type: 'number', scale: 'linear' },
  series: [{ property: 'revenue', title: 'Revenue', renderer: 'area' }]
});

const values = [
  112, 118, 115, 121, 119, 124, 128, 125, 131, 129,
  134, 138, 135, 132, 137, 141, 145, 142, 147, 151,
  148, 153, 158, 155, 161, 164, 160, 166, 171, 169
];

export const data = values.map((revenue, day) => ({ day, revenue }));
