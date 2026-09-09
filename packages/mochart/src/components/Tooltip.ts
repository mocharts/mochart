import { Renderer, htmlEl } from '../render';

import TooltipContent from './TooltipContent';
import { MODE_FOCUS, MODE_FILTER } from './TooltipControls';
import type { TooltipMode } from './TooltipControls';

import { mochartCssClasses } from '../utils/ChartDom';
import { cssBorderWidth, cssStyleColor } from '../utils/style';
import type { EnhancedMochartConfig } from '../types/enhanced';
import type { FocusPercentageMap } from '../types/animation';
import type { SpacingLayoutInfo } from '../types/layout';
import type { Bounds } from '../types/geometry';
import type { CategorySeriesValueObject } from '../data/ChartData';

interface TooltipProps {
  mochartConfig: EnhancedMochartConfig;
  tooltipVisible: boolean;
  tooltipCategoryIndex: number;
  svgUniqueId: string;
  categoryCount: number;
  focusedCategoryIndex: number;
  tooltipBounds: Bounds | null;
  tooltipValueObject: CategorySeriesValueObject;
  focusedSeriesId: string | null;
  valueAxisFocusPercentages: FocusPercentageMap;
  seriesFocusPercentages: FocusPercentageMap;
  tooltipLayoutInfo: SpacingLayoutInfo;
  onClose: () => void;
  onEscape: () => void;
  updateTooltipCategoryIndex: (categoryIndex: number) => void;
  onFocus: (focus: { categoryIndex?: number | null; seriesId?: string | null }) => void;
  onSeriesFilter: (seriesId: string) => void;
}

interface TooltipState { mode: TooltipMode }

export default class Tooltip extends Renderer<TooltipProps, TooltipState> {
  root = htmlEl('div');
  sizer = htmlEl('div');
  sizerContent = this.slot(this.sizer);
  tooltip = htmlEl('div');
  tooltipContent = this.slot(this.tooltip);

  constructor() {
    super();
    this.state = { mode: MODE_FILTER };
  }

  toggleMode = () => {
    const { mode } = this.state;
    this.setState({ mode: mode === MODE_FILTER ? MODE_FOCUS : MODE_FILTER });
  }

  create() {
    this.root.append(this.sizer, this.tooltip);
    return this.root.node;
  }

  sync() {
    const { mochartConfig, tooltipVisible, tooltipCategoryIndex } = this.props;
    if (mochartConfig.tooltip.visible && tooltipVisible && tooltipCategoryIndex >= 0) {
      const { svgUniqueId, categoryCount, focusedCategoryIndex, tooltipBounds, tooltipValueObject, focusedSeriesId,
        valueAxisFocusPercentages, seriesFocusPercentages, tooltipLayoutInfo, onClose, onEscape, updateTooltipCategoryIndex, onFocus, onSeriesFilter } = this.props;

      const { tooltip: tooltipConfig } = mochartConfig;

      const { x, y } = tooltipLayoutInfo;

      const { dropShadow } = tooltipConfig;
      const boxShadowStyle = dropShadow.offsetX + 'px ' + dropShadow.offsetY + 'px ' + dropShadow.blurRadius + 'px ' + dropShadow.color;

      const tooltipSizerStyle = {
        position: 'absolute',
        left: 0,
        top: 0,
        visibility: 'hidden'
      };

      // the tooltip is html: the fill is the box's background and the stroke its border, and css has
      // nowhere to put a separate opacity, so each opacity is composited into its color
      const { backgroundStyle } = tooltipConfig;

      const tooltipStyle = {
        position: 'absolute',
        left: x,
        top: y,
        background: cssStyleColor(backgroundStyle.fillColor, backgroundStyle.fillOpacity),
        borderStyle: 'solid',
        paddingTop: tooltipConfig.padding.top,
        paddingRight: tooltipConfig.padding.right,
        paddingBottom: tooltipConfig.padding.bottom,
        paddingLeft: tooltipConfig.padding.left,
        // a null width must not leave the solid border at css 'medium'; the layout counts it as 0 too
        borderWidth: cssBorderWidth(backgroundStyle.strokeColor, backgroundStyle.strokeWidth),
        borderColor: cssStyleColor(backgroundStyle.strokeColor, backgroundStyle.strokeOpacity),
        borderRadius: tooltipConfig.cornerRadius,
        boxShadow: boxShadowStyle,
        visibility: tooltipBounds !== null ? 'visible' : 'hidden'
      };

      const sizeForFiltering = tooltipConfig.adjustSizeForFiltering;

      const commonProps = {
        mochartConfig, tooltipValueObject, tooltipCategoryIndex, focusedCategoryIndex,
        focusedSeriesId, valueAxisFocusPercentages, seriesFocusPercentages,
        svgUniqueId, updateTooltipCategoryIndex,
        onClose, onEscape, onFocus, onSeriesFilter, categoryCount,
        mode: this.state.mode, toggleMode: this.toggleMode
      };

      this.setPresent(true);
      this.root.set({ className: mochartCssClasses['tooltipContainer'] });
      this.sizer.set({ className: mochartCssClasses['tooltipSizer'], style: tooltipSizerStyle });
      this.sizerContent.set(TooltipContent, { ...commonProps, adjustForFiltering: sizeForFiltering, visible: false });
      this.tooltip.set({ className: mochartCssClasses['tooltip'], style: tooltipStyle });
      this.tooltipContent.set(TooltipContent, { ...commonProps, minWidth: tooltipBounds ? tooltipBounds.width : null, visible: true });
    }
    else {
      this.setPresent(false);
    }
  }
}
