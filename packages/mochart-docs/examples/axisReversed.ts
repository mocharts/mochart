// reversed flips which end of the axis each bound sits at. A rank reads best
// with first place at the top, which is the opposite of the default direction.
import type { MochartInputConfig } from '@mochart/core';

export const config: MochartInputConfig = {
  version: '1.0.0',
  title: { text: 'League Position' },
  categoryAxis: { property: 'week', type: 'string', scale: 'ordinal' },
  valueAxes: [{ id: 'VA0', title: { text: 'Position' }, reversed: true, min: 1, max: 10, tickLabel: { format: 'd' } }],
  series: [
    {
      property: 'position',
      title: 'Position',
      renderer: 'line',
      marker: { shape: 'circle' }
    }
  ]
};

export const data = [
  { week: 'Wk 1', position: 8 },
  { week: 'Wk 2', position: 7 },
  { week: 'Wk 3', position: 9 },
  { week: 'Wk 4', position: 5 },
  { week: 'Wk 5', position: 4 },
  { week: 'Wk 6', position: 6 },
  { week: 'Wk 7', position: 3 },
  { week: 'Wk 8', position: 2 }
];
