import type { MochartInputConfig } from '@mochart/core';

export const config: MochartInputConfig = {
  version: '1.0.0',
  title: { text: 'Weekly Signups' },
  categoryAxis: { property: 'day', type: 'string', scale: 'ordinal' },
  seriesDefaults: { renderer: 'bar' },
  series: [
    { property: 'trial', title: 'Trial' },
    { property: 'paid', title: 'Paid' }
  ],
  legend: {
    filterOnClick: true,
    focusOnHover: true
  },
  accessibility: {
    plotLabel: 'Weekly signup values',
    legendLabel: 'Signup types'
  }
};

export const data = [
  { day: 'Mon', trial: 18, paid: 6 },
  { day: 'Tue', trial: 21, paid: 8 },
  { day: 'Wed', trial: 17, paid: 7 },
  { day: 'Thu', trial: 25, paid: 9 },
  { day: 'Fri', trial: 28, paid: 12 },
  { day: 'Sat', trial: 14, paid: 5 },
  { day: 'Sun', trial: 12, paid: 4 }
];
