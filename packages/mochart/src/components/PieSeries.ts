import { arc } from 'd3-shape';
import type { ArcDatum } from 'd3-shape';

import { Renderer, svgEl, textEl } from '../render';

import { degreesToRadians } from '../data/PieData';
import { getSeriesFillColor, getSeriesStrokeColor, getSeriesLabelFillColor, getSeriesLabelStrokeColor } from '../utils/SeriesColors';
import { getSeriesFocusPercentage } from '../utils/SeriesFocus';
import { getSeriesTitle } from '../utils/SeriesTitle';
import { sliceIsInteractive } from '../utils/RovingFocus';
import { getFocusStyle } from '../utils/FocusValue';
import { getGradientReference, getPatternReference } from '../utils/svgUtils';
import { mochartCssClasses } from '../utils/ChartDom';
import { translate, textDY, isHoverPointer } from '../utils/utils';
import { NONE } from '../config/core/constants';
import { formatPieLabelType, getPieLabelFormats } from '../data/PieLabel';
import type { PieLabelFormats } from '../data/PieLabel';

import type { ColorPaletteConfig, PieConfig } from '../types/config';
import type { EnhancedSeriesConfig } from '../types/enhanced';
import type { FocusData } from '../types/animation';
import type { LayoutInfo } from '../types/layout';
import type { PieSliceAngles } from '../data/PieData';
import type { RadialLayoutInfo } from '../layout/RadialLayout';

const noOp = () => {};

interface SliceArcDatum extends ArcDatum {
  innerRadius: number;
  outerRadius: number;
  padAngle: number;
  cornerRadius: number;
}

// one generator for every slice and frame; the datum carries the per-sync geometry
const sliceArc = arc<SliceArcDatum>().cornerRadius(d => d.cornerRadius);

interface PieSeriesFocusUpdate {
  seriesId?: string | null;
}

interface PieSeriesProps {
  colorPaletteConfig: ColorPaletteConfig;
  pieConfig: PieConfig;
  seriesConfig: EnhancedSeriesConfig;
  seriesIndex: number;
  seriesLayoutInfo: LayoutInfo;
  radialLayoutInfo: RadialLayoutInfo;
  sliceAngles: PieSliceAngles | undefined;
  /** The label/min-angle fraction: the slice's share of the unfiltered total
   * (or of the full raw total when label.adjustForFiltering is off). */
  labelFraction: number;
  focusData: FocusData | null;
  gradientIdMap: Record<string, string>;
  patternIdMap: Record<string, string>;
  /** Filter labels while the initial sweep-in is running. */
  hideLabels: boolean;
  onFocus: (focus: PieSeriesFocusUpdate) => void;
  /** Click-only slice event for selection; independent of the focus flags. */
  onSliceClick?: (payload: { seriesId: string }) => void;
  /** Master switch for the slice's keyboard and screen-reader semantics. */
  accessibility: boolean;
  /** The roving tab stop: one slice is Tab-reachable, arrows move between slices. */
  tabStop: boolean;
}

interface PieSeriesState {
  onSeriesEnter: (event: Event) => void;
  onSeriesLeave: () => void;
  onSeriesClick: () => void;
}

function getPieLabelText(pieConfig: PieConfig, { valueFormat, percentFormat }: PieLabelFormats, seriesConfig: EnhancedSeriesConfig,
    sliceAngles: PieSliceAngles, labelFraction: number): string {
  return formatPieLabelType(pieConfig.label.type, {
    title: getSeriesTitle(seriesConfig),
    value: valueFormat(sliceAngles.value),
    percent: percentFormat(labelFraction)
  });
}

/** One pie/donut slice: an arc path plus an optional centroid label. */
export default class PieSeries extends Renderer<PieSeriesProps, PieSeriesState> {
  root = svgEl('g');
  shape = this.elSlot(this.root);
  label = this.elSlot(this.root);
  labelText = textEl();
  // leave mirrors the enter that actually fired: an ignored touch enter must not clear focus set elsewhere
  hoverActive = false;

  constructor() {
    super();
    this.state = { onSeriesEnter: noOp, onSeriesLeave: noOp, onSeriesClick: noOp };
  }

  derive(props: PieSeriesProps, _state: PieSeriesState, prevProps: PieSeriesProps | null): Partial<PieSeriesState> | null {
    const { seriesConfig, focusData, onFocus, onSliceClick } = props;
    let focusedSeriesChanged = false;
    if (prevProps !== null && focusData !== prevProps.focusData) {
      focusedSeriesChanged = focusData === null || prevProps.focusData === null ||
        focusData.focusedSeriesId !== prevProps.focusData.focusedSeriesId;
    }
    if (prevProps !== null && seriesConfig === prevProps.seriesConfig && onFocus === prevProps.onFocus &&
        onSliceClick === prevProps.onSliceClick && !focusedSeriesChanged) {
      return null;
    }
    // a follower series (followSeries) focuses as its leader, matching Series
    const seriesId = seriesConfig.followSeries ?? seriesConfig.id;
    const focusedSeriesId = focusData ? focusData.focusedSeriesId : null;

    let onSeriesEnter: PieSeriesState['onSeriesEnter'] = noOp;
    let onSeriesLeave = noOp;
    let onSeriesClick = noOp;
    if (seriesConfig.focusOnHover) {
      onSeriesEnter = (event: Event) => { if (isHoverPointer(event)) { this.hoverActive = true; onFocus({ seriesId }); } };
      onSeriesLeave = () => { if (this.hoverActive) { this.hoverActive = false; onFocus({ seriesId: null }); } };
    }
    if (seriesConfig.focusOnClick || onSliceClick) {
      onSeriesClick = () => {
        if (seriesConfig.focusOnClick) {
          onFocus({ seriesId: seriesId === focusedSeriesId ? null : seriesId });
        }
        onSliceClick?.({ seriesId });
      };
    }
    return { onSeriesEnter, onSeriesLeave, onSeriesClick };
  }

  onKeyDown = (event: Event) => {
    const { key } = event as KeyboardEvent;
    if (key === 'Enter' || key === ' ') {
      event.preventDefault();
      // the slice half only (focus toggle / selection); the container forwards the keydown to the
      // plot handler for the tooltip half — a synthesized click can miss the chart rect on exploded edge slices
      this.state.onSeriesClick();
    }
  }

  create() {
    return this.root.node;
  }

  sync() {
    const { colorPaletteConfig, pieConfig, seriesConfig, seriesIndex, seriesLayoutInfo, radialLayoutInfo,
      sliceAngles, labelFraction, focusData, gradientIdMap, patternIdMap, hideLabels, onSliceClick, accessibility, tabStop } = this.props;
    const { onSeriesEnter, onSeriesLeave, onSeriesClick } = this.state;

    if (sliceAngles === undefined || sliceAngles.fraction <= 0 || focusData === null) {
      this.setPresent(false);
      return;
    }

    const { valueAxisFocusPercentages, seriesFocusPercentages } = focusData;
    const seriesFocusPercentage = getSeriesFocusPercentage(seriesConfig, valueAxisFocusPercentages, seriesFocusPercentages);

    const strokeColor = getSeriesStrokeColor(colorPaletteConfig, seriesConfig, seriesIndex, seriesFocusPercentage);
    let fillColor = getSeriesFillColor(colorPaletteConfig, seriesConfig, seriesIndex, seriesFocusPercentage);
    if (seriesConfig.pattern !== NONE) {
      fillColor = getPatternReference(patternIdMap[seriesConfig.id]);
    }
    else if (seriesConfig.gradient !== NONE) {
      fillColor = getGradientReference(gradientIdMap[seriesConfig.gradient]);
    }
    const { strokeWidth, strokeDashArray, strokeOpacity, fillOpacity } = getFocusStyle(seriesFocusPercentage, seriesConfig.shapeStyle);

    const { startAngle, endAngle } = sliceAngles;
    const arcPath = sliceArc({ startAngle, endAngle,
      innerRadius: radialLayoutInfo.innerRadius, outerRadius: radialLayoutInfo.outerRadius,
      cornerRadius: pieConfig.cornerRadius, padAngle: degreesToRadians(pieConfig.padAngle) });

    // The focused slice "explodes" along its mid-angle; the tweened focus
    // percentage animates the offset in and out.
    let offsetX = 0;
    let offsetY = 0;
    if (pieConfig.focusOffsetFraction > 0 && seriesFocusPercentage !== null && seriesFocusPercentage > 0) {
      const offsetMidAngle = (startAngle + endAngle) / 2;
      const offset = seriesFocusPercentage * pieConfig.focusOffsetFraction * radialLayoutInfo.outerRadius;
      offsetX = offset * Math.sin(offsetMidAngle);
      offsetY = -offset * Math.cos(offsetMidAngle);
    }

    this.setPresent(true);
    // keyboard focus shows only the ring — mirroring hover would reorder the DOM under the focused node
    const interactive = sliceIsInteractive(accessibility, seriesConfig, onSliceClick);
    const labelFormats = getPieLabelFormats(pieConfig);
    this.root.set({ className: mochartCssClasses['series'] + seriesConfig.id,
      cursor: seriesConfig.showPointer ? 'pointer' : null,
      ariaHidden: accessibility && !interactive ? 'true' : null,
      dataSeriesId: interactive ? seriesConfig.id : null,
      tabindex: interactive ? (tabStop ? '0' : '-1') : null,
      role: interactive ? 'button' : null,
      ariaLabel: interactive ? getSeriesTitle(seriesConfig) + ', ' + labelFormats.percentFormat(labelFraction) : null,
      onKeyDown: interactive ? this.onKeyDown : null,
      transform: translate(seriesLayoutInfo.x + radialLayoutInfo.cx + offsetX, seriesLayoutInfo.y + radialLayoutInfo.cy + offsetY) });

    this.shape.set('slice', () => svgEl('path'))!.set({
      d: arcPath, className: mochartCssClasses['seriesSlice'],
      onPointerEnter: onSeriesEnter, onPointerLeave: onSeriesLeave, onClick: onSeriesClick,
      stroke: strokeColor, strokeWidth, strokeDasharray: strokeDashArray, strokeOpacity,
      fill: fillColor, fillOpacity });

    if (pieConfig.label.visible && !hideLabels && labelFraction >= pieConfig.label.minFraction) {
      const midAngle = (startAngle + endAngle) / 2;
      const labelRadius = radialLayoutInfo.innerRadius + (radialLayoutInfo.outerRadius - radialLayoutInfo.innerRadius) * pieConfig.label.radiusFraction;
      const labelFillColor = getSeriesLabelFillColor(colorPaletteConfig, seriesConfig, seriesIndex, seriesFocusPercentage);
      const labelStrokeColor = getSeriesLabelStrokeColor(colorPaletteConfig, seriesConfig, seriesIndex, seriesFocusPercentage);
      const { strokeWidth: labelStrokeWidth, strokeOpacity: labelStrokeOpacity, fillOpacity: labelFillOpacity } = getFocusStyle(seriesFocusPercentage, seriesConfig.label.textStyle);

      const labelEl = this.label.set('text', () => {
        const el = svgEl('text');
        el.append(this.labelText);
        return el;
      });
      labelEl!.set({ className: mochartCssClasses['seriesSliceLabel'],
        transform: translate(labelRadius * Math.sin(midAngle), -labelRadius * Math.cos(midAngle)),
        textAnchor: 'middle', dy: textDY,
        stroke: labelStrokeColor, strokeWidth: labelStrokeWidth, strokeOpacity: labelStrokeOpacity,
        fill: labelFillColor, fillOpacity: labelFillOpacity });
      this.labelText.set(getPieLabelText(pieConfig, labelFormats, seriesConfig, sliceAngles, labelFraction));
    }
    else {
      this.label.set(null);
    }
  }
}
