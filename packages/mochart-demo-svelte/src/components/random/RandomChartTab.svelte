<script lang="ts">
  import { untrack, onDestroy } from 'svelte';

  import { Chart } from '@mochart/svelte';
  import type { MochartConfig } from '@mochart/core';
  import { exportPNG, exportSVG } from '@mochart/export';

  import { controlsMenuPlacement, demoText, getChartExportOptions, getDemoTabPanelAttrs, menuKeepOpenClassName } from '@mochart/demo-common';
  import type { ShareState } from '@mochart/demo-common';

  import ButtonWithTooltip from '../misc/ButtonWithTooltip.svelte';
  import ExportShareMenu from '../misc/ExportShareMenu.svelte';
  import Icon from '../misc/Icon.svelte';
  import OverflowMenu from '../misc/OverflowMenu.svelte';
  import { createPhoneViewport } from '../misc/phoneViewport.svelte';

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

  type InputEvent = Event & { currentTarget: EventTarget & HTMLInputElement };

  const defaultRate = 2000;

  let {
    active = false,
    mochartConfig,
    dataProvider,
    randomConfig,
    initialRate = undefined,
    onRandomizeBack,
    onRandomizeNext,
    applyReuse,
    toggleApplyReuse
  }: Props = $props();

  // The phone fold (see the comment above the markup).
  const phone = createPhoneViewport();
  let controlsElement = $state<HTMLElement | null>(null);

  let intervalId: ReturnType<typeof setInterval> | null = null;

  let chartSizerElement = $state<HTMLDivElement | null>(null);

  let playing = $state(false);
  // A share link restores the interval; otherwise start on the default.
  // svelte-ignore state_referenced_locally
  let rate = $state(initialRate ?? defaultRate);
  // svelte-ignore state_referenced_locally
  let rateText = $state('' + (initialRate ?? defaultRate));

  // Intentional initial-value capture; the $effect.pre below re-syncs it.
  // svelte-ignore state_referenced_locally
  let previousActive = active;
  $effect.pre(() => {
    const nextActive = active;
    untrack(() => {
      if (nextActive !== previousActive) {
        previousActive = nextActive;
        onStopClick();
      }
    });
  });

  function onPlayClick() {
    playing = true;
    intervalId = setInterval(onRandomizeNext, rate);
  }

  function onStopClick() {
    if (intervalId !== null) {
      clearInterval(intervalId);
    }
    intervalId = null;
    playing = false;
  }

  function rateChanged(event: InputEvent) {
    let nextRateText: any = event.currentTarget.value;
    if (!isNaN(parseFloat(nextRateText)) && isFinite(nextRateText)) {
      nextRateText = +nextRateText;
      if (nextRateText >= 5 && nextRateText <= 60000) {
        rate = nextRateText;
      }
    }
    rateText = nextRateText;
  }

  function onExportPng() {
    if (chartSizerElement) {
      void exportPNG(chartSizerElement, getChartExportOptions());
    }
  }

  function onExportSvg() {
    if (chartSizerElement) {
      exportSVG(chartSizerElement, getChartExportOptions());
    }
  }

  // Share captures the generator config, the reuse toggle and the interval; the
  // step comes from the /random/:demoId/:randomId path already in the URL.
  function getShareState(): ShareState {
    return { mode: 'random', randomConfig, applyReuse, interval: rate };
  }

  onDestroy(() => {
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  });
</script>

{#snippet playButton()}
  <ButtonWithTooltip id="play" disabled={playing} menuLabel={demoText.randomChartTab.play.menuLabel}
                     tooltipText={demoText.randomChartTab.play.tooltip} tooltipPlacement="top-start"
                     onClick={onPlayClick} aria-label={demoText.randomChartTab.play.aria}>
    <Icon size="lg" fixedWidth={true} name="play" />
  </ButtonWithTooltip>
{/snippet}

{#snippet stopButton()}
  <ButtonWithTooltip id="stop" disabled={!playing} menuLabel={demoText.randomChartTab.stop.menuLabel}
                     tooltipText={demoText.randomChartTab.stop.tooltip} tooltipPlacement="top-start"
                     onClick={onStopClick} aria-label={demoText.randomChartTab.stop.aria}>
    <Icon size="lg" fixedWidth={true} name="stop" />
  </ButtonWithTooltip>
{/snippet}

{#snippet reuseButton()}
  <ButtonWithTooltip id="reuse" disabled={playing} label={demoText.randomChartTab.reuse.label} pressed={applyReuse}
                     tooltipText={demoText.randomChartTab.reuse.tooltip} tooltipPlacement="top-start"
                     onClick={toggleApplyReuse} aria-label={demoText.randomChartTab.reuse.aria}>
    <Icon size="lg" fixedWidth={true} name="recycle" />
  </ButtonWithTooltip>
{/snippet}

<!-- `.demo-menu-keep-open` so a press inside the field — the number input's
     own spinners in particular — cannot dismiss the panel it is hosted in.
     The class paints nothing, so it is unconditional. -->
{#snippet rateField()}
  <div class="demo-field {menuKeepOpenClassName}">
    <label class="demo-label" for="random-rate">{demoText.randomChartTab.intervalLabel}</label>
    <input id="random-rate" disabled={playing} type="number" min="5" max="60000" step="100" class="demo-input" value={rateText}
           oninput={rateChanged} aria-label={demoText.randomChartTab.intervalAria} />
  </div>
{/snippet}

{#snippet exportMenu()}
  <ExportShareMenu active={active !== false} exportPng={onExportPng} exportSvg={onExportSvg} {getShareState} />
{/snippet}

<!-- The phone fold keeps the dice pair (Back / Randomize) inline — stepping by
     hand is the mode's primary interaction — and demotes the automation
     transport (Play / Stop) with the Reuse toggle and the interval field. Each
     control renders in exactly one of the two places (see OverflowMenu.svelte). -->
<div {...getDemoTabPanelAttrs('chart')} class={"mochart-demo-tab-container demo-layout-col chart" + (active ? " active" : "")} inert={!active}>
  <div class="random-chart-sizer" bind:this={chartSizerElement}>
    <Chart style="flex: 1 1 auto; min-width: 0; min-height: 0; overflow: hidden;"
           {mochartConfig} {dataProvider} />
  </div>
  <div class="random-controls" bind:this={controlsElement}>
    <form>
      <div class="demo-field">
        <div class="demo-toolbar">
          <div class="demo-btn-group">
            <ButtonWithTooltip id="randomize-back" disabled={playing} label={demoText.randomChartTab.back.label}
                               tooltipText={demoText.randomChartTab.back.tooltip} tooltipPlacement="top-start"
                               onClick={onRandomizeBack} aria-label={demoText.randomChartTab.back.aria}>
              <Icon size="lg" fixedWidth={true} name="dice" flip="horizontal" />
            </ButtonWithTooltip>
            <ButtonWithTooltip id="randomize-next" disabled={playing} label={demoText.randomChartTab.randomize.label}
                               tooltipText={demoText.randomChartTab.randomize.tooltip} tooltipPlacement="top-start"
                               onClick={onRandomizeNext} aria-label={demoText.randomChartTab.randomize.aria}>
              <Icon size="lg" fixedWidth={true} name="dice" />
            </ButtonWithTooltip>
            {#if !phone.isPhone}{@render playButton()}{@render stopButton()}{/if}
          </div>
          {#if !phone.isPhone}{@render rateField()}{/if}
        </div>
        <div class="demo-toolbar">
          {#if phone.isPhone}
            <div class="demo-btn-group">
              <!-- Anchored to the whole strip: `align: 'end'` pins the panel's
                   right edge to the anchor's, and the export trigger sits to
                   the ⋯'s right. -->
              <OverflowMenu text={demoText.overflowMenu.random}
                            placement={controlsMenuPlacement}
                            getAnchor={() => controlsElement}
                            active={active !== false}>
                <div class="demo-btn-group">{@render playButton()}{@render stopButton()}</div>
                <div class="demo-menu-divider"></div>
                <div class="demo-btn-group">{@render reuseButton()}</div>
                <div class="demo-menu-divider"></div>
                {@render rateField()}
              </OverflowMenu>
              {@render exportMenu()}
            </div>
          {:else}
            <div class="demo-btn-group">{@render reuseButton()}</div>
            {@render exportMenu()}
          {/if}
        </div>
      </div>
    </form>
  </div>
</div>
