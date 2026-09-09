<script lang="ts">
  import { demoText } from '@mochart/demo-common';
  import type { ShareState } from '@mochart/demo-common';

  import ButtonWithTooltip from '../misc/ButtonWithTooltip.svelte';
  import ExportShareMenu from '../misc/ExportShareMenu.svelte';
  import Icon from '../misc/Icon.svelte';

  interface Props {
    playing: boolean;
    initialRows: number;
    initialCols: number;
    initialRate: number;
    onRowsChange: (rows: number) => void;
    onColsChange: (cols: number) => void;
    onStepBackwardClick: () => void;
    onStepForwardClick: () => void;
    onPlayBackwardClick: () => void;
    onPlayForwardClick: () => void;
    onStopClick: () => void;
    onRateChange: (rate: number) => void;
    exportPng: () => void;
    exportSvg: () => void;
    getShareState: () => ShareState;
  }

  type InputEvent = Event & { currentTarget: EventTarget & HTMLInputElement };

  let {
    playing,
    initialRows,
    initialCols,
    initialRate,
    onRowsChange,
    onColsChange,
    onStepBackwardClick,
    onStepForwardClick,
    onPlayBackwardClick,
    onPlayForwardClick,
    onStopClick,
    onRateChange,
    exportPng,
    exportSvg,
    getShareState
  }: Props = $props();

  // Seed the inputs from the (possibly share-restored) initial values.
  // svelte-ignore state_referenced_locally
  let rateText = $state('' + initialRate);
  // svelte-ignore state_referenced_locally
  let rowsText = $state('' + initialRows);
  // svelte-ignore state_referenced_locally
  let colsText = $state('' + initialCols);

  // Input values arrive as strings and are coerced to numbers in place, so the
  // working variable is intentionally loose (matching the original demo).
  function rowsChanged(event: InputEvent) {
    let rows: any = event.currentTarget.value;
    if (!isNaN(parseFloat(rows)) && isFinite(rows)) {
      rows = +rows;
      if (rows >= 1 && rows <= 4) {
        onRowsChange(rows);
      }
    }
    rowsText = rows;
  }

  function colsChanged(event: InputEvent) {
    let cols: any = event.currentTarget.value;
    if (!isNaN(parseFloat(cols)) && isFinite(cols)) {
      cols = +cols;
      if (cols >= 1 && cols <= 4) {
        onColsChange(cols);
      }
    }
    colsText = cols;
  }

  function rateChanged(event: InputEvent) {
    let rate: any = event.currentTarget.value;
    if (!isNaN(parseFloat(rate)) && isFinite(rate)) {
      rate = +rate;
      if (rate >= 5 && rate <= 60000) {
        onRateChange(rate);
      }
    }
    rateText = rate;
  }
</script>

<div class="multi-controls">
  <form>
    <div class="demo-field">
      <label class="demo-label" for="grid-rows">{demoText.multiChartsTab.gridLabel}</label>
      <input id="grid-rows" disabled={playing} type="number" min="1" max="4" class="demo-input" value={rowsText}
             oninput={rowsChanged} aria-label={demoText.multiChartsTab.gridRowsAria} />
      <span class="demo-label">&times;</span>
      <input id="grid-cols" disabled={playing} type="number" min="1" max="4" class="demo-input" value={colsText}
             oninput={colsChanged} aria-label={demoText.multiChartsTab.gridColsAria} />
    </div>
    <div class="demo-field">
      <div class="demo-toolbar">
        <div class="demo-btn-group">
          <ButtonWithTooltip id="step-back" disabled={playing} tooltipText={demoText.multiChartsTab.stepBackward.tooltip} tooltipPlacement="top-start"
                             onClick={onStepBackwardClick} aria-label={demoText.multiChartsTab.stepBackward.aria}>
            <Icon size="lg" fixedWidth={true} name="backward-step" />
          </ButtonWithTooltip>
          <ButtonWithTooltip id="step-forward" disabled={playing} tooltipText={demoText.multiChartsTab.stepForward.tooltip} tooltipPlacement="top-start"
                             onClick={onStepForwardClick} aria-label={demoText.multiChartsTab.stepForward.aria}>
            <Icon size="lg" fixedWidth={true} name="forward-step" />
          </ButtonWithTooltip>
          <ButtonWithTooltip id="play-backward" disabled={playing} tooltipText={demoText.multiChartsTab.playBackward.tooltip} tooltipPlacement="top-start"
                             onClick={onPlayBackwardClick} aria-label={demoText.multiChartsTab.playBackward.aria}>
            <Icon size="lg" fixedWidth={true} name="play" flip="horizontal" />
          </ButtonWithTooltip>
          <ButtonWithTooltip id="play-forward" disabled={playing} tooltipText={demoText.multiChartsTab.playForward.tooltip} tooltipPlacement="top-start"
                             onClick={onPlayForwardClick} aria-label={demoText.multiChartsTab.playForward.aria}>
            <Icon size="lg" fixedWidth={true} name="play" />
          </ButtonWithTooltip>
          <ButtonWithTooltip id="stop" disabled={!playing} tooltipText={demoText.multiChartsTab.stop.tooltip} tooltipPlacement="top-start"
                             onClick={onStopClick} aria-label={demoText.multiChartsTab.stop.aria}>
            <Icon size="lg" fixedWidth={true} name="stop" />
          </ButtonWithTooltip>
        </div>
      </div>
    </div>
    <div class="demo-field">
      <label class="demo-label" for="multi-rate">{demoText.multiChartsTab.intervalLabel}</label>
      <input id="multi-rate" disabled={playing} type="number" min="5" max="60000" step="100" class="demo-input" value={rateText}
             oninput={rateChanged} aria-label={demoText.multiChartsTab.intervalAria} />
    </div>
    <div class="demo-field">
      <div class="demo-toolbar">
        <ExportShareMenu {exportPng} {exportSvg} {getShareState} />
      </div>
    </div>
  </form>
</div>
