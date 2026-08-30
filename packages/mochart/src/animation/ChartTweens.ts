
import { getFocusDataForPercent } from './FocusAnimation';

import { getChartDataForAxisDelta, getChartDataForValueDelta } from './ChartAnimation';

import type { EnhancedMochartConfig } from '../types/enhanced';
import type { AnimationChartData, ChartAnimationData, FocusAnimationData, FocusData } from '../types/animation';

export const dataTweenExpandStart = 'dataTweenExpandStart' as const;
export const dataTweenExpandUpdate = 'dataTweenExpandUpdate' as const;
export const dataTweenExpandComplete = 'dataTweenExpandComplete' as const;

export const dataTweenValueStart = 'dataTweenValueStart' as const;
export const dataTweenValueUpdate = 'dataTweenValueUpdate' as const;
export const dataTweenValueComplete = 'dataTweenValueComplete' as const;

export const dataTweenContractStart = 'dataTweenContractStart' as const;
export const dataTweenContractUpdate = 'dataTweenContractUpdate' as const;
export const dataTweenContractComplete = 'dataTweenContractComplete' as const;

export type DataTweenEvent =
  | typeof dataTweenExpandStart | typeof dataTweenExpandUpdate | typeof dataTweenExpandComplete
  | typeof dataTweenValueStart | typeof dataTweenValueUpdate | typeof dataTweenValueComplete
  | typeof dataTweenContractStart | typeof dataTweenContractUpdate | typeof dataTweenContractComplete;

type VoidCallback = () => void;
type FocusUpdateCallback = (focusData: FocusData) => void;
type DataUpdateCallback = (chartData: AnimationChartData, event: DataTweenEvent, percentage?: number) => void;

interface Tween {
  readonly id: number;
  start(time?: number): Tween;
  update(time: number): boolean;
  stop(): Tween;
  chain(...tweens: Tween[]): Tween;
  onStart(callback: VoidCallback): Tween;
  onUpdate(callback: (percentage: number) => void): Tween;
  onComplete(callback: VoidCallback): Tween;
}

interface TweenEngine {
  now: () => number;
  add(tween: Tween): void;
  remove(tween: Tween): void;
  update(time?: number): boolean;
  /** run once after the current update pass (the same callback is queued once), or now when no pass is running */
  afterUpdate(callback: VoidCallback): void;
  create(duration: number, delay?: number): Tween;
}

interface FocusTweenOptions {
  completeCallback?: VoidCallback;
  startCallback?: VoidCallback;
}

interface DataTweenOptions extends FocusTweenOptions {
  completeValueChangeCallback?: (chartData: AnimationChartData) => void;
  startValueChangeCallback?: (chartData: AnimationChartData) => void;
}

export interface ChartTweenManager {
  tweenFocus(mochartConfig: EnhancedMochartConfig, focusAnimationData: FocusAnimationData, updateCallback: FocusUpdateCallback, options?: FocusTweenOptions): void;
  cancelFocusTween(): void;
  tweenData(mochartConfig: EnhancedMochartConfig, chartAnimationData: ChartAnimationData, updateCallback: DataUpdateCallback, options?: DataTweenOptions): void;
  cancelDataTween(): void;
  cancelTweens(): void;
  /** see TweenEngine.afterUpdate: lets one render follow all the tween callbacks of a frame */
  afterUpdate(callback: VoidCallback): void;
}

// Upper bound on same-frame chain cascades in the engine update loop; real
// chains are at most a few steps deep (expand -> value -> contract).
const MAX_UPDATE_PASSES = 100;

interface DataTweenStep {
  onStart: VoidCallback;
  onUpdate: (percentage: number) => void;
  onComplete: VoidCallback;
  duration: number;
}

const MochartTween: TweenEngine & {
  _requestRaf?: () => void;
  _animationId?: number | null;
  _rafCallback?: FrameRequestCallback;
} = initMochartTween();

function initMochartTween(): TweenEngine {
  // Resolved per call rather than bound at import so that clocks installed
  // after this module loads (e.g. test fake timers) are honored.
  const now = function(): number {
    if (typeof (window) !== 'undefined' && window.performance !== undefined && window.performance.now !== undefined) {
      return window.performance.now();
    }
    return Date.now();
  };

  const _tweens: Record<string, Tween> = {};
  let _pendingTweens: Record<string, Tween> = {};
  let _nextTweenId = 0;
  let _updating = false;
  const _afterUpdate = new Set<VoidCallback>();

  const add = function(tween: Tween): void {
    _tweens[tween.id] = tween;
    _pendingTweens[tween.id] = tween;
  };

  const remove = function(tween: Tween): void {
    delete _tweens[tween.id];
    delete _pendingTweens[tween.id];
  }

  const update = function(time?: number): boolean {
    let tweenIds = Object.keys(_tweens);

    if (tweenIds.length === 0) {
      return false;
    }

    time = time !== undefined ? time : now();

    // A cascade this deep within one frame means a zero-duration chain cycle;
    // defer the remainder to the next frame instead of hanging the loop.
    let passes = 0;
    // a throwing tween is stopped with its chain, or it would starve later tweens and re-fire its final frame forever
    let firstError: unknown = null;
    let threw = false;
    _updating = true;
    try {
      while (tweenIds.length > 0 && ++passes <= MAX_UPDATE_PASSES) {
        _pendingTweens = {};

        for (const tweenId of tweenIds) {
          const tween = _tweens[tweenId];
          if (tween === undefined) {
            continue;
          }
          try {
            if (tween.update(time) === false) {
              delete _tweens[tweenId];
            }
          }
          catch (error) {
            tween.stop();
            if (!threw) {
              threw = true;
              firstError = error;
            }
          }
        }

        tweenIds = Object.keys(_pendingTweens);
      }
    }
    finally {
      _updating = false;
      // the frame's last state still renders when a tween threw
      const callbacks = [..._afterUpdate];
      _afterUpdate.clear();
      for (const callback of callbacks) {
        callback();
      }
    }
    if (threw) {
      throw firstError;
    }
    return true;
  }

  const afterUpdate = function(callback: VoidCallback): void {
    if (_updating) {
      _afterUpdate.add(callback);
    }
    else {
      callback();
    }
  }

  const create = function(duration: number, delay = 0): Tween {
    const id = _nextTweenId++;
    let startTime = 0;
    let isPlaying = false;
    // set by stop(): a callback that cancels this tween (a re-entrant tweenData) must not see it complete or start its chain
    let stopped = false;
    let onStartCallbackFired = false;
    let onStartCallback: VoidCallback | null = null;
    let onUpdateCallback: ((percentage: number) => void) | null = null;
    let onCompleteCallback: VoidCallback | null = null;
    let chainedTweens: Tween[] = [];

    const start = function(time?: number): Tween {
      add(tween);

      isPlaying = true;
      stopped = false;
		  onStartCallbackFired = false;

      startTime = delay + (time !== undefined ? time : now());
      return tween;
    }

    const update = function(time: number): boolean {
      if (time < startTime) {
			  return true;
		  }
      if (onStartCallbackFired === false) {
        if (onStartCallback !== null) {
          onStartCallback();
        }
        onStartCallbackFired = true;
        if (stopped) {
          return false;
        }
      }

      let percentage = duration === 0 ? 1 : (time - startTime) / duration;
      percentage = percentage > 1 ? 1 : percentage;

      if (onUpdateCallback !== null) {
			  onUpdateCallback(percentage);
        if (stopped) {
          return false;
        }
		  }

      if (percentage === 1) {
        isPlaying = false;

        if (onCompleteCallback !== null) {
					onCompleteCallback();
          if (stopped) {
            return false;
          }
				}

        for (const chainedTween of chainedTweens) {
          chainedTween.start(startTime+duration);
        }

        return false;
      }

      return true;
    };

    const stopChainedTweens = function(): void {
      for (const chainedTween of chainedTweens) {
        chainedTween.stop();
      }
    }

    const chain = function(...tweens: Tween[]): Tween {
      chainedTweens = tweens;
      return tween;
    }

    // Always cascades into chained tweens, even after this tween completed —
    // stopping the head of a chain must halt whichever step is currently running.
    const stop = function(): Tween {
      stopped = true;
      if (isPlaying) {
        remove(tween);
        isPlaying = false;
      }

      stopChainedTweens();
      return tween;
    };

    const onStart = function(callback: VoidCallback): Tween {
      onStartCallback = callback;
      return tween;
    }

    const onUpdate = function(callback: (percentage: number) => void): Tween {
      onUpdateCallback = callback;
      return tween;
    }

    const onComplete = function(callback: VoidCallback): Tween {
      onCompleteCallback = callback;
      return tween;
    }

    const tween: Tween = {
      id,
      start,
      update,
      stop,
      chain,
      onStart,
      onUpdate,
      onComplete
    };

    return tween;
  };

  return {
    now,
    add,
    remove,
    update,
    afterUpdate,
    create
  };
}

if (MochartTween._requestRaf === undefined) {
  MochartTween._animationId = null;
  MochartTween._rafCallback = function(ts: number): void {
    if (!ts) {
      ts = MochartTween.now();
    }
    // a throwing tween callback must still re-arm the frame, or the shared loop wedges for every chart
    let active = true;
    try {
      active = MochartTween.update(ts);
    }
    finally {
      MochartTween._animationId = active ? requestAnimationFrame(MochartTween._rafCallback!) : null;
    }
  };
  MochartTween._requestRaf = function() {
    if (MochartTween._animationId === null) {
      MochartTween._animationId = requestAnimationFrame(MochartTween._rafCallback!);
    }
  };
}

export function getChartTweenManager(): ChartTweenManager {
  let focusTween: Tween | null = null;
  let dataTween: Tween | null = null;

  const self: ChartTweenManager = {
    tweenFocus: (mochartConfig, focusAnimationData, updateCallback, {
      completeCallback = () => {},
      startCallback = () => {}
    } = {}) => {
      self.cancelFocusTween();
      // identity-guarded completion: the final frame's updateCallback may re-enter and replace the slot
      const tween = buildFocusTween(mochartConfig, focusAnimationData, {
        updateCallback,
        completeCallback: () => {
          if (focusTween === tween) {
            focusTween = null;
            completeCallback();
          }
        },
        startCallback

      });
      focusTween = tween;
      // TODO, defer start until after next raf callback?!
      tween.start();
      MochartTween._requestRaf!();
    },
    cancelFocusTween: () => {
      if (focusTween !== null) {
        focusTween.stop();
        focusTween = null;
      }
    },
    tweenData: (mochartConfig, chartAnimationData, updateCallback, {
      completeCallback = () => {},
      startCallback = () => {},
      completeValueChangeCallback = () => {},
      startValueChangeCallback = () => {}
    } = {}) => {
      self.cancelDataTween();
      // same identity guard as tweenFocus
      const tween = buildDataTween(mochartConfig, chartAnimationData, {
        updateCallback,
        completeCallback: () => {
          if (dataTween === tween) {
            dataTween = null;
            completeCallback();
          }
        },
        startCallback,
        completeValueChangeCallback,
        startValueChangeCallback
      });
      dataTween = tween;
      if (tween !== null) {
        tween.start();
      }
      else {
        completeCallback();
      }
      MochartTween._requestRaf!();
    },
    cancelDataTween: () => {
      if (dataTween !== null) {
        dataTween.stop();
        dataTween = null;
      }
    },
    cancelTweens: () => {
      self.cancelFocusTween();
      self.cancelDataTween();
    },
    afterUpdate: callback => {
      MochartTween.afterUpdate(callback);
    }
  };

  return self;
}

function buildFocusTween(
  mochartConfig: EnhancedMochartConfig, focusAnimationData: FocusAnimationData,
  {
    updateCallback,
    completeCallback = () => {},
    startCallback = () => {}
  }: FocusTweenOptions & { updateCallback: FocusUpdateCallback }): Tween {
  const focusDuration = mochartConfig.animation.focusDuration;
  const duration = safeDuration(focusAnimationData.deltaPercentage * focusDuration);
  // delay the start of the focus tween by a few milliseconds to allow it to be canceled if another tween is built
  // immediately after, like when we mouseover the series, and then mouseout but immediately mouseover a series marker
  const delay = 5;
  const focusTween = MochartTween.create(duration, delay);
  focusTween.onStart(() => {
    updateCallback(focusAnimationData.start);
    startCallback();
  });
  focusTween.onUpdate(percentage => {
    updateCallback(getFocusDataForPercent(focusAnimationData, percentage));
  });
  focusTween.onComplete(() => {
    updateCallback(focusAnimationData.final);
    completeCallback();
  });
  return focusTween;
}

// a non-finite or negative duration would never reach percentage 1, wedging the rAF loop forever
function safeDuration(duration: number): number {
  return Number.isFinite(duration) && duration > 0 ? duration : 0;
}

function buildDataTween(
  mochartConfig: EnhancedMochartConfig, chartAnimationData: ChartAnimationData, {
    updateCallback,
    completeCallback = () => {},
    startCallback = () => {},
    completeValueChangeCallback = () => {},
    startValueChangeCallback = () => {}
  }: DataTweenOptions & { updateCallback: DataUpdateCallback }): Tween | null {
  const { axisExpansionData, valueChangeData, axisContractionData } = chartAnimationData;
  const tweenData: DataTweenStep[] = [];
  if (axisExpansionData.deltaPercentage !== 0) {
    if (axisExpansionData.start === null || axisExpansionData.final === null || axisExpansionData.final === undefined) {
      throw new Error('Axis expansion tween requires chart data');
    }
    tweenData.push({
      onStart: () => { updateCallback(axisExpansionData.start, dataTweenExpandStart); },
      onUpdate: (percentage) => { updateCallback(getChartDataForAxisDelta(mochartConfig, chartAnimationData, true, percentage), dataTweenExpandUpdate); },
      onComplete: () => { updateCallback(axisExpansionData.final, dataTweenExpandComplete); },
      duration: safeDuration(mochartConfig.animation.expansionDuration * axisExpansionData.deltaPercentage)
    });
  }
  else {
    const { start, final } = axisExpansionData;
    if (start !== null && final !== null && start !== final) {
      tweenData.push({
        onStart: () => { updateCallback(start, dataTweenExpandStart); },
        onUpdate: () => { updateCallback(final, dataTweenExpandUpdate); },
        onComplete: () => { updateCallback(final, dataTweenExpandComplete); },
        duration: 0
      });
    }
  }
  if (valueChangeData.deltaPercentage !== 0) {
    tweenData.push({
      onStart: () => { updateCallback(valueChangeData.start, dataTweenValueStart); startValueChangeCallback(valueChangeData.start); },
      onUpdate: (percentage) => { updateCallback(getChartDataForValueDelta(mochartConfig, chartAnimationData, percentage), dataTweenValueUpdate, percentage); },
      onComplete: () => { updateCallback(valueChangeData.final, dataTweenValueComplete); completeValueChangeCallback(valueChangeData.final); },
      duration: safeDuration((chartAnimationData.initialAnimation ? mochartConfig.animation.initialDuration : mochartConfig.animation.valueChangeDuration) * valueChangeData.deltaPercentage)
    });
  }
  else {
    const { start, final } = valueChangeData;
    // the value-change callbacks still bracket a zero-delta phase: the source keys its focus index space off them
    if (start !== null && final !== null && start !== final) {
      tweenData.push({
        onStart: () => { updateCallback(start, dataTweenValueStart); startValueChangeCallback(start); },
        onUpdate: () => { updateCallback(final, dataTweenValueUpdate); },
        onComplete: () => { updateCallback(final, dataTweenValueComplete); completeValueChangeCallback(final); },
        duration: 0
      });
    }
  }
  if (axisContractionData.deltaPercentage !== 0) {
    if (axisContractionData.start === null || axisContractionData.final === null || axisContractionData.final === undefined) {
      throw new Error('Axis contraction tween requires chart data');
    }
    tweenData.push({
      onStart: () => { updateCallback(axisContractionData.start, dataTweenContractStart); },
      onUpdate: (percentage) => { updateCallback(getChartDataForAxisDelta(mochartConfig, chartAnimationData, false, percentage), dataTweenContractUpdate); },
      onComplete: () => { updateCallback(axisContractionData.final, dataTweenContractComplete); },
      duration: safeDuration(mochartConfig.animation.contractionDuration * axisContractionData.deltaPercentage)
    });
  }
  else {
    const { start, final } = axisContractionData;
    if (start !== null && final !== null && start !== final) {
      tweenData.push({
        onStart: () => { updateCallback(start, dataTweenContractStart); },
        onUpdate: () => { updateCallback(final, dataTweenContractUpdate); },
        onComplete: () => { updateCallback(final, dataTweenContractComplete); },
        duration: 0
      });
    }
  }
  let firstTween: Tween | null = null;
  let lastTween: Tween | null = null;
  for (let i=0; i<tweenData.length; i++) {
    const newTween = MochartTween.create(tweenData[i].duration);
    if (i === 0) {
      newTween.onStart(() => {
        tweenData[i].onStart();
        startCallback();
      });
    }
    else {
      newTween.onStart(tweenData[i].onStart);
    }
    newTween.onUpdate(percentage => { tweenData[i].onUpdate(percentage); });
    if (i === tweenData.length-1) {
      newTween.onComplete(() => {
        tweenData[i].onComplete();
        completeCallback();
      });
    }
    else {
      newTween.onComplete(tweenData[i].onComplete);
    }
    if (firstTween === null) {
      firstTween = newTween;
    }
    if (lastTween !== null) {
      lastTween.chain(newTween);
    }
    lastTween = newTween;
  }
  return firstTween;
}
