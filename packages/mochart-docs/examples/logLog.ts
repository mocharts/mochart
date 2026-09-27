// A number category axis can be log too: with both axes log, a low-pass
// filter's roll-off above its 1 kHz cutoff is a straight line, falling by 10x
// for every tenfold rise in frequency for the first-order filter and 100x for
// the second-order one.
import type { MochartInputConfig } from '@mochart/core';

export const config: MochartInputConfig = {
  version: '1.0.0',
  title: { text: 'Low-Pass Filter Response' },
  categoryAxis: {
    property: 'hz',
    type: 'number',
    scale: 'log',
    title: { text: 'Frequency (Hz)' },
    valueFormat: ',.4~g',
    valueSuffix: ' Hz'
  },
  valueAxes: [{ scale: 'log', title: { text: 'Gain (output / input)' }, tickLabel: { format: '~g' } }],
  series: [
    { property: 'firstOrder', title: 'First order', renderer: 'line', marker: { shape: null } },
    { property: 'secondOrder', title: 'Second order', renderer: 'line', marker: { shape: null } }
  ]
};

export const data = [
  { hz: 20, firstOrder: 0.9998, secondOrder: 1 },
  { hz: 25, firstOrder: 0.9997, secondOrder: 1 },
  { hz: 31.5, firstOrder: 0.9995, secondOrder: 1 },
  { hz: 40, firstOrder: 0.9992, secondOrder: 1 },
  { hz: 50, firstOrder: 0.9988, secondOrder: 1 },
  { hz: 63, firstOrder: 0.998, secondOrder: 1 },
  { hz: 80, firstOrder: 0.9968, secondOrder: 1 },
  { hz: 100, firstOrder: 0.995, secondOrder: 1 },
  { hz: 125, firstOrder: 0.9923, secondOrder: 0.9999 },
  { hz: 160, firstOrder: 0.9874, secondOrder: 0.9997 },
  { hz: 200, firstOrder: 0.9806, secondOrder: 0.9992 },
  { hz: 250, firstOrder: 0.9701, secondOrder: 0.9981 },
  { hz: 315, firstOrder: 0.9538, secondOrder: 0.9951 },
  { hz: 400, firstOrder: 0.9285, secondOrder: 0.9874 },
  { hz: 500, firstOrder: 0.8944, secondOrder: 0.9701 },
  { hz: 630, firstOrder: 0.8461, secondOrder: 0.9295 },
  { hz: 800, firstOrder: 0.7809, secondOrder: 0.8423 },
  { hz: 1000, firstOrder: 0.7071, secondOrder: 0.7071 },
  { hz: 1250, firstOrder: 0.6247, secondOrder: 0.5391 },
  { hz: 1600, firstOrder: 0.53, secondOrder: 0.3639 },
  { hz: 2000, firstOrder: 0.4472, secondOrder: 0.2425 },
  { hz: 2500, firstOrder: 0.3714, secondOrder: 0.158 },
  { hz: 3150, firstOrder: 0.3026, secondOrder: 0.1003 },
  { hz: 4000, firstOrder: 0.2425, secondOrder: 0.06238 },
  { hz: 5000, firstOrder: 0.1961, secondOrder: 0.03997 },
  { hz: 6300, firstOrder: 0.1568, secondOrder: 0.02519 },
  { hz: 8000, firstOrder: 0.124, secondOrder: 0.01562 },
  { hz: 10000, firstOrder: 0.0995, secondOrder: 0.01 },
  { hz: 12500, firstOrder: 0.07975, secondOrder: 0.0064 },
  { hz: 16000, firstOrder: 0.06238, secondOrder: 0.003906 },
  { hz: 20000, firstOrder: 0.04994, secondOrder: 0.0025 }
];
