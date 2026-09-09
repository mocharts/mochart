import type { MochartConfig } from '@mochart/core';
import { exportPNG, exportSVG } from '@mochart/export';

import { controlsMenuPlacement, getChartExportOptions, demoText, isPhoneViewport, menuKeepOpenClassName, watchPhoneViewport } from '@mochart/demo-common';
import type { ShareState } from '@mochart/demo-common';

import { buttonWithTooltip, el, icon, setActiveClass, setChildren, tabContainer } from '../misc/dom';
import { mountChart } from '../misc/chartHost';
import { exportShareMenu } from '../misc/ExportShareMenu';
import { menuDivider, overflowMenu } from '../misc/OverflowMenu';

import type { DemoDataProvider, RandomConfigWithValid } from '../../types';

export interface RandomChartTabProps {
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

export interface RandomChartTabHandle {
  el: HTMLElement;
  setActive(active: boolean): void;
  update(next: { mochartConfig: MochartConfig; dataProvider: DemoDataProvider | null; applyReuse: boolean; randomConfig: RandomConfigWithValid }): void;
  destroy(): void;
}

const defaultRate = 2000;

export function randomChartTab(props: RandomChartTabProps): RandomChartTabHandle {
  const { onRandomizeBack, onRandomizeNext, toggleApplyReuse } = props;

  let active = props.active ?? false;
  let mochartConfig = props.mochartConfig;
  let dataProvider = props.dataProvider;
  let applyReuse = props.applyReuse;
  let randomConfig = props.randomConfig;

  let intervalId: ReturnType<typeof setInterval> | null = null;
  let playing = false;
  // A share link restores the interval; otherwise start on the default.
  let rate = props.initialRate ?? defaultRate;

  // The phone fold. Read once up front and kept current by the watcher below;
  // `sync()` re-lays the strip out from it (see placeControls).
  let isPhone = isPhoneViewport();
  const unwatchViewport = watchPhoneViewport(next => {
    isPhone = next;
    sync();
  });

  const chartHost = mountChart(
    { mochartConfig, dataProvider },
    { style: 'flex: 1 1 auto; min-width: 0; min-height: 0; overflow: hidden;' }
  );
  const chartSizer = el('div', { className: 'random-chart-sizer' }, [chartHost.el]);

  function onPlayClick(): void {
    playing = true;
    intervalId = setInterval(onRandomizeNext, rate);
    sync();
  }

  function onStopClick(): void {
    if (intervalId !== null) {
      clearInterval(intervalId);
    }
    intervalId = null;
    playing = false;
    sync();
  }

  const rateInput = el('input', {
    id: 'random-rate', className: 'demo-input',
    attrs: { type: 'number', min: '5', max: '60000', step: '100', 'aria-label': demoText.randomChartTab.intervalAria }
  });
  rateInput.value = '' + (props.initialRate ?? defaultRate);
  rateInput.addEventListener('input', () => {
    const nextRateText = rateInput.value;
    if (!isNaN(parseFloat(nextRateText)) && isFinite(+nextRateText)) {
      const value = +nextRateText;
      if (value >= 5 && value <= 60000) {
        rate = value;
      }
    }
  });

  const backButton = buttonWithTooltip({
    id: 'randomize-back', label: demoText.randomChartTab.back.label, ariaLabel: demoText.randomChartTab.back.aria,
    tooltipText: demoText.randomChartTab.back.tooltip,
    onClick: onRandomizeBack,
    content: [icon('dice', { size: 'lg', fixedWidth: true, flip: 'horizontal' })]
  });
  const nextButton = buttonWithTooltip({
    id: 'randomize-next', label: demoText.randomChartTab.randomize.label, ariaLabel: demoText.randomChartTab.randomize.aria,
    tooltipText: demoText.randomChartTab.randomize.tooltip,
    onClick: onRandomizeNext,
    content: [icon('dice', { size: 'lg', fixedWidth: true })]
  });
  const playButton = buttonWithTooltip({
    id: 'play', menuLabel: demoText.randomChartTab.play.menuLabel, ariaLabel: demoText.randomChartTab.play.aria,
    tooltipText: demoText.randomChartTab.play.tooltip,
    onClick: onPlayClick,
    content: [icon('play', { size: 'lg', fixedWidth: true })]
  });
  const stopButton = buttonWithTooltip({
    id: 'stop', disabled: true, menuLabel: demoText.randomChartTab.stop.menuLabel, ariaLabel: demoText.randomChartTab.stop.aria,
    tooltipText: demoText.randomChartTab.stop.tooltip,
    onClick: onStopClick,
    content: [icon('stop', { size: 'lg', fixedWidth: true })]
  });
  const reuseButton = buttonWithTooltip({
    id: 'reuse', label: demoText.randomChartTab.reuse.label, pressed: applyReuse, ariaLabel: demoText.randomChartTab.reuse.aria,
    tooltipText: demoText.randomChartTab.reuse.tooltip,
    onClick: toggleApplyReuse,
    content: [icon('recycle', { size: 'lg', fixedWidth: true })]
  });
  // Share captures the generator config, the reuse toggle and the interval; the
  // step comes from the /random/:demoId/:randomId path already in the URL.
  const menu = exportShareMenu({
    exportPng: () => { void exportPNG(chartSizer, getChartExportOptions()); },
    exportSvg: () => { exportSVG(chartSizer, getChartExportOptions()); },
    getShareState: (): ShareState => ({ mode: 'random', randomConfig, applyReuse, interval: rate })
  });

  // The strip's order at desktop widths; also the lists the unfold restores, so
  // the desktop layout has exactly one definition.
  //
  // The fold keeps the dice pair (Back / Randomize) inline and demotes the
  // automation transport (Play / Stop) instead: stepping by hand is the mode's
  // primary interaction, playback is the set-and-forget one, and splitting the
  // mirrored dice across the menu boundary read worse than a menu'd Play.
  // Two 44px buttons plus the two menu triggers want ~202px, so the row fits
  // even at 320x568 (278px) with no per-width branch.
  const transportButtons = [backButton.el, nextButton.el, playButton.el, stopButton.el];
  const foldedTransportButtons = [backButton.el, nextButton.el];
  const transportGroup = el('div', { className: 'demo-btn-group' }, transportButtons);
  // `.demo-menu-keep-open` so a press inside the field — the number input's own
  // spinners in particular — cannot dismiss the panel it is hosted in. The class
  // paints nothing, so it is set once here rather than toggled by the fold.
  const rateField = el('div', { className: 'demo-field ' + menuKeepOpenClassName }, [
    el('label', { className: 'demo-label', attrs: { for: 'random-rate' }, text: demoText.randomChartTab.intervalLabel }),
    rateInput
  ]);
  const transportToolbarItems = [transportGroup, rateField];
  const transportToolbar = el('div', { className: 'demo-toolbar' }, transportToolbarItems);

  const reuseGroup = el('div', { className: 'demo-btn-group' }, [reuseButton.el]);
  // Menu-side home for Play and Stop — a cached `.demo-btn-group`;
  // OverflowMenu.ts's header says why that shape.
  const menuTransportGroup = el('div', { className: 'demo-btn-group' });
  const overflowMenuHandle = overflowMenu({
    text: demoText.overflowMenu.random,
    placement: controlsMenuPlacement,
    // Measured against the whole strip, not the trigger and not the trailing
    // group either.
    //
    // `align: 'end'` pins the panel's right edge to the anchor's, so the anchor
    // has to reach the end of the row or the panel is pushed left by the
    // difference. The single-mode strip can measure from its trailing group
    // because `.chart-controls-menu` carries `margin-left: auto` and so *is* the
    // row's end; nothing pushes this strip's menus right, and its controls are
    // left-packed inside a shrink-to-fit form. Measured at 390x844 the trailing
    // group ends at x=281 of a 369px row, which put a 320px panel at left=-39 —
    // the "Back" and "Interval (ms):" labels were off the screen. The strip is
    // full width, so its right edge is the row's end: left=49 (and left=11 at
    // 320x568, matching the two editor footers).
    getAnchor: () => controls
  });
  const menuGroup = el('div', { className: 'demo-btn-group' }, [overflowMenuHandle.el, menu.el]);
  const trailingToolbarItems = [reuseGroup, menuGroup];
  const trailingToolbar = el('div', { className: 'demo-toolbar' }, trailingToolbarItems);

  const controls = el('div', { className: 'random-controls' }, [
    el('form', {}, [
      el('div', { className: 'demo-field' }, [transportToolbar, trailingToolbar])
    ])
  ]);

  const container = tabContainer('demo-layout-col chart', active, [chartSizer, controls], 'chart');

  /**
   * Where every control of the strip lives right now. Reparenting, never
   * duplication — see OverflowMenu.ts's header.
   */
  function placeControls(): void {
    // Do this first: emptying the panel detaches whatever it was hosting, so the
    // restores below see honest child lists rather than believing the controls
    // are already placed.
    overflowMenuHandle.setItems(isPhone
      ? [menuTransportGroup, menuDivider, reuseGroup, menuDivider, rateField]
      : []);
    setChildren(transportGroup, isPhone ? foldedTransportButtons : transportButtons);
    if (isPhone) {
      setChildren(menuTransportGroup, [playButton.el, stopButton.el]);
    }
    setChildren(transportToolbar, isPhone ? [transportGroup] : transportToolbarItems);
    // The reuse group moves into the panel whole rather than being emptied, so
    // no stray zero-width flex item is left behind spending one of the toolbar's
    // gaps.
    setChildren(trailingToolbar, isPhone ? [menuGroup] : trailingToolbarItems);
  }

  function sync(): void {
    placeControls();
    backButton.setDisabled(playing);
    nextButton.setDisabled(playing);
    playButton.setDisabled(playing);
    stopButton.setDisabled(!playing);
    reuseButton.setDisabled(playing);
    reuseButton.setPressed(applyReuse);
    rateInput.disabled = playing;
  }
  sync();

  return {
    el: container,
    setActive(nextActive: boolean) {
      if (nextActive !== active) {
        active = nextActive;
        // Before the pane goes inert: an open panel is `position: fixed`, so it
        // would keep painting over whichever pane replaced this one.
        if (!nextActive) {
          overflowMenuHandle.close();
          menu.close();
        }
        setActiveClass(container, nextActive);
        onStopClick();
      }
    },
    update(next: { mochartConfig: MochartConfig; dataProvider: DemoDataProvider | null; applyReuse: boolean; randomConfig: RandomConfigWithValid }) {
      if (next.mochartConfig !== mochartConfig || next.dataProvider !== dataProvider) {
        mochartConfig = next.mochartConfig;
        dataProvider = next.dataProvider;
        chartHost.update({ mochartConfig, dataProvider });
      }
      applyReuse = next.applyReuse;
      randomConfig = next.randomConfig;
      sync();
    },
    destroy() {
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
      unwatchViewport();
      overflowMenuHandle.destroy();
      menu.destroy();
      chartHost.destroy();
    }
  };
}
