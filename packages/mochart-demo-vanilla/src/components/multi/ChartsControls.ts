import { demoText } from '@mochart/demo-common';
import type { ShareState } from '@mochart/demo-common';

import { buttonWithTooltip, el, icon } from '../misc/dom';
import { exportShareMenu } from '../misc/ExportShareMenu';

export interface ChartsControlsProps {
  onRowsChange: (rows: number) => void;
  onColsChange: (cols: number) => void;
  onStepBackwardClick: () => void;
  onStepForwardClick: () => void;
  onPlayBackwardClick: () => void;
  onPlayForwardClick: () => void;
  onStopClick: () => void;
  onRateChange: (rate: number) => void;
  // Seed the inputs from the (possibly share-restored) initial values.
  initialRows?: number;
  initialCols?: number;
  initialRate?: number;
  exportPng: () => void;
  exportSvg: () => void;
  getShareState: () => ShareState;
}

export interface ChartsControlsHandle {
  el: HTMLElement;
  setPlaying(playing: boolean): void;
  destroy(): void;
}

const defaultChartRows = 2;
const defaultChartCols = 2;
const defaultRate = 2000;

export function chartsControls(props: ChartsControlsProps): ChartsControlsHandle {
  const rowsInput = el('input', {
    id: 'grid-rows', className: 'demo-input',
    attrs: { type: 'number', min: '1', max: '4', 'aria-label': demoText.multiChartsTab.gridRowsAria }
  });
  rowsInput.value = '' + (props.initialRows ?? defaultChartRows);
  rowsInput.addEventListener('input', () => {
    const rows = rowsInput.value;
    if (!isNaN(parseFloat(rows)) && isFinite(+rows)) {
      const value = +rows;
      if (value >= 1 && value <= 4) {
        props.onRowsChange(value);
      }
    }
  });

  const colsInput = el('input', {
    id: 'grid-cols', className: 'demo-input',
    attrs: { type: 'number', min: '1', max: '4', 'aria-label': demoText.multiChartsTab.gridColsAria }
  });
  colsInput.value = '' + (props.initialCols ?? defaultChartCols);
  colsInput.addEventListener('input', () => {
    const cols = colsInput.value;
    if (!isNaN(parseFloat(cols)) && isFinite(+cols)) {
      const value = +cols;
      if (value >= 1 && value <= 4) {
        props.onColsChange(value);
      }
    }
  });

  const rateInput = el('input', {
    id: 'multi-rate', className: 'demo-input',
    attrs: { type: 'number', min: '5', max: '60000', step: '100', 'aria-label': demoText.multiChartsTab.intervalAria }
  });
  rateInput.value = '' + (props.initialRate ?? defaultRate);
  rateInput.addEventListener('input', () => {
    const rate = rateInput.value;
    if (!isNaN(parseFloat(rate)) && isFinite(+rate)) {
      const value = +rate;
      if (value >= 5 && value <= 60000) {
        props.onRateChange(value);
      }
    }
  });

  const stepBackButton = buttonWithTooltip({
    id: 'step-back', ariaLabel: demoText.multiChartsTab.stepBackward.aria,
    tooltipText: demoText.multiChartsTab.stepBackward.tooltip,
    onClick: props.onStepBackwardClick,
    content: [icon('backward-step', { size: 'lg', fixedWidth: true })]
  });
  const stepForwardButton = buttonWithTooltip({
    id: 'step-forward', ariaLabel: demoText.multiChartsTab.stepForward.aria,
    tooltipText: demoText.multiChartsTab.stepForward.tooltip,
    onClick: props.onStepForwardClick,
    content: [icon('forward-step', { size: 'lg', fixedWidth: true })]
  });
  const playBackwardButton = buttonWithTooltip({
    id: 'play-backward', ariaLabel: demoText.multiChartsTab.playBackward.aria,
    tooltipText: demoText.multiChartsTab.playBackward.tooltip,
    onClick: props.onPlayBackwardClick,
    content: [icon('play', { size: 'lg', fixedWidth: true, flip: 'horizontal' })]
  });
  const playForwardButton = buttonWithTooltip({
    id: 'play-forward', ariaLabel: demoText.multiChartsTab.playForward.aria,
    tooltipText: demoText.multiChartsTab.playForward.tooltip,
    onClick: props.onPlayForwardClick,
    content: [icon('play', { size: 'lg', fixedWidth: true })]
  });
  const stopButton = buttonWithTooltip({
    id: 'stop', disabled: true, ariaLabel: demoText.multiChartsTab.stop.aria,
    tooltipText: demoText.multiChartsTab.stop.tooltip,
    onClick: props.onStopClick,
    content: [icon('stop', { size: 'lg', fixedWidth: true })]
  });

  const menu = exportShareMenu({
    exportPng: props.exportPng,
    exportSvg: props.exportSvg,
    getShareState: props.getShareState
  });

  const container = el('div', { className: 'multi-controls' }, [
    el('form', {}, [
      el('div', { className: 'demo-field' }, [
        el('label', { className: 'demo-label', attrs: { for: 'grid-rows' }, text: demoText.multiChartsTab.gridLabel }),
        rowsInput,
        el('span', { className: 'demo-label', text: '×' }),
        colsInput
      ]),
      el('div', { className: 'demo-field' }, [
        el('div', { className: 'demo-toolbar' }, [
          el('div', { className: 'demo-btn-group' }, [
            stepBackButton.el, stepForwardButton.el, playBackwardButton.el, playForwardButton.el, stopButton.el
          ])
        ])
      ]),
      el('div', { className: 'demo-field' }, [
        el('label', { className: 'demo-label', attrs: { for: 'multi-rate' }, text: demoText.multiChartsTab.intervalLabel }),
        rateInput
      ]),
      el('div', { className: 'demo-field' }, [
        el('div', { className: 'demo-toolbar' }, [menu.el])
      ])
    ])
  ]);

  return {
    el: container,
    setPlaying(playing: boolean) {
      rowsInput.disabled = playing;
      colsInput.disabled = playing;
      rateInput.disabled = playing;
      stepBackButton.setDisabled(playing);
      stepForwardButton.setDisabled(playing);
      playBackwardButton.setDisabled(playing);
      playForwardButton.setDisabled(playing);
      stopButton.setDisabled(!playing);
    },
    destroy() {
      menu.destroy();
    }
  };
}
