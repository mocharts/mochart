import React, { useState, useRef, useEffect } from 'react';
import Icon from '../misc/Icon';

import { Chart } from '@mochart/react';
import type { MochartConfig } from '@mochart/core';
import { exportPNG, exportSVG } from '@mochart/export';

import { controlsMenuPlacement, demoText, getChartExportOptions, getDemoTabPanelAttrs, menuKeepOpenClassName } from '@mochart/demo-common';
import type { ShareState } from '@mochart/demo-common';

import ButtonWithTooltip from '../misc/ButtonWithTooltip';
import ExportShareMenu from '../misc/ExportShareMenu';
import OverflowMenu, { MenuDivider } from '../misc/OverflowMenu';
import { usePhoneViewport } from '../misc/usePhoneViewport';

import type { DemoDataProvider, RandomConfigWithValid } from '../../types';

const defaultRate = 2000;

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

export default function RandomMochartChartsTab({ active, mochartConfig, dataProvider, randomConfig, initialRate, onRandomizeBack, onRandomizeNext, applyReuse, toggleApplyReuse }: Props) {
  const intervalIdRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chartSizerRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  // A share link restores the interval; otherwise start on the default.
  const [rate, setRate] = useState(initialRate ?? defaultRate);
  const [rateText, setRateText] = useState<string | number>('' + (initialRate ?? defaultRate));

  const onStopClick = () => {
    if (intervalIdRef.current !== null) {
      clearInterval(intervalIdRef.current);
    }
    intervalIdRef.current = null;
    setPlaying(false);
  };

  // Stop playback when the tab toggles active (matches the old cWRP behavior).
  useEffect(() => {
    onStopClick();
     
  }, [active]);

  // Clean up the interval on unmount.
  useEffect(() => () => {
    if (intervalIdRef.current !== null) {
      clearInterval(intervalIdRef.current);
      intervalIdRef.current = null;
    }
  }, []);

  // The routed randomId is baked into each render's onRandomizeNext, so the
  // interval must read the latest one via a ref — freezing the play-time
  // closure would navigate to the same randomId on every tick after the first.
  const onRandomizeNextRef = useRef(onRandomizeNext);
  onRandomizeNextRef.current = onRandomizeNext;

  const onPlayClick = () => {
    setPlaying(true);
    intervalIdRef.current = setInterval(() => onRandomizeNextRef.current(), rate);
  };

  const rateChanged = (event: React.ChangeEvent<HTMLInputElement>) => {
    let nextRate = rate;
    let nextRateText: any = event.target.value;
    if (!isNaN(parseFloat(nextRateText)) && isFinite(nextRateText)) {
      nextRateText = +nextRateText;
      if (nextRateText >= 5 && nextRateText <= 60000) {
        nextRate = nextRateText;
      }
    }
    setRateText(nextRateText);
    setRate(nextRate);
  };

  const onExportPng = () => {
    const container = chartSizerRef.current;
    if (container) {
      void exportPNG(container, getChartExportOptions());
    }
  };

  const onExportSvg = () => {
    const container = chartSizerRef.current;
    if (container) {
      exportSVG(container, getChartExportOptions());
    }
  };

  // Share captures the generator config, the reuse toggle and the interval; the
  // step comes from the /random/:demoId/:randomId path already in the URL.
  const getShareState = (): ShareState => ({
    mode: 'random', randomConfig, applyReuse, interval: rate
  });

  // The phone fold keeps the dice pair (Back / Randomize) inline — stepping by
  // hand is the mode's primary interaction — and demotes the automation
  // transport (Play / Stop) with the Reuse toggle and the interval field. Each
  // control renders in exactly one of the two places (see OverflowMenu.tsx).
  const isPhone = usePhoneViewport();
  const controlsRef = useRef<HTMLDivElement>(null);

  const backButton = (
    <ButtonWithTooltip id="randomize-back" disabled={playing} label={demoText.randomChartTab.back.label}
      tooltipText={demoText.randomChartTab.back.tooltip} tooltipPlacement="top-start"
      onClick={onRandomizeBack} aria-label={demoText.randomChartTab.back.aria}>
      <Icon size="lg" fixedWidth={true} name="dice" flip={'horizontal'} />
    </ButtonWithTooltip>
  );
  const nextButton = (
    <ButtonWithTooltip id="randomize-next" disabled={playing} label={demoText.randomChartTab.randomize.label}
      tooltipText={demoText.randomChartTab.randomize.tooltip} tooltipPlacement="top-start"
      onClick={onRandomizeNext} aria-label={demoText.randomChartTab.randomize.aria}>
      <Icon size="lg" fixedWidth={true} name="dice" />
    </ButtonWithTooltip>
  );
  const playButton = (
    <ButtonWithTooltip id="play" disabled={playing} menuLabel={demoText.randomChartTab.play.menuLabel}
      tooltipText={demoText.randomChartTab.play.tooltip} tooltipPlacement="top-start"
      onClick={onPlayClick} aria-label={demoText.randomChartTab.play.aria}>
      <Icon size="lg" fixedWidth={true} name="play" />
    </ButtonWithTooltip>
  );
  const stopButton = (
    <ButtonWithTooltip id="stop" disabled={!playing} menuLabel={demoText.randomChartTab.stop.menuLabel}
      tooltipText={demoText.randomChartTab.stop.tooltip} tooltipPlacement="top-start"
      onClick={onStopClick} aria-label={demoText.randomChartTab.stop.aria}>
      <Icon size="lg" fixedWidth={true} name="stop" />
    </ButtonWithTooltip>
  );
  const reuseButton = (
    <ButtonWithTooltip id="reuse" disabled={playing} label={demoText.randomChartTab.reuse.label} pressed={applyReuse}
      tooltipText={demoText.randomChartTab.reuse.tooltip} tooltipPlacement="top-start"
      onClick={toggleApplyReuse} aria-label={demoText.randomChartTab.reuse.aria}>
      <Icon size="lg" fixedWidth={true} name="recycle" />
    </ButtonWithTooltip>
  );
  // `.demo-menu-keep-open` so a press inside the field — the number input's
  // own spinners in particular — cannot dismiss the panel it is hosted in.
  // The class paints nothing, so it is unconditional.
  const rateField = (
    <div className={'demo-field ' + menuKeepOpenClassName}>
      <label className="demo-label" htmlFor="random-rate">{demoText.randomChartTab.intervalLabel}</label>
      <input id="random-rate" className="demo-input" disabled={playing} type="number" min={5} max={60000} step={100} value={rateText}
        onChange={rateChanged} aria-label={demoText.randomChartTab.intervalAria} />
    </div>
  );
  const exportShareMenu = (
    <ExportShareMenu active={active !== false} exportPng={onExportPng} exportSvg={onExportSvg} getShareState={getShareState} />
  );

  return (
    <div {...getDemoTabPanelAttrs('chart')} className={"mochart-demo-tab-container demo-layout-col chart" + (active ? " active" : "")} inert={!active}>
      <div className="random-chart-sizer" ref={chartSizerRef}>
        {/* Chart self-measures when width/height are omitted. */}
        <Chart style={{ flex: '1 1 auto', minWidth: 0, minHeight: 0, overflow: 'hidden' }}
          mochartConfig={mochartConfig} dataProvider={dataProvider} />
      </div>
      <div className="random-controls" ref={controlsRef}>
        <form>
          <div className="demo-field">
            <div className="demo-toolbar">
              <div className="demo-btn-group">
                {backButton}
                {nextButton}
                {isPhone ? null : <>{playButton}{stopButton}</>}
              </div>
              {isPhone ? null : rateField}
            </div>
            <div className="demo-toolbar">
              {isPhone ? (
                <div className="demo-btn-group">
                  {/* Anchored to the whole strip: `align: 'end'` pins the
                      panel's right edge to the anchor's, and the export
                      trigger sits to the ⋯'s right. */}
                  <OverflowMenu text={demoText.overflowMenu.random} placement={controlsMenuPlacement}
                    anchorRef={controlsRef} active={active !== false}>
                    <div className="demo-btn-group">{playButton}{stopButton}</div>
                    <MenuDivider />
                    <div className="demo-btn-group">{reuseButton}</div>
                    <MenuDivider />
                    {rateField}
                  </OverflowMenu>
                  {exportShareMenu}
                </div>
              ) : (
                <>
                  <div className="demo-btn-group">{reuseButton}</div>
                  {exportShareMenu}
                </>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
