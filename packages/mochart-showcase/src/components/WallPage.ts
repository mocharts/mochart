// The wall: a desktop-only grid of charts driven by one shared seed, so a
// single Randomize (or Play) makes the whole board transition together. The
// selection and seed live in the URL (/wall?d=a,b,c&seed=n) so any wall is a
// shareable link.

import { buildMochartDemoConfig, generateDemoDataProvider } from '@mochart/demo-common';
import type { ThemeController } from '../app/theme';

import { defaultWallSlugs, getEntry, getWallEntries } from '../content/manifest';
import type { ShowcaseEntry } from '../content/types';
import { randomForSeed } from '../content/randomForSeed';
import { getSearchParams, replaceSearchParams } from '../app/router';
import { MAX_SEED, nextSeed, parseSeed } from '../state/seed';
import { isDesktopViewport, watchDesktopViewport } from '../app/viewport';
import { button, el, toast } from '../ui/dom';
import { mountChart } from './chartHost';
import type { ChartHostHandle } from './chartHost';

export interface WallPageProps {
  theme: ThemeController;
  onBack: () => void;
}

export interface WallPageHandle {
  el: HTMLElement;
  destroy(): void;
}

const WALL_PLAY_INTERVAL_MS = 3000;

interface Tile {
  entry: ShowcaseEntry;
  demoConfig: ReturnType<typeof buildMochartDemoConfig>;
  chart: ChartHostHandle;
  el: HTMLElement;
}

export function wallPage(props: WallPageProps): WallPageHandle {
  const { theme } = props;

  const params = getSearchParams();
  const requested = (params.get('d') ?? '').split(',').map(s => s.trim()).filter(s => s !== '');
  let slugs = requested
    .filter(slug => {
      const entry = getEntry(slug);
      return entry !== undefined && entry.wall;
    });
  if (slugs.length === 0) {
    slugs = defaultWallSlugs.slice();
  }
  let seed = parseSeed(params.get('seed')) ?? 0;
  let playing = false;
  let playTimer: ReturnType<typeof setInterval> | null = null;

  const tiles = new Map<string, Tile>();

  function writeUrl(): void {
    const next = getSearchParams();
    next.set('d', slugs.join(','));
    next.set('seed', String(seed));
    replaceSearchParams(next);
  }

  function tileProps(tile: Pick<Tile, 'entry' | 'demoConfig'>): Record<string, unknown> {
    const { entry, demoConfig } = tile;
    return {
      mochartConfig: demoConfig.mochartConfig,
      dataProvider: demoConfig.valid && entry.random !== undefined
        ? generateDemoDataProvider(entry.generator, demoConfig.mochartConfig, randomForSeed(entry.random, seed, entry.walkBounds), seed)
        : null
    };
  }

  function makeTile(entry: ShowcaseEntry): Tile {
    // Built once per tile: buildMochartConfig wires back-references into the
    // config it is given, so it must not be re-run on the same object (and a
    // seed step only needs a new data provider anyway).
    const demoConfig = buildMochartDemoConfig(structuredClone(entry.config));
    const chart = mountChart(tileProps({ entry, demoConfig }), { className: 'sc-tile-chart' });
    const element = el('div', { className: 'sc-tile' }, [
      el('h3', { className: 'sc-tile-title', text: entry.title }),
      chart.el
    ]);
    return { entry, demoConfig, chart, el: element };
  }

  const grid = el('main', { className: 'sc-wall-grid' });

  function syncGrid(): void {
    for (const [slug, tile] of [...tiles]) {
      if (!slugs.includes(slug)) {
        tile.chart.destroy();
        tile.el.remove();
        tiles.delete(slug);
      }
    }
    const ordered: HTMLElement[] = [];
    for (const slug of slugs) {
      let tile = tiles.get(slug);
      if (tile === undefined) {
        const entry = getEntry(slug);
        if (entry === undefined) {
          continue;
        }
        tile = makeTile(entry);
        tiles.set(slug, tile);
      }
      ordered.push(tile.el);
    }
    grid.replaceChildren(...ordered);
  }

  function setSeed(next: number): void {
    seed = next;
    writeUrl();
    syncSeedLabel();
    for (const tile of tiles.values()) {
      tile.chart.update(tileProps(tile));
    }
  }

  function stopPlaying(): void {
    if (playTimer !== null) {
      clearInterval(playTimer);
      playTimer = null;
    }
    playing = false;
    playButton.setIcon('play');
    playButton.setLabel('Play');
  }

  function togglePlaying(): void {
    if (playing) {
      stopPlaying();
      return;
    }
    playing = true;
    playButton.setIcon('pause');
    playButton.setLabel('Pause');
    playTimer = setInterval(() => seed >= MAX_SEED ? stopPlaying() : setSeed(nextSeed(seed)), WALL_PLAY_INTERVAL_MS);
  }

  // --- picker --------------------------------------------------------------

  const picker = el('div', { className: 'sc-picker', attrs: { hidden: '' } });
  function renderPicker(): void {
    picker.replaceChildren(el('h2', { className: 'sc-picker-title', text: 'Charts on the wall' }));
    for (const entry of getWallEntries()) {
      const checkbox = el('input', { attrs: { type: 'checkbox', id: 'wall-' + entry.slug } });
      checkbox.checked = slugs.includes(entry.slug);
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) {
          slugs = [...slugs, entry.slug];
        }
        else if (slugs.length > 1) {
          slugs = slugs.filter(slug => slug !== entry.slug);
        }
        else {
          checkbox.checked = true;
          return;
        }
        writeUrl();
        syncGrid();
      });
      picker.append(el('label', { className: 'sc-picker-item', attrs: { for: 'wall-' + entry.slug } }, [
        checkbox,
        el('span', { text: entry.title })
      ]));
    }
  }
  renderPicker();

  const pickerButton = button({
    icon: 'sliders', label: 'Charts', ariaLabel: 'Choose charts', title: 'Choose which charts are on the wall',
    onClick: () => {
      if (picker.hasAttribute('hidden')) {
        picker.removeAttribute('hidden');
      }
      else {
        picker.setAttribute('hidden', '');
      }
    }
  });

  // --- app bar -------------------------------------------------------------

  const backButton = button({ icon: 'arrow-left', ariaLabel: 'Back to gallery', title: 'Back to gallery', variant: 'sc-btn-quiet', onClick: props.onBack });
  const themeButton = button({
    icon: theme.isDark() ? 'sun' : 'moon',
    ariaLabel: 'Toggle color theme', title: 'Toggle color theme', variant: 'sc-btn-quiet',
    onClick: () => theme.toggle()
  });
  const unsubscribeTheme = theme.onChange(dark => themeButton.setIcon(dark ? 'sun' : 'moon'));
  const shareButton = button({
    icon: 'link', ariaLabel: 'Copy wall link', title: 'Copy a link to this wall', variant: 'sc-btn-quiet',
    onClick: () => {
      const url = window.location.href;
      void navigator.clipboard.writeText(url).then(
        () => toast('Link copied'),
        () => {
          window.prompt('Copy this link', url);
        }
      );
    }
  });
  const diceButton = button({
    icon: 'dice', label: 'Randomize', ariaLabel: 'Randomize all charts', title: 'Step every chart to the next dataset',
    onClick: () => setSeed(nextSeed(seed))
  });
  const playButton = button({
    icon: 'play', label: 'Play', ariaLabel: 'Play transitions', title: 'Step all charts automatically',
    onClick: togglePlaying
  });

  const seedValue = el('span', { className: 'sc-seed-value' });
  function syncSeedLabel(): void {
    seedValue.textContent = 'Seed ' + seed;
  }

  const appBar = el('header', { className: 'sc-appbar' }, [
    backButton.el,
    el('h1', { className: 'sc-appbar-title', text: 'Chart Wall' }),
    el('div', { className: 'sc-appbar-actions' }, [
      diceButton.el, seedValue, playButton.el, pickerButton.el, shareButton.el, themeButton.el
    ])
  ]);

  // --- small-screen fallback ----------------------------------------------

  const notice = el('div', { className: 'sc-wall-notice' }, [
    el('p', { text: 'The chart wall needs a bigger screen: it lays several charts out side by side.' }),
    el('p', { text: 'Rotate a tablet to landscape, or open this page on a desktop.' })
  ]);

  const container = el('div', { className: 'sc-wall-page' });

  function render(): void {
    if (isDesktopViewport()) {
      container.replaceChildren(appBar, grid, picker);
      syncGrid();
      syncSeedLabel();
      writeUrl();
    }
    else {
      stopPlaying();
      container.replaceChildren(appBar, notice);
    }
  }
  const unwatchViewport = watchDesktopViewport(() => render());
  render();

  return {
    el: container,
    destroy() {
      stopPlaying();
      unwatchViewport();
      unsubscribeTheme();
      for (const tile of tiles.values()) {
        tile.chart.destroy();
      }
      tiles.clear();
    }
  };
}
