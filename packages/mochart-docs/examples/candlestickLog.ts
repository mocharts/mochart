// A price that multiplies reads best on a log axis, where a candle's height is
// its percentage move. The helper's volume axis starts at 0, which a log axis
// has no place for, so scale: 'log' goes on the price axis alone, by its id.
import { createCandlestick } from '@mochart/core';
import type { MochartInputConfig } from '@mochart/core';

const candlestick = createCandlestick([
  { label: '2023-07-01', open: 9.91, high: 11.32, low: 9.74, close: 10.86, volume: 2502743 },
  { label: '2023-08-01', open: 10.97, high: 13.3, low: 10.76, close: 13.26, volume: 2173218 },
  { label: '2023-09-01', open: 13.04, high: 16.56, low: 12.71, close: 15.88, volume: 3014207 },
  { label: '2023-10-01', open: 15.77, high: 17.33, low: 15.66, close: 16.85, volume: 893563 },
  { label: '2023-11-01', open: 17.05, high: 17.41, low: 16.64, close: 16.79, volume: 488922 },
  { label: '2023-12-01', open: 16.67, high: 18.02, low: 16.3, close: 18.01, volume: 1293914 },
  { label: '2024-01-01', open: 18.15, high: 18.47, low: 17.37, close: 17.88, volume: 913006 },
  { label: '2024-02-01', open: 18.14, high: 21.41, low: 17.33, close: 20.83, volume: 2840181 },
  { label: '2024-03-01', open: 21.03, high: 21.78, low: 20.72, close: 21.28, volume: 457832 },
  { label: '2024-04-01', open: 21.02, high: 23.61, low: 20.3, close: 22.77, volume: 2436680 },
  { label: '2024-05-01', open: 22.37, high: 26.21, low: 21.89, close: 26.03, volume: 3898785 },
  { label: '2024-06-01', open: 26.3, high: 28.67, low: 25.75, close: 27.75, volume: 704007 },
  { label: '2024-07-01', open: 27.95, high: 35.03, low: 27.08, close: 33.63, volume: 2156540 },
  { label: '2024-08-01', open: 33.14, high: 38.89, low: 32.74, close: 38.35, volume: 1853128 },
  { label: '2024-09-01', open: 38.62, high: 43.94, low: 37.19, close: 43.61, volume: 1710602 },
  { label: '2024-10-01', open: 43.4, high: 47.92, low: 43.15, close: 46.94, volume: 1960551 },
  { label: '2024-11-01', open: 47.54, high: 48.94, low: 45.9, close: 48.27, volume: 1023672 },
  { label: '2024-12-01', open: 48.37, high: 50.37, low: 47.08, close: 48.39, volume: 612871 },
  { label: '2025-01-01', open: 47.64, high: 54.39, low: 45.96, close: 53.77, volume: 2363299 },
  { label: '2025-02-01', open: 53.73, high: 63.45, low: 52.24, close: 63.16, volume: 4180924 },
  { label: '2025-03-01', open: 62.2, high: 69.38, low: 60.92, close: 67.28, volume: 2070509 },
  { label: '2025-04-01', open: 66.07, high: 70.9, low: 65.81, close: 69.62, volume: 943656 },
  { label: '2025-05-01', open: 69.65, high: 87.59, low: 67.37, close: 84.88, volume: 2706720 },
  { label: '2025-06-01', open: 84.28, high: 103.83, low: 84.14, close: 101.07, volume: 2800259 }
], { volume: true, axisType: 'date' });

export const config: MochartInputConfig = {
  version: '1.0.0',
  title: { text: 'Monthly Share Price (fictional, $)' },
  categoryAxis: { ...candlestick.categoryAxis, tickLabel: { format: '%Y' }, valueFormat: '%b %Y', tickStep: { period: 'year' } },
  valueAxes: candlestick.valueAxes!.map((axisConfig) =>
    axisConfig.id === 'price' ? { ...axisConfig, scale: 'log', title: { text: '$ per share' } } : axisConfig),
  series: candlestick.series
};

export const data = candlestick.data;
