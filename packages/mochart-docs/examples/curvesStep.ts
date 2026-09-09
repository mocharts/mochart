// stepAfter holds each value until the next reading — the right semantics
// for state that persists between observations, like stock on hand. The
// default circle markers mark the actual readings at the step corners.
import type { MochartInputConfig } from '@mochart/core';

export const config: MochartInputConfig = {
  version: '1.0.0',
  title: { text: 'Inventory on Hand' },
  categoryAxis: { title: { text: 'Week' }, property: 'week', type: 'number', scale: 'linear' },
  valueAxes: [{ id: 'VA0', title: { text: 'Units' }, min: 0 }],
  series: [
    {
      property: 'onHand',
      title: 'Units in stock',
      renderer: 'area',
      curve: { type: 'stepAfter' }
    }
  ]
};

export const data = [
  { week: 1, onHand: 120 },
  { week: 2, onHand: 95 },
  { week: 3, onHand: 210 },
  { week: 4, onHand: 168 },
  { week: 5, onHand: 132 },
  { week: 6, onHand: 96 },
  { week: 7, onHand: 240 },
  { week: 8, onHand: 205 },
  { week: 9, onHand: 175 },
  { week: 10, onHand: 140 }
];
