import validators from './validators';

import { NONE, STYLE_SAME } from '../core/constants';

import type { Validator } from '@mochart/movalid';

export type StyleMember = 'strokeColor' | 'strokeOpacity' | 'strokeWidth' | 'strokeDashArray' | 'fillColor' | 'fillOpacity';

export const lineMembers: StyleMember[] = ['strokeColor', 'strokeOpacity', 'strokeWidth', 'strokeDashArray'];
export const styleMembers: StyleMember[] = ['strokeColor', 'strokeOpacity', 'strokeWidth', 'strokeDashArray', 'fillColor', 'fillOpacity'];

export type StyleColorValidator = (allowSame: boolean) => Validator;

// The colour keywords differ per section (axis vs series), the rest of the members validate the same everywhere.
export function createStyleValidators(color: StyleColorValidator) {
  function memberValidator(member: StyleMember, allowSame: boolean): Validator {
    switch (member) {
      case 'strokeColor':
      case 'fillColor':
        return color(allowSame);
      case 'strokeOpacity':
      case 'fillOpacity':
        return validators.opacity();
      case 'strokeWidth':
        // null (leave the attribute unset) is a supported width — getFocusStrokeWidth handles it
        return allowSame ? validators.numberMin(0).orOneOf([NONE, STYLE_SAME]) : validators.numberMin(0).orEqual(NONE);
      case 'strokeDashArray':
        return allowSame ? validators.dashArray().orOneOf([NONE, STYLE_SAME]) : validators.dashArray().orEqual(NONE);
    }
  }

  // Partial, and extra members pass: an unknown member is reported once by the unknown-key walk.
  function styleShape(members: StyleMember[], allowSame: boolean) {
    const shape: Record<string, Validator> = {};
    for (const member of members) {
      shape[member] = memberValidator(member, allowSame);
    }
    return validators.partialObjectWithShape(shape, true);
  }

  function styleStates(members: StyleMember[]) {
    return validators.partialObjectWithShape({
      normal: styleShape(members, false),
      focused: styleShape(members, true),
      defocused: styleShape(members, true)
    }, true);
  }

  return { styleShape, styleStates };
}
