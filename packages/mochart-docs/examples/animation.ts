// Alternate dataset adds categories and a much larger maximum, so animating to it
// plays axis expansion before the value change — and animating back plays the
// value change before axis contraction.
import type { MochartInputConfig } from '@mochart/core';

export const config: MochartInputConfig = {
  version: '1.0.0',
  title: { text: 'Weekly Orders' },
  categoryAxis: { property: 'week', type: 'string', scale: 'ordinal' },
  seriesDefaults: { renderer: 'bar' },
  series: [{ property: 'orders', title: 'Orders' }],
  animation: {
    expansionDuration: 900,
    valueChangeDuration: 900,
    contractionDuration: 900
  }
};

export const data = [
  { week: 'W1', orders: 14 },
  { week: 'W2', orders: 11 },
  { week: 'W3', orders: 17 },
  { week: 'W4', orders: 13 }
];

export const altData = [
  { week: 'W1', orders: 21 },
  { week: 'W2', orders: 26 },
  { week: 'W3', orders: 35 },
  { week: 'W4', orders: 42 },
  { week: 'W5', orders: 58 },
  { week: 'W6', orders: 74 },
  { week: 'W7', orders: 66 }
];
