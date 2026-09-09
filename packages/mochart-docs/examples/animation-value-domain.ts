// The same growing dataset under the two value-domain modes: 'staged' expands the
// axis first and moves the values after; 'combined' interpolates the axis domain
// together with the values in a single phase.
import type { MochartInputConfig } from '@mochart/core';

const durations = {
  expansionDuration: 900,
  valueChangeDuration: 900,
  contractionDuration: 900
};

const baseConfig: MochartInputConfig = {
  version: '1.0.0',
  categoryAxis: { property: 'week', type: 'string', scale: 'ordinal' },
  seriesDefaults: { renderer: 'bar' },
  series: [{ property: 'orders', title: 'Orders' }]
};

export const config: MochartInputConfig = {
  ...baseConfig,
  title: { text: 'valueDomainChange: staged' },
  animation: { ...durations, valueDomainChange: 'staged' }
};

export const combinedConfig: MochartInputConfig = {
  ...baseConfig,
  title: { text: 'valueDomainChange: combined' },
  animation: { ...durations, valueDomainChange: 'combined' }
};

export const data = [
  { week: 'W1', orders: 14 },
  { week: 'W2', orders: 11 },
  { week: 'W3', orders: 17 },
  { week: 'W4', orders: 13 }
];

// The maximum jumps from 17 to 68: under 'staged' the axis grows first, under
// 'combined' the W3 bar rides the top of the plot while the ticks restate its value.
export const altData = [
  { week: 'W1', orders: 26 },
  { week: 'W2', orders: 19 },
  { week: 'W3', orders: 68 },
  { week: 'W4', orders: 41 }
];
