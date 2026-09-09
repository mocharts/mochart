// the width and height helpers are used as an interchangeable pair, so a fractional input has to round the same way on both axes
import { describe, it, expect } from 'vitest';
import {
  getOuterWidth, getInnerWidth, getOuterHeight, getInnerHeight,
  getSpacingOuterWidth, getSpacingOuterHeight, getSpacingInnerWidth, getSpacingInnerHeight
} from '../../src/layout/SpacingLayoutInfo';

const spacing = { top: 2, right: 3, bottom: 2, left: 3 };

describe('spacing helpers round alike on both axes', () => {
  it('rounds a fractional extent up, outer and inner', () => {
    expect(getOuterHeight(10.25, spacing)).toBe(15);
    expect(getInnerHeight(10.25, spacing)).toBe(7);
    expect(getOuterWidth(10.25, spacing)).toBe(17);
    expect(getInnerWidth(10.25, spacing)).toBe(5);
  });

  it('rounds through the bounds-taking wrappers too', () => {
    expect(getSpacingOuterHeight({ height: 10.25 }, spacing)).toBe(15);
    expect(getSpacingInnerHeight({ height: 10.25 }, spacing)).toBe(7);
    expect(getSpacingOuterWidth({ width: 10.25 }, spacing)).toBe(17);
    expect(getSpacingInnerWidth({ width: 10.25 }, spacing)).toBe(5);
  });

  it('leaves a whole extent alone', () => {
    expect(getOuterHeight(10, spacing)).toBe(14);
    expect(getInnerHeight(10, spacing)).toBe(6);
  });
});
