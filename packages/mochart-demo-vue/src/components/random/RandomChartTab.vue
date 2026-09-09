<script setup lang="ts">
import { h, onBeforeUnmount, ref, watch } from 'vue';

import { Chart } from '@mochart/vue';
import type { MochartConfig } from '@mochart/core';
import { exportPNG, exportSVG } from '@mochart/export';

import { controlsMenuPlacement, demoText, getChartExportOptions, getDemoTabPanelAttrs, menuKeepOpenClassName } from '@mochart/demo-common';
import type { ShareState } from '@mochart/demo-common';

import ButtonWithTooltip from '../misc/ButtonWithTooltip.vue';
import ExportShareMenu from '../misc/ExportShareMenu.vue';
import Icon from '../misc/Icon.vue';
import OverflowMenu from '../misc/OverflowMenu.vue';
import { usePhoneViewport } from '../misc/usePhoneViewport';

import type { DemoDataProvider, RandomConfigWithValid } from '../../types';

interface Props {
  active?: boolean;
  mochartConfig: MochartConfig;
  dataProvider: DemoDataProvider | null;
  randomConfig: RandomConfigWithValid;
  initialRate?: number;
  onRandomizeBack: () => void;
  onRandomizeNext: () => void;
  applyReuse: boolean;
  toggleApplyReuse: () => void;
}

const defaultRate = 2000;

const props = withDefaults(defineProps<Props>(), {
  active: false,
  initialRate: undefined
});

let intervalId: ReturnType<typeof setInterval> | null = null;

const playing = ref(false);
const chartSizerElement = ref<HTMLDivElement | null>(null);
// A share link restores the interval; otherwise start on the default.
const rate = ref(props.initialRate ?? defaultRate);
const rateText = ref('' + (props.initialRate ?? defaultRate));

watch(() => props.active, () => {
  onStopClick();
});

function onPlayClick() {
  playing.value = true;
  intervalId = setInterval(props.onRandomizeNext, rate.value);
}

function onStopClick() {
  if (intervalId !== null) {
    clearInterval(intervalId);
  }
  intervalId = null;
  playing.value = false;
}

function rateChanged(event: Event) {
  let nextRateText: any = (event.currentTarget as HTMLInputElement).value;
  if (!isNaN(parseFloat(nextRateText)) && isFinite(nextRateText)) {
    nextRateText = +nextRateText;
    if (nextRateText >= 5 && nextRateText <= 60000) {
      rate.value = nextRateText;
    }
  }
  rateText.value = nextRateText;
}

onBeforeUnmount(() => {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
});

function onExportPng() {
  const container = chartSizerElement.value;
  if (container) {
    void exportPNG(container, getChartExportOptions());
  }
}

function onExportSvg() {
  const container = chartSizerElement.value;
  if (container) {
    exportSVG(container, getChartExportOptions());
  }
}

// Share captures the generator config, the reuse toggle and the interval; the
// step comes from the /random/:demoId/:randomId path already in the URL.
function getRandomShareState(): ShareState {
  return { mode: 'random', randomConfig: props.randomConfig, applyReuse: props.applyReuse, interval: rate.value };
}

// ---------------------------------------------------------------------------
// The phone fold keeps the dice pair (Back / Randomize) inline — stepping by
// hand is the mode's primary interaction — and demotes the automation
// transport (Play / Stop) with the Reuse toggle and the interval field. Each
// foldable control is a functional component rendered in exactly one of the
// two places (see OverflowMenu.vue).
// ---------------------------------------------------------------------------
const isPhone = usePhoneViewport();
const controlsElement = ref<HTMLElement | null>(null);
const getControlsAnchor = () => controlsElement.value;

const iconChild = (name: string) => () => h(Icon, { size: 'lg', fixedWidth: true, name });

const PlayButton = () => h(ButtonWithTooltip, {
  id: 'play', disabled: playing.value, menuLabel: demoText.randomChartTab.play.menuLabel,
  tooltipText: demoText.randomChartTab.play.tooltip, tooltipPlacement: 'top-start',
  onClick: onPlayClick, 'aria-label': demoText.randomChartTab.play.aria
}, iconChild('play'));

const StopButton = () => h(ButtonWithTooltip, {
  id: 'stop', disabled: !playing.value, menuLabel: demoText.randomChartTab.stop.menuLabel,
  tooltipText: demoText.randomChartTab.stop.tooltip, tooltipPlacement: 'top-start',
  onClick: onStopClick, 'aria-label': demoText.randomChartTab.stop.aria
}, iconChild('stop'));

const ReuseButton = () => h(ButtonWithTooltip, {
  id: 'reuse', disabled: playing.value, label: demoText.randomChartTab.reuse.label, pressed: props.applyReuse,
  tooltipText: demoText.randomChartTab.reuse.tooltip, tooltipPlacement: 'top-start',
  onClick: props.toggleApplyReuse, 'aria-label': demoText.randomChartTab.reuse.aria
}, iconChild('recycle'));

// `.demo-menu-keep-open` so a press inside the field — the number input's own
// spinners in particular — cannot dismiss the panel it is hosted in. The class
// paints nothing, so it is unconditional.
const RateField = () => h('div', { class: 'demo-field ' + menuKeepOpenClassName }, [
  h('label', { class: 'demo-label', for: 'random-rate' }, demoText.randomChartTab.intervalLabel),
  h('input', {
    id: 'random-rate', disabled: playing.value, type: 'number', min: '5', max: '60000', step: '100',
    class: 'demo-input', value: rateText.value, 'aria-label': demoText.randomChartTab.intervalAria,
    onInput: rateChanged
  })
]);

const panelAttrs = getDemoTabPanelAttrs('chart');
</script>

<template>
  <div v-bind="panelAttrs" :class="'mochart-demo-tab-container demo-layout-col chart' + (props.active ? ' active' : '')" :inert="!props.active">
    <div class="random-chart-sizer" ref="chartSizerElement">
      <Chart style="flex: 1 1 auto; min-width: 0; min-height: 0; overflow: hidden;"
             :mochart-config="props.mochartConfig" :data-provider="props.dataProvider" />
    </div>
    <div class="random-controls" ref="controlsElement">
      <form>
        <div class="demo-field">
          <div class="demo-toolbar">
            <div class="demo-btn-group">
              <ButtonWithTooltip id="randomize-back" :disabled="playing" :label="demoText.randomChartTab.back.label"
                                 :tooltip-text="demoText.randomChartTab.back.tooltip" tooltip-placement="top-start"
                                 :on-click="props.onRandomizeBack" :aria-label="demoText.randomChartTab.back.aria">
                <Icon size="lg" :fixed-width="true" name="dice" flip="horizontal" />
              </ButtonWithTooltip>
              <ButtonWithTooltip id="randomize-next" :disabled="playing" :label="demoText.randomChartTab.randomize.label"
                                 :tooltip-text="demoText.randomChartTab.randomize.tooltip" tooltip-placement="top-start"
                                 :on-click="props.onRandomizeNext" :aria-label="demoText.randomChartTab.randomize.aria">
                <Icon size="lg" :fixed-width="true" name="dice" />
              </ButtonWithTooltip>
              <template v-if="!isPhone">
                <PlayButton />
                <StopButton />
              </template>
            </div>
            <RateField v-if="!isPhone" />
          </div>
          <div class="demo-toolbar">
            <!-- Anchored to the whole strip: `align: 'end'` pins the panel's
                 right edge to the anchor's, and the export trigger sits to
                 the ⋯'s right. -->
            <div v-if="isPhone" class="demo-btn-group">
              <OverflowMenu :text="demoText.overflowMenu.random"
                            :placement="controlsMenuPlacement"
                            :get-anchor="getControlsAnchor"
                            :active="props.active">
                <div class="demo-btn-group"><PlayButton /><StopButton /></div>
                <div class="demo-menu-divider"></div>
                <div class="demo-btn-group"><ReuseButton /></div>
                <div class="demo-menu-divider"></div>
                <RateField />
              </OverflowMenu>
              <ExportShareMenu :active="props.active" :export-png="onExportPng" :export-svg="onExportSvg" :get-share-state="getRandomShareState" />
            </div>
            <template v-else>
              <div class="demo-btn-group"><ReuseButton /></div>
              <ExportShareMenu :active="props.active" :export-png="onExportPng" :export-svg="onExportSvg" :get-share-state="getRandomShareState" />
            </template>
          </div>
        </div>
      </form>
    </div>
  </div>
</template>
