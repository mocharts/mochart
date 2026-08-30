// Per-series tooltip formatting: a d3-format string plus optional prefix and
// suffix around the formatted value, with the series title as the label. The
// category axis formats the tooltip's category line separately from its ticks.
import type { MochartInputConfig } from '@mochart/core';

export const config: MochartInputConfig = {
  version: '1.0.0',
  title: { text: 'Store Performance' },
  categoryAxis: {
    property: 'month',
    type: 'date',
    scale: 'ordinal',
    tickLabel: { format: '%b' },
    valueFormat: '%B'
  },
  valueAxes: [
    { id: 'money', title: { text: 'Revenue' } },
    { id: 'rate', title: { text: 'Refund rate' }, side: 'end', tickLabel: { format: '.1%' } }
  ],
  series: [
    {
      property: 'revenue',
      title: 'Revenue',
      renderer: 'bar',
      axis: 'money',
      valueFormat: ',.1f',
      valuePrefix: '$',
      valueSuffix: 'k'
    },
    {
      property: 'refunds',
      title: 'Refund rate',
      renderer: 'line',
      axis: 'rate',
      valueFormat: '.1%'
    }
  ],
  tooltip: {
    valueAlign: 'right'
  }
};

export const data = [
  { month: '2025-01-01', revenue: 41.2, refunds: 0.021 },
  { month: '2025-02-01', revenue: 46.8, refunds: 0.018 },
  { month: '2025-03-01', revenue: 44.1, refunds: 0.024 },
  { month: '2025-04-01', revenue: 52.6, refunds: 0.016 },
  { month: '2025-05-01', revenue: 57.9, refunds: 0.019 },
  { month: '2025-06-01', revenue: 63.4, refunds: 0.014 }
];
