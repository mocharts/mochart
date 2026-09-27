// scale: 'log' gives each power of 10 the same height, so equal growth rates are
// equal slopes and the early years of a fast-growing series stay readable next
// to its millions.
import type { MochartInputConfig } from '@mochart/core';

export const config: MochartInputConfig = {
  version: '1.0.0',
  title: { text: 'Monthly Active Users (fictional)' },
  categoryAxis: { property: 'year', type: 'number', scale: 'linear', tickLabel: { format: 'd' }, valueFormat: 'd' },
  valueAxes: [{ scale: 'log', title: { text: 'Users' } }],
  series: [
    { property: 'orbit', title: 'Orbit', renderer: 'line' },
    { property: 'lantern', title: 'Lantern', renderer: 'line' },
    { property: 'harbor', title: 'Harbor', renderer: 'line' }
  ]
};

export const data = [
  { year: 2014, orbit: 120, lantern: 5000, harbor: 40000 },
  { year: 2015, orbit: 380, lantern: 6500, harbor: 52000 },
  { year: 2016, orbit: 1200, lantern: 8400, harbor: 61000 },
  { year: 2017, orbit: 3900, lantern: 11000, harbor: 68000 },
  { year: 2018, orbit: 12000, lantern: 14300, harbor: 70000 },
  { year: 2019, orbit: 40000, lantern: 18600, harbor: 66000 },
  { year: 2020, orbit: 125000, lantern: 24100, harbor: 58000 },
  { year: 2021, orbit: 400000, lantern: 31400, harbor: 47000 },
  { year: 2022, orbit: 1200000, lantern: 40800, harbor: 36000 },
  { year: 2023, orbit: 2600000, lantern: 53000, harbor: 27000 },
  { year: 2024, orbit: 4100000, lantern: 68900, harbor: 19000 },
  { year: 2025, orbit: 5300000, lantern: 89600, harbor: 13000 },
  { year: 2026, orbit: 6000000, lantern: 116500, harbor: 9000 }
];
