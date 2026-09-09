// Built-in patterns are screen-space fills. Declare each pattern once, then
// reference its id from a series; "series" resolves to that series' base color.
import type { MochartInputConfig } from '@mochart/core';

export const config: MochartInputConfig = {
  version: '1.0.0',
  title: { text: 'Quarterly orders by channel' },
  categoryAxis: { property: 'quarter', type: 'string', scale: 'ordinal' },
  patternDefaults: {
    spacing: 9,
    foregroundColor: 'series',
    backgroundColor: 'series',
    backgroundOpacity: 0.18
  },
  patterns: [
    { id: 'direct', type: 'lines', rotation: 45, lineWidth: 2 },
    { id: 'partner', type: 'crosshatch', rotation: 45, lineWidth: 1.5 },
    { id: 'marketplace', type: 'dots', radius: 2 }
  ],
  series: [
    { property: 'direct', title: 'Direct', renderer: 'bar', pattern: 'direct' },
    { property: 'partner', title: 'Partner', renderer: 'bar', pattern: 'partner' },
    { property: 'marketplace', title: 'Marketplace', renderer: 'bar', pattern: 'marketplace' }
  ]
};

export const data = [
  { quarter: 'Q1', direct: 42, partner: 31, marketplace: 18 },
  { quarter: 'Q2', direct: 48, partner: 35, marketplace: 24 },
  { quarter: 'Q3', direct: 55, partner: 39, marketplace: 29 },
  { quarter: 'Q4', direct: 61, partner: 44, marketplace: 37 }
];
