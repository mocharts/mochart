import validators from './validators.js';
import getSeriesIconValidators from './seriesIconConfig.js';

import { NONE, TOOLTIP_VALUE_ALIGNS } from '../core/constants.js';
import type { DeepPartial, TooltipConfig } from '../../types/config.js';

// a following tooltip ignores the pointer, so nothing inside it can be clicked or hovered
const followPointerRule = { condition: ({ followPointer }: DeepPartial<TooltipConfig>) => followPointer === true, suffix: 'when followPointer is true' };
const defaultRule = { condition: () => true };

export default function getValidators(config: DeepPartial<TooltipConfig> = {}) {
  const unreachableUnderFollow = () => validators.conditional([
    { ...followPointerRule, validator: validators.equal(false) },
    { ...defaultRule, validator: validators.boolean() }
  ], config);
  return {
    visible: validators.boolean(),
    applyFocus: validators.boolean(),
    snapToCategory: validators.boolean(),
    followPointer: validators.boolean(),
    closeOnClick: validators.boolean(),
    filterSeriesOnClick: unreachableUnderFollow(),
    focusCategoryOnClick: unreachableUnderFollow(),
    focusSeriesOnClick: unreachableUnderFollow(),
    focusCategoryOnHover: unreachableUnderFollow(),
    focusSeriesOnHover: unreachableUnderFollow(),
    showCategory: validators.boolean(),
    showControls: unreachableUnderFollow(),
    filterModeText: validators.string(),
    focusModeText: validators.string(),
    keepInside: validators.boolean(),
    padding: validators.padding(),
    lineSpacing: validators.numberMin(0),
    valueAlign: validators.oneOf(TOOLTIP_VALUE_ALIGNS),
    // cssStyle / cssColor, not style / color: the tooltip is html, so 'none' is not a valid color here.
    backgroundStyle: validators.cssStyle(),
    font: validators.font(),
    cornerRadius: validators.numberMin(0),
    dropShadow: validators.partialObjectWithShape({
      color: validators.cssColor(),
      // negative offsets cast the css box-shadow up/left; only the blur radius must stay >= 0
      offsetX: validators.number(),
      offsetY: validators.number(),
      blurRadius: validators.numberMin(0)
    }, true),
    icon: validators.partialObjectWithShape(getSeriesIconValidators(), true),
    strikeThroughFiltered: validators.boolean(),
    adjustForFiltering: validators.boolean(),
    adjustSizeForFiltering: validators.boolean(),
    showFiltered: validators.boolean(),
    showMissingValues: validators.boolean(),
    missingValueText: validators.string(),
    filteredValueText: validators.string().orEqual(NONE),
    filteredValueCharacter: validators.stringWithLength(1).orEqual(NONE),
    rangeValueSeparator: validators.string()
  };
}
