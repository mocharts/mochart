// Long team names on a horizontal category axis. Rotating the labels -45°
// makes them perpendicular to the axis, so each one is truncated to a
// fraction of the plot height (truncation.maxFraction) rather than to the
// width of its category slot; truncation.minLength keeps a readable minimum
// when the chart is short.
import type { MochartInputConfig } from '@mochart/core';

export const config: MochartInputConfig = {
  version: '1.0.0',
  title: { text: 'Open Tickets by Team' },
  categoryAxis: {
    property: 'team',
    type: 'string',
    scale: 'ordinal',
    title: { text: 'Team' },
    tickLabel: {
      rotation: -45,
      truncation: { enabled: true, maxFraction: 0.35, minLength: 72, text: '…' }
    }
  },
  valueAxes: [{ id: 'VA0', title: { text: 'Open tickets' }, min: 0 }],
  series: [{ property: 'open', title: 'Open tickets', renderer: 'bar' }]
};

export const data = [
  { team: 'Customer Support (Americas)', open: 42 },
  { team: 'Customer Support (EMEA)', open: 37 },
  { team: 'Platform Engineering', open: 18 },
  { team: 'Mobile Applications', open: 25 },
  { team: 'Data and Analytics', open: 11 },
  { team: 'Billing and Payments', open: 29 },
  { team: 'Security Operations', open: 8 },
  { team: 'Developer Relations', open: 14 },
  { team: 'Quality Assurance', open: 21 }
];
