// createHeatmap turns a grid of values into heatmap pieces: each row becomes
// a full-width bar series floating on a one-unit band of the value axis
// (labelled with the row names via explicit ticks), and each cell's value
// colors it from a shared sequential ramp.
import { createHeatmap } from '@mochart/core';
import type { MochartInputConfig } from '@mochart/core';

const heatmap = createHeatmap(
  [
    { label: 'Mon', values: [58, 54, 49, 43, 38, 34, 32, 35, 40, 46, 52, 57] },
    { label: 'Tue', values: [61, 56, 50, 44, 39, 35, 33, 36, 42, 48, 54, 59] },
    { label: 'Wed', values: [63, 58, 52, 46, 40, 36, 34, 38, 44, 50, 56, 62] },
    { label: 'Thu', values: [59, 55, 49, 43, 38, 33, 31, 35, 41, 47, 53, 58] },
    { label: 'Fri', values: [52, 48, 43, 38, 33, 29, 27, 30, 36, 41, 46, 51] },
    // null leaves a gap in the grid (no data collected that month).
    { label: 'Sat', values: [24, 22, 19, null, 15, 13, 12, 14, 16, 19, 21, 23] },
    { label: 'Sun', values: [20, 18, 16, 14, 12, 10, 9, 11, 13, 15, 17, 19] }
  ],
  { columnLabels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] }
);

export const config: MochartInputConfig = {
  version: '1.0.0',
  title: { text: 'Support Tickets by Weekday (fictional)' },
  categoryAxis: heatmap.categoryAxis,
  valueAxes: heatmap.valueAxes,
  // valueFormat formats the tooltip's cell values (via tooltipProperty).
  series: heatmap.series.map(seriesConfig => ({ ...seriesConfig, valueFormat: ',.0f' }))
};

export const data = heatmap.data;
