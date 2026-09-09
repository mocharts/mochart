// The chart and plot boxes made visible. chart.padding holds the title,
// legend and plot away from the chart background's edge, while chart.margin
// keeps that background off the svg edge; plot.margin insets the plot
// background, and plot.padding sits between it and the axis bands.
import type { MochartInputConfig } from '@mochart/core';

export const config: MochartInputConfig = {
  version: '1.0.0',
  title: { text: 'Warehouse Throughput' },
  chart: {
    margin: { top: 2, right: 2, bottom: 2, left: 2 },
    padding: { top: 8, right: 10, bottom: 8, left: 10 },
    backgroundStyle: {
      strokeColor: 'currentColor',
      strokeOpacity: 0.25,
      strokeWidth: 1,
      fillColor: 'currentColor',
      fillOpacity: 0.02
    }
  },
  plot: {
    margin: { top: 4, right: 0, bottom: 4, left: 0 },
    padding: { top: 4, right: 8, bottom: 4, left: 4 },
    backgroundStyle: {
      strokeColor: 'currentColor',
      strokeOpacity: 0.15,
      strokeWidth: 1,
      fillColor: 'currentColor',
      fillOpacity: 0.04
    }
  },
  categoryAxis: {
    property: 'week',
    type: 'string',
    scale: 'ordinal',
    title: { text: 'Week' }
  },
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
