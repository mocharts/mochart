export default function getDescriptions() {
  return {
    id: 'the unique identifier for the pattern so that it can be referenced for use',
    ignore: 'whether to ignore this pattern and treat it as though it were not specified',
    type: 'the built-in pattern type (lines, crosshatch, or dots)',
    spacing: 'the screen-space distance (in pixels) between repeated pattern marks',
    foregroundColor: 'the color of the pattern marks: use "series" for the owning series color or "currentColor" to follow the host page CSS color',
    foregroundOpacity: 'the opacity (0 - 1) of the pattern marks',
    backgroundColor: 'the color behind the pattern marks: use "series" for the owning series color, "currentColor" to follow the host page CSS color, or null for a transparent background',
    backgroundOpacity: 'the opacity (0 - 1) of the pattern background when backgroundColor is not null',
    rotation: 'the clockwise rotation (in degrees, -360 to 360) of a lines or crosshatch pattern',
    lineWidth: 'the width (in pixels) of the strokes in a lines or crosshatch pattern',
    radius: 'the radius (in pixels) of each dot in a dots pattern'
  };
}
