import validators from './validators';
import getSeriesIconValidators from './seriesIconConfig';

import { NONE, TOOLTIP_VALUE_ALIGNS } from '../core/constants';

export default function getValidators() {
  return {
    visible: validators.boolean(),
    applyFocus: validators.boolean(),
    snapToCategory: validators.boolean(),
    followPointer: validators.boolean(),
    closeOnClick: validators.boolean(),
    filterSeriesOnClick: validators.boolean(),
    focusCategoryOnClick: validators.boolean(),
    focusSeriesOnClick: validators.boolean(),
    focusCategoryOnHover: validators.boolean(),
    focusSeriesOnHover: validators.boolean(),
    showCategory: validators.boolean(),
    showControls: validators.boolean(),
    filterModeText: validators.string(),
    focusModeText: validators.string(),
    keepInside: validators.boolean(),
    padding: validators.padding(),
    lineSpacing: validators.numberMin(0),
    valueAlign: validators.oneOf(TOOLTIP_VALUE_ALIGNS),
    // cssStyle / cssColor, not style / color: the tooltip is html, so 'none' is not a valid color here.
    backgroundStyle: validators.cssStyle(),
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
