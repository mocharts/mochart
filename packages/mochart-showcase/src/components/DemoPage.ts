// The demo page: chart on top (always visible), a control strip driven by the
// entry's capabilities (seed stepper/play for demos with a random spec, plus
// the specials' extra controls), and Config / Data / About tabs below, which
// the desktop layout moves into a side-by-side right panel via CSS only.

import { ArrayOfObjectsDataProvider, EASINGS } from '@mochart/core';
import type { AnimationEasing } from '@mochart/core';
import { exportPNG, exportSVG } from '@mochart/export';
import { createMochartConfigSupport } from '@mochart/editor';
import {
  buildMochartDemoConfig, generateDemoDataProvider, getChartExportOptions,
  getReferenceSectionIds, getReferenceSectionUrl, rotationConfigs, rotationData
} from '@mochart/demo-common';

import type { ThemeController } from '../app/theme';
import type { DataObject, DemoConfig } from '@mochart/demo-data';

import { button, el, segmented, toast } from '../ui/dom';
import { getSearchParams, replaceSearchParams } from '../app/router';
import { buildShareUrl, consumeShareState } from '../state/share';
import { mountChart } from './chartHost';
import { jsonPanel } from './EditorPanel';
import type { JsonPanelHandle } from './EditorPanel';
import type { ShowcaseEntry } from '../content/types';

type MochartDemoConfig = ReturnType<typeof buildMochartDemoConfig>;

export interface DemoPageProps {
  entry: ShowcaseEntry;
  theme: ThemeController;
  onBack: () => void;
}

export interface DemoPageHandle {
  el: HTMLElement;
  destroy(): void;
}

type TabId = 'config' | 'data' | 'about';
type StateMode = 'data' | 'loading' | 'error' | 'empty';

const PLAY_INTERVAL_MS = 2400;
const ROTATION_INTERVAL_MS = 1600;
const SEED_HINT = 'The chart is showing data generated from the seed in the URL. The JSON below is the curated dataset. Applying an edit (or Reset) returns to it.';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Scale the config's staged-animation durations for the player's slow motion. */
function withAnimationSpeed(config: DemoConfig, speed: number): DemoConfig {
  const factor = 1 / speed;
  const animation: Record<string, unknown> = isPlainObject(config.animation) ? { ...config.animation } : {};
  for (const key of ['initialDuration', 'expansionDuration', 'valueChangeDuration', 'contractionDuration', 'focusDuration']) {
    const base = typeof animation[key] === 'number' ? animation[key] as number : 1000;
    animation[key] = Math.round(base * factor);
  }
  return { ...config, animation };
}

export function demoPage(props: DemoPageProps): DemoPageHandle {
  const { entry, theme } = props;

  // --- state ---------------------------------------------------------------

  const share = consumeShareState(entry.slug);
  let config: DemoConfig = share?.config ?? structuredClone(entry.config);
  let rows: DataObject[] = share?.data ?? structuredClone(entry.data);
  let configDirty = share?.config !== undefined;
  let dataDirty = share?.data !== undefined;

  const seedParam = getSearchParams().get('seed');
  let seed: number | null = seedParam !== null && /^-?\d+$/.test(seedParam) ? Number(seedParam) : null;

  let speed = 1;
  let stateMode: StateMode = 'data';
  let rotationIndex = 0;
  let playing = false;
  let playTimer: ReturnType<typeof setInterval> | null = null;

  let filteredSeriesIds: Record<string, boolean> = {};
  let focusedValueAxisId: string | null = null;
  let focusedSeriesId: string | null = null;
  let focusedCategoryIndex = -1;

  if (entry.special === 'rotation') {
    config = structuredClone(rotationConfigs[rotationIndex]) as DemoConfig;
    rows = structuredClone(rotationData) as DataObject[];
  }

  let demoConfig: MochartDemoConfig = buildDemoConfig();

  function effectiveConfig(): DemoConfig {
    return entry.special === 'player' ? withAnimationSpeed(config, speed) : config;
  }

  function buildDemoConfig(): MochartDemoConfig {
    // Always hand the builder a clone: buildMochartConfig wires back-references
    // into the section objects it is given, and rebuilding from an already-
    // built (circular) config would recurse forever.
    return buildMochartDemoConfig(structuredClone(effectiveConfig()));
  }

  // Focus and filter updates reuse the provider: a rebuilt one counts as a
  // data change on every hover and re-derives the data each time.
  interface ProviderInputs { demoConfig: MochartDemoConfig; stateMode: StateMode; seed: number | null; rows: DataObject[] }
  let cachedProvider: { inputs: ProviderInputs; provider: unknown } | null = null;

  function buildDataProvider(): unknown {
    const inputs: ProviderInputs = { demoConfig, stateMode, seed, rows };
    const cached = cachedProvider;
    if (cached !== null && (Object.keys(inputs) as (keyof ProviderInputs)[]).every(key => cached.inputs[key] === inputs[key])) {
      return cached.provider;
    }
    const provider = createDataProvider();
    cachedProvider = { inputs, provider };
    return provider;
  }

  function createDataProvider(): unknown {
    if (!demoConfig.valid) {
      return null;
    }
    if (stateMode === 'error') {
      return { getError: () => 'Example upstream failure: the data service returned 503.' };
    }
    if (stateMode === 'empty') {
      return new ArrayOfObjectsDataProvider([]);
    }
    if (seed !== null && entry.random !== undefined) {
      return generateDemoDataProvider(entry.generator, demoConfig.mochartConfig, entry.random, seed);
    }
    return new ArrayOfObjectsDataProvider(structuredClone(rows));
  }

  // --- chart ---------------------------------------------------------------

  const logEntries = el('ul', { className: 'sc-log-entries' });
  const logMoveLine = el('div', { className: 'sc-log-move', text: 'pointer: outside plot' });
  // shown by css only while the entry list is empty, so the reserved box reads as waiting rather than blank
  const logHint = el('div', { className: 'sc-log-hint', text: 'click or hover the chart to see callbacks fire' });
  const logRegion = entry.special === 'callbacks'
    ? el('div', { className: 'sc-log sc-demo-log', attrs: { 'aria-label': 'Event log' } }, [logMoveLine, logEntries, logHint])
    : null;

  function logEvent(kind: string, detail: string): void {
    if (logRegion === null) {
      return;
    }
    const item = el('li', {}, [
      el('span', { className: 'sc-log-kind', text: kind }),
      el('span', { text: ' ' + detail })
    ]);
    logEntries.prepend(item);
    while (logEntries.children.length > 8) {
      logEntries.lastElementChild?.remove();
    }
  }

  function chartProps(): Record<string, unknown> {
    return {
      mochartConfig: demoConfig.mochartConfig,
      dataProvider: buildDataProvider(),
      loading: stateMode === 'loading',
      filteredSeriesIds,
      focusedValueAxisId,
      focusedSeriesId,
      focusedCategoryIndex,
      // Both handlers bail when nothing changed: the chart notifies focus and
      // filter resets from inside update() (FocusController.reconcile), so an
      // unconditional re-update here would recurse forever.
      onFocus(focus: { focusedValueAxisId?: string | null; focusedSeriesId?: string | null; focusedCategoryIndex?: number }) {
        const nextAxisId = focus.focusedValueAxisId ?? null;
        const nextSeriesId = focus.focusedSeriesId ?? null;
        const nextCategoryIndex = focus.focusedCategoryIndex ?? -1;
        if (nextAxisId === focusedValueAxisId && nextSeriesId === focusedSeriesId && nextCategoryIndex === focusedCategoryIndex) {
          return;
        }
        focusedValueAxisId = nextAxisId;
        focusedSeriesId = nextSeriesId;
        focusedCategoryIndex = nextCategoryIndex;
        logEvent('onFocus', `series=${focusedSeriesId ?? 'none'} category=${focusedCategoryIndex}`);
        updateChart();
      },
      onSeriesFilter(filter: { filteredSeriesIds: Record<string, boolean> }) {
        const next = filter.filteredSeriesIds;
        const sameKeys = Object.keys(next).length === Object.keys(filteredSeriesIds).length
          && Object.keys(next).every(id => next[id] === filteredSeriesIds[id]);
        if (sameKeys) {
          return;
        }
        filteredSeriesIds = next;
        logEvent('onSeriesFilter', 'hidden: ' + (Object.keys(filteredSeriesIds).filter(id => filteredSeriesIds[id]).join(', ') || 'none'));
        updateChart();
      },
      onChartClick(event: { categoryIndex: number; chartX: number; chartY: number }) {
        logEvent('onChartClick', `category=${event.categoryIndex} at ${Math.round(event.chartX)},${Math.round(event.chartY)}`);
      },
      onSeriesClick(payload: { seriesId: string; categoryIndex: number }) {
        logEvent('onSeriesClick', `${payload.seriesId} category=${payload.categoryIndex}`);
      },
      onSliceClick(payload: { seriesId: string }) {
        logEvent('onSliceClick', payload.seriesId);
      },
      onChartMouseEnter() {
        logEvent('onChartMouseEnter', '');
      },
      onChartMouseLeave() {
        logMoveLine.textContent = 'pointer: outside plot';
        logEvent('onChartMouseLeave', '');
      },
      onChartMouseMove(event: { chartX: number; chartY: number; categoryIndex: number }) {
        logMoveLine.textContent = `pointer: ${Math.round(event.chartX)},${Math.round(event.chartY)} (category ${event.categoryIndex})`;
      }
    };
  }

  const chartHost = mountChart(chartProps(), { className: 'sc-chart-host' });

  function updateChart(): void {
    chartHost.update(chartProps());
  }

  // --- seed / play ---------------------------------------------------------

  function writeSeedToUrl(): void {
    const params = getSearchParams();
    if (seed === null) {
      params.delete('seed');
    }
    else {
      params.set('seed', String(seed));
    }
    replaceSearchParams(params);
  }

  function setSeed(next: number | null): void {
    seed = next;
    writeSeedToUrl();
    syncControls();
    updateChart();
    dataPanel?.setHint(seed !== null ? SEED_HINT : null);
  }

  function stopPlaying(): void {
    if (playTimer !== null) {
      clearInterval(playTimer);
      playTimer = null;
    }
    playing = false;
    syncControls();
  }

  function togglePlaying(): void {
    if (playing) {
      stopPlaying();
      return;
    }
    playing = true;
    if (entry.special === 'rotation') {
      playTimer = setInterval(() => stepRotation(1), ROTATION_INTERVAL_MS);
    }
    else {
      const interval = entry.special === 'player' ? Math.round(PLAY_INTERVAL_MS / Math.min(speed, 1)) + 800 : PLAY_INTERVAL_MS;
      playTimer = setInterval(() => setSeed((seed ?? 0) + 1), interval);
    }
    syncControls();
  }

  function stepRotation(delta: number): void {
    rotationIndex = (rotationIndex + delta + rotationConfigs.length) % rotationConfigs.length;
    config = structuredClone(rotationConfigs[rotationIndex]) as DemoConfig;
    configDirty = false;
    demoConfig = buildDemoConfig();
    configPanel?.setValue(JSON.stringify(config, null, 2));
    syncControls();
    updateChart();
  }

  // --- control strip -------------------------------------------------------

  const seedValue = el('span', { className: 'sc-seed-value' });
  const prevButton = button({
    icon: 'chevron-left', ariaLabel: 'Previous step', title: 'Previous step',
    onClick: () => entry.special === 'rotation' ? stepRotation(-1) : setSeed(Math.max(0, (seed ?? 0) - 1))
  });
  const nextButton = button({
    icon: 'chevron-right', ariaLabel: 'Next step', title: 'Next step',
    onClick: () => entry.special === 'rotation' ? stepRotation(1) : setSeed((seed ?? 0) + 1)
  });
  const diceButton = button({
    icon: 'dice', label: 'Randomize', ariaLabel: 'Randomize data', title: 'Generate the next dataset (deterministic per seed)',
    onClick: () => setSeed((seed ?? 0) + 1)
  });
  const playButton = button({
    icon: 'play', label: 'Play', ariaLabel: 'Play transitions', title: 'Step automatically',
    onClick: togglePlaying
  });
  const resetSeedButton = button({
    icon: 'undo', ariaLabel: 'Back to curated data', title: 'Back to the curated dataset',
    onClick: () => {
      stopPlaying();
      setSeed(null);
    }
  });

  const speedControl = entry.special === 'player'
    ? segmented<'0.25' | '0.5' | '1'>({
        ariaLabel: 'Animation speed',
        value: '1',
        options: [
          { value: '0.25', label: '¼×' },
          { value: '0.5', label: '½×' },
          { value: '1', label: '1×' }
        ],
        onChange(value) {
          speed = Number(value);
          demoConfig = buildDemoConfig();
          updateChart();
        }
      })
    : null;

  // The easing picker writes into the config itself, so the config tab and a
  // shared link both carry the chosen easing.
  function easingPicker(): HTMLSelectElement {
    const animation = isPlainObject(config.animation) ? config.animation : {};
    const select = el('select', { className: 'sc-select', attrs: { 'aria-label': 'Easing', title: 'Easing for value changes and focus' } },
      EASINGS.map(name => el('option', { attrs: { value: name }, text: name })));
    select.value = typeof animation.easing === 'string' ? animation.easing : 'sineInOut';
    select.addEventListener('change', () => {
      const current = isPlainObject(config.animation) ? config.animation : {};
      const easing = select.value as AnimationEasing;
      config = { ...config, animation: { ...current, easing, focusEasing: easing } };
      configDirty = true;
      demoConfig = buildDemoConfig();
      configPanel?.setValue(JSON.stringify(config, null, 2));
      updateChart();
    });
    return select;
  }
  const easingControl = entry.special === 'easing' ? easingPicker() : null;

  const stateControl = entry.special === 'states'
    ? segmented<StateMode>({
        ariaLabel: 'Chart state',
        value: 'data',
        options: [
          { value: 'data', label: 'Data' },
          { value: 'loading', label: 'Loading' },
          { value: 'error', label: 'Error' },
          { value: 'empty', label: 'Empty' }
        ],
        onChange(value) {
          stateMode = value;
          updateChart();
        }
      })
    : null;

  function syncControls(): void {
    if (entry.special === 'rotation') {
      seedValue.textContent = `Layout ${rotationIndex + 1}/${rotationConfigs.length}`;
    }
    else {
      seedValue.textContent = seed === null ? 'Curated' : `Seed ${seed}`;
    }
    playButton.setIcon(playing ? 'pause' : 'play');
    playButton.setLabel(playing ? 'Pause' : 'Play');
    prevButton.setDisabled(entry.special !== 'rotation' && (seed === null || seed <= 0));
    resetSeedButton.setDisabled(seed === null);
  }

  const hasSeedControls = entry.random !== undefined && entry.special !== 'rotation' && entry.special !== 'states';
  const controlStrip = el('div', { className: 'sc-controls' });
  if (entry.special === 'rotation') {
    controlStrip.append(prevButton.el, seedValue, nextButton.el, playButton.el);
  }
  else if (hasSeedControls) {
    controlStrip.append(diceButton.el, prevButton.el, seedValue, nextButton.el, playButton.el, resetSeedButton.el);
  }
  if (speedControl !== null) {
    controlStrip.append(speedControl.el);
  }
  if (stateControl !== null) {
    controlStrip.append(stateControl.el);
  }
  if (easingControl !== null) {
    controlStrip.append(easingControl);
  }
  syncControls();

  // --- tabs & panels -------------------------------------------------------

  let configPanel: JsonPanelHandle | null = null;
  let dataPanel: JsonPanelHandle | null = null;

  function applyParsedConfig(parsed: unknown): void {
    if (!isPlainObject(parsed)) {
      return;
    }
    config = parsed as DemoConfig;
    configDirty = true;
    demoConfig = buildDemoConfig();
    updateChart();
  }

  function applyParsedData(parsed: unknown): void {
    if (!Array.isArray(parsed) || parsed.some(row => !isPlainObject(row))) {
      return;
    }
    rows = parsed as DataObject[];
    dataDirty = true;
    if (seed !== null) {
      stopPlaying();
      setSeed(null);
    }
    else {
      updateChart();
    }
  }

  function ensureConfigPanel(): JsonPanelHandle {
    if (configPanel === null) {
      configPanel = jsonPanel({
        ariaLabel: 'Chart configuration',
        initialValue: JSON.stringify(config, null, 2),
        dark: theme.isDark(),
        support: createMochartConfigSupport(),
        onParsed: applyParsedConfig,
        onReset: () => {
          config = entry.special === 'rotation'
            ? structuredClone(rotationConfigs[rotationIndex]) as DemoConfig
            : structuredClone(entry.config);
          configDirty = false;
          demoConfig = buildDemoConfig();
          configPanel?.setValue(JSON.stringify(config, null, 2));
          updateChart();
        }
      });
    }
    return configPanel;
  }

  function ensureDataPanel(): JsonPanelHandle {
    if (dataPanel === null) {
      dataPanel = jsonPanel({
        ariaLabel: 'Chart data',
        initialValue: JSON.stringify(rows, null, 2),
        dark: theme.isDark(),
        onParsed: applyParsedData,
        onReset: () => {
          rows = structuredClone(entry.data);
          dataDirty = false;
          dataPanel?.setValue(JSON.stringify(rows, null, 2));
          if (seed !== null) {
            stopPlaying();
            setSeed(null);
          }
          else {
            updateChart();
          }
        }
      });
      dataPanel.setHint(seed !== null ? SEED_HINT : null);
    }
    return dataPanel;
  }

  function aboutPanel(): HTMLElement {
    const sectionsUsed = getReferenceSectionIds(entry.config as Record<string, unknown>);
    const links = el('ul', { className: 'sc-about-links' }, sectionsUsed.map(id =>
      el('li', {}, [
        el('a', { attrs: { href: getReferenceSectionUrl(id) }, text: id })
      ])
    ));
    return el('div', { className: 'sc-about' }, [
      el('p', { className: 'sc-about-blurb', text: entry.blurb }),
      entry.notes !== undefined ? el('p', { className: 'sc-about-notes', text: entry.notes }) : null,
      sectionsUsed.length > 0 ? el('h3', { text: 'Config reference' }) : null,
      sectionsUsed.length > 0 ? links : null
    ]);
  }

  const panelHost = el('div', { className: 'sc-panel-host' });

  function showTab(tab: TabId): void {
    if (tab === 'config') {
      panelHost.replaceChildren(ensureConfigPanel().el);
    }
    else if (tab === 'data') {
      panelHost.replaceChildren(ensureDataPanel().el);
    }
    else {
      panelHost.replaceChildren(aboutPanel());
    }
  }

  const tabs = segmented<TabId>({
    ariaLabel: 'Demo panels',
    value: 'config',
    options: [
      { value: 'config', label: 'Config' },
      { value: 'data', label: 'Data' },
      { value: 'about', label: 'About' }
    ],
    onChange: showTab
  });

  // --- app bar -------------------------------------------------------------

  const backButton = button({ icon: 'arrow-left', ariaLabel: 'Back to gallery', title: 'Back to gallery', variant: 'sc-btn-quiet', onClick: props.onBack });
  const themeButton = button({
    icon: theme.isDark() ? 'sun' : 'moon',
    ariaLabel: 'Toggle color theme', title: 'Toggle color theme', variant: 'sc-btn-quiet',
    onClick: () => theme.toggle()
  });
  const shareButton = button({
    icon: 'link', ariaLabel: 'Copy share link', title: 'Copy a link to this exact chart', variant: 'sc-btn-quiet',
    onClick: () => {
      const url = buildShareUrl({
        v: 1,
        slug: entry.slug,
        config: configDirty ? config : undefined,
        data: dataDirty ? rows : undefined
      });
      void navigator.clipboard.writeText(url).then(
        () => toast('Link copied'),
        () => {
          window.prompt('Copy this link', url);
        }
      );
    }
  });

  const exportMenu = el('div', { className: 'sc-menu', attrs: { hidden: '' } }, [
    el('button', { className: 'sc-menu-item', attrs: { type: 'button' }, text: 'Download SVG' }),
    el('button', { className: 'sc-menu-item', attrs: { type: 'button' }, text: 'Download PNG' })
  ]);
  (exportMenu.children[0] as HTMLElement).addEventListener('click', () => {
    exportSVG(chartHost.el, getChartExportOptions());
    closeExportMenu();
  });
  (exportMenu.children[1] as HTMLElement).addEventListener('click', () => {
    void exportPNG(chartHost.el, getChartExportOptions());
    closeExportMenu();
  });
  const exportButton = button({
    icon: 'download', ariaLabel: 'Export chart', title: 'Export as SVG or PNG', variant: 'sc-btn-quiet',
    onClick: () => {
      if (exportMenu.hasAttribute('hidden')) {
        exportMenu.removeAttribute('hidden');
      }
      else {
        exportMenu.setAttribute('hidden', '');
      }
    }
  });
  function closeExportMenu(): void {
    exportMenu.setAttribute('hidden', '');
  }
  const onDocumentPointerDown = (event: PointerEvent): void => {
    if (!exportMenu.hasAttribute('hidden') && event.target instanceof Node
        && !exportMenu.contains(event.target) && !exportButton.el.contains(event.target)) {
      closeExportMenu();
    }
  };
  document.addEventListener('pointerdown', onDocumentPointerDown);

  const exportWrap = el('div', { className: 'sc-menu-wrap' }, [exportButton.el, exportMenu]);

  const appBar = el('header', { className: 'sc-appbar' }, [
    backButton.el,
    el('h1', { className: 'sc-appbar-title', text: entry.title }),
    el('div', { className: 'sc-appbar-actions' }, [themeButton.el, shareButton.el, exportWrap])
  ]);

  const unsubscribeTheme = theme.onChange(dark => {
    themeButton.setIcon(dark ? 'sun' : 'moon');
    configPanel?.setTheme(dark);
    dataPanel?.setTheme(dark);
  });

  // --- assembly ------------------------------------------------------------

  // the log is a sibling of the chart region, not a child: the region is a fixed 45dvh band on a
  // phone, so a log inside it would take its height off the chart instead of off the scrolling page
  const chartRegion = el('div', { className: 'sc-chart-region' }, [chartHost.el]);

  const container = el('div', { className: 'sc-demo-page' }, [
    appBar,
    el('div', { className: 'sc-demo-layout' }, [
      el('div', { className: 'sc-demo-main' }, [
        chartRegion,
        logRegion,
        controlStrip.childElementCount > 0 ? controlStrip : null
      ]),
      el('div', { className: 'sc-demo-side' }, [tabs.el, panelHost])
    ])
  ]);

  showTab('config');

  return {
    el: container,
    destroy() {
      stopPlaying();
      document.removeEventListener('pointerdown', onDocumentPointerDown);
      unsubscribeTheme();
      configPanel?.destroy();
      dataPanel?.destroy();
      chartHost.destroy();
    }
  };
}
