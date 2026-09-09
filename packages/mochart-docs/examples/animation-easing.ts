// Both datasets share the same value extent, so swapping them plays a pure
// value change with no axis phases: the cleanest stage for comparing easings.
import type { MochartInputConfig } from '@mochart/core';

export const config: MochartInputConfig = {
  version: '1.0.0',
  title: { text: 'Monthly Orders' },
  categoryAxis: { property: 'month', type: 'string', scale: 'ordinal' },
  seriesDefaults: { renderer: 'bar' },
  series: [{ property: 'orders', title: 'Orders' }],
  animation: {
    valueChangeDuration: 1500
  }
};

export const data = [
  { month: 'Jan', orders: 95 },
  { month: 'Feb', orders: 15 },
  { month: 'Mar', orders: 60 },
  { month: 'Apr', orders: 25 },
  { month: 'May', orders: 80 },
  { month: 'Jun', orders: 10 }
];

export const altData = [
  { month: 'Jan', orders: 10 },
  { month: 'Feb', orders: 85 },
  { month: 'Mar', orders: 20 },
  { month: 'Apr', orders: 95 },
  { month: 'May', orders: 15 },
  { month: 'Jun', orders: 70 }
];
