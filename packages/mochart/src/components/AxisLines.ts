import { svgEl } from '../render';
import type { El, ElList } from '../render';

import { translate } from '../utils/utils';
import type { StyleAttributes } from '../utils/style';

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
  offset: (item: T) => number;
  hidden?: (item: T) => boolean;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  styleAttributes: StyleAttributes;
}

function createAxisLine(): AxisLineHandle {
  const root = svgEl('g');
  const line = svgEl('line');
  root.append(line);
  return { root, line };
}

/** Syncs a keyed list of g-wrapped lines placed along an axis (grid lines, tick marks). */
export function syncAxisLines<T>(list: ElList<T, AxisLineHandle>, items: readonly T[], spec: AxisLinesSpec<T>): void {
  const { keyPrefix, className, vertical, offset, hidden, x1, y1, x2, y2, styleAttributes } = spec;
  list.sync(items, {
    key: (_item, i) => keyPrefix + i,
    create: createAxisLine,
    update: (handle, item, i) => {
      const position = offset(item);
      handle.root.set({ className: className + i, transform: vertical ? translate(0, position) : translate(position, 0) });
      handle.line.set({ x1, y1, x2, y2, style: hidden !== undefined && hidden(item) ? hiddenStyle : null, ...styleAttributes });
    }
  });
}
