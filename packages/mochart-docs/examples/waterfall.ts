// createWaterfall accumulates signed steps into floating bars — one series
// per direction (increase / decrease / total), each row filling exactly one.
import { createWaterfall } from '@mochart/core';
import type { MochartInputConfig } from '@mochart/core';

const waterfall = createWaterfall([
  { label: 'Product revenue', value: 420 },
  { label: 'Services revenue', value: 210 },
  { label: 'Gross revenue', total: true },
  { label: 'Cost of goods', value: -180 },
  { label: 'Operating expenses', value: -95 },
  { label: 'Marketing', value: -60 },
  { label: 'Tax', value: -22 },
  { label: 'Net income', total: true }
]);

export const config: MochartInputConfig = {
  version: '1.0.0',
  title: { text: 'Income Statement (fictional, $k)' },
  categoryAxis: waterfall.categoryAxis,
  // the returned fragment carries the axis base; merge your own settings over it
  valueAxes: [{ ...waterfall.valueAxes[0], title: { text: '$ thousands' } }],
  series: waterfall.series
};

export const data = waterfall.data;
