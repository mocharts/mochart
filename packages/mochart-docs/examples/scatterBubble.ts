// A scatter chart is marker-only series (renderer 'none') on a linear category
// axis, so points sit at their measured x values. Point markerProperty at a
// data property to scale marker size per point — a bubble chart.
import type { MochartInputConfig } from '@mochart/core';

export const config: MochartInputConfig = {
  version: '1.0.0',
  title: { text: 'Latency under Load' },
  categoryAxis: {
    title: { text: 'Requests per second' },
    property: 'load',
    type: 'number',
    scale: 'linear'
  },
  chart: {
    margin: { right: 5 }
  },
  valueAxes: [{ id: 'VA0', title: { text: 'Latency (ms)' } }],
  seriesDefaults: { renderer: 'none' },
  series: [
    {
      property: 'v1',
      title: 'v1',
      marker: {
        shape: 'circle',
        size: 6
      }
    },
    {
      property: 'v2',
      title: 'v2',
      marker: {
        shape: 'diamond',
        minSize: 4,
        size: 16
      },
      markerProperty: 'v2Errors'
    }
  ]
};

export const data = [
  { load: 12, v1: 38, v2: 31, v2Errors: 0 },
  { load: 45, v1: 42, v2: 33, v2Errors: 1 },
  { load: 70, v1: 55, v2: 41, v2Errors: 2 },
  { load: 160, v1: 74, v2: 52, v2Errors: 3 },
  { load: 240, v1: 92, v2: 60, v2Errors: 8 },
  { load: 310, v1: 121, v2: 71, v2Errors: 14 },
  { load: 470, v1: 168, v2: 95, v2Errors: 25 }
];
