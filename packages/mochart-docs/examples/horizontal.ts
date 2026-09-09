// plot.inverted swaps the axes: categories run down the left side and
// values extend horizontally.
import type { MochartInputConfig } from '@mochart/core';

export const config: MochartInputConfig = {
  version: '1.0.0',
  title: { text: 'Support Tickets by Team' },
  plot: { inverted: true },
  categoryAxis: { property: 'team', type: 'string', scale: 'ordinal' },
  seriesDefaults: { renderer: 'bar' },
  series: [{ property: 'tickets', title: 'Open tickets' }]
};

export const data = [
  { team: 'Platform', tickets: 34 },
  { team: 'Billing', tickets: 27 },
  { team: 'Mobile', tickets: 21 },
  { team: 'Integrations', tickets: 15 },
  { team: 'Onboarding', tickets: 9 }
];

export const altData = [
  { team: 'Platform', tickets: 22 },
  { team: 'Billing', tickets: 31 },
  { team: 'Mobile', tickets: 12 },
  { team: 'Integrations', tickets: 25 },
  { team: 'Onboarding', tickets: 17 }
];
