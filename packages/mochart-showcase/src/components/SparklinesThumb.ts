// The Sparklines card: the page is text with word-sized charts and a metrics
// table, so its thumbnail is a compact cut of both rather than one chart.

import { inlineSparklineMetrics, tableSparklineMetrics } from '@mochart/demo-common';
import type { SparklineMetric } from '@mochart/demo-common';

import type { ThumbnailHandle } from '../content/types';
import { el } from '../ui/dom';
import { mountDefaultChart } from './chartHost';
import type { ChartHostHandle } from './chartHost';

const INLINE_SIZE = { width: 72, height: 16 };
const TABLE_SIZE = { width: 110, height: 22 };
const TABLE_ROWS = 3;

export function sparklinesThumb(): ThumbnailHandle {
  const charts: ChartHostHandle[] = [];

  function spark(metric: SparklineMetric, data: ReturnType<SparklineMetric['generate']>, size: { width: number; height: number }, className: string): HTMLElement {
    const chart = mountDefaultChart(
      { config: { ...metric.config, animation: { enabled: false } }, data, ...size },
      { className }
    );
    charts.push(chart);
    return chart.el;
  }

  function inline(metric: SparklineMetric): HTMLElement {
    return el('span', { className: 'sc-spark-inline-wrap' }, [spark(metric, metric.generate(0), INLINE_SIZE, 'sc-spark-inline')]);
  }

  const [revenue, errorRate] = inlineSparklineMetrics;
  const sentence = el('p', { className: 'sc-thumb-spark-text' }, [
    'A 30-day revenue trend ', inline(revenue),
    ' can sit right in a sentence, an error-rate pulse ', inline(errorRate),
    ' beside it.'
  ]);

  const rows = tableSparklineMetrics.slice(0, TABLE_ROWS).map(metric => {
    const data = metric.generate(0);
    return el('tr', {}, [
      el('th', { attrs: { scope: 'row' }, text: metric.label }),
      el('td', {}, [spark(metric, data, TABLE_SIZE, 'sc-spark-table-chart')]),
      el('td', { className: 'sc-thumb-spark-latest', text: metric.latestText(data) })
    ]);
  });

  return {
    el: el('div', { className: 'sc-thumb-spark' }, [sentence, el('table', {}, [el('tbody', {}, rows)])]),
    destroy() {
      for (const chart of charts) {
        chart.destroy();
      }
    }
  };
}
