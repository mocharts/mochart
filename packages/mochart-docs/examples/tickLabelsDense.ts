// Thirty daily readings on an ordinal date axis. The labels stay flat and
// truncation is off, so the axis keeps only as many ticks as fit — one label
// width plus minTickSpacing per tick, at most maxTickCount — and draws the
// surviving labels in full. format sets the label text.
import type { MochartInputConfig } from '@mochart/core';

export const config: MochartInputConfig = {
  version: '1.0.0',
  title: { text: 'Daily Visits' },
  categoryAxis: {
    property: 'day',
    type: 'date',
    scale: 'ordinal',
    title: { text: 'June 2026' },
    minTickSpacing: 24,
    maxTickCount: 8,
    tickLabel: {
      format: '%b %d',
      truncationEnabled: false,
      marginInner: 4,
      textStyle: { normal: { fillOpacity: 0.75 } }
    }
  },
  valueAxes: [{ id: 'VA0', title: { text: 'Visits' }, min: 0 }],
  series: [{ property: 'visits', title: 'Visits', renderer: 'area' }]
};

const firstDay = Date.UTC(2026, 5, 1);
const dayMs = 24 * 60 * 60 * 1000;

export const data = Array.from({ length: 30 }, (_, i) => ({
  day: new Date(firstDay + i * dayMs).toISOString(),
  // a weekly rhythm: weekends (June 2026 starts on a Monday) dip
  visits: Math.round(180 + 40 * Math.sin(i / 2.5) - (i % 7 >= 5 ? 60 : 0))
}));
