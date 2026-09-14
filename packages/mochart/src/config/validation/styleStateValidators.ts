import validators from './validators';

import { NONE, STYLE_SAME, MAJOR } from '../core/constants';

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
        return allowSame ? validators.opacity().orEqual(STYLE_SAME) : validators.opacity();
      case 'strokeWidth':
        // null (leave the attribute unset) is a supported width — getFocusStrokeWidth handles it
        return allowSame ? validators.numberMin(0).orOneOf([NONE, STYLE_SAME]) : validators.numberMin(0).orEqual(NONE);
      case 'strokeDashArray':
        return allowSame ? validators.dashArray().orOneOf([NONE, STYLE_SAME]) : validators.dashArray().orEqual(NONE);
    }
  }

  // Partial, and extra members pass: an unknown member is reported once by the unknown-key walk.
  // A minor tick style (allowMajor) also takes "major" in any member, the matching non-minor member's value.
  function styleShape(members: StyleMember[], allowSame: boolean, allowMajor = false) {
    const shape: Record<string, Validator> = {};
    for (const member of members) {
      const validator = memberValidator(member, allowSame);
      shape[member] = allowMajor ? validator.orEqual(MAJOR) : validator;
    }
    return validators.partialObjectWithShape(shape, true);
  }

  function styleStates(members: StyleMember[], allowMajor = false) {
    return validators.partialObjectWithShape({
      normal: styleShape(members, false, allowMajor),
      focused: styleShape(members, true, allowMajor),
      defocused: styleShape(members, true, allowMajor)
    }, true);
  }

  return { styleShape, styleStates };
}
