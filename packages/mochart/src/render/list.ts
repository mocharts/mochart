import { El } from './el';
import type { ErasedRenderer, RendererClass } from './renderer';

export type ListKey = string | number;

interface KeyedEntry {
  key: ListKey;
}

interface KeyedListOps<T, E extends KeyedEntry> {
  key(item: T, index: number): ListKey;
  /** Whether a same-key entry can be updated in place (default: always). */
  matches?(entry: E, item: T): boolean;
  /** Creates the entry and inserts its DOM before the list anchor. */
  create(item: T, index: number): E;
  update(entry: E, item: T, index: number): void;
}

/**
 * Shared skeleton of the keyed reconcilers below: entries are matched by
 * key, updated in place, created/removed as needed, then reordered with
 * minimal moves. Subclasses supply the per-entry DOM primitives. All nodes
 * live before the comment anchor.
 */
abstract class KeyedList<T, E extends KeyedEntry> {
  readonly hostNode: Node;
  readonly anchor: Comment;
  protected entries: E[] = [];
  protected abstract readonly label: string;

  constructor(hostNode: Node, before: Node | null) {
    this.hostNode = hostNode;
    this.anchor = document.createComment('');
    hostNode.insertBefore(this.anchor, before);
  }

  protected abstract destroyEntry(entry: E, removeDom: boolean): void;
  protected abstract firstNode(entry: E): Node;
  protected abstract lastNode(entry: E): Node;
  protected abstract moveBefore(entry: E, ref: Node): void;

  protected reconcile(items: readonly T[], ops: KeyedListOps<T, E>): void {
    const oldByKey = new Map<ListKey, E>();
    for (const entry of this.entries) {
      const clash = oldByKey.get(entry.key);
      if (clash !== undefined) {
        // duplicate keys break matching (the map keeps only the last entry);
        // destroy the older entry here so its DOM cannot leak
        console.warn('mochart ' + this.label + ' has duplicate key: ' + String(entry.key));
        this.destroyEntry(clash, true);
      }
      oldByKey.set(entry.key, entry);
    }

    const next: E[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const key = ops.key(item, i);
      const old = oldByKey.get(key);
      if (old !== undefined && (ops.matches === undefined || ops.matches(old, item))) {
        oldByKey.delete(key);
        ops.update(old, item, i);
        next.push(old);
      }
      else {
        if (old !== undefined) {
          oldByKey.delete(key);
          this.destroyEntry(old, true);
        }
        next.push(ops.create(item, i));
      }
    }

    for (const leftover of oldByKey.values()) {
      this.destroyEntry(leftover, true);
    }

    // minimal-move reordering, walking the desired order back to front
    let ref: Node = this.anchor;
    for (let i = next.length - 1; i >= 0; i--) {
      const entry = next[i];
      if (this.lastNode(entry).nextSibling !== ref) {
        this.moveBefore(entry, ref);
      }
      ref = this.firstNode(entry);
    }

    this.entries = next;
  }

  destroy(removeDom: boolean): void {
    for (const entry of this.entries) {
      this.destroyEntry(entry, removeDom);
    }
    this.entries = [];
    if (removeDom && this.anchor.parentNode) {
      this.anchor.parentNode.removeChild(this.anchor);
    }
  }
}

/** A block managed by ElList: a handle object exposing its root El. */
export interface ElBlock {
  root: El;
}

export interface ElListAdapter<T, H extends ElBlock> {
  key(item: T, index: number): ListKey;
  create(item: T, index: number): H;
  update(handle: H, item: T, index: number): void;
}

interface ElListEntry<H> {
  key: ListKey;
  handle: H;
}

/**
 * A keyed list of retained element subtrees (no component lifecycle) — the
 * old keyed vdom reconciler's enter/update/exit.
 */
export class ElList<T, H extends ElBlock = ElBlock> extends KeyedList<T, ElListEntry<H>> {
  protected readonly label = 'list';

  sync(items: readonly T[], adapter: ElListAdapter<T, H>): void {
    this.reconcile(items, {
      key: (item, index) => adapter.key(item, index),
      create: (item, index) => {
        const handle = adapter.create(item, index);
        adapter.update(handle, item, index);
        this.hostNode.insertBefore(handle.root.node, this.anchor);
        return { key: adapter.key(item, index), handle };
      },
      update: (entry, item, index) => adapter.update(entry.handle, item, index),
    });
  }

  protected destroyEntry(entry: ElListEntry<H>, removeDom: boolean): void {
    const node = entry.handle.root.node;
    if (removeDom && node.parentNode) {
      node.parentNode.removeChild(node);
    }
  }

  protected firstNode(entry: ElListEntry<H>): Node {
    return entry.handle.root.node;
  }

  protected lastNode(entry: ElListEntry<H>): Node {
    return entry.handle.root.node;
  }

  protected moveBefore(entry: ElListEntry<H>, ref: Node): void {
    this.hostNode.insertBefore(entry.handle.root.node, ref);
  }
}

export interface RendererItem<P extends object = any> {
  key: ListKey;
  ctor: RendererClass<P>;
  props: P;
}

interface RendererEntry {
  key: ListKey;
  ctor: RendererClass;
  renderer: ErasedRenderer;
}

/**
 * A keyed list of child renderers (components with lifecycle). Matched by
 * key + class like the old keyed vdom reconciler. Each renderer occupies a
 * contiguous span [firstNode .. anchor] in the host, so pass-through
 * renderers with self-anchored regions reorder like rooted ones.
 */
export class RendererList extends KeyedList<RendererItem, RendererEntry> {
  protected readonly label = 'renderer list';

  private readonly ops: KeyedListOps<RendererItem, RendererEntry> = {
    key: (item) => item.key,
    matches: (entry, item) => entry.ctor === item.ctor,
    create: (item) => {
      const renderer = new item.ctor();
      renderer.mount(this.hostNode, this.anchor, item.props);
      return { key: item.key, ctor: item.ctor, renderer };
    },
    update: (entry, item) => entry.renderer.update(item.props),
  };

  sync(items: readonly RendererItem[]): void {
    this.reconcile(items, this.ops);
  }

  protected destroyEntry(entry: RendererEntry, removeDom: boolean): void {
    entry.renderer.destroy(removeDom);
  }

  protected firstNode(entry: RendererEntry): Node {
    return entry.renderer.firstNode;
  }

  protected lastNode(entry: RendererEntry): Node {
    return entry.renderer.anchor;
  }

  protected moveBefore(entry: RendererEntry, ref: Node): void {
    entry.renderer.moveBefore(ref);
  }
}
