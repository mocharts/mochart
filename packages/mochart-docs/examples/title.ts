// A title using all three of its boxes: a prefix badge, the title text and a
// suffix note, boxed together by the title's own background and aligned to
// the left edge of the plot. verticalExpand grows the shorter boxes to the
// tallest one, so the badge and the note line up with the text.
import type { MochartInputConfig } from '@mochart/core';

export const config: MochartInputConfig = {
  version: '1.0.0',
  title: {
    text: 'Warehouse Throughput',
    align: 'left',
    alignedToAxes: true,
    verticalAlign: 'middle',
    verticalExpand: true,
    margin: { top: 0, right: 0, bottom: 10, left: 0 },
    padding: { top: 3, right: 4, bottom: 3, left: 4 },
    backgroundStyle: {
      strokeColor: 'currentColor',
      strokeOpacity: 0.2,
      strokeWidth: 1,
      fillColor: 'currentColor',
      fillOpacity: 0.03
    },
    textMargin: { top: 0, right: 8, bottom: 0, left: 8 },
    textPadding: { top: 3, right: 6, bottom: 3, left: 6 },
    textBackgroundStyle: { fillColor: 'currentColor', fillOpacity: 0.05 },
    textStyle: { fillColor: 'currentColor', fillOpacity: 0.9 },
    prefix: {
      text: 'FY26',
      padding: { top: 0, right: 6, bottom: 0, left: 6 },
      backgroundStyle: { fillColor: '#3e63dd', fillOpacity: 0.9 },
      textStyle: { fillColor: '#ffffff' }
    },
    suffix: {
      text: 'pallets per week',
      padding: { top: 0, right: 2, bottom: 0, left: 2 },
      textStyle: { fillColor: 'currentColor', fillOpacity: 0.55 }
    },
    truncationEnabled: true,
    truncationText: '…'
  },
  categoryAxis: { property: 'week', type: 'string', scale: 'ordinal' },
  valueAxes: [{ id: 'VA0', title: { text: 'Pallets' }, min: 0 }],
  seriesDefaults: { renderer: 'bar' },
  series: [
    { property: 'inbound', title: 'Inbound' },
    { property: 'outbound', title: 'Outbound' }
  ],
  seriesGroups: [{ id: 'flow' }]
};

export const data = [
  { week: 'W1', inbound: 320, outbound: 295 },
  { week: 'W2', inbound: 348, outbound: 310 },
  { week: 'W3', inbound: 336, outbound: 342 },
  { week: 'W4', inbound: 372, outbound: 351 },
  { week: 'W5', inbound: 359, outbound: 368 },
  { week: 'W6', inbound: 391, outbound: 377 }
];
