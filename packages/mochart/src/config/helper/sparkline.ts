import type { MochartInputConfig } from '../../types/config';
import type { MarginPadding } from '../../types/geometry';

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
 * defaults — any value set on the passed config wins, so individual pieces
 * (e.g. the tooltip) can be opted back in per chart.
 */
export function createSparklineConfig(config: MochartInputConfig, options: CreateSparklineConfigOptions = {}): MochartInputConfig {
  const interactive = options.interactive ?? false;
  const padding = options.padding ?? 2;
  return {
    ...config,
    // per side, so a partial margin or padding falls back to the sparkline's sides, not the chart defaults'
    chart: { ...config.chart, margin: { ...uniform(0), ...config.chart?.margin }, padding: { ...uniform(padding), ...config.chart?.padding } },
    legend: { visible: false, ...config.legend },
    tooltip: { visible: interactive, ...config.tooltip },
    crosshair: { visible: interactive, ...config.crosshair },
    categoryAxis: { visible: false, ...config.categoryAxis },
    // the base line draws in the plot, not the axis band, so hiding the axis does not hide it
    valueAxisDefaults: { visible: false, ...config.valueAxisDefaults, baseLine: { visible: false, ...config.valueAxisDefaults?.baseLine } },
    seriesDefaults: { ...config.seriesDefaults, marker: { shape: null, ...config.seriesDefaults?.marker } }
  };
}
