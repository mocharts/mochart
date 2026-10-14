import { colorPaletteDescriptions } from './shared.js';
import type { DescriptionMap, NestedDescription } from './shared.js';

function palettes(element: string, descriptions: DescriptionMap = colorPaletteDescriptions): NestedDescription {
  return {
    description: 'the color palettes to use for series ' + element + ' that are colored by series or category index',
    properties: {
      normal: { description: 'the palette to use while nothing has focus', properties: descriptions },
      focused: { description: 'the palette to use for the focused ' + element, properties: descriptions },
      defocused: { description: 'the palette to use for the defocused ' + element, properties: descriptions }
    }
  };
}

// error bars draw strokes only, so their palettes hold no fill colors
const strokePaletteDescriptions: DescriptionMap = { strokeColors: colorPaletteDescriptions.strokeColors! };

export default function getDescriptions() {
  return {
    shape: palettes('shapes'),
    marker: palettes('markers'),
    label: palettes('labels'),
    errorBar: palettes('error bars', strokePaletteDescriptions)
  };
}
export function getDetails() {
  return {
    shape: 'The fallback coloring for series that do not set explicit colors: each series takes the palette entry for its series index (or its category index, for series configured to color by category index). The focused/defocused variants apply while another element has focus. The built-in arrays use Paul Tol\'s <a href="https://sronpersonalpages.nl/~pault/">Bright qualitative color scheme</a>, designed to be color-blind safe.'
  };
}
