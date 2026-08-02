// The sparkline showcase: word-sized charts woven into a paragraph, then a
// small-multiples metrics table. Reuses demo-common's sparkline metric models
// (config presets + seeded per-step generators) and page copy.

import { demoText, inlineSparklineMetrics, tableSparklineMetrics } from '@mochart/demo-common';
import type { SparklineMetric } from '@mochart/demo-common';

import type { ThemeController } from '../app/theme';

import { button, el } from '../ui/dom';
import { mountDefaultChart } from './chartHost';
import type { ChartHostHandle } from './chartHost';
import type { ShowcaseEntry } from '../content/types';

export interface SparklinesPageProps {
  entry: ShowcaseEntry;
  theme: ThemeController;
  onBack: () => void;
}

export interface SparklinesPageHandle {
  el: HTMLElement;
  destroy(): void;
}

export function sparklinesPage(props: SparklinesPageProps): SparklinesPageHandle {
  const { entry, theme } = props;
  let step = 0;

  interface MountedMetric {
    metric: SparklineMetric;
    chart: ChartHostHandle;
    latestCell: HTMLElement | null;
  }
  const mounted: MountedMetric[] = [];

  function mountMetric(metric: SparklineMetric, className: string, latestCell: HTMLElement | null): HTMLElement {
    const data = metric.generate(step);
    const chart = mountDefaultChart(
      { config: metric.config, data, width: metric.width, height: metric.height },
      { className }
    );
    if (latestCell !== null) {
      latestCell.textContent = metric.latestText(data);
    }
    mounted.push({ metric, chart, latestCell });
    return chart.el;
  }

  function randomize(): void {
    step += 1;
    for (const { metric, chart, latestCell } of mounted) {
      const data = metric.generate(step);
      chart.update({ config: metric.config, data, width: metric.width, height: metric.height });
      if (latestCell !== null) {
        latestCell.textContent = metric.latestText(data);
      }
    }
  }

  // Intro paragraph with the inline metrics woven between the text segments.
  const intro = el('p', { className: 'sc-spark-intro' });
  const segments = demoText.sparklinePage.intro;
  segments.forEach((segment, index) => {
    intro.append(segment);
    const metric = inlineSparklineMetrics[index];
    if (metric !== undefined) {
      intro.append(el('span', { className: 'sc-spark-inline-wrap' }, [mountMetric(metric, 'sc-spark-inline', null)]));
    }
  });

  // Small-multiples table.
  const tableBody = el('tbody');
  for (const metric of tableSparklineMetrics) {
    const latestCell = el('td', { className: 'sc-spark-latest' });
    tableBody.append(el('tr', {}, [
      el('th', { attrs: { scope: 'row' }, text: metric.label }),
      el('td', { className: 'sc-spark-cell' }, [mountMetric(metric, 'sc-spark-table-chart', latestCell)]),
      latestCell
    ]));
  }
  const table = el('table', { className: 'sc-spark-table' }, [
    el('thead', {}, [
      el('tr', {}, [
        el('th', { attrs: { scope: 'col' }, text: demoText.sparklinePage.table.metric }),
        el('th', { attrs: { scope: 'col' }, text: demoText.sparklinePage.table.trend }),
        el('th', { attrs: { scope: 'col' }, text: demoText.sparklinePage.table.latest })
      ])
    ]),
    tableBody
  ]);

  const backButton = button({ icon: 'arrow-left', ariaLabel: 'Back to gallery', title: 'Back to gallery', variant: 'sc-btn-quiet', onClick: props.onBack });
  const themeButton = button({
    icon: theme.isDark() ? 'sun' : 'moon',
    ariaLabel: 'Toggle color theme', title: 'Toggle color theme', variant: 'sc-btn-quiet',
    onClick: () => theme.toggle()
  });
  const unsubscribeTheme = theme.onChange(dark => themeButton.setIcon(dark ? 'sun' : 'moon'));
  const randomizeButton = button({
    icon: 'dice',
    label: demoText.sparklinePage.randomize.label,
    title: demoText.sparklinePage.randomize.tooltip,
    ariaLabel: demoText.sparklinePage.randomize.aria,
    onClick: randomize
  });

  const container = el('div', { className: 'sc-demo-page sc-spark-page' }, [
    el('header', { className: 'sc-appbar' }, [
      backButton.el,
      el('h1', { className: 'sc-appbar-title', text: entry.title }),
      el('div', { className: 'sc-appbar-actions' }, [themeButton.el])
    ]),
    el('main', { className: 'sc-spark-body' }, [
      intro,
      el('div', { className: 'sc-controls' }, [randomizeButton.el]),
      el('div', { className: 'sc-spark-table-wrap' }, [table]),
      entry.notes !== undefined ? el('p', { className: 'sc-about-notes', text: entry.notes }) : null
    ])
  ]);

  return {
    el: container,
    destroy() {
      unsubscribeTheme();
      for (const { chart } of mounted) {
        chart.destroy();
      }
    }
  };
}
