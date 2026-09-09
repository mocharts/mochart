// createCandlestick turns OHLC items into direction-colored open/close body
// bars drawn over thin low/high wick bars — four ordinary bar series.
import { createCandlestick } from '@mochart/core';
import type { MochartInputConfig } from '@mochart/core';

const candlestick = createCandlestick([
  { label: 'Jun 01', open: 96.5, high: 97.4, low: 96.1, close: 97.1 },
  { label: 'Jun 02', open: 97.2, high: 99.2, low: 97.2, close: 98.6 },
  { label: 'Jun 03', open: 98.1, high: 102.3, low: 98.0, close: 101.2 },
  { label: 'Jun 04', open: 101.4, high: 101.8, low: 98.4, close: 99.1 },
  { label: 'Jun 05', open: 99.0, high: 99.6, low: 96.8, close: 97.3 },
  { label: 'Jun 08', open: 97.5, high: 98.8, low: 96.9, close: 98.4 },
  { label: 'Jun 09', open: 98.3, high: 98.5, low: 95.7, close: 96.2 },
  { label: 'Jun 10', open: 96.2, high: 97.9, low: 95.9, close: 97.6 },
  { label: 'Jun 11', open: 97.7, high: 100.4, low: 97.5, close: 100.1 },
  { label: 'Jun 12', open: 100.0, high: 100.9, low: 98.6, close: 99.0 }
]);

export const config: MochartInputConfig = {
  version: '1.0.0',
  title: { text: 'Daily Share Price (fictional, $)' },
  categoryAxis: candlestick.categoryAxis,
  valueAxes: [{ title: { text: '$ per share' } }],
  series: candlestick.series
};

export const data = candlestick.data;
