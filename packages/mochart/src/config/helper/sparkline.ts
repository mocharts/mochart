import { deepMerge } from '../core/deepMerge.js';
import type { MochartInputConfig } from '../../types/config.js';
import type { MarginPadding } from '../../types/geometry.js';

/** Options for createSparklineConfig: whether the tooltip stays on, and the edge padding. */
export interface CreateSparklineConfigOptions {
  /**
   * Whether the tooltip and crosshairs should stay enabled. Sparklines are
   * usually too small to host either, so both default to off.
   *
   * @default false
   */
  interactive?: boolean;
  /**
   * The uniform chart padding (in pixels). A couple of pixels keeps strokes at
   * the extremes of the data from clipping against the chart edges.
   *
   * @default 2
   */
  padding?: number;
}

const uniform = (value: number): MarginPadding => ({ top: value, right: value, bottom: value, left: value });

/**
 * Turns a chart input config into a sparkline preset: axes, legend, tooltip,
 * crosshairs and per-point markers hidden and margins collapsed, leaving only
 * the plotted shapes for tiny inline charts. The preset only fills in
 * defaults: any value set on the passed config wins, so individual pieces
 * (e.g. the tooltip) can be opted back in per chart. A member passed as
 * undefined counts as not set, so a wrapper forwarding optional props does
 * not cancel the preset.
 */
export function createSparklineConfig(config: MochartInputConfig, options: CreateSparklineConfigOptions = {}): MochartInputConfig {
  const interactive = options.interactive ?? false;
  const padding = options.padding ?? 2;
  const preset = {
    // per side, so a partial margin or padding falls back to the sparkline's sides, not the chart defaults'
    chart: { margin: uniform(0), padding: uniform(padding) },
    legend: { visible: false },
    tooltip: { visible: interactive },
    crosshair: { visible: interactive },
    categoryAxis: { visible: false },
    // the base line draws in the plot, not the axis band, so hiding the axis does not hide it
    valueAxisDefaults: { visible: false, baseLine: { visible: false } },
    seriesDefaults: { marker: { shape: null } }
  };
  // deepMerge skips undefined members and copies both sides, so neither the preset nor the config is mutated
  return deepMerge<MochartInputConfig>(preset, config);
}
