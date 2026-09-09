// A gallery card's live mini-chart: the demo's real config and data, mounted
// with animation off — and only once the card actually scrolls into view, so
// a phone never pays for charts it hasn't seen. Interaction is disabled via
// CSS (pointer-events: none) so the card stays one big link.

import type { ShowcaseEntry } from '../content/types';
import { el } from '../ui/dom';
import { mountDefaultChart } from './chartHost';
import type { ChartHostHandle } from './chartHost';

export interface ThumbHandle {
  el: HTMLElement;
  destroy(): void;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

// One shared observer for every card; charts mount on first intersection.
const pending = new Map<Element, () => void>();
const observer = new IntersectionObserver(entries => {
  for (const entry of entries) {
    if (entry.isIntersecting) {
      const mount = pending.get(entry.target);
      if (mount !== undefined) {
        pending.delete(entry.target);
        observer.unobserve(entry.target);
        mount();
      }
    }
  }
}, { rootMargin: '200px 0px' });

export function thumb(entry: ShowcaseEntry): ThumbHandle {
  const container = el('div', { className: 'sc-thumb', attrs: { 'aria-hidden': 'true' } });
  let chart: ChartHostHandle | null = null;

  // Thumbnails drop the title and legend: the card already names the demo,
  // neither is readable at card size, and a wrapping legend can push the plot
  // height negative in a 170px box.
  const config = structuredClone(entry.config);
  const animation = isPlainObject(config.animation) ? config.animation : {};
  config.animation = { ...animation, enabled: false };
  const legend = isPlainObject(config.legend) ? config.legend : {};
  config.legend = { ...legend, visible: false };
  const title = isPlainObject(config.title) ? config.title : {};
  config.title = { ...title, text: null };

  pending.set(container, () => {
    chart = mountDefaultChart(
      { config, data: structuredClone(entry.data) },
      { className: 'sc-thumb-chart' }
    );
    container.append(chart.el);
  });
  observer.observe(container);

  return {
    el: container,
    destroy() {
      pending.delete(container);
      observer.unobserve(container);
      chart?.destroy();
      chart = null;
    }
  };
}
