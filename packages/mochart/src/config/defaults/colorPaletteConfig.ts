const defaultColors = ["#4477aa", "#ee6677", "#228833", "#ccbb44", "#66ccee", "#aa3377", "#bbbbbb"];

// fresh arrays per call: getDefaults is public, so its result must not alias module state or another state's list
const defaultState = () => ({
  strokeColors: [...defaultColors],
  fillColors: [...defaultColors]
});

const defaultPalette = () => ({
  normal: defaultState(),
  focused: defaultState(),
  defocused: defaultState()
});

// error bars draw strokes only
const defaultStrokeState = () => ({ strokeColors: [...defaultColors] });

const defaultStrokePalette = () => ({
  normal: defaultStrokeState(),
  focused: defaultStrokeState(),
  defocused: defaultStrokeState()
});

export default function getDefaults() {
  return {
    shape: defaultPalette(),
    marker: defaultPalette(),
    label: defaultPalette(),
    errorBar: defaultStrokePalette()
  };
}
