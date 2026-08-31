import { Renderer, svgEl, textEl } from '../render';
import type { RendererItem } from '../render';

import { mochartCssClasses } from '../utils/ChartDom';
import { layoutInfoExtentChanged } from '../layout/LayoutInfo';
import { resolveLegendIconSize, legendItemClickable } from '../layout/LegendLayout';
import { getTruncatedText, TruncationTracker, TruncationTooltip } from '../utils/TextTruncation';
import { accessibilityActive, translate, translateObject, centerTextY, isHoverPointer, isKeyboardFocus } from '../utils/utils';
import { moveRovingFocus, resolveRovingId, focusedSeriesNode, restoreSeriesFocus } from '../utils/RovingFocus';
import { getClipPathReference } from '../utils/svgUtils';
import { getSeriesTitle } from '../utils/SeriesTitle';
import { getSeriesFocusPercentage, leaderSeriesId } from '../utils/SeriesFocus';
import { CHART_TYPE_PIE } from '../config/core/constants';
import { styleToAttributes } from '../utils/style';
import Background from './Background';
import SeriesColorIcon from './SeriesColorIcon';
import type { ColorPaletteConfig, LegendConfig } from '../types/config';
import type { EnhancedMochartConfig, EnhancedSeriesConfig } from '../types/enhanced';
import type { SpacingLayoutInfo } from '../types/layout';
import type { TruncationState } from '../utils/TextTruncation';
import type { FocusPercentageMap } from '../types/animation';

interface LegendItemUniqueIds {
  legendClipPathUniqueId: string;
  seriesColorGradientUniqueIds: Record<string, string>;
  gradientIdMap: Record<string, string>;
  patternIdMap: Record<string, string>;
}

interface LegendProps {
  mochartConfig: EnhancedMochartConfig;
  // the layout leaves these undefined when there is nothing to place (no series), legend.visible notwithstanding
  legendLayoutInfo: SpacingLayoutInfo | undefined;
  legendItemTextLayoutInfo: SpacingLayoutInfo | undefined;
  legendItemLayoutInfos: SpacingLayoutInfo[] | undefined;
  legendItemRawLayoutInfos: SpacingLayoutInfo[] | undefined;
  filteredFlags: Record<string, boolean>;
  uniqueIds: LegendItemUniqueIds;
  focusedSeriesId: string | null;
  valueAxisFocusPercentages: FocusPercentageMap;
  seriesFocusPercentages: FocusPercentageMap;
  onFocus: (focus: { seriesId: string | null }) => void;
  onSeriesFilter: (seriesId: string) => void;
}

interface LegendItemProps {
  legendConfig: LegendConfig;
  pieMode: boolean;
  seriesConfig: EnhancedSeriesConfig;
  legendLayoutInfo: SpacingLayoutInfo;
  legendItemLayoutInfo: SpacingLayoutInfo;
  legendItemRawLayoutInfo: SpacingLayoutInfo;
  legendItemTextLayoutInfo: SpacingLayoutInfo;
  uniqueIds: LegendItemUniqueIds;
  clipPath: string | null;
  colorPaletteConfig: ColorPaletteConfig;
  seriesIndex: number;
  seriesIsFiltered: boolean;
  seriesFocusPercentage: number | null;
  /** clicking filters or focuses the series, so the item shows the pointer cursor */
  clickable: boolean;
  /** clickable and accessibility is on, so the item is keyboard-reachable */
  interactive: boolean;
  /** the roving tab stop: one legend item is Tab-reachable, arrows move between items */
  tabStop: boolean;
  /** filtering applies, so the item exposes aria-pressed (pressed = series shown) */
  showsFilterState: boolean;
  onClick: (seriesId: string) => void;
  onPointerEnter: (seriesId: string) => void;
  onPointerLeave: (seriesId: string) => void;
}

type LegendItemState = TruncationState;

interface LegendState { rovingSeriesId: string | null }

const hiddenStyle = { visibility: 'hidden' };

export default class Legend extends Renderer<LegendProps, LegendState> {
  root = svgEl('g');
  background = this.slot(this.root);
  items = this.rendererList(this.root);

  constructor() {
    super();
    this.state = { rovingSeriesId: null };
  }

  private interactiveItemNodes(): SVGElement[] {
    return Array.from(this.root.node.querySelectorAll<SVGElement>('g[tabindex]'));
  }

  /** any focus landing on an item (Tab, arrows, mouse) makes it the roving tab stop */
  legendFocusIn = (event: Event) => {
    const seriesId = (event.target as Element).getAttribute('data-series-id');
    if (seriesId !== null && seriesId !== this.state.rovingSeriesId) {
      this.setState({ rovingSeriesId: seriesId });
    }
  }

  legendKeyDown = (event: Event) => {
    moveRovingFocus(event, this.interactiveItemNodes());
  }

  legendItemPointerEnter = (seriesId: string) => {
    const { mochartConfig, onFocus } = this.props;
    if (mochartConfig.legend.focusOnHover) {
      onFocus({ seriesId: leaderSeriesId(mochartConfig, seriesId) });
    }
  }

  legendItemPointerLeave = (_seriesId: string) => {
    const { mochartConfig, onFocus } = this.props;
    if (mochartConfig.legend.focusOnHover) {
      onFocus({ seriesId: null });
    }
  }

  legendItemClick = (seriesId: string) => {
    const { mochartConfig, focusedSeriesId, onFocus, onSeriesFilter } = this.props;
    // a following series acts as the one it follows, whose filterable decides
    const leaderId = leaderSeriesId(mochartConfig, seriesId);
    const legendConfig = mochartConfig.legend;
    if (legendConfig.filterOnClick && mochartConfig.seriesById[leaderId].filterable) {
      onSeriesFilter(leaderId);
    }
    if (legendConfig.focusOnClick) {
      // toggle per series like the other click-to-focus sites: clicking the
      // focused item clears, clicking any other item moves the focus
      onFocus({ seriesId: leaderId === focusedSeriesId ? null : leaderId });
    }
  }

  create() {
    return this.root.node;
  }

  sync() {
    const { mochartConfig, legendLayoutInfo, legendItemTextLayoutInfo, legendItemLayoutInfos,
      legendItemRawLayoutInfos, filteredFlags, uniqueIds, valueAxisFocusPercentages, seriesFocusPercentages } = this.props;
    const { legendClipPathUniqueId } = uniqueIds;
    const { legend: legendConfig } = mochartConfig;
    if (legendConfig.visible && legendLayoutInfo !== undefined && legendItemTextLayoutInfo !== undefined &&
      legendItemLayoutInfos !== undefined && legendItemRawLayoutInfos !== undefined) {
      const { series: seriesConfigs, seriesIndicesById: seriesConfigIndicesById, colorPalette: colorPaletteConfig } = mochartConfig;
      const { enabled: truncationEnabled } = legendConfig.truncation;
      const transform = translateObject(legendLayoutInfo);

      const clipPath = truncationEnabled ? getClipPathReference(legendClipPathUniqueId) : null;

      const accessibility = accessibilityActive(mochartConfig.accessibility);
      const { legendLabel } = mochartConfig.accessibility;
      // keyboard reach needs both: the click has to do something, and accessibility has to be on
      const itemIsInteractive = (seriesConfig: EnhancedSeriesConfig): boolean =>
        accessibility && legendItemClickable(mochartConfig, seriesConfig);
      const interactiveIds = seriesConfigs
        .filter(seriesConfig => seriesConfig.showInLegend && itemIsInteractive(seriesConfig))
        .map(seriesConfig => seriesConfig.id);
      const effectiveRovingId = resolveRovingId(this.state.rovingSeriesId, interactiveIds, seriesConfigIndicesById);
      const anyInteractive = interactiveIds.length > 0;

      this.setPresent(true);
      this.root.set({ className: mochartCssClasses['legend'], transform,
        role: anyInteractive ? 'group' : null, ariaLabel: anyInteractive ? legendLabel : null,
        onKeyDown: anyInteractive ? this.legendKeyDown : null,
        onFocusIn: anyInteractive ? this.legendFocusIn : null });
      this.background.set(Background, { config: legendConfig, classKey: 'legendBackground', spacingRelative: true, spacingLayoutInfo: legendLayoutInfo });

      const items: RendererItem<LegendItemProps>[] = [];
      // The measured bounds and layout infos only cover showInLegend series,
      // so items index into them by legend position, not raw series index.
      let itemIndex = 0;
      seriesConfigs.forEach((seriesConfig: EnhancedSeriesConfig) => {
        const { id, showInLegend } = seriesConfig;
        if (showInLegend) {
          const i = itemIndex++;
          const seriesIndex = seriesConfigIndicesById[id];
          const seriesIsFiltered = filteredFlags[id] === true;
          const seriesFocusPercentage = getSeriesFocusPercentage(seriesConfig, valueAxisFocusPercentages, seriesFocusPercentages);

          items.push({
            key: id,
            ctor: LegendItem,
            props: { legendConfig, seriesConfig, legendLayoutInfo, pieMode: mochartConfig.chart.type === CHART_TYPE_PIE,
              legendItemLayoutInfo: legendItemLayoutInfos[i],
              legendItemRawLayoutInfo: legendItemRawLayoutInfos[i], legendItemTextLayoutInfo,
              uniqueIds, colorPaletteConfig, seriesIndex,
              seriesIsFiltered,
              seriesFocusPercentage, clipPath,
              clickable: legendItemClickable(mochartConfig, seriesConfig),
              interactive: itemIsInteractive(seriesConfig),
              tabStop: id === effectiveRovingId,
              showsFilterState: accessibility && legendConfig.filterOnClick
                && mochartConfig.seriesById[leaderSeriesId(mochartConfig, id)].filterable,
              onClick: this.legendItemClick,
              onPointerEnter: this.legendItemPointerEnter, onPointerLeave: this.legendItemPointerLeave }
          });
        }
      });
      // syncing may move or drop the focused item's node; a gone item hands focus to the tab stop
      const focusedItem = focusedSeriesNode(this.root.node);
      this.items.sync(items);
      restoreSeriesFocus(this.root.node, focusedItem, effectiveRovingId);
    }
    else {
      this.setPresent(false);
    }
  }
}

function legendItemFits(legendLayoutInfo: SpacingLayoutInfo, legendItemLayoutInfo: SpacingLayoutInfo, legendItemRawLayoutInfo: SpacingLayoutInfo): boolean {
  return legendItemLayoutInfo.width === legendItemRawLayoutInfo.width && legendLayoutInfo.default !== true;
}

class LegendItem extends Renderer<LegendItemProps, LegendItemState> {
  root = svgEl('g');
  background = this.slot(this.root);
  iconGroup = svgEl('g');
  icon = this.slot(this.iconGroup);
  textGroup = svgEl('g');
  text = svgEl('text');
  textValue = textEl();
  textRawGroup = svgEl('g');
  textRaw = svgEl('text');
  textRawValue = textEl();
  truncation = new TruncationTracker();
  tooltip = new TruncationTooltip();

  constructor() {
    super();
    this.state = { truncationData: null };
  }

  onClick = () => {
    const { onClick, seriesConfig } = this.props;
    onClick(seriesConfig.id);
  }

  // leave mirrors the enter that actually fired: the filtered flag can flip
  // mid-hover (legend click, controlled filter), so it can't gate the leave
  hoverActive = false;

  onKeyDown = (event: Event) => {
    const { key } = event as KeyboardEvent;
    if (key === 'Enter' || key === ' ') {
      event.preventDefault();
      this.onClick();
    }
  }

  onPointerEnter = (event: Event) => {
    if (isHoverPointer(event)) {
      this.hoverEnter();
    }
  }

  onPointerLeave = () => {
    this.hoverLeave();
  }

  hoverEnter(): void {
    const { onPointerEnter, seriesConfig, seriesIsFiltered } = this.props;
    if (!seriesIsFiltered) {
      this.hoverActive = true;
      onPointerEnter(seriesConfig.id);
    }
  }

  hoverLeave(): void {
    const { onPointerLeave, seriesConfig } = this.props;
    if (this.hoverActive) {
      this.hoverActive = false;
      onPointerLeave(seriesConfig.id);
    }
  }

  // keyboard focus mirrors hover, so the focused series highlights the same way; a tap or click
  // focuses too, but that focus is not visible and its hover (if any) came from the pointer
  onFocusIn = (event: Event) => {
    if (isKeyboardFocus(event)) {
      this.hoverEnter();
    }
  }

  onFocusOut = () => {
    this.hoverLeave();
  }

  derive(props: LegendItemProps, _state: LegendItemState, prevProps: LegendItemProps | null): Partial<LegendItemState> | null {
    if (prevProps === null) {
      return this.truncation.mount(props.legendConfig.truncation.enabled);
    }
    const { legendConfig, seriesConfig, legendLayoutInfo, legendItemLayoutInfo, legendItemRawLayoutInfo } = props;
    const truncationEnabled = legendConfig.truncation.enabled;
    const truncationChanged = truncationEnabled &&
      (layoutInfoExtentChanged(prevProps.legendItemLayoutInfo, legendItemLayoutInfo) || layoutInfoExtentChanged(prevProps.legendItemRawLayoutInfo, legendItemRawLayoutInfo));
    const seriesTitleChanged = prevProps.seriesConfig.title !== seriesConfig.title;
    // reset only on settling, not on every update while settled: each reset re-arms a forced-layout measure
    const truncationFinished = legendItemFits(legendLayoutInfo, legendItemLayoutInfo, legendItemRawLayoutInfo) &&
      !legendItemFits(prevProps.legendLayoutInfo, prevProps.legendItemLayoutInfo, prevProps.legendItemRawLayoutInfo);
    return this.truncation.prepare(truncationEnabled, truncationChanged, seriesTitleChanged || truncationFinished);
  }

  create() {
    this.textGroup.append(this.text);
    this.text.append(this.textValue);
    this.textRawGroup.append(this.textRaw);
    this.textRaw.append(this.textRawValue);
    this.root.append(this.iconGroup, this.textGroup, this.textRawGroup);
    return this.root.node;
  }

  sync() {
    const { legendConfig, seriesConfig, legendItemLayoutInfo, legendItemTextLayoutInfo, uniqueIds, clipPath, colorPaletteConfig,
      seriesIndex, seriesIsFiltered, seriesFocusPercentage } = this.props;
    const { strikeThroughFiltered } = legendConfig;
    const { enabled: truncationEnabled, text: truncationText, tooltipEnabled: truncationTooltipEnabled } = legendConfig.truncation;
    const { spacing: iconSpacing } = legendConfig.icon;
    const { textStyle: itemTextStyle } = legendConfig.item;
    const itemTextAttributes = styleToAttributes(itemTextStyle);
    // a camelCase prop, not a style: the dom layer kebab-cases it into the svg attribute, and null leaves it off
    const textDecoration = strikeThroughFiltered && seriesIsFiltered ? 'line-through' : null;
    const iconSize = resolveLegendIconSize(legendConfig, legendItemTextLayoutInfo);
    const { truncationData } = this.state;
    const seriesLabel = getSeriesTitle(seriesConfig);
    const seriesLabelText = getTruncatedText(truncationEnabled, truncationText, seriesLabel, truncationData);
    const { paddingRelativeBounds } = legendItemLayoutInfo;
    const { x, y } = paddingRelativeBounds;
    const itemInnerHeight = paddingRelativeBounds.height;
    const iconWidth = iconSize + iconSpacing;
    const iconHeight = iconSize;
    const halfIconOffset = iconHeight < itemInnerHeight ? (itemInnerHeight - iconHeight) / 2.0 : 0;

    const transform = translateObject(legendItemLayoutInfo);
    const iconTransform = translate(x, y + halfIconOffset);

    const { dy, transform: textTransform } = centerTextY({ x: x + iconWidth, y, height: itemInnerHeight });

    const { clickable, interactive, tabStop, showsFilterState } = this.props;
    this.root.set({ className: mochartCssClasses['legendItem'] + seriesConfig.id, transform,
      cursor: clickable ? 'pointer' : null,
      dataSeriesId: interactive ? seriesConfig.id : null,
      tabindex: interactive ? (tabStop ? '0' : '-1') : null,
      role: interactive ? 'button' : null,
      // the untruncated label, so assistive tech hears the full series name
      ariaLabel: interactive ? seriesLabel : null,
      // pressed = series shown; toggling filters it out
      ariaPressed: showsFilterState ? String(!seriesIsFiltered) : null,
      onClick: this.onClick, onPointerEnter: this.onPointerEnter, onPointerLeave: this.onPointerLeave,
      onKeyDown: interactive ? this.onKeyDown : null,
      onFocusIn: interactive ? this.onFocusIn : null,
      onFocusOut: interactive ? this.onFocusOut : null });
    this.background.set(Background, { config: legendConfig.item, classKey: 'legendItemBackground', spacingRelative: true, spacingLayoutInfo: legendItemLayoutInfo });
    this.iconGroup.set({ className: mochartCssClasses['legendItemIcon'], transform: iconTransform });
    this.icon.set(SeriesColorIcon, { seriesContextConfig: legendConfig, seriesConfig, pieMode: this.props.pieMode,
      focusPercentage: seriesFocusPercentage, colorPaletteConfig, seriesIndex,
      seriesShowColorProperty: 'showColorInLegend', uniqueIds,
      seriesIsFiltered, renderHTML: false, resolvedIconSize: iconSize });
    this.textGroup.set({ className: mochartCssClasses['legendItemText'], clipPath });
    this.text.set({ ...itemTextAttributes, textDecoration, transform: textTransform, dy });
    this.textValue.set(seriesLabelText);
    this.tooltip.sync(this.text, truncationTooltipEnabled, seriesLabel, seriesLabelText);
    this.textRawGroup.set({ className: mochartCssClasses['legendItemTextRaw'], style: hiddenStyle });
    // the hidden measurement text carries the same style so its metrics match the visible text
    this.textRaw.set({ ...itemTextAttributes, textDecoration, transform: textTransform, dy });
    this.textRawValue.set(seriesLabel);
  }

  measure(prevProps: LegendItemProps | null) {
    if (prevProps === null) {
      // truncation is only rechecked after updates; the initial sync renders untruncated
      return;
    }
    if (this.truncation.check) {
      const domElement = this.root.node.querySelector<SVGTextContentElement>(getLegendItemTextCssSelector());
      const { legendConfig, seriesConfig, legendItemTextLayoutInfo } = this.props;
      const { width } = legendItemTextLayoutInfo;
      const { text: truncationText } = legendConfig.truncation;
      const title = getSeriesTitle(seriesConfig);
      const maxLength = Math.max(width, 0);
      this.truncation.update(this, truncationText, title, maxLength, domElement);
    }
  }
}

function getLegendItemTextCssSelector() {
  return '.' + mochartCssClasses['legendItemText'] + ' text';
}
