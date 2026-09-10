// The Interaction Callbacks card: the page is a chart over a live event log,
// so its thumbnail is a shorter chart over three fixed lines of that log.

import type { DataObject, DemoConfig } from '@mochart/demo-data';

import type { ThumbnailHandle } from '../content/types';
import { el } from '../ui/dom';
import { mountDefaultChart } from './chartHost';

const LOG_LINES: [string, string][] = [
  ['onSeriesClick', 'online category=4'],
  ['onFocus', 'series=online category=4'],
  ['onSeriesFilter', 'hidden: pickup']
];

export function callbacksThumb(config: DemoConfig, data: DataObject[]): ThumbnailHandle {
  const chart = mountDefaultChart({ config, data }, { className: 'sc-thumb-callbacks-chart' });
  const log = el('div', { className: 'sc-log sc-thumb-callbacks-log' }, [
    el('ul', { className: 'sc-log-entries' }, LOG_LINES.map(([kind, detail]) =>
      el('li', {}, [el('span', { className: 'sc-log-kind', text: kind }), el('span', { text: ' ' + detail })])
    ))
  ]);
  return {
    el: el('div', { className: 'sc-thumb-callbacks' }, [chart.el, log]),
    destroy() {
      chart.destroy();
    }
  };
}
