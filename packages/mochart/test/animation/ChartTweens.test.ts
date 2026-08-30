import type { EnhancedMochartConfig } from '../../src/types/enhanced';
// Tween engine + ChartTweenManager tests (sequencing, events, durations, cancellation) on a fake
// clock; the data/focus interpolators are mocked — their math is covered by their own test files.
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { FRAME_MS, installFakeFrameClock, runFrames } from '../components/helpers';
import {
  getChartTweenManager,
  dataTweenExpandStart, dataTweenExpandUpdate, dataTweenExpandComplete,
  dataTweenValueStart, dataTweenValueUpdate, dataTweenValueComplete,
  dataTweenContractStart, dataTweenContractUpdate, dataTweenContractComplete
} from '../../src/animation/ChartTweens';
import { getChartDataForAxisDelta, getChartDataForValueDelta } from '../../src/animation/ChartAnimation';
import { getFocusDataForPercent } from '../../src/animation/FocusAnimation';
import type { ChartTweenManager, DataTweenEvent } from '../../src/animation/ChartTweens';

import type { AnimationChartData, ChartAnimationData, FocusAnimationData, FocusData } from '../../src/types/animation';

vi.mock('../../src/animation/ChartAnimation', () => ({
  getChartDataForAxisDelta: vi.fn((_config: unknown, _data: unknown, expand: boolean, percentage: number) =>
    ({ interpolated: expand ? 'expand' : 'contraction', percentage })),
  getChartDataForValueDelta: vi.fn((_config: unknown, _data: unknown, percentage: number) =>
    ({ interpolated: 'value', percentage }))
}));

vi.mock('../../src/animation/FocusAnimation', () => ({
  getFocusDataForPercent: vi.fn((_data: unknown, percentage: number) =>
    ({ interpolated: 'focus', percentage }))
}));


interface Sentinel { phase: string; edge: string; }
const sentinel = (phase: string, edge: string): Sentinel => ({ phase, edge });

function phaseData(deltaPercentage: number, start: unknown, final: unknown) {
  return { deltaPercentage, start, final };
}

const settled = sentinel('none', 'settled');

function makeAnimationData(overrides: Partial<Record<'axisExpansionData' | 'valueChangeData' | 'axisContractionData', unknown>> & { initialAnimation?: boolean } = {}): ChartAnimationData {
  return {
    initialAnimation: false,
    axisExpansionData: phaseData(0, settled, settled),
    valueChangeData: phaseData(0, settled, settled),
    axisContractionData: phaseData(0, settled, settled),
    ...overrides
  } as unknown as ChartAnimationData;
}

function makeConfig(overrides: Record<string, number> = {}): EnhancedMochartConfig {
  return {
    animation: {
      expansionDuration: 100,
      valueChangeDuration: 100,
      initialDuration: 300,
      contractionDuration: 100,
      focusDuration: 100,
      ...overrides
    }
  } as unknown as EnhancedMochartConfig;
}

interface RecordedEvent { event: DataTweenEvent; data: unknown; }

function makeRecorder() {
  const events: RecordedEvent[] = [];
  const record = (data: AnimationChartData, event: DataTweenEvent): void => {
    events.push({ event, data });
  };
  return { events, record };
}

/** Collapse consecutive duplicate events down to the distinct sequence. */
function eventSequence(events: RecordedEvent[]): DataTweenEvent[] {
  return events.map(({ event }) => event).filter((event, i, all) => i === 0 || all[i - 1] !== event);
}

let managers: ChartTweenManager[] = [];

function makeManager(): ChartTweenManager {
  const manager = getChartTweenManager();
  managers.push(manager);
  return manager;
}

beforeAll(() => {
  installFakeFrameClock();
});

afterEach(() => {
  for (const manager of managers) {
    manager.cancelTweens();
  }
  managers = [];
  // let the shared raf loop wind down so the next test starts from idle
  runFrames();
  vi.clearAllMocks();
});

describe('tweenData', () => {
  it('runs expand, value and contraction phases in order with phase-correct events', () => {
    const manager = makeManager();
    const { events, record } = makeRecorder();
    const expandStart = sentinel('expand', 'start');
    const expandFinal = sentinel('expand', 'final');
    const valueStart = sentinel('value', 'start');
    const valueFinal = sentinel('value', 'final');
    const contractionStart = sentinel('contraction', 'start');
    const contractionFinal = sentinel('contraction', 'final');
    const startCallback = vi.fn();
    const completeCallback = vi.fn();
    const startValueChangeCallback = vi.fn();
    const completeValueChangeCallback = vi.fn();

    manager.tweenData(makeConfig(), makeAnimationData({
      axisExpansionData: phaseData(1, expandStart, expandFinal),
      valueChangeData: phaseData(1, valueStart, valueFinal),
      axisContractionData: phaseData(1, contractionStart, contractionFinal)
    }), record, { startCallback, completeCallback, startValueChangeCallback, completeValueChangeCallback });
    runFrames();

    expect(eventSequence(events)).toEqual([
      dataTweenExpandStart, dataTweenExpandUpdate, dataTweenExpandComplete,
      dataTweenValueStart, dataTweenValueUpdate, dataTweenValueComplete,
      dataTweenContractStart, dataTweenContractUpdate, dataTweenContractComplete
    ]);
    expect(events[0]!.data).toBe(expandStart);
    expect(events.find(({ event }) => event === dataTweenExpandComplete)!.data).toBe(expandFinal);
    expect(events.find(({ event }) => event === dataTweenValueStart)!.data).toBe(valueStart);
    expect(events.find(({ event }) => event === dataTweenValueComplete)!.data).toBe(valueFinal);
    expect(events.find(({ event }) => event === dataTweenContractStart)!.data).toBe(contractionStart);
    expect(events[events.length - 1]!.data).toBe(contractionFinal);
    // intermediate frames come from the interpolators, not DOM-facing state
    expect(vi.mocked(getChartDataForAxisDelta)).toHaveBeenCalledWith(expect.anything(), expect.anything(), true, expect.any(Number));
    expect(vi.mocked(getChartDataForAxisDelta)).toHaveBeenCalledWith(expect.anything(), expect.anything(), false, expect.any(Number));
    expect(vi.mocked(getChartDataForValueDelta)).toHaveBeenCalled();
    expect(startCallback).toHaveBeenCalledTimes(1);
    expect(completeCallback).toHaveBeenCalledTimes(1);
    expect(startValueChangeCallback).toHaveBeenCalledTimes(1);
    expect(startValueChangeCallback).toHaveBeenCalledWith(valueStart);
    expect(completeValueChangeCallback).toHaveBeenCalledTimes(1);
    expect(completeValueChangeCallback).toHaveBeenCalledWith(valueFinal);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('emits phase-correct events from the zero-delta fallback steps', () => {
    const manager = makeManager();
    const { events, record } = makeRecorder();
    const expandStart = sentinel('expand', 'start');
    const expandFinal = sentinel('expand', 'final');
    const valueStart = sentinel('value', 'start');
    const valueFinal = sentinel('value', 'final');
    const contractionStart = sentinel('contraction', 'start');
    const contractionFinal = sentinel('contraction', 'final');
    const completeCallback = vi.fn();
    const startValueChangeCallback = vi.fn();
    const completeValueChangeCallback = vi.fn();

    manager.tweenData(makeConfig(), makeAnimationData({
      axisExpansionData: phaseData(0, expandStart, expandFinal),
      valueChangeData: phaseData(0, valueStart, valueFinal),
      axisContractionData: phaseData(0, contractionStart, contractionFinal)
    }), record, { completeCallback, startValueChangeCallback, completeValueChangeCallback });
    runFrames();

    // Regression: the fallback value step skipped the value-change callbacks, so the source stayed in
    // the old index space through a real contraction phase
    expect(startValueChangeCallback).toHaveBeenCalledTimes(1);
    expect(startValueChangeCallback).toHaveBeenCalledWith(valueStart);
    expect(completeValueChangeCallback).toHaveBeenCalledTimes(1);
    expect(completeValueChangeCallback).toHaveBeenCalledWith(valueFinal);

    expect(events.map(({ event }) => event)).toEqual([
      dataTweenExpandStart, dataTweenExpandUpdate, dataTweenExpandComplete,
      dataTweenValueStart, dataTweenValueUpdate, dataTweenValueComplete,
      dataTweenContractStart, dataTweenContractUpdate, dataTweenContractComplete
    ]);
    expect(events.map(({ data }) => data)).toEqual([
      expandStart, expandFinal, expandFinal,
      valueStart, valueFinal, valueFinal,
      contractionStart, contractionFinal, contractionFinal
    ]);
    expect(completeCallback).toHaveBeenCalledTimes(1);
    // zero-delta steps jump straight to final; nothing to interpolate
    expect(vi.mocked(getChartDataForAxisDelta)).not.toHaveBeenCalled();
    expect(vi.mocked(getChartDataForValueDelta)).not.toHaveBeenCalled();
  });

  it('invokes completeCallback immediately when there is nothing to animate', () => {
    const manager = makeManager();
    const { events, record } = makeRecorder();
    const completeCallback = vi.fn();
    const startCallback = vi.fn();

    manager.tweenData(makeConfig(), makeAnimationData(), record, { startCallback, completeCallback });

    expect(completeCallback).toHaveBeenCalledTimes(1);
    runFrames();
    expect(events).toEqual([]);
    expect(startCallback).not.toHaveBeenCalled();
  });

  it('cancelDataTween mid-chain halts the step that is currently running', () => {
    const manager = makeManager();
    const { events, record } = makeRecorder();
    const completeCallback = vi.fn();

    manager.tweenData(makeConfig(), makeAnimationData({
      axisExpansionData: phaseData(1, sentinel('expand', 'start'), sentinel('expand', 'final')),
      valueChangeData: phaseData(1, sentinel('value', 'start'), sentinel('value', 'final'))
    }), record, { completeCallback });

    // 8 frames = 128ms: the 100ms expand phase is done, the value phase is running
    for (let frame = 0; frame < 8; frame++) {
      vi.advanceTimersByTime(FRAME_MS);
    }
    expect(events.some(({ event }) => event === dataTweenValueUpdate)).toBe(true);
    expect(completeCallback).not.toHaveBeenCalled();

    manager.cancelDataTween();
    const eventCount = events.length;
    runFrames();

    expect(events.length).toBe(eventCount);
    expect(events.some(({ event }) => event === dataTweenValueComplete)).toBe(false);
    expect(completeCallback).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('afterUpdate runs a queued callback once per frame after every step of the chain advanced', () => {
    const manager = makeManager();
    const { events, record } = makeRecorder();
    const flushes: number[] = [];
    const flush = () => { flushes.push(events.length); };
    manager.tweenData(makeConfig(), makeAnimationData({
      axisExpansionData: phaseData(0, sentinel('expand', 'start'), sentinel('expand', 'final')),
      valueChangeData: phaseData(0, sentinel('value', 'start'), sentinel('value', 'final')),
      axisContractionData: phaseData(0, sentinel('contraction', 'start'), sentinel('contraction', 'final'))
    }), (data, event) => {
      record(data, event);
      // queued from every callback, run once
      manager.afterUpdate(flush);
      manager.afterUpdate(flush);
    });
    runFrames();
    // the three zero-duration steps fire nine events inside one frame, then the single flush sees them all
    expect(events.length).toBe(9);
    expect(flushes).toEqual([9]);

    // outside a pass the callback runs at once
    manager.afterUpdate(flush);
    expect(flushes).toEqual([9, 9]);
  });

  it('a data tween step that throws stops the chain, so no later step runs', () => {
    const manager = makeManager();
    const { events, record } = makeRecorder();
    const completeCallback = vi.fn();
    const throwingRecord = (data: AnimationChartData, event: DataTweenEvent): void => {
      record(data, event);
      if (event === dataTweenExpandUpdate) {
        throw new Error('render failed');
      }
    };

    manager.tweenData(makeConfig(), makeAnimationData({
      axisExpansionData: phaseData(1, sentinel('expand', 'start'), sentinel('expand', 'final')),
      valueChangeData: phaseData(1, sentinel('value', 'start'), sentinel('value', 'final'))
    }), throwingRecord, { completeCallback });

    let thrown: unknown = null;
    while (thrown === null && vi.getTimerCount() > 0) {
      try { vi.advanceTimersByTime(FRAME_MS); } catch (error) { thrown = error; }
    }
    expect(thrown).toEqual(new Error('render failed'));
    const eventCount = events.length;
    runFrames();

    expect(events.length).toBe(eventCount);
    expect(events.some(({ event }) => event === dataTweenExpandComplete || event === dataTweenValueStart)).toBe(false);
    expect(completeCallback).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  // Regression: a tween cancelled from inside its own callback still fired its completion and started its
  // chained steps, so a superseded data tween kept running interleaved with its replacement
  it('a data tween replaced from inside its own callback runs none of its later steps', () => {
    const manager = makeManager();
    const { events, record } = makeRecorder();
    const firstComplete = vi.fn();
    const firstValueStart = vi.fn();
    const secondFinal = sentinel('value2', 'final');
    let replaced = false;

    const reentrantRecord: typeof record = (data, event) => {
      record(data, event);
      if (event === dataTweenExpandComplete && !replaced) {
        replaced = true;
        manager.tweenData(makeConfig(), makeAnimationData({
          valueChangeData: phaseData(1, sentinel('value2', 'start'), secondFinal)
        }), record);
      }
    };
    manager.tweenData(makeConfig(), makeAnimationData({
      axisExpansionData: phaseData(1, sentinel('expand', 'start'), sentinel('expand', 'final')),
      valueChangeData: phaseData(1, sentinel('value1', 'start'), sentinel('value1', 'final')),
      axisContractionData: phaseData(1, sentinel('contract', 'start'), sentinel('contract', 'final'))
    }), reentrantRecord, { completeCallback: firstComplete, startValueChangeCallback: firstValueStart });
    runFrames();

    const firstEvents = events.filter(({ data }) => String((data as { phase?: string }).phase ?? '').startsWith('value1') || String((data as { phase?: string }).phase ?? '').startsWith('contract'));
    expect(firstEvents).toEqual([]);
    expect(firstValueStart).not.toHaveBeenCalled();
    expect(firstComplete).not.toHaveBeenCalled();
    expect(events[events.length - 1]!.data).toBe(secondFinal);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('starting a new data tween replaces the running one without double completion', () => {
    const manager = makeManager();
    const { events, record } = makeRecorder();
    const firstComplete = vi.fn();
    const secondComplete = vi.fn();
    const secondFinal = sentinel('value2', 'final');

    manager.tweenData(makeConfig(), makeAnimationData({
      valueChangeData: phaseData(1, sentinel('value1', 'start'), sentinel('value1', 'final'))
    }), record, { completeCallback: firstComplete });
    vi.advanceTimersByTime(FRAME_MS * 2);

    manager.tweenData(makeConfig(), makeAnimationData({
      valueChangeData: phaseData(1, sentinel('value2', 'start'), secondFinal)
    }), record, { completeCallback: secondComplete });
    runFrames();

    expect(firstComplete).not.toHaveBeenCalled();
    expect(secondComplete).toHaveBeenCalledTimes(1);
    expect(events[events.length - 1]!.event).toBe(dataTweenValueComplete);
    expect(events[events.length - 1]!.data).toBe(secondFinal);
  });

  it('scales the phase duration by deltaPercentage', () => {
    const manager = makeManager();
    const completeCallback = vi.fn();
    const startTime = performance.now();
    let completeTime = 0;

    manager.tweenData(makeConfig({ valueChangeDuration: 200 }), makeAnimationData({
      valueChangeData: phaseData(0.5, sentinel('value', 'start'), sentinel('value', 'final'))
    }), () => {}, { completeCallback: () => { completeTime = performance.now(); completeCallback(); } });
    runFrames();

    expect(completeCallback).toHaveBeenCalledTimes(1);
    const elapsed = completeTime - startTime;
    expect(elapsed).toBeGreaterThanOrEqual(100);
    expect(elapsed).toBeLessThan(200);
  });

  it('uses initialDuration instead of valueChangeDuration for the initial animation', () => {
    const manager = makeManager();
    const startTime = performance.now();
    let completeTime = 0;

    manager.tweenData(makeConfig({ valueChangeDuration: 100, initialDuration: 300 }), makeAnimationData({
      initialAnimation: true,
      valueChangeData: phaseData(1, sentinel('value', 'start'), sentinel('value', 'final'))
    }), () => {}, { completeCallback: () => { completeTime = performance.now(); } });
    runFrames();

    expect(completeTime - startTime).toBeGreaterThanOrEqual(300);
  });
});

describe('tweenFocus', () => {
  function makeFocusData(deltaPercentage = 1): { animationData: FocusAnimationData; start: Sentinel; final: Sentinel } {
    const start = sentinel('focus', 'start');
    const final = sentinel('focus', 'final');
    const animationData = { deltaPercentage, start, final } as unknown as FocusAnimationData;
    return { animationData, start, final };
  }

  it('tweens focus from start through interpolated frames to final', () => {
    const manager = makeManager();
    const updates: unknown[] = [];
    const startCallback = vi.fn();
    const completeCallback = vi.fn();
    const { animationData, start, final } = makeFocusData();

    manager.tweenFocus(makeConfig(), animationData, (focusData: FocusData) => { updates.push(focusData); }, { startCallback, completeCallback });
    runFrames();

    expect(updates[0]).toBe(start);
    expect(updates[updates.length - 1]).toBe(final);
    expect(vi.mocked(getFocusDataForPercent)).toHaveBeenCalled();
    expect(updates.length).toBeGreaterThan(2);
    expect(startCallback).toHaveBeenCalledTimes(1);
    expect(completeCallback).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('never fires callbacks when canceled within its start delay', () => {
    const manager = makeManager();
    const updateCallback = vi.fn();
    const startCallback = vi.fn();
    const completeCallback = vi.fn();

    manager.tweenFocus(makeConfig(), makeFocusData().animationData, updateCallback, { startCallback, completeCallback });
    manager.cancelFocusTween();
    runFrames();

    expect(updateCallback).not.toHaveBeenCalled();
    expect(startCallback).not.toHaveBeenCalled();
    expect(completeCallback).not.toHaveBeenCalled();
  });

  // Regression: a throwing callback left the fired frame's id armed, so no later frame was ever
  // requested and every chart on the page lost animation.
  it('keeps the shared frame loop alive after a tween callback throws', () => {
    const throwing = makeManager();
    let updates = 0;
    throwing.tweenFocus(makeConfig(), makeFocusData().animationData, () => {
      if (++updates === 2) {
        throw new Error('render failed');
      }
    });
    let thrown: unknown = null;
    while (thrown === null && vi.getTimerCount() > 0) {
      try { vi.advanceTimersByTime(FRAME_MS); } catch (error) { thrown = error; }
    }
    expect(thrown).toEqual(new Error('render failed'));
    // the throwing tween is stopped, so it neither drives nor throws on later frames
    runFrames();
    expect(updates).toBe(2);

    const manager = makeManager();
    const updateCallback = vi.fn();
    const completeCallback = vi.fn();
    manager.tweenFocus(makeConfig(), makeFocusData().animationData, updateCallback, { completeCallback });
    runFrames();
    expect(updateCallback).toHaveBeenCalled();
    expect(completeCallback).toHaveBeenCalledTimes(1);
  });

  // Regression: an uncaught throw left the engine loop before the tweens registered after the
  // thrower, and the thrower re-fired its final frame every frame until something stopped it
  it('a throwing tween is stopped and the tweens after it still run in the same frame', () => {
    const throwing = makeManager();
    let throws = 0;
    throwing.tweenFocus(makeConfig(), makeFocusData().animationData, () => {
      throws++;
      throw new Error('render failed');
    });
    const manager = makeManager();
    const updateCallback = vi.fn();
    const completeCallback = vi.fn();
    manager.tweenFocus(makeConfig(), makeFocusData().animationData, updateCallback, { completeCallback });

    let thrown: unknown = null;
    while (thrown === null && vi.getTimerCount() > 0) {
      try { vi.advanceTimersByTime(FRAME_MS); } catch (error) { thrown = error; }
    }
    expect(thrown).toEqual(new Error('render failed'));
    // the later tween was reached in the frame that threw
    expect(updateCallback).toHaveBeenCalled();

    runFrames();
    expect(throws).toBe(1);
    expect(completeCallback).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  // Regression: a tween started from the final frame's updateCallback was clobbered by the
  // completing tween's wrapper and the replaced tween reported complete; now identity-guarded.
  it('keeps a tween started from the final frame cancelable, without completing the replaced tween', () => {
    const manager = makeManager();
    const first = makeFocusData();
    const second = makeFocusData();
    const firstComplete = vi.fn();
    const secondComplete = vi.fn();
    const secondUpdate = vi.fn();
    let reentered = false;

    manager.tweenFocus(makeConfig(), first.animationData, (focusData: unknown) => {
      if (focusData === first.final && !reentered) {
        reentered = true;
        // synchronous re-entry from the final frame
        manager.tweenFocus(makeConfig(), second.animationData, secondUpdate, { completeCallback: secondComplete });
      }
    }, { completeCallback: firstComplete });

    // 8 frames = 128ms: the first tween (5ms delay + 100ms) is done, the replacement is mid-flight
    for (let frame = 0; frame < 8; frame++) {
      vi.advanceTimersByTime(FRAME_MS);
    }
    expect(reentered).toBe(true);
    // the replaced tween was superseded mid-completion; superseded tweens do not complete
    expect(firstComplete).not.toHaveBeenCalled();

    // the replacement must still be governed by the manager: cancel stops it
    manager.cancelFocusTween();
    const updateCount = secondUpdate.mock.calls.length;
    runFrames();
    expect(secondUpdate.mock.calls.length).toBe(updateCount);
    expect(secondComplete).not.toHaveBeenCalled();
  });
});
