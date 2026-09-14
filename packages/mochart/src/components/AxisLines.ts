import { svgEl } from '../render';
import type { El, ElList } from '../render';

import { translate } from '../utils/utils';
import type { StyleAttributes } from '../utils/style';
import type { AxisTick } from '../types/data';

/** A tick a pass draws, with its index in the axis's tick list, which names its class whichever ticks the pass leaves out. */
export interface PassTick { tick: AxisTick; index: number }

/** The ticks a pass draws: those of each kind that are visible and drawn in this pass. */
export function getPassTicks(axisTicks: AxisTick[], majorPass: boolean, minorPass: boolean): PassTick[] {
  const passTicks: PassTick[] = [];
  axisTicks.forEach((tick, index) => {
    if (tick.minor === true ? minorPass : majorPass) {
      passTicks.push({ tick, index });
    }
  });
  return passTicks;
}

const hiddenStyle = {
  visibility: 'hidden'
};

export interface AxisLineHandle {
  root: El;
  line: El;
}

export interface AxisLinesSpec<T> {
  keyPrefix: string;
  /** Indexed class prefix for each line's g wrapper. */
  className: string;
  /** Vertical axes offset lines along y, horizontal along x. */
  vertical: boolean;
  /** The index naming an item's key and class; the list position when absent. */
  index?: (item: T, i: number) => number;
  offset: (item: T) => number;
  hidden?: (item: T) => boolean;
  minorClassName?: string;
  minor?: (item: T) => boolean;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  styleAttributes: StyleAttributes;
  /** The minor lines' own geometry and style, when they differ. */
  minorLine?: { x1: number; y1: number; x2: number; y2: number; styleAttributes: StyleAttributes };
}

function createAxisLine(): AxisLineHandle {
  const root = svgEl('g');
  const line = svgEl('line');
  root.append(line);
  return { root, line };
}

/** Syncs a keyed list of g-wrapped lines placed along an axis (grid lines, tick marks). */
export function syncAxisLines<T>(list: ElList<T, AxisLineHandle>, items: readonly T[], spec: AxisLinesSpec<T>): void {
  const { keyPrefix, className, vertical, index, offset, hidden, minor, minorClassName, x1, y1, x2, y2, styleAttributes, minorLine } = spec;
  const itemIndex = index ?? ((_item: T, i: number) => i);
  list.sync(items, {
    key: (item, i) => keyPrefix + itemIndex(item, i),
    create: createAxisLine,
    update: (handle, item, i) => {
      const position = offset(item);
      const isMinor = minor !== undefined && minor(item);
      const itemClassName = isMinor && minorClassName !== undefined ? className + itemIndex(item, i) + ' ' + minorClassName : className + itemIndex(item, i);
      handle.root.set({ className: itemClassName, transform: vertical ? translate(0, position) : translate(position, 0) });
      const line = isMinor && minorLine !== undefined ? minorLine : { x1, y1, x2, y2, styleAttributes };
      handle.line.set({ x1: line.x1, y1: line.y1, x2: line.x2, y2: line.y2, style: hidden !== undefined && hidden(item) ? hiddenStyle : null, ...line.styleAttributes });
    }
  });
}
