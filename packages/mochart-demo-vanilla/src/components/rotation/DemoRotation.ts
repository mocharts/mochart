import { getRotationGrid, rotationConfigs as configs, rotationData as data } from '@mochart/demo-common';

import { el, observeSize } from '../misc/dom';
import { topBar } from '../misc/TopBar';
import { mountDefaultChart } from '../misc/chartHost';
import type { ChartHostHandle } from '../misc/chartHost';

export interface DemoRotationProps {
  siteRootUrl?: string;
  onBackToDemos: () => void;
}

export interface DemoRotationHandle {
  el: HTMLElement;
  destroy(): void;
}

export function demoRotation(props: DemoRotationProps): DemoRotationHandle {
  // Columns are sized from the card's measured width (not the window) so the
  // grid stays inside the padded shell.
  let chartsWidth = 0;
  let cells: { wrapper: HTMLDivElement; host: ChartHostHandle }[] = [];

  const bar = topBar({ siteRootUrl: props.siteRootUrl, onBackToDemos: props.onBackToDemos });

  const chartsContainer = el('div', { className: 'rotation-charts' });
  const container = el('div', { className: 'mochart-demo-container' }, [bar.el, chartsContainer]);

  function destroyCells(): void {
    for (const cell of cells) {
      cell.host.destroy();
    }
    cells = [];
    chartsContainer.replaceChildren();
  }

  function sync(): void {
    const { cols, colWidth } = getRotationGrid(chartsWidth);
    if (colWidth <= 0) {
      destroyCells();
      return;
    }
    if (cells.length === 0) {
      configs.forEach((config, i) => {
        const host = mountDefaultChart({ config, data, width: colWidth, height: colWidth });
        const wrapper = el('div', { className: 'rotation-chart rotation-chart-' + i }, [host.el]);
        cells.push({ wrapper, host });
        chartsContainer.append(wrapper);
      });
    }
    cells.forEach((cell, i) => {
      cell.wrapper.style.left = `${(i % cols) * colWidth}px`;
      cell.wrapper.style.top = `${Math.floor(i / cols) * colWidth}px`;
      cell.wrapper.style.width = `${colWidth}px`;
      cell.wrapper.style.height = `${colWidth}px`;
      cell.host.update({ config: configs[i], data, width: colWidth, height: colWidth });
    });
  }

  const stopObserving = observeSize(chartsContainer, (nextWidth) => {
    chartsWidth = nextWidth;
    sync();
  });

  return {
    el: container,
    destroy() {
      bar.destroy();
      stopObserving();
      destroyCells();
    }
  };
}
