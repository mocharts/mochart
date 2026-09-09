import { partialStyle } from './shared';

const lineMembers = ['strokeColor', 'strokeOpacity', 'strokeWidth', 'strokeDashArray'];

export default function getDescriptions() {
  return {
    visible: 'whether or not crosshairs should be shown when a category or series is focused',
    applyFocus: 'whether to change the focused category as the crosshairs are shown or hidden, and as the pointer moves when the tooltip\'s followPointer is on',
    categoryLine: {
      description: 'the crosshair lines shown for the focused category',
      properties: {
        visible: 'whether or not these crosshair lines should be shown',
        style: partialStyle('the style of these crosshair lines', lineMembers)
      }
    },
    seriesLine: {
      description: 'the crosshair lines shown for the focused series',
      properties: {
        visible: 'whether or not these crosshair lines should be shown',
        style: partialStyle('the style of these crosshair lines', lineMembers)
      }
    },
    showBehindTooltip: 'whether to show the crosshair lines for sections where they are overlapped by the tooltip'
  };
}
