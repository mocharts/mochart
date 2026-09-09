// createPie turns labelled values into pie pieces: every slice is its own
// series (so the legend lists the slices and clicking one filters it),
// and the data is a single row holding every slice value.
import { createPie } from '@mochart/core';
import type { MochartInputConfig } from '@mochart/core';

const pie = createPie(
  [
    { label: 'Subscriptions', value: 420 },
    { label: 'Services', value: 210 },
    { label: 'Hardware', value: 140 },
    { label: 'Licensing', value: 75 },
    { label: 'Support', value: 65 },
    { label: 'Other', value: 30 }
  ],
  // valuePercent puts each slice's share next to its value in the tooltip,
  // e.g. "420 (44.7%)"
  { valueFormat: ',.0f', tooltipValueType: 'valuePercent' }
);

export const config: MochartInputConfig = {
  version: '1.0.0',
  title: { text: 'Revenue by Product (fictional, $k)' },
  // chart.type 'pie' swaps the axis plot for the radial plot.
  chart: pie.chart,
  pie: pie.pie,
  categoryAxis: pie.categoryAxis,
  series: pie.series
};

export const data = pie.data;
