<script setup lang="ts">
import { ref } from 'vue';

import { demoText } from '@mochart/demo-common';
import type { ShareState } from '@mochart/demo-common';

import ButtonWithTooltip from '../misc/ButtonWithTooltip.vue';
import ExportShareMenu from '../misc/ExportShareMenu.vue';
import Icon from '../misc/Icon.vue';

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

const props = defineProps<Props>();

// Seed the inputs from the (possibly share-restored) initial values.
const rateText = ref('' + props.initialRate);
const rowsText = ref('' + props.initialRows);
const colsText = ref('' + props.initialCols);

// Input values arrive as strings and are coerced to numbers in place, so the
// working variable is intentionally loose (matching the original demo).
function rowsChanged(event: Event) {
  let rows: any = (event.currentTarget as HTMLInputElement).value;
  if (!isNaN(parseFloat(rows)) && isFinite(rows)) {
    rows = +rows;
    if (rows >= 1 && rows <= 4) {
      props.onRowsChange(rows);
    }
  }
  rowsText.value = rows;
}

function colsChanged(event: Event) {
  let cols: any = (event.currentTarget as HTMLInputElement).value;
  if (!isNaN(parseFloat(cols)) && isFinite(cols)) {
    cols = +cols;
    if (cols >= 1 && cols <= 4) {
      props.onColsChange(cols);
    }
  }
  colsText.value = cols;
}

function rateChanged(event: Event) {
  let rate: any = (event.currentTarget as HTMLInputElement).value;
  if (!isNaN(parseFloat(rate)) && isFinite(rate)) {
    rate = +rate;
    if (rate >= 5 && rate <= 60000) {
      props.onRateChange(rate);
    }
  }
  rateText.value = rate;
}
</script>

<template>
  <div class="multi-controls">
    <form>
      <div class="demo-field">
        <label class="demo-label" for="grid-rows">{{ demoText.multiChartsTab.gridLabel }}</label>
        <input id="grid-rows" :disabled="props.playing" type="number" min="1" max="4" class="demo-input" :value="rowsText"
               :aria-label="demoText.multiChartsTab.gridRowsAria" @input="rowsChanged" />
        <span class="demo-label">&times;</span>
        <input id="grid-cols" :disabled="props.playing" type="number" min="1" max="4" class="demo-input" :value="colsText"
               :aria-label="demoText.multiChartsTab.gridColsAria" @input="colsChanged" />
      </div>
      <div class="demo-field">
        <div class="demo-toolbar">
          <div class="demo-btn-group">
            <ButtonWithTooltip id="step-back" :disabled="props.playing" :tooltip-text="demoText.multiChartsTab.stepBackward.tooltip" tooltip-placement="top-start"
                               :on-click="props.onStepBackwardClick" :aria-label="demoText.multiChartsTab.stepBackward.aria">
              <Icon size="lg" :fixed-width="true" name="backward-step" />
            </ButtonWithTooltip>
            <ButtonWithTooltip id="step-forward" :disabled="props.playing" :tooltip-text="demoText.multiChartsTab.stepForward.tooltip" tooltip-placement="top-start"
                               :on-click="props.onStepForwardClick" :aria-label="demoText.multiChartsTab.stepForward.aria">
              <Icon size="lg" :fixed-width="true" name="forward-step" />
            </ButtonWithTooltip>
            <ButtonWithTooltip id="play-backward" :disabled="props.playing" :tooltip-text="demoText.multiChartsTab.playBackward.tooltip" tooltip-placement="top-start"
                               :on-click="props.onPlayBackwardClick" :aria-label="demoText.multiChartsTab.playBackward.aria">
              <Icon size="lg" :fixed-width="true" name="play" flip="horizontal" />
            </ButtonWithTooltip>
            <ButtonWithTooltip id="play-forward" :disabled="props.playing" :tooltip-text="demoText.multiChartsTab.playForward.tooltip" tooltip-placement="top-start"
                               :on-click="props.onPlayForwardClick" :aria-label="demoText.multiChartsTab.playForward.aria">
              <Icon size="lg" :fixed-width="true" name="play" />
            </ButtonWithTooltip>
            <ButtonWithTooltip id="stop" :disabled="!props.playing" :tooltip-text="demoText.multiChartsTab.stop.tooltip" tooltip-placement="top-start"
                               :on-click="props.onStopClick" :aria-label="demoText.multiChartsTab.stop.aria">
              <Icon size="lg" :fixed-width="true" name="stop" />
            </ButtonWithTooltip>
          </div>
        </div>
      </div>
      <div class="demo-field">
        <label class="demo-label" for="multi-rate">{{ demoText.multiChartsTab.intervalLabel }}</label>
        <input id="multi-rate" :disabled="props.playing" type="number" min="5" max="60000" step="100" class="demo-input" :value="rateText"
               :aria-label="demoText.multiChartsTab.intervalAria" @input="rateChanged" />
      </div>
      <div class="demo-field">
        <div class="demo-toolbar">
          <ExportShareMenu :export-png="props.exportPng" :export-svg="props.exportSvg" :get-share-state="props.getShareState" />
        </div>
      </div>
    </form>
  </div>
</template>
