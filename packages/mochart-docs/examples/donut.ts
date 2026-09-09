// The donut option adds an inner radius, and tooltipValueType 'percent' makes the
// tooltip show each slice's share instead of its raw value. The chart computes
// those percentages from the current slice shares, so — like the percent slice
// labels below — they renormalize as slices are filtered.
import { createPie } from '@mochart/core';
import type { MochartInputConfig } from '@mochart/core';

const donut = createPie(
  [
    { label: 'Chrome', value: 62 },
    { label: 'Safari', value: 20 },
    { label: 'Edge', value: 6 },
    { label: 'Firefox', value: 5 },
    { label: 'Opera', value: 3 },
    { label: 'Other', value: 4 }
  ],
  { donut: true, tooltipValueType: 'percent' }
);

export const config: MochartInputConfig = {
  version: '1.0.0',
  title: { text: 'Browser Market Share (fictional)' },
  chart: donut.chart,
  // label.visible puts percent labels at the slice centroids (slices thinner
  // than label.minFraction hide theirs), and focusOffsetFraction explodes
  // the hovered slice away from the center.
  pie: { ...donut.pie, label: { visible: true, type: 'percent' }, focusOffsetFraction: 0.05 },
  categoryAxis: donut.categoryAxis,
  series: donut.series
};

export const data = donut.data;
