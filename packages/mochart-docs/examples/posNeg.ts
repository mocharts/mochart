// Without stacks the axis base defaults to the domain minimum, so mixed-sign
// bars would all grow up from the most negative value — base: 0 makes them
// grow out of zero instead. The outside labels flip on their own: above
// positive bars, below negative ones.
import type { MochartInputConfig } from '@mochart/core';

export const config: MochartInputConfig = {
  version: '1.0.0',
  title: { text: 'Monthly Net Cash Flow' },
  categoryAxis: { property: 'month', type: 'string', scale: 'ordinal' },
  // The extra min margin leaves room for the lowest bar's outside label.
  valueAxes: [{ id: 'VA0', title: { text: 'Net cash flow ($k)' }, base: 0, minMarginFraction: 0.15 }],
  series: [
    {
      property: 'net',
      title: 'Net cash flow',
      renderer: 'bar',
      labelProperty: 'net',
      label: {
        position: 'outside',
        format: ',.0f'
      }
    }
  ]
};

export const data = [
  { month: 'Jan', net: 42 },
  { month: 'Feb', net: 28 },
  { month: 'Mar', net: -15 },
  { month: 'Apr', net: 33 },
  { month: 'May', net: -8 },
  { month: 'Jun', net: 51 },
  { month: 'Jul', net: 12 },
  { month: 'Aug', net: -24 }
];
