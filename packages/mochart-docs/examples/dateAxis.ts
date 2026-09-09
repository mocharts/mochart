// A linear date category axis positions each point by its actual date, so uneven
// sampling shows as uneven spacing. Dates arrive as ISO strings.
import type { MochartInputConfig } from '@mochart/core';

export const config: MochartInputConfig = {
  version: '1.0.0',
  title: { text: 'Active Users' },
  categoryAxis: {
    property: 'date',
    type: 'date',
    scale: 'linear',
    tickLabel: { format: '%b %d' }
  },
  seriesDefaults: { renderer: 'area' },
  series: [{ property: 'users', title: 'Active users' }]
};

export const data = [
  { date: '2026-06-01T00:00:00Z', users: 120 },
  { date: '2026-06-02T00:00:00Z', users: 132 },
  { date: '2026-06-03T00:00:00Z', users: 101 },
  { date: '2026-06-05T00:00:00Z', users: 154 },
  { date: '2026-06-08T00:00:00Z', users: 148 },
  { date: '2026-06-09T00:00:00Z', users: 170 },
  { date: '2026-06-12T00:00:00Z', users: 190 }
];
