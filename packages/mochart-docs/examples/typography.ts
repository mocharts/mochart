import type { MochartInputConfig } from '@mochart/core';

// chart.font sets the family and size for every text; the title singles itself out with its own size and weight
export const config: MochartInputConfig = {
  version: '1.0.0',
  chart: { font: { family: 'Georgia, serif', size: 12 } },
  title: { text: 'Support Tickets by Month', font: { size: 18, weight: 'bold' } },
  categoryAxis: { property: 'month', type: 'string', scale: 'ordinal' },
  valueAxes: [{ title: { text: 'tickets', font: { style: 'italic' } }, gridLine: { visible: true } }],
  series: [
    { property: 'opened', title: 'Opened', renderer: 'bar' },
    { property: 'resolved', title: 'Resolved', renderer: 'line' }
  ]
};

export const data = [
  { month: 'Jan', opened: 42, resolved: 39 },
  { month: 'Feb', opened: 51, resolved: 47 },
  { month: 'Mar', opened: 47, resolved: 50 },
  { month: 'Apr', opened: 38, resolved: 41 }
];
