import { Renderer, svgEl, htmlEl } from '../render';
import type { El, ElSlot, Slot } from '../render';

import LinearGradient from './LinearGradient';
import RadialGradient from './RadialGradient';
import SeriesColorGradient from './SeriesColorGradient';
import Pattern from './Pattern';

import { AUTO, NONE } from '../config/core/constants';
import { getSeriesColor, getSeriesFillColor, getSeriesOpacities, getSeriesGradientColors } from '../utils/SeriesColors';
import { getSymbolGenerator } from '../utils/shapeUtils';
import { translate } from '../utils/utils';
import { getGradientReference, getPatternReference } from '../utils/svgUtils';
import { getFocusValue } from '../utils/FocusValue';
import type { ColorPaletteConfig, LegendConfig, TooltipConfig } from '../types/config';
import type { EnhancedSeriesConfig } from '../types/enhanced';

interface SeriesColorUniqueIds {
  seriesColorGradientUniqueIds: Record<string, string>;
  gradientIdMap: Record<string, string>;
  patternIdMap: Record<string, string>;
}

interface SeriesColorIconProps {
  visible?: boolean;
  renderHTML: boolean;
  resolvedIconSize?: number;
  seriesContextConfig: LegendConfig | TooltipConfig;
  seriesShowColorProperty: 'showColorInLegend' | 'showColorInTooltip';
  seriesConfig: EnhancedSeriesConfig;
  pieMode: boolean;
  seriesIndex: number;
  colorPaletteConfig: ColorPaletteConfig;
  seriesIsFiltered: boolean;
  focusPercentage: number | null;
  iconClassName?: string | null;
  svgUniqueId?: string;
  uniqueIds?: SeriesColorUniqueIds;
}

// Auto-sized tooltip icons use a stable internal coordinate system while the
// outer SVG viewport follows the inherited font size through `1em`.
const autoIconViewBoxSize = 16;

function getIconGeometrySize(seriesContextConfig: LegendConfig | TooltipConfig, resolvedIconSize?: number): number {
  return resolvedIconSize ?? (seriesContextConfig.icon.size === AUTO ? autoIconViewBoxSize : seriesContextConfig.icon.size);
}

export default class SeriesColorIcon extends Renderer<SeriesColorIconProps> {
  span!: El;
  svg!: El;
  spacer!: El;
  defs: El | null = null;
  defsSlot!: ElSlot;
  shapeSlot!: ElSlot;
  defsFillSlot!: Slot;

  // renderHTML is decided per call site and never changes for a mounted
  // instance, so the structure is chosen once at create() time.
  create() {
    if (this.props.renderHTML) {
      this.span = htmlEl('span');
      this.svg = svgEl('svg');
      this.defsSlot = this.elSlot(this.svg);
      this.shapeSlot = this.elSlot(this.svg);
      this.defs = null;
      this.spacer = htmlEl('span');
      this.span.append(this.svg, this.spacer);
      return this.span.node;
    }
    this.shapeSlot = this.elSlot();
    return null;
  }

  sync() {
    if (this.props.renderHTML) {
      this.syncHTML();
    }
    else {
      this.syncSVG();
    }
  }

  syncHTML() {
    const { seriesContextConfig, seriesShowColorProperty, seriesConfig, svgUniqueId, iconClassName } = this.props;
    const { showColors: showIconColors, showPlaceholders: showIconPlaceholders } = seriesContextConfig.icon;
    const showSeriesColor = showIconColors && seriesConfig[seriesShowColorProperty];

    if (showSeriesColor || showIconPlaceholders) {
      const { size: iconSize, spacing: iconSpacing } = seriesContextConfig.icon;
      const geometrySize = getIconGeometrySize(seriesContextConfig);
      const displaySize = iconSize === AUTO ? '1em' : iconSize;
      const colorStyle = {
        display: 'inline-block',
        width: iconSize === AUTO ? `calc(1em + ${iconSpacing}px)` : iconSize + iconSpacing,
        verticalAlign: 'middle'
      };
      const spacerStyle = {
        display: 'inline-block',
        width: iconSpacing,
        height: displaySize
      };

      const fillDefinitionId = svgUniqueId! + '-' + seriesConfig.id;

      this.setPresent(true);
      this.span.set({ className: iconClassName, style: colorStyle });
      this.svg.set({
        xmlns: 'http://www.w3.org/2000/svg',
        width: displaySize,
        height: displaySize,
        viewBox: `0 0 ${geometrySize} ${geometrySize}`
      });
      this.spacer.set({ style: spacerStyle });
      this.syncColorDefs(fillDefinitionId);
      this.syncColorContent(showSeriesColor, fillDefinitionId, null);
    }
    else {
      this.setPresent(false);
    }
  }

  syncSVG() {
    const { seriesContextConfig, seriesShowColorProperty, seriesConfig, uniqueIds, iconClassName } = this.props;
    const { showColors: showIconColors, showPlaceholders: showIconPlaceholders } = seriesContextConfig.icon;
    const showSeriesColor = showIconColors && seriesConfig[seriesShowColorProperty];

    if (showSeriesColor || showIconPlaceholders) {
      const { seriesColorGradientUniqueIds, gradientIdMap, patternIdMap } = uniqueIds!;
      const fillDefinitionId = seriesConfig.pattern !== NONE
        ? patternIdMap[seriesConfig.id]
        : (seriesConfig.gradient !== NONE ? gradientIdMap[seriesConfig.gradient] : seriesColorGradientUniqueIds[seriesConfig.id]);
      this.syncColorContent(showSeriesColor, fillDefinitionId, iconClassName);
    }
    else {
      this.shapeSlot.set(null);
    }
  }

  ensureDefsFillSlot() {
    if (this.defs === null) {
      this.defs = svgEl('defs');
      this.defsFillSlot = this.slot(this.defs);
    }
    this.defsSlot.set('defs', () => this.defs!);
    return this.defsFillSlot;
  }

  syncColorDefs(fillDefinitionId: string): void {
    const { seriesConfig, visible = true } = this.props;

    if (!visible) {
      this.defsSlot.set(null);
      return;
    }

    const { gradient, pattern } = seriesConfig;

    const seriesGradientColors = getSeriesGradientColors(seriesConfig);
    if (pattern !== NONE) {
      const fillPalette = this.props.colorPaletteConfig.shape.normal.fillColors;
      const fallbackColor = fillPalette[this.props.seriesIndex % fillPalette.length] ?? null;
      this.ensureDefsFillSlot().set(Pattern, {
        uniqueId: fillDefinitionId,
        patternConfig: seriesConfig.patternConfig!,
        seriesColor: getSeriesFillColor(this.props.colorPaletteConfig, seriesConfig, this.props.seriesIndex, null, fallbackColor)
      });
    }
    else if (gradient !== NONE) {
      const { linearGradientConfig, radialGradientConfig } = seriesConfig;
      const gradientSlot = this.ensureDefsFillSlot();
      if (linearGradientConfig !== undefined) {
        gradientSlot.set(LinearGradient, { uniqueId: fillDefinitionId, linearGradientConfig });
      }
      else {
        gradientSlot.set(RadialGradient, { uniqueId: fillDefinitionId, radialGradientConfig });
      }
    }
    else if (seriesGradientColors) {
      this.ensureDefsFillSlot().set(SeriesColorGradient, { uniqueId: fillDefinitionId, seriesConfig });
    }
    else {
      this.defsSlot.set(null);
    }
  }

  syncColorContent(showSeriesColor: boolean, fillDefinitionId: string, className: string | null | undefined): void {
    const {
      seriesContextConfig, seriesConfig, seriesIndex, colorPaletteConfig,
      seriesIsFiltered, focusPercentage, visible = true
    } = this.props;

    if (!visible) {
      this.shapeSlot.set(null);
      return;
    }

    const { borderStyle: iconBorderStyle, filteredColor: iconFilteredColor, unfilteredColor: iconUnfilteredColor, showShapes: showIconShapes } = seriesContextConfig.icon;
    const { strokeColor: iconBorderColor, strokeOpacity: iconBorderOpacity, strokeWidth: iconBorderSize } = iconBorderStyle;
    const iconSize = getIconGeometrySize(seriesContextConfig, this.props.resolvedIconSize);
    const { gradient, pattern } = seriesConfig;
    const markerShape = seriesConfig.marker.shape;

    const { pieMode } = this.props;
    const { opacity, focusedOpacity, defocusedOpacity } = getSeriesOpacities(seriesConfig, pieMode);
    const hasFillDefinition = pattern !== NONE || gradient !== NONE || getSeriesGradientColors(seriesConfig);
    const halfBorderSize = iconBorderSize / 2.0;
    // icon.size and icon.borderStyle.strokeWidth validate independently, so a border wider than the icon would
    // otherwise put a negative width on the rect and the browser would drop the element
    const shapeSize = Math.max(iconSize - iconBorderSize, 0);
    const fillDefinitionReference = pattern !== NONE
      ? getPatternReference(fillDefinitionId)
      : getGradientReference(fillDefinitionId);
    const seriesColor = getSeriesColor(colorPaletteConfig, seriesConfig, pieMode, seriesIndex, focusPercentage, iconUnfilteredColor);

    // a filtered icon takes iconFilteredColor as given: it stands in for the series color rather
    // than dimming it, so it carries its own alpha and ignores the focus opacity
    const stroke = iconBorderColor;
    const strokeWidth = (seriesIsFiltered ? 1.5 : 1) * iconBorderSize;
    const unfilteredFill = showSeriesColor
      ? (hasFillDefinition ? fillDefinitionReference : seriesColor)
      : iconUnfilteredColor;
    const fill = seriesIsFiltered ? iconFilteredColor : unfilteredFill;
    const fillOpacity = seriesIsFiltered ? 1 : getFocusValue(focusPercentage, opacity, focusedOpacity, defocusedOpacity);

    const commonProps = {
      stroke,
      strokeOpacity: iconBorderOpacity,
      strokeWidth,
      fill,
      fillOpacity,
      className
    };

    if (showIconShapes && !pieMode && markerShape !== NONE && pattern === NONE) {
      const symbolSize = Math.max(shapeSize - 3, 0);
      const halfSize = Math.floor(iconSize / 2.0);
      const symbolGenerator = getSymbolGenerator(symbolSize, markerShape);
      const symbolTransform = translate(halfSize, halfSize);
      this.shapeSlot.set('path', () => svgEl('path'))!.set({ d: symbolGenerator(), transform: symbolTransform, ...commonProps });
    }
    else {
      this.shapeSlot.set('rect', () => svgEl('rect'))!.set({ x: halfBorderSize, y: halfBorderSize, width: shapeSize, height: shapeSize, ...commonProps });
    }
  }
}
