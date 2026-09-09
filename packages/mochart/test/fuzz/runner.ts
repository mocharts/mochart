// One fuzz case = one config property moved to one value on one base config, checked by the four
// tier-1 oracles. Findings are grouped as they are produced so a single bug reports once.
import { applyValue, type Candidate, type PropertySpec } from './configModel';
import { differencePath, diffSignature, diffSummary, scanGeometry, serializeDom } from './oracles';
import { mountContainer, pendingTimerCount, resetClock, runFrames, unmountContainer } from './environment';
import type { ChartHandle } from '../../src/createChart';
import type { ArrayOfObjectsData, DataProvider, ManagedChartProps, ObjectOfArraysData } from '../../src';

export type Library = typeof import('../../src');

export type Oracle = 'error' | 'geometry' | 'path-independence' | 'input-mutation';

export interface FindingSample {
  base: string;
  /** Index of the list-section entry the value was written to; omitted for the first entry. */
  entry?: number;
  value: string;
  stage: string;
  detail: string;
}

export interface FindingGroup {
  key: string;
  oracle: Oracle;
  property: string;
  signature: string;
  count: number;
  bases: string[];
  samples: FindingSample[];
}

export interface BaseCase {
  id: string;
  /** Raw (migrated) config, the input every case clones. */
  config: Record<string, unknown>;
  data: unknown;
}

export interface RunnerOptions {
  width: number;
  height: number;
  maxFrames: number;
}

export type CaseStatus = 'ran' | 'inapplicable' | 'invalid' | 'no-op' | 'data-mismatch';

const MAX_SAMPLES = 3;

export class Fuzzer {
  readonly stats = {
    cases: 0,
    inapplicable: 0,
    invalid: 0,
    dataMismatch: 0,
    noOp: 0,
    notSettled: 0,
    timersLeftAfterDestroy: 0
  };

  private readonly groups = new Map<string, FindingGroup>();
  /** List-section entry the case in flight writes to, stamped onto its findings. */
  private entry = 0;

  constructor(private readonly library: Library, private readonly options: RunnerOptions) {}

  /** Rehydrate a previous run's findings and counters, so `--resume` continues one report. */
  restore(findings: FindingGroup[], stats: Record<string, number>): void {
    for (const group of findings) {
      this.groups.set(group.key, group);
    }
    Object.assign(this.stats, stats);
  }

  getFindings(): FindingGroup[] {
    return [...this.groups.values()].sort((a, b) => b.count - a.count || a.property.localeCompare(b.property));
  }

  private record(oracle: Oracle, property: string, signature: string, sample: FindingSample): void {
    const key = oracle + '|' + property + '|' + signature;
    let group = this.groups.get(key);
    if (!group) {
      group = { key, oracle, property, signature, count: 0, bases: [], samples: [] };
      this.groups.set(key, group);
    }
    group.count++;
    if (!group.bases.includes(sample.base)) {
      group.bases.push(sample.base);
    }
    if (group.samples.length < MAX_SAMPLES) {
      group.samples.push(this.entry > 0 ? { ...sample, entry: this.entry } : sample);
    }
  }

  private makeProvider(data: unknown): DataProvider {
    return Array.isArray(data)
      ? new this.library.ArrayOfObjectsDataProvider(data as ArrayOfObjectsData)
      : new this.library.ObjectOfArraysDataProvider(data as ObjectOfArraysData);
  }

  /** A config its data cannot satisfy is out of contract for createChart — DefaultChartInput gates on the same check. */
  private hasDataMismatch(raw: Record<string, unknown>, data: unknown): boolean {
    const enhanced = this.library.enhanceConfig(structuredClone(raw));
    return this.library.getDataErrors(enhanced, this.makeProvider(structuredClone(data))).length > 0;
  }

  /** Render to a settled state, reporting a frame-cap overrun as an error finding. */
  private settle(property: string, base: string, value: string, stage: string): void {
    const { frames, settled } = runFrames(this.options.maxFrames);
    if (!settled) {
      this.stats.notSettled++;
      this.record('error', property, 'no-settle', {
        base, value, stage,
        detail: 'still had pending frames after ' + frames + ' frames — the chart never settles'
      });
    }
  }

  private capture(property: string, base: string, value: string, stage: string, container: HTMLElement): string {
    for (const issue of scanGeometry(container)) {
      this.record('geometry', property, issue.kind + ':' + issue.attribute, {
        base, value, stage,
        detail: issue.kind + ' in ' + issue.attribute + '="' + issue.value.slice(0, 160) + '" on ' + issue.element
      });
    }
    return serializeDom(container);
  }

  private createChart(container: HTMLElement, props: ManagedChartProps): ChartHandle {
    return this.library.createChart(container, props);
  }

  runCase(base: BaseCase, spec: PropertySpec, candidate: Candidate, entry = 0): CaseStatus {
    const rawB = structuredClone(base.config);
    if (!applyValue(rawB, spec, candidate.value, entry)) {
      this.stats.inapplicable++;
      return 'inapplicable';
    }
    if (JSON.stringify(rawB) === JSON.stringify(base.config)) {
      this.stats.noOp++;
      return 'no-op';
    }
    if (!this.library.validateConfig(rawB).valid) {
      this.stats.invalid++;
      return 'invalid';
    }
    if (this.hasDataMismatch(rawB, base.data)) {
      this.stats.dataMismatch++;
      return 'data-mismatch';
    }
    this.stats.cases++;
    this.execute(base, spec.id, candidate.label, rawB, null, entry);
    return 'ran';
  }

  /** One case for a config/data shape change: adding, removing or reordering entries and rows. */
  runStructuralCase(base: BaseCase, property: string, label: string, config: Record<string, unknown>, data: unknown | null): CaseStatus {
    if (!this.library.validateConfig(config).valid) {
      this.stats.invalid++;
      return 'invalid';
    }
    if (this.hasDataMismatch(config, data ?? base.data)) {
      this.stats.dataMismatch++;
      return 'data-mismatch';
    }
    this.stats.cases++;
    this.execute(base, property, label, config, data, 0);
    return 'ran';
  }

  private execute(base: BaseCase, property: string, value: string, rawB: Record<string, unknown>, dataB: unknown | null, entry: number): void {
    this.entry = entry;
    const consoleMessages: string[] = [];
    const restoreConsole = captureConsole(consoleMessages);
    const containerA = mountContainer();
    const containerB = mountContainer();
    let chartA: ChartHandle | null = null;
    let chartB: ChartHandle | null = null;
    let stage = 'setup';
    try {
      const rawA = structuredClone(base.config);
      const enhancedA = this.enhance(rawA, property, base.id, value, 'enhance-A');
      const enhancedB = this.enhance(rawB, property, base.id, value, 'enhance-B');
      const enhancedBFresh = this.enhance(structuredClone(rawB), property, base.id, value, 'enhance-B-fresh');

      const rowsA = structuredClone(base.data);
      const rowsB = structuredClone(dataB ?? base.data);
      const rowsRevert = structuredClone(base.data);
      const guardedA = safeClone(enhancedA);
      const guardedB = safeClone(enhancedB);
      const guardedRowsA = safeClone(rowsA);
      const guardedRowsB = safeClone(rowsB);
      const guardedRowsRevert = safeClone(rowsRevert);

      stage = 'render-A';
      chartA = this.createChart(containerA, {
        mochartConfig: enhancedA,
        dataProvider: this.makeProvider(rowsA),
        width: this.options.width,
        height: this.options.height
      });
      this.settle(property, base.id, value, stage);
      const domA = this.capture(property, base.id, value, stage, containerA);

      stage = 'update-A-to-B';
      chartA.update(dataB === null ? { mochartConfig: enhancedB }
        : { mochartConfig: enhancedB, dataProvider: this.makeProvider(structuredClone(dataB)) });
      this.settle(property, base.id, value, stage);
      const domAB = this.capture(property, base.id, value, stage, containerA);

      stage = 'render-B';
      chartB = this.createChart(containerB, {
        mochartConfig: enhancedBFresh,
        dataProvider: this.makeProvider(rowsB),
        width: this.options.width,
        height: this.options.height
      });
      this.settle(property, base.id, value, stage);
      const domB = this.capture(property, base.id, value, stage, containerB);

      stage = 'update-B-to-A';
      chartA.update(dataB === null ? { mochartConfig: enhancedA }
        : { mochartConfig: enhancedA, dataProvider: this.makeProvider(rowsRevert) });
      this.settle(property, base.id, value, stage);
      const domABA = this.capture(property, base.id, value, stage, containerA);

      if (domAB !== domB) {
        this.record('path-independence', property, 'update:' + diffSignature(domB, domAB), {
          base: base.id, value, stage: 'A→B vs B',
          detail: 'updating to this value does not reach the same DOM as building it directly\n' + diffSummary(domB, domAB)
        });
      }
      if (domABA !== domA) {
        this.record('path-independence', property, 'revert:' + diffSignature(domA, domABA), {
          base: base.id, value, stage: 'A→B→A vs A',
          detail: 'reverting this value does not return to the original DOM\n' + diffSummary(domA, domABA)
        });
      }

      stage = 'input-mutation';
      this.checkUnchanged(guardedA, enhancedA, property, base.id, value, 'the config passed to createChart/update (A)');
      this.checkUnchanged(guardedB, enhancedB, property, base.id, value, 'the config passed to update (B)');
      this.checkUnchanged(guardedRowsA, rowsA, property, base.id, value, 'the data rows behind chart A');
      this.checkUnchanged(guardedRowsB, rowsB, property, base.id, value, 'the data rows behind chart B');
      this.checkUnchanged(guardedRowsRevert, rowsRevert, property, base.id, value, 'the data rows passed when reverting');
    }
    catch (error) {
      this.record('error', property, errorSignature(error), {
        base: base.id, value, stage,
        detail: errorDetail(error)
      });
    }
    finally {
      restoreConsole();
      this.destroy(chartA, property, base.id, value);
      this.destroy(chartB, property, base.id, value);
      unmountContainer(containerA as HTMLDivElement);
      unmountContainer(containerB as HTMLDivElement);
      if (pendingTimerCount() > 0) {
        this.stats.timersLeftAfterDestroy++;
      }
      resetClock();
      for (const message of consoleMessages) {
        this.record('error', property, 'console:' + message.slice(0, 80), {
          base: base.id, value, stage, detail: message.slice(0, 400)
        });
      }
    }
  }

  private enhance(raw: Record<string, unknown>, property: string, base: string, value: string, stage: string) {
    const guarded = safeClone(raw);
    const enhanced = this.library.enhanceConfig(raw);
    this.checkUnchanged(guarded, raw, property, base, value, 'the raw config passed to enhanceConfig (' + stage + ')');
    return enhanced;
  }

  private checkUnchanged(before: unknown, after: unknown, property: string, base: string, value: string, target: string): void {
    if (before === undefined) {
      return;
    }
    const difference = differencePath(before, after);
    if (difference !== null) {
      this.record('input-mutation', property, target + ' @ ' + difference, {
        base, value, stage: 'input-mutation',
        detail: 'the library mutated ' + target + ' at `' + difference + '`'
      });
    }
  }

  private destroy(chart: ChartHandle | null, property: string, base: string, value: string): void {
    if (!chart) {
      return;
    }
    try {
      chart.destroy();
    }
    catch (error) {
      this.record('error', property, 'destroy:' + errorSignature(error), {
        base, value, stage: 'destroy', detail: errorDetail(error)
      });
    }
  }
}

/** A config holding something unclonable cannot be guarded; skip its mutation check rather than fail the case. */
function safeClone<T>(value: T): T | undefined {
  try {
    return structuredClone(value);
  }
  catch {
    return undefined;
  }
}

function captureConsole(messages: string[]): () => void {
  const originalError = console.error;
  const originalWarn = console.warn;
  const collect = (...args: unknown[]) => {
    messages.push(args.map(argument => String(argument)).join(' '));
  };
  console.error = collect;
  console.warn = collect;
  return () => {
    console.error = originalError;
    console.warn = originalWarn;
  };
}

function errorSignature(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const frame = error instanceof Error && error.stack
    ? (error.stack.split('\n').find(line => line.includes('/src/')) ?? '').trim().slice(0, 120)
    : '';
  return message.split('\n')[0]!.slice(0, 120) + (frame ? ' @ ' + frame : '');
}

function errorDetail(error: unknown): string {
  if (!(error instanceof Error)) {
    return String(error);
  }
  const frames = (error.stack ?? '').split('\n').slice(1, 6).map(line => line.trim()).join('\n');
  return error.message + '\n' + frames;
}
