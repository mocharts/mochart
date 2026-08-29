import { Renderer, htmlEl, textEl } from '../render';
import type { El, RendererItem, Slot, TextEl } from '../render';

import { getCategoryFormat, getSeriesFormats } from '../utils/ValueFormat';
import { getSeriesText } from '../utils/TooltipFormat';
import type { PieTooltipValues } from '../utils/TooltipFormat';
import { getSeriesFocusPercentage } from '../utils/SeriesFocus';
import { mochartCssClasses } from '../utils/ChartDom';
import { accessibilityActive, focusRestored, isHoverPointer, isKeyboardFocus } from '../utils/utils';
import { moveRovingFocus, resolveRovingId } from '../utils/RovingFocus';
import { getPieSliceFractionMap } from '../data/PieData';
import { getPieTooltipPercentFormat, pieLabelTypeUsesPercent } from '../data/PieLabel';
import { NONE, CHART_TYPE_PIE, ALIGN_RIGHT } from '../config/core/constants';

import TooltipControls, { MODE_FOCUS, MODE_FILTER } from './TooltipControls';
import type { TooltipMode } from './TooltipControls';
import SeriesColorIcon from './SeriesColorIcon';
import type { ColorPaletteConfig } from '../types/config';
import type { EnhancedMochartConfig, EnhancedSeriesConfig, EnhancedValueAxisConfig } from '../types/enhanced';
import type { AxisDomains } from '../types/data';
import type { ValueFormatter } from '../utils/ValueFormat';
import type { InternalFocus } from '../types/chart';
import type { FocusPercentage, FocusPercentageMap } from '../types/animation';
import type { CategorySeriesValueObject } from '../data/ChartData';

type LineStyle = Record<string, string | number>;

interface LineStyles {
  minWidth: number | null; lineSpacing: number; minTargetSize: number;
  lineStyle: LineStyle; targetLineStyle: LineStyle; lastLineStyle: LineStyle; lastTargetLineStyle: LineStyle;
}

interface ValueFormats {
  seriesConfigs: EnhancedSeriesConfig[]; valueAxisConfigs: EnhancedValueAxisConfig[]; axisDomains: AxisDomains;
  formats: Record<string, ValueFormatter>;
}

interface TooltipCategoryLineProps {
  lineStyle: LineStyle;
  categoryLabel: string;
  categoryText: string | number | Date;
  rowKey: string;
  interactive: boolean;
  tabStop: boolean;
  onPointerEnter: (event: Event) => void;
  onPointerLeave: (event: Event) => void;
  onClick: (event: Event) => void;
}

interface TooltipSeriesLineProps {
  mochartConfig: EnhancedMochartConfig;
  seriesConfig: EnhancedSeriesConfig;
  seriesIndex: number;
  seriesIsFiltered: boolean;
  seriesFocusPercentage: FocusPercentage;
  colorPaletteConfig: ColorPaletteConfig;
  svgUniqueId: string;
  visible: boolean;
  labelText: string;
  valueText: string;
  style: LineStyle;
  rowKey: string;
  interactive: boolean;
  tabStop: boolean;
  /** filtering applies, so the row exposes aria-pressed (pressed = series shown) */
  showsFilterState: boolean;
  /** the series the row acts on: a follower's leader (followSeries), else itself */
  focusSeriesId: string;
  onPointerEnter: (event: Event, seriesId: string) => void;
  onPointerLeave: (event: Event) => void;
  onClick: (event: Event, seriesId: string) => void;
}

interface TooltipContentProps {
  mochartConfig: EnhancedMochartConfig;
  tooltipValueObject: CategorySeriesValueObject;
  categoryCount: number;
  focusedCategoryIndex: number;
  focusedSeriesId: string | null;
  visible: boolean;
  mode: TooltipMode;
  toggleMode: () => void;
  tooltipCategoryIndex: number;
  updateTooltipCategoryIndex: (categoryIndex: number) => void;
  minWidth?: number | null;
  adjustForFiltering?: boolean;
  svgUniqueId: string;
  onFocus: (focus: InternalFocus) => void;
  onSeriesFilter: (seriesId: string) => void;
  onClose: () => void;
  onEscape?: () => void;
  valueAxisFocusPercentages: FocusPercentageMap;
  seriesFocusPercentages: FocusPercentageMap;
}

interface TooltipContentState { rovingRowKey: string | null }

type AlignedLineEl = El & { leftHandle: El; labelHandle: El; spacerHandle: El; valueHandle: El };
type PlainLineEl = El & { textHandle: El };

const itemPadding = 2;

// longhands only: a row that becomes the last row must have its bottom padding written back, not cleared.
// border-box: the visible rows take the sizer's measured width as minWidth, which already includes this padding
const baseLineStyle = {
  whiteSpace: 'nowrap',
  boxSizing: 'border-box',
  paddingTop: itemPadding,
  paddingRight: itemPadding,
  paddingBottom: itemPadding,
  paddingLeft: itemPadding
};

const alignedLineStyle = {
  overflow: 'auto',
  whiteSpace: 'nowrap'
};

export class TooltipCategoryLine extends Renderer<TooltipCategoryLineProps> {
  root = htmlEl('div');
  text = textEl();

  onKeyDown = (event: Event) => {
    const { key } = event as KeyboardEvent;
    if (key === 'Enter' || key === ' ') {
      event.preventDefault();
      this.props.onClick(event);
    }
  }

  onPointerEnter = (event: Event) => {
    if (isHoverPointer(event)) {
      this.props.onPointerEnter(event);
    }
  }

  // keyboard focus mirrors hover, so the focused row highlights the same way; a tap or click
  // focuses too, but that focus is not visible and its hover (if any) came from the pointer
  onFocusIn = (event: Event) => {
    if (isKeyboardFocus(event)) {
      this.props.onPointerEnter(event);
    }
  }

  onFocusOut = (event: Event) => {
    this.props.onPointerLeave(event);
  }

  create() {
    this.root.append(this.text);
    return this.root.node;
  }

  sync() {
    const { lineStyle, categoryLabel, categoryText, rowKey, interactive, tabStop, onPointerLeave, onClick } = this.props;
    this.root.set({ className: mochartCssClasses['tooltipCategoryLine'], style: lineStyle,
      'data-row-key': interactive ? rowKey : null,
      tabindex: interactive ? (tabStop ? '0' : '-1') : null,
      role: interactive ? 'button' : null,
      onPointerEnter: this.onPointerEnter, onPointerLeave, onClick,
      onKeyDown: interactive ? this.onKeyDown : null,
      onFocusIn: interactive ? this.onFocusIn : null,
      onFocusOut: interactive ? this.onFocusOut : null });
    this.text.set(categoryLabel + String(categoryText));
  }
}

export class TooltipSeriesLine extends Renderer<TooltipSeriesLineProps> {
  root = htmlEl('div');
  line = this.elSlot(this.root);
  iconSlot: Slot | null = null;
  labelValue: TextEl | null = null;
  valueValue: TextEl | null = null;

  // stable per row, so the content's shared handlers never force a row re-sync
  onRootPointerEnter = (event: Event) => {
    if (isHoverPointer(event)) {
      this.props.onPointerEnter(event, this.props.focusSeriesId);
    }
  }

  onRootClick = (event: Event) => {
    this.props.onClick(event, this.props.focusSeriesId);
  }

  // the icon sits in a different host per layout, so the slot is rebuilt when valueAlign
  // flips; the outgoing one still holds a mounted SeriesColorIcon and has to be destroyed
  private replaceIconSlot(host: El): void {
    if (this.iconSlot !== null) {
      this.releaseRegion(this.iconSlot);
    }
    this.iconSlot = this.slot(host);
  }

  onKeyDown = (event: Event) => {
    const { key } = event as KeyboardEvent;
    if (key === 'Enter' || key === ' ') {
      event.preventDefault();
      this.onRootClick(event);
    }
  }

  // keyboard focus mirrors hover, so the focused row highlights its series; a tap or click
  // focuses too, but that focus is not visible and its hover (if any) came from the pointer
  onFocusIn = (event: Event) => {
    if (isKeyboardFocus(event)) {
      this.props.onPointerEnter(event, this.props.focusSeriesId);
    }
  }

  onFocusOut = (event: Event) => {
    this.props.onPointerLeave(event);
  }

  create() {
    return this.root.node;
  }

  buildAlignedLine(): AlignedLineEl {
    const container = htmlEl('div') as AlignedLineEl;
    const left = htmlEl('span');
    this.replaceIconSlot(left);
    const label = htmlEl('span');
    this.labelValue = textEl();
    label.append(this.labelValue);
    left.append(label);
    const spacer = htmlEl('span');
    const value = htmlEl('span');
    this.valueValue = textEl();
    value.append(this.valueValue);
    container.append(left, spacer, value);
    container.leftHandle = left;
    container.labelHandle = label;
    container.spacerHandle = spacer;
    container.valueHandle = value;
    return container;
  }

  buildPlainLine(): PlainLineEl {
    const container = htmlEl('span') as PlainLineEl;
    this.replaceIconSlot(container);
    const text = htmlEl('span');
    this.labelValue = textEl();
    text.append(this.labelValue);
    container.append(text);
    container.textHandle = text;
    return container;
  }

  sync() {
    const { mochartConfig, seriesConfig, seriesIndex, seriesIsFiltered, seriesFocusPercentage,
      colorPaletteConfig, svgUniqueId, visible, labelText, valueText, style, rowKey, interactive, tabStop, showsFilterState,
      onPointerLeave } = this.props;
    const { tooltip: tooltipConfig } = mochartConfig;

    this.root.set({ className: mochartCssClasses['tooltipSeriesLine'] + seriesConfig.id, style,
      'data-row-key': interactive ? rowKey : null,
      tabindex: interactive ? (tabStop ? '0' : '-1') : null,
      role: interactive ? 'button' : null,
      // pressed = series shown; toggling filters it out
      'aria-pressed': showsFilterState ? String(!seriesIsFiltered) : null,
      onPointerEnter: this.onRootPointerEnter, onPointerLeave, onClick: this.onRootClick,
      onKeyDown: interactive ? this.onKeyDown : null,
      onFocusIn: interactive ? this.onFocusIn : null,
      onFocusOut: interactive ? this.onFocusOut : null });

    // html, so this has to be a style: a top-level prop would be written as an attribute, which means nothing here
    const labelStyle = { textDecoration: tooltipConfig.strikeThroughFiltered && seriesIsFiltered ? 'line-through' : null };

    const iconProps = {
      seriesContextConfig: tooltipConfig, seriesConfig, pieMode: mochartConfig.chart.type === CHART_TYPE_PIE,
      focusPercentage: seriesFocusPercentage, colorPaletteConfig, seriesIndex,
      svgUniqueId: svgUniqueId + '-tooltip', seriesShowColorProperty: 'showColorInTooltip' as const,
      seriesIsFiltered, iconClassName: mochartCssClasses['tooltipLineIcon'],
      visible, renderHTML: true
    };

    if (tooltipConfig.valueAlign === ALIGN_RIGHT) {
      const container = this.line.set('aligned', () => this.buildAlignedLine()) as AlignedLineEl;
      container.set({ style: alignedLineStyle });
      container.leftHandle.set({ style: { float: 'left' } });
      this.iconSlot!.set(SeriesColorIcon, iconProps);
      container.labelHandle.set({ className: mochartCssClasses['tooltipLineLabel'], style: labelStyle });
      this.labelValue!.set(labelText);
      container.spacerHandle.set({ style: { float: 'left', width: 2, height: 4 } });
      container.valueHandle.set({ className: mochartCssClasses['tooltipLineValue'], style: { float: 'right' } });
      this.valueValue!.set(valueText);
    }
    else {
      const container = this.line.set('plain', () => this.buildPlainLine()) as PlainLineEl;
      container.set({ className: mochartCssClasses['tooltipLineIcon'] });
      this.iconSlot!.set(SeriesColorIcon, iconProps);
      // label and value share one text node here, so the strike-through covers both
      container.textHandle.set({ className: mochartCssClasses['tooltipLineText'], style: labelStyle });
      this.labelValue!.set(labelText + valueText);
    }
  }
}

export default class TooltipContent extends Renderer<TooltipContentProps, TooltipContentState> {
  root = htmlEl('div');
  controlsContainer = htmlEl('div');
  controls = this.slot(this.controlsContainer);
  linesContainer = htmlEl('div');
  lines = this.rendererList(this.linesContainer);

  constructor() {
    super();
    this.state = { rovingRowKey: null };
  }

  private interactiveRowNodes(): HTMLElement[] {
    return Array.from(this.linesContainer.node.querySelectorAll<HTMLElement>('[data-row-key]'));
  }

  /** any focus landing on a row (Tab, arrows, mouse) makes it the roving tab stop */
  linesFocusIn = (event: Event) => {
    const rowKey = (event.target as Element).getAttribute('data-row-key');
    if (rowKey !== null && rowKey !== this.state.rovingRowKey) {
      this.setState({ rovingRowKey: rowKey });
    }
  }

  linesKeyDown = (event: Event) => {
    moveRovingFocus(event, this.interactiveRowNodes());
  }

  onRootKeyDown = (event: Event) => {
    if ((event as KeyboardEvent).key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.props.onEscape?.();
    }
  }

  /** filtering with showFiltered off unmounts the acted-on row synchronously; keep focus inside the tooltip */
  private restoreRowFocus(activeElement: Element | null): void {
    if (activeElement !== null && activeElement !== document.body && !activeElement.isConnected) {
      const rows = this.interactiveRowNodes();
      const fallback = rows.find(row => row.getAttribute('tabindex') === '0')
        ?? rows[0] ?? this.controlsContainer.node.querySelector('button');
      focusRestored(fallback);
    }
  }

  // the category row's hover-focus stays opt-in (focusCategoryOnHover): its pointerleave
  // clears the category focus, which would break the applyFocus pin as the pointer crosses the tooltip
  onCategoryPointerEnter = (_event: Event) => {
    const { mochartConfig, tooltipCategoryIndex, onFocus } = this.props;
    const { mode } = this.props;
    const { tooltip: tooltipConfig } = mochartConfig;
    const { showControls, focusCategoryOnHover } = tooltipConfig;
    const shouldFocus = focusCategoryOnHover && (showControls ? mode === MODE_FILTER : true);
    if (shouldFocus) {
      this.categoryHoverActive = true;
      onFocus({ categoryIndex: tooltipCategoryIndex });
    }
  }

  // leave mirrors the enter that actually fired, like the series rows below
  categoryHoverActive = false;

  onCategoryPointerLeave = (_event: Event) => {
    const { onFocus } = this.props;
    if (this.categoryHoverActive) {
      this.categoryHoverActive = false;
      onFocus({ categoryIndex: null });
    }
  }

  onCategoryClick = (event: Event) => {
    const { mochartConfig, tooltipCategoryIndex, focusedCategoryIndex, onFocus } = this.props;
    const { mode } = this.props;
    const { tooltip: tooltipConfig } = mochartConfig;
    const { showControls, focusCategoryOnClick } = tooltipConfig;
    const shouldFocus = showControls ? mode === MODE_FOCUS : focusCategoryOnClick;
    if (shouldFocus) {
      event.stopPropagation();
      onFocus({ categoryIndex: focusedCategoryIndex === tooltipCategoryIndex ? -1 : tooltipCategoryIndex });
    }
  }

  onSeriesPointerEnter = (_event: Event, seriesId: string) => {
    const { mochartConfig, tooltipValueObject, onFocus } = this.props;
    const { mode } = this.props;
    const { tooltip: tooltipConfig } = mochartConfig;
    const { showControls, focusSeriesOnHover } = tooltipConfig;
    const shouldFocus = showControls ? mode === MODE_FILTER : focusSeriesOnHover;
    // a filtered series has nothing visible to highlight, like the legend
    if (shouldFocus && tooltipValueObject.series.filteredFlags[seriesId] !== true) {
      this.hoverActive = true;
      onFocus({ seriesId });
    }
  }

  // leave mirrors the enter that actually fired: the filtered flag can flip mid-hover, so it
  // cannot gate the leave, and clearing unconditionally wipes focus set elsewhere
  hoverActive = false;

  onSeriesPointerLeave = (_event: Event) => {
    const { onFocus } = this.props;
    if (this.hoverActive) {
      this.hoverActive = false;
      onFocus({ seriesId: null });
    }
  }

  onSeriesClick = (event: Event, seriesId: string) => {
    const { mode } = this.props;
    const { mochartConfig, focusedSeriesId, onFocus, onSeriesFilter } = this.props;
    const { tooltip: tooltipConfig } = mochartConfig;
    const { showControls, focusSeriesOnClick, filterSeriesOnClick } = tooltipConfig;
    const shouldFocus = showControls ? mode === MODE_FOCUS : focusSeriesOnClick;
    // filterable gates filtering like the legend; the row acts on its leader
    // (followSeries), so the leader's filterable decides
    const shouldFilter = (showControls ? mode === MODE_FILTER : filterSeriesOnClick) &&
      mochartConfig.seriesById[seriesId].filterable;
    if (shouldFocus || shouldFilter) {
      event.stopPropagation();
      const activeElement = document.activeElement;
      // filter before focus, like the legend click: an explicit focus request
      // must land after the filter toggle's derived focus clear
      if (shouldFilter) {
        onSeriesFilter(seriesId);
      }
      if (shouldFocus) {
        if (focusedSeriesId !== undefined && focusedSeriesId !== null) {
          onFocus({ seriesId: seriesId === focusedSeriesId ? null : seriesId });
        }
        else {
          onFocus({ seriesId });
        }
      }
      this.restoreRowFocus(activeElement);
    }
  }

  // row styles keep their identity across syncs unless their inputs change, so unchanged rows can skip
  private lineStyles: LineStyles | null = null;

  private getLineStyles(minWidth: number | null, lineSpacing: number, minTargetSize: number): LineStyles {
    const styles = this.lineStyles;
    if (styles !== null && styles.minWidth === minWidth && styles.lineSpacing === lineSpacing && styles.minTargetSize === minTargetSize) {
      return styles;
    }
    const targetStyle: LineStyle = minTargetSize > 0 ? { minHeight: minTargetSize, cursor: 'pointer' } : { cursor: 'pointer' };
    const lastLineStyle: LineStyle = minWidth !== null ? { ...baseLineStyle, minWidth } : baseLineStyle;
    const lineStyle: LineStyle = { ...lastLineStyle, paddingBottom: lineSpacing };
    return this.lineStyles = { minWidth, lineSpacing, minTargetSize, lineStyle, lastLineStyle,
      targetLineStyle: { ...lineStyle, ...targetStyle }, lastTargetLineStyle: { ...lastLineStyle, ...targetStyle } };
  }

  // the formatters build d3 scales/formats per series; rebuilt only when their inputs change
  private valueFormats: ValueFormats | null = null;

  private getValueFormats(seriesConfigs: EnhancedSeriesConfig[], valueAxisConfigs: EnhancedValueAxisConfig[], axisDomains: AxisDomains): Record<string, ValueFormatter> {
    const cached = this.valueFormats;
    if (cached !== null && cached.seriesConfigs === seriesConfigs && cached.valueAxisConfigs === valueAxisConfigs && cached.axisDomains === axisDomains) {
      return cached.formats;
    }
    const formats = getSeriesFormats(seriesConfigs, valueAxisConfigs, axisDomains);
    this.valueFormats = { seriesConfigs, valueAxisConfigs, axisDomains, formats };
    return formats;
  }

  onClick = (event: Event) => {
    const { mochartConfig, onClose } = this.props;
    const { tooltip: tooltipConfig } = mochartConfig;
    // never reaches the chart root's click, which would toggle the tooltip straight back open
    event.stopPropagation();
    if (tooltipConfig.closeOnClick) {
      event.preventDefault();
      onClose();
    }
  }

  create() {
    this.root.append(this.controlsContainer, this.linesContainer);
    return this.root.node;
  }

  sync() {
    const { mochartConfig, tooltipValueObject, categoryCount, focusedCategoryIndex, visible, tooltipCategoryIndex, updateTooltipCategoryIndex,
      minWidth = null, adjustForFiltering = true, svgUniqueId, onFocus, valueAxisFocusPercentages, seriesFocusPercentages, mode, toggleMode } = this.props;

    const { chart: chartConfig, pie: pieConfig, tooltip: tooltipConfig, categoryAxis: categoryAxisConfig, valueAxes: valueAxisConfigs, series: seriesConfigs, seriesIndicesById: seriesConfigIndicesById, colorPalette: colorPaletteConfig } = mochartConfig;

    const { category, series } = tooltipValueObject;
    const { raw, filtered, filteredFlags } = series;
    // render domains: tickFormat precision needs a real extent, which a collapsed domain lacks
    const { renderAxisDomains } = raw;

    // Percent values come from the same normalized slice fractions as the labels (getPieSliceFractions),
    // built once per tooltip; tooltipConfig.adjustForFiltering picks renormalized vs full-total shares.
    const pieTooltipValueType = pieConfig.tooltip.valueType;
    let piePercentFormat: ((fraction: number) => string) | null = null;
    let rawFractions: Record<string, number> = Object.create(null);
    let adjustedFractions: Record<string, number> = Object.create(null);
    if (chartConfig.type === CHART_TYPE_PIE && pieLabelTypeUsesPercent(pieTooltipValueType)) {
      piePercentFormat = getPieTooltipPercentFormat(pieConfig);
      rawFractions = getPieSliceFractionMap(seriesConfigs, seriesId => raw.values[seriesId]?.plain);
      adjustedFractions = adjustForFiltering && tooltipConfig.adjustForFiltering ?
        getPieSliceFractionMap(seriesConfigs, seriesId => filtered.values[seriesId]?.plain) : rawFractions;
    }

    const accessibility = accessibilityActive(mochartConfig.accessibility);
    // a row is a tab stop only when clicking it would do something (the click handlers'
    // conditions), and only on the shown copy — the hidden sizer must not carry tab stops
    const a11yRows = accessibility && visible;
    const categoryRowInteractive = a11yRows && (tooltipConfig.showControls ? mode === MODE_FOCUS : tooltipConfig.focusCategoryOnClick);
    const seriesRowFocuses = tooltipConfig.showControls ? mode === MODE_FOCUS : tooltipConfig.focusSeriesOnClick;
    const seriesRowFilters = tooltipConfig.showControls ? mode === MODE_FILTER : tooltipConfig.filterSeriesOnClick;
    const interactiveRowKeys: string[] = [];

    this.root.set({ className: mochartCssClasses['tooltipContent'], onClick: this.onClick,
      onKeyDown: accessibility && visible ? this.onRootKeyDown : null });
    this.controls.set(TooltipControls, { mochartConfig, categoryCount, updateTooltipCategoryIndex,
      tooltipCategoryIndex, focusedCategoryIndex,
      onFocus, mode, toggleMode, sizing: !visible, minWidth });

    // the click-target floor for a row, keyed off what a click does rather than off the current mode, copy, or the row's own interactivity
    const { minTargetSize } = mochartConfig.accessibility;
    const categoryRowClickable = tooltipConfig.showControls || tooltipConfig.focusCategoryOnClick;
    const seriesRowClickable = (leaderSeriesId: string): boolean => tooltipConfig.showControls ||
      tooltipConfig.focusSeriesOnClick || (tooltipConfig.filterSeriesOnClick && mochartConfig.seriesById[leaderSeriesId].filterable);
    const { lineStyle, targetLineStyle, lastLineStyle, lastTargetLineStyle } = this.getLineStyles(minWidth, tooltipConfig.lineSpacing, minTargetSize);
    const collapsedLineStyle: LineStyle = { ...lineStyle, height: 0, paddingTop: 0, paddingBottom: 0, overflow: 'hidden' };

    const tooltipLines: RendererItem[] = [];

    // pie charts render a single category, so its value is chart-level noise in the tooltip
    if (tooltipConfig.showCategory) {
      const categoryText = category.values.parsed;
      const categoryFormat = getCategoryFormat(categoryAxisConfig);
      const categoryLabel = categoryAxisConfig.valueLabel !== NONE ? categoryAxisConfig.valueLabel + ": " : "";
      if (categoryRowInteractive) {
        interactiveRowKeys.push('category');
      }
      tooltipLines.push({
        key: 'category',
        ctor: TooltipCategoryLine,
        props: { lineStyle: categoryRowClickable ? targetLineStyle : lineStyle, categoryLabel, categoryText: categoryFormat(categoryText!),
          rowKey: 'category', interactive: categoryRowInteractive, tabStop: false,
          onPointerEnter: this.onCategoryPointerEnter, onPointerLeave: this.onCategoryPointerLeave, onClick: this.onCategoryClick }
      });
    }

    const valueFormats = this.getValueFormats(seriesConfigs, valueAxisConfigs, renderAxisDomains);
    let lastSeriesLineIndex = -1;
    let lastSeriesLineIsTarget = false;
    for (const seriesConfig of seriesConfigs) {
      if (!seriesConfig.showInTooltip) {
        continue;
      }
      const { id: seriesId } = seriesConfig;
      const seriesIndex = seriesConfigIndicesById[seriesId];
      // a follower series (followSeries) focuses and filters as its leader,
      // so a candlestick range row acts on the whole candle
      const focusSeriesId = seriesConfig.followSeries ?? seriesId;
      const seriesIsFiltered = filteredFlags[seriesId];
      const seriesFocusPercentage = getSeriesFocusPercentage(seriesConfig, valueAxisFocusPercentages, seriesFocusPercentages);
      // the sizer keeps a row the visible box drops so the width stays put, but collapses it so the
      // measured height — which positions the box — is the height the visible box will have
      const rowCollapsed = seriesIsFiltered && !tooltipConfig.showFiltered;
      if (!adjustForFiltering || !rowCollapsed) {
        const valueFormat = valueFormats[seriesId];
        const pieValues: PieTooltipValues | undefined = piePercentFormat === null ? undefined : {
          valueType: pieTooltipValueType, percentFormat: piePercentFormat,
          fraction: adjustedFractions[seriesId] ?? 0, rawFraction: rawFractions[seriesId] ?? 0,
          filtered: seriesIsFiltered
        };
        const { labelText, valueText } = getSeriesText(tooltipConfig, seriesConfig, valueFormat, series, adjustForFiltering, pieValues);
        if (valueText !== null) {
          const rowKey = 'series-' + seriesId;
          const rowIsTarget = seriesRowClickable(focusSeriesId);
          if (!rowCollapsed) {
            lastSeriesLineIndex = tooltipLines.length;
            lastSeriesLineIsTarget = rowIsTarget;
          }
          // filtering acts on the leader (followSeries), so its filterable decides
          const rowFilters = seriesRowFilters && mochartConfig.seriesById[focusSeriesId].filterable;
          const rowInteractive = a11yRows && (seriesRowFocuses || rowFilters);
          if (rowInteractive) {
            interactiveRowKeys.push(rowKey);
          }
          tooltipLines.push({
            key: rowKey,
            ctor: TooltipSeriesLine,
            props: { mochartConfig, seriesConfig, seriesIndex, seriesIsFiltered, seriesFocusPercentage,
              colorPaletteConfig, svgUniqueId, visible, labelText, valueText,
              style: rowCollapsed ? collapsedLineStyle : rowIsTarget ? targetLineStyle : lineStyle,
              rowKey, interactive: rowInteractive, tabStop: false,
              showsFilterState: a11yRows && rowFilters, focusSeriesId,
              onPointerEnter: this.onSeriesPointerEnter, onPointerLeave: this.onSeriesPointerLeave, onClick: this.onSeriesClick }
          });
        }
      }
    }

    // the last rendered row drops the bottom padding, not the last config
    if (lastSeriesLineIndex !== -1) {
      (tooltipLines[lastSeriesLineIndex].props as { style: unknown }).style =
        lastSeriesLineIsTarget ? lastTargetLineStyle : lastLineStyle;
    }

    // the remembered roving row keeps the tab stop while it exists; otherwise the first takes it
    const { rovingRowKey } = this.state;
    // config indices, not rendered ones: a row filtering just unmounted still needs a position
    const rowIndicesByKey: Record<string, number> = { category: -1 };
    for (const seriesConfig of seriesConfigs) {
      rowIndicesByKey['series-' + seriesConfig.id] = seriesConfigIndicesById[seriesConfig.id]!;
    }
    const effectiveRovingKey = resolveRovingId(rovingRowKey, interactiveRowKeys, rowIndicesByKey);
    if (effectiveRovingKey !== null) {
      const rovingLine = tooltipLines.find(line => line.key === effectiveRovingKey);
      (rovingLine!.props as { tabStop: boolean }).tabStop = true;
    }

    // the roving rows are one group, named like the legend's (html: kebab-case aria attribute)
    const anyInteractiveRows = interactiveRowKeys.length > 0;
    this.linesContainer.set({ className: mochartCssClasses['tooltipLines'], style: { clear: 'both' },
      role: anyInteractiveRows ? 'group' : null,
      'aria-label': anyInteractiveRows ? mochartConfig.accessibility.tooltipLabel : null,
      onKeyDown: anyInteractiveRows ? this.linesKeyDown : null,
      onFocusIn: anyInteractiveRows ? this.linesFocusIn : null });

    this.lines.sync(tooltipLines);
  }
}
