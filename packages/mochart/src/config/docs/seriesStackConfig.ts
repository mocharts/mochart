export default function getDescriptions() {
  return {
    axis: 'the unique identifier of the value axis that the series stack belongs to',
    id: 'the unique identifier for the series stack so it can be referenced by series that belong to it',
    ignore: 'whether to ignore this series stack and treat it as though it were not specified',
    outerCap: {
      description: 'the cap drawn on the outer end of the stack, on the series that are its outer series',
      properties: {
        size: 'the size of the cap (in pixels) for series that are an outer series of the stack',
        type: 'the type (point, curve, round, use null for none) of cap for series that are an outer series of the stack',
        expand: 'whether to expand the base of caps for series that are an outer series of the stack when the size of the cap is greater than the extent of the bar'
      }
    }
  };
}
export function getDetails() {
  return {
    id: 'Referenced by `series[].stack` to place series in this stack. Stacked series draw on top of one another and animate as a single gapless unit — each segment’s baseline follows the tweened top of the segment below it throughout a transition.',
    outerCap: { properties: { type: 'Caps only the outer end of the whole stack rather than every segment; pairs with `series[].cap.onlyStackOuter`.' } }
  };
}
