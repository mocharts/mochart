import { focusRestored } from './utils';
import { NONE } from '../config/core/constants';
import type { EnhancedSeriesConfig } from '../types/enhanced';

type FocusableNode = SVGElement | HTMLElement;

/** Arrow/Home/End move focus within `nodes` (clamped, no wrap); other keys are left alone */
export function moveRovingFocus(event: Event, nodes: FocusableNode[]): void {
  const { key } = event as KeyboardEvent;
  const index = nodes.indexOf(event.target as FocusableNode);
  if (index === -1) {
    return;
  }
  let nextIndex: number;
  if (key === 'ArrowRight' || key === 'ArrowDown') {
    nextIndex = Math.min(index + 1, nodes.length - 1);
  }
  else if (key === 'ArrowLeft' || key === 'ArrowUp') {
    nextIndex = Math.max(index - 1, 0);
  }
  else if (key === 'Home') {
    nextIndex = 0;
  }
  else if (key === 'End') {
    nextIndex = nodes.length - 1;
  }
  else {
    return;
  }
  event.preventDefault();
  if (nextIndex !== index) {
    nodes[nextIndex].focus();
  }
}

/** series nodes under `root` in config order (the DOM is focus-ordered, so it cannot drive navigation) */
export function seriesNodesInConfigOrder(root: Element, seriesConfigs: EnhancedSeriesConfig[]): SVGElement[] {
  const nodeById = new Map<string, SVGElement>();
  for (const node of root.querySelectorAll<SVGElement>('g[data-series-id]')) {
    nodeById.set(node.getAttribute('data-series-id')!, node);
  }
  const nodes: SVGElement[] = [];
  for (const seriesConfig of seriesConfigs) {
    const node = nodeById.get(seriesConfig.id);
    if (node !== undefined) {
      nodes.push(node);
    }
  }
  return nodes;
}

/** the remembered roving id keeps the tab stop while interactive; when gone, the nearest following
 * config-order neighbour inherits it, else the last; with no memory, the first */
export function resolveRovingId(rovingId: string | null, interactiveIds: string[], indicesById: Record<string, number>): string | null {
  if (rovingId !== null && interactiveIds.indexOf(rovingId) !== -1) {
    return rovingId;
  }
  if (rovingId !== null && interactiveIds.length > 0) {
    const removedIndex = indicesById[rovingId] ?? -1;
    return interactiveIds.find(id => indicesById[id] > removedIndex) ?? interactiveIds[interactiveIds.length - 1];
  }
  return interactiveIds[0] ?? null;
}

/** the focused series node under `root`, captured before a sync that may move or drop it */
export function focusedSeriesNode(root: Element): SVGElement | null {
  const activeElement = document.activeElement;
  return activeElement !== null && root.contains(activeElement) &&
    activeElement.getAttribute('data-series-id') !== null ? activeElement as SVGElement : null;
}

/** refocus the captured node if it was only moved; if it is gone, focus the node holding the tab stop */
export function restoreSeriesFocus(root: Element, focusedNode: SVGElement | null, rovingId: string | null): void {
  if (focusedNode === null || document.activeElement === focusedNode) {
    return;
  }
  if (focusedNode.isConnected) {
    focusRestored(focusedNode);
  }
  else if (rovingId !== null) {
    for (const node of root.querySelectorAll<SVGElement>('g[data-series-id]')) {
      if (node.getAttribute('data-series-id') === rovingId) {
        focusRestored(node);
        break;
      }
    }
  }
}

/** a cartesian series is keyboard-reachable when clicking it does something; followers stay pointer-only */
export function seriesIsInteractive(accessibility: boolean, seriesConfig: EnhancedSeriesConfig, onSeriesShapeClick: unknown): boolean {
  return accessibility && seriesConfig.followSeries === NONE && (seriesConfig.focusOnClick || onSeriesShapeClick !== null);
}

/** a pie slice is keyboard-reachable when clicking it does something (focus or selection); followers stay pointer-only */
export function sliceIsInteractive(accessibility: boolean, seriesConfig: EnhancedSeriesConfig, onSliceClick: unknown): boolean {
  return accessibility && seriesConfig.followSeries === NONE && (seriesConfig.focusOnClick || onSliceClick !== undefined);
}
