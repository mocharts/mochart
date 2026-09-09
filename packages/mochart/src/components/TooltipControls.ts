import { Renderer, htmlEl, textEl } from '../render';

import { mochartCssClasses } from '../utils/ChartDom';
import type { EnhancedMochartConfig } from '../types/enhanced';
import type { InternalFocus } from '../types/chart';

interface TooltipControlsProps {
  mochartConfig: EnhancedMochartConfig;
  categoryCount: number;
  focusedCategoryIndex: number;
  tooltipCategoryIndex: number;
  onFocus: (focus: InternalFocus) => void;
  updateTooltipCategoryIndex: (categoryIndex: number) => void;
  toggleMode: () => void;
  mode: TooltipMode;
  sizing?: boolean;
  minWidth?: number | null;
}

export const MODE_FOCUS = 'focus';
export const MODE_FILTER = 'filter';

export type TooltipMode = typeof MODE_FOCUS | typeof MODE_FILTER;

const buttonWidth = 35;

const modeContainerStyle = { flex: '1 1 auto', minWidth: 0 };

const modeStackStyle = { display: 'grid' };
const modeLabelStyle = { gridArea: '1 / 1' };
const modeAltStyle = { gridArea: '1 / 1', visibility: 'hidden' };

// currentColor keeps the buttons legible on any host theme; hover/active tints live in mochart.css
const buttonStyle = {
  width: '100%',
  font: 'inherit',
  fontSize: '0.85em',
  lineHeight: 1.5,
  color: 'inherit',
  background: 'transparent',
  border: '1px solid color-mix(in srgb, currentColor 35%, transparent)',
  borderRadius: 3,
  padding: '0 6px',
  cursor: 'pointer'
};

// aria-disabled rather than disabled: the end buttons stay focusable so keyboard focus is not dropped
const disabledButtonStyle = { ...buttonStyle, opacity: 0.4, cursor: 'default' };

export default class TooltipControls extends Renderer<TooltipControlsProps> {
  root = htmlEl('div');
  prevContainer = htmlEl('div');
  prevButton = htmlEl('button');
  modeContainer = htmlEl('div');
  modeButton = htmlEl('button');
  modeStack = htmlEl('span');
  modeLabel = htmlEl('span');
  modeText = textEl();
  modeAlt = htmlEl('span');
  modeAltText = textEl();
  nextContainer = htmlEl('div');
  nextButton = htmlEl('button');

  onCategoryPrevClick = (event: Event) => {
    const { mochartConfig, tooltipCategoryIndex, onFocus, updateTooltipCategoryIndex } = this.props;
    event.stopPropagation();
    if (tooltipCategoryIndex > 0) {
      const categoryIndex = tooltipCategoryIndex - 1;
      if (mochartConfig.tooltip.applyFocus) {
        onFocus({ categoryIndex });
      }
      updateTooltipCategoryIndex(categoryIndex);
    }
  }

  onCategoryNextClick = (event: Event) => {
    const { mochartConfig, categoryCount, tooltipCategoryIndex, onFocus, updateTooltipCategoryIndex } = this.props;
    event.stopPropagation();
    if (tooltipCategoryIndex >= 0 && tooltipCategoryIndex < categoryCount - 1) {
      const categoryIndex = tooltipCategoryIndex + 1;
      if (mochartConfig.tooltip.applyFocus) {
        onFocus({ categoryIndex });
      }
      updateTooltipCategoryIndex(categoryIndex);
    }
  }

  onTooltipModeClick = (event: Event) => {
    event.stopPropagation();
    const { toggleMode } = this.props;
    toggleMode();
  }

  // clicks in the gaps between buttons must not reach the tooltip's closeOnClick
  onControlsClick = (event: Event) => {
    event.stopPropagation();
  }

  create() {
    this.prevButton.append(textEl('‹'));
    this.prevContainer.append(this.prevButton);
    this.modeLabel.append(this.modeText);
    this.modeAlt.append(this.modeAltText);
    this.modeStack.append(this.modeLabel, this.modeAlt);
    this.modeButton.append(this.modeStack);
    this.modeContainer.append(this.modeButton);
    this.nextButton.append(textEl('›'));
    this.nextContainer.append(this.nextButton);
    this.root.append(this.prevContainer, this.modeContainer, this.nextContainer);
    return this.root.node;
  }

  sync() {
    const { mochartConfig, categoryCount, tooltipCategoryIndex, minWidth, mode, sizing = false } = this.props;
    const { tooltip: tooltipConfig, accessibility: accessibilityConfig } = mochartConfig;
    if (tooltipConfig.showControls) {
      // shown buttons are always click targets, so they take the target floor in both directions
      const { minTargetSize } = accessibilityConfig;
      const targetStyle = minTargetSize > 0 ? { minHeight: minTargetSize } : {};
      const containerStyle = { flex: '0 0 auto', width: Math.max(buttonWidth, minTargetSize) };
      const controlsStyle: Record<string, string | number> = {
        display: 'flex',
        gap: 3,
        width: '100%',
        marginBottom: 3
      };
      if (minWidth != null) {
        controlsStyle.width = minWidth;
        controlsStyle.minWidth = minWidth;
      }

      const prevDisabled = tooltipCategoryIndex <= 0;
      const nextDisabled = tooltipCategoryIndex < 0 || tooltipCategoryIndex >= categoryCount - 1;

      this.setPresent(true);
      this.root.set({ className: mochartCssClasses['tooltipControls'], style: controlsStyle, onClick: this.onControlsClick });
      this.prevContainer.set({ style: containerStyle });
      // native buttons are tab stops by default; a decorative-hidden chart must not have any
      const buttonTabindex = accessibilityConfig.hidden ? '-1' : null;
      this.prevButton.set({ type: 'button', style: { ...(prevDisabled ? disabledButtonStyle : buttonStyle), ...targetStyle },
        title: accessibilityConfig.tooltipPreviousLabel, 'aria-label': accessibilityConfig.tooltipPreviousLabel,
        'aria-disabled': prevDisabled ? 'true' : null, tabindex: buttonTabindex, onClick: this.onCategoryPrevClick });
      this.modeContainer.set({ style: modeContainerStyle });
      this.modeButton.set({ type: 'button', style: { ...buttonStyle, ...targetStyle }, tabindex: buttonTabindex, onClick: this.onTooltipModeClick });
      this.modeStack.set({ style: modeStackStyle });
      this.modeLabel.set({ style: modeLabelStyle });
      this.modeText.set(mode === MODE_FILTER ? tooltipConfig.filterModeText : tooltipConfig.focusModeText);
      this.modeAlt.set({ style: modeAltStyle });
      this.modeAltText.set(sizing ? (mode === MODE_FILTER ? tooltipConfig.focusModeText : tooltipConfig.filterModeText) : '');
      this.nextContainer.set({ style: containerStyle });
      this.nextButton.set({ type: 'button', style: { ...(nextDisabled ? disabledButtonStyle : buttonStyle), ...targetStyle },
        title: accessibilityConfig.tooltipNextLabel, 'aria-label': accessibilityConfig.tooltipNextLabel,
        'aria-disabled': nextDisabled ? 'true' : null, tabindex: buttonTabindex, onClick: this.onCategoryNextClick });
    }
    else {
      this.setPresent(false);
    }
  }
}
