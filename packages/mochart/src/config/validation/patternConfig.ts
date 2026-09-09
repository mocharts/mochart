import validators from './validators';
import {
  COLOR_SERIES, PATTERN_TYPES, PATTERN_TYPE_CROSSHATCH, PATTERN_TYPE_DOTS, PATTERN_TYPE_LINES
} from '../core/constants';
import type { PatternConfig } from '../../types/config';

const linePattern = ({ type }: Partial<PatternConfig>) => type === PATTERN_TYPE_LINES || type === PATTERN_TYPE_CROSSHATCH;
const dotPattern = ({ type }: Partial<PatternConfig>) => type === PATTERN_TYPE_DOTS;
const defaultRule = { condition: () => true };

export default function getValidators(config: Partial<PatternConfig>) {
  const patternColor = () => validators.svgColor().orEqual(COLOR_SERIES);
  return {
    id: validators.id(),
    ignore: validators.boolean(),
    type: validators.oneOf(PATTERN_TYPES),
    spacing: validators.numberMin(1),
    foregroundColor: patternColor(),
    foregroundOpacity: validators.opacity(),
    backgroundColor: patternColor().orEqual(null),
    backgroundOpacity: validators.opacity(),
    rotation: validators.conditional([
      { condition: linePattern, suffix: 'when type is lines or crosshatch', validator: validators.numberMinMax(-360, 360) },
      { ...defaultRule, suffix: 'when type is dots', validator: validators.equal(undefined) }
    ], config),
    lineWidth: validators.conditional([
      { condition: linePattern, suffix: 'when type is lines or crosshatch', validator: validators.numberMin(0) },
      { ...defaultRule, suffix: 'when type is dots', validator: validators.equal(undefined) }
    ], config),
    radius: validators.conditional([
      { condition: dotPattern, suffix: 'when type is dots', validator: validators.numberMin(0) },
      { ...defaultRule, suffix: 'when type is lines or crosshatch', validator: validators.equal(undefined) }
    ], config)
  };
}
