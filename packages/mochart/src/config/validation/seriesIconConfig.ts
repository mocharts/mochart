import validators from './validators';
import { AUTO } from '../core/constants';

// The SeriesIconConfig members, the `icon` group of the legend and tooltip validators.
export default function getValidators() {
  return {
    showColors: validators.boolean(),
    showShapes: validators.boolean(),
    showPlaceholders: validators.boolean(),
    size: validators.numberMin(0).orEqual(AUTO),
    spacing: validators.numberMin(0),
    // svgColor, not color / cssColor: the icons are svg (even inside the html tooltip), so 'currentColor' and 'none' are valid here.
    borderStyle: validators.partialObjectWithShape({
      strokeColor: validators.svgColor(),
      strokeOpacity: validators.opacity(),
      strokeWidth: validators.numberMin(0)
    }, true),
    filteredColor: validators.svgColor(),
    unfilteredColor: validators.svgColor()
  };
}
