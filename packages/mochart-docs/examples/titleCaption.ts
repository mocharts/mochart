// The title moved under the plot and used as a source note: no background,
// aligned to the chart bounds rather than to the axes, and linked. The link
// is disabled here so the docs page does not navigate away when it is
// clicked; an onTitleClick handler still runs.
import type { MochartInputConfig } from '@mochart/core';

export const config: MochartInputConfig = {
  version: '1.0.0',
  title: {
    text: 'Source: weekly operations report',
    position: 'bottom',
    align: 'left',
    alignedToAxes: false,
    link: 'https://example.com/reports/throughput',
    linkDisabled: true,
    margin: { top: 8, right: 0, bottom: 0, left: 0 },
    padding: { top: 0, right: 0, bottom: 0, left: 0 },
    textStyle: { fillColor: 'currentColor', fillOpacity: 0.6 }
  },
  legend: { position: 'bottom' },
  categoryAxis: { property: 'week', type: 'string', scale: 'ordinal' },
  valueAxes: [{ id: 'VA0', title: { text: 'Pallets' }, min: 0 }],
  seriesDefaults: { renderer: 'line' },
  series: [
    { property: 'inbound', title: 'Inbound' },
    { property: 'outbound', title: 'Outbound' }
  ]
};

export const data = [
  { week: 'W1', inbound: 320, outbound: 295 },
  { week: 'W2', inbound: 348, outbound: 310 },
  { week: 'W3', inbound: 336, outbound: 342 },
  { week: 'W4', inbound: 372, outbound: 351 },
  { week: 'W5', inbound: 359, outbound: 368 },
  { week: 'W6', inbound: 391, outbound: 377 }
];
