
import validators from './validators';

const palette = () => validators.partialObjectWith(['strokeColors', 'fillColors'], validators.arrayOf(validators.color(), false));

const paletteStates = () => validators.partialObjectWithShape({
  normal: palette(),
  focused: palette(),
  defocused: palette()
}, true);

export default function getValidators() {
  return {
    shape: paletteStates(),
    marker: paletteStates(),
    label: paletteStates(),
    errorBar: paletteStates()
  };
}
