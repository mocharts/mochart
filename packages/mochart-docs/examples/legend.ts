// A styled legend above the plot: right-aligned against the chart bounds
// instead of the axes, boxed with a faint background, and with filtered
// series struck through rather than only greyed out. The long EMEA title is
// truncated once the legend row runs out of room.
import type { MochartInputConfig } from '@mochart/core';

export const config: MochartInputConfig = {
  version: '1.0.0',
  title: { text: 'Regional Revenue' },
  categoryAxis: { property: 'quarter', type: 'string', scale: 'ordinal' },
  valueAxes: [{ id: 'VA0', title: { text: 'Revenue ($k)' }, min: 0 }],
  seriesDefaults: { renderer: 'line' },
  series: [
    { property: 'north', title: 'North America' },
    { property: 'emea', title: 'Europe, Middle East and Africa' },
    { property: 'apac', title: 'Asia Pacific' },
    { property: 'latam', title: 'Latin America' }
  ],
  legend: {
    position: 'top',
    align: 'right',
    alignedToAxes: false,
    margin: { top: 0, right: 0, bottom: 8, left: 0 },
    padding: { top: 2, right: 6, bottom: 2, left: 6 },
    backgroundStyle: {
      strokeColor: 'currentColor',
      strokeOpacity: 0.25,
      strokeWidth: 1,
      fillColor: 'currentColor',
      fillOpacity: 0.04
    },
    item: {
      margin: { top: 1, right: 4, bottom: 1, left: 4 },
      padding: { top: 2, right: 4, bottom: 2, left: 4 },
      textStyle: { fillColor: 'currentColor', fillOpacity: 0.85 }
    },
    icon: { size: 10, spacing: 6 },
    strikeThroughFiltered: true,
    truncationEnabled: true,
    truncationText: '…'
  }
};

export const data = [
  { quarter: 'Q1', north: 420, emea: 310, apac: 180, latam: 95 },
  { quarter: 'Q2', north: 455, emea: 335, apac: 210, latam: 110 },
  { quarter: 'Q3', north: 470, emea: 320, apac: 245, latam: 120 },
  { quarter: 'Q4', north: 510, emea: 360, apac: 270, latam: 140 }
];
