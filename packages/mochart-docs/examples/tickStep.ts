// tickStep on a daily ordinal date axis: a period of week gives the first trading
// day of each week the tick, through holidays and as the window slides.
import type { MochartInputConfig } from '@mochart/core';

export const config: MochartInputConfig = {
  version: '1.0.0',
  title: { text: 'Daily Close (fictional, $)' },
  categoryAxis: {
    property: 'date',
    type: 'date',
    scale: 'ordinal',
    gridLine: { visible: true },
    tickLabel: { format: '%b %d' },
    valueFormat: '%a %b %d',
    tickStep: { period: 'week' }
  },
  valueAxes: [{ tickLabel: { format: '$.0f' } }],
  series: [{ property: 'close', renderer: 'line', title: 'Close' }]
};

// Wednesday June 3 start, and Monday June 15 is a holiday
export const data = [
  { date: '2026-06-03', close: 97.6 }, { date: '2026-06-04', close: 98.9 }, { date: '2026-06-05', close: 100.2 },
  { date: '2026-06-08', close: 101.0 }, { date: '2026-06-09', close: 99.7 }, { date: '2026-06-10', close: 100.8 },
  { date: '2026-06-11', close: 102.3 }, { date: '2026-06-12', close: 101.5 }, { date: '2026-06-16', close: 102.2 },
  { date: '2026-06-17', close: 104.0 }, { date: '2026-06-18', close: 103.4 }, { date: '2026-06-19', close: 105.2 },
  { date: '2026-06-22', close: 104.6 }, { date: '2026-06-23', close: 106.1 }, { date: '2026-06-24', close: 105.3 },
  { date: '2026-06-25', close: 107.0 }, { date: '2026-06-26', close: 106.4 }, { date: '2026-06-29', close: 107.8 }
];
