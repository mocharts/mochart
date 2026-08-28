import { describe, it, expect, vi } from 'vitest';
import { svgEl, htmlEl, textEl, Renderer, ElList, ElSlot, shallowEqual, El } from '../../src/render';
import { setProperty } from '../../src/render/dom';

function host(): HTMLElement {
  const div = document.createElement('div');
  document.body.appendChild(div);
  return div;
}

/** innerHTML with comment anchors stripped, matching the golden normalization. */
function markup(node: Element): string {
  return node.innerHTML.replace(/<!--[^>]*-->/g, '');
}

describe('El', () => {
  it('sets, updates and removes attributes by diffing', () => {
    const el = htmlEl('div');
    el.set({ id: 'a', title: 'x' });
    expect(el.node.getAttribute('id')).toBe('a');
    el.set({ id: 'b' });
    expect(el.node.getAttribute('id')).toBe('b');
    expect(el.node.hasAttribute('title')).toBe(false);
  });

  it('maps className to class and kebab-cases SVG attributes', () => {
    const el = svgEl('path');
    el.set({ className: 'foo', strokeWidth: 2, fillOpacity: 0.5 });
    expect(el.node.getAttribute('class')).toBe('foo');
    expect(el.node.getAttribute('stroke-width')).toBe('2');
    expect(el.node.getAttribute('fill-opacity')).toBe('0.5');
  });

  it('writes style objects with px suffixes and unitless exceptions', () => {
    const el = htmlEl('div');
    el.set({ style: { width: 10, opacity: 0.5, textAlign: 'center' } });
    const style = (el.node as HTMLElement).style;
    expect(style.width).toBe('10px');
    expect(style.opacity).toBe('0.5');
    expect(style.textAlign).toBe('center');
    el.set({ style: { width: 20 } });
    expect(style.width).toBe('20px');
    expect(style.textAlign).toBe('');
  });

  it('attaches one proxy listener and swaps handlers without re-adding', () => {
    const el = htmlEl('button');
    const first = vi.fn();
    const second = vi.fn();
    el.set({ onClick: first });
    el.node.dispatchEvent(new MouseEvent('click'));
    el.set({ onClick: second });
    el.node.dispatchEvent(new MouseEvent('click'));
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    el.set({});
    el.node.dispatchEvent(new MouseEvent('click'));
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('removes attributes for null/false and writes empty string for true', () => {
    const el = htmlEl('div');
    el.set({ hidden: true, title: 'x' });
    expect(el.node.getAttribute('hidden')).toBe('');
    el.set({ hidden: false, title: null });
    expect(el.node.hasAttribute('hidden')).toBe(false);
    expect(el.node.hasAttribute('title')).toBe(false);
  });
});

describe('TextEl', () => {
  it('updates text content with change detection', () => {
    const t = textEl('a');
    expect(t.node.nodeValue).toBe('a');
    t.set(5);
    expect(t.node.nodeValue).toBe('5');
    t.set(null);
    expect(t.node.nodeValue).toBe('');
  });
});

// ---------------------------------------------------------------------------
// Renderer lifecycle
// ---------------------------------------------------------------------------

interface LeafProps { label: string; calls?: string[] }

class Leaf extends Renderer<LeafProps> {
  root = svgEl('text');
  text = textEl();
  syncCount = 0;

  create() {
    this.root.append(this.text);
    return this.root.node;
  }

  sync() {
    this.syncCount++;
    this.root.set({ className: 'leaf' });
    this.text.set(this.props.label);
  }

  measure(prevProps: LeafProps | null) {
    if (prevProps === null) {
      this.props.calls?.push('leaf measure, attached: ' + this.root.node.isConnected);
    }
  }
}

class Wrapper extends Renderer<{ label: string; calls: string[] }> {
  child!: ReturnType<Renderer<object>['slot']>;

  create() {
    // pass-through renderer: no element of its own
    this.child = this.slot();
    return null;
  }

  sync() {
    this.child.set(Leaf, { label: this.props.label, calls: this.props.calls });
  }

  measure(prevProps: { label: string; calls: string[] } | null) {
    if (prevProps === null) {
      this.props.calls.push('wrapper measure');
    }
  }
}

describe('Renderer', () => {
  it('mounts and skips sync on shallow-equal props', () => {
    const parent = host();
    const leaf = new Leaf();
    leaf.mount(parent, null, { label: 'default' });
    expect(markup(parent)).toBe('<text class="leaf">default</text>');
    expect(leaf.syncCount).toBe(1);

    leaf.update({ label: 'default' });
    expect(leaf.syncCount).toBe(1); // shallow-equal -> skipped

    leaf.update({ label: 'hi' });
    expect(leaf.syncCount).toBe(2);
    expect(markup(parent)).toBe('<text class="leaf">hi</text>');
  });

  it('runs child measure before parent measure, after DOM attach', () => {
    const parent = host();
    const calls: string[] = [];
    const wrapper = new Wrapper();
    wrapper.mount(parent, null, { label: 'x', calls });
    expect(calls).toEqual(['leaf measure, attached: true', 'wrapper measure']);
    expect(markup(parent)).toBe('<text class="leaf">x</text>');
  });

  it('merges derived state into the same sync as the triggering update', () => {
    class Stateful extends Renderer<{ v: number }, { doubled: number }> {
      root = htmlEl('span');
      text = textEl();
      syncCount = 0;
      derive(props: { v: number }, _state: { doubled: number }, prevProps: { v: number } | null) {
        if (prevProps !== null && props.v === prevProps.v) {
          return null;
        }
        return { doubled: props.v * 2 };
      }
      create() {
        this.root.append(this.text);
        return this.root.node;
      }
      sync() {
        this.syncCount++;
        this.text.set(this.state.doubled);
      }
    }
    const parent = host();
    const r = new Stateful();
    r.mount(parent, null, { v: 2 });
    expect(markup(parent)).toBe('<span>4</span>');
    expect(r.syncCount).toBe(1);
    r.update({ v: 5 });
    expect(markup(parent)).toBe('<span>10</span>');
    expect(r.syncCount).toBe(2); // derive + update produced a single sync
  });

  it('setState outside lifecycle syncs immediately and defers callbacks until after the DOM is written', () => {
    class Counter extends Renderer<object, { n: number }> {
      root = htmlEl('i');
      text = textEl();
      state = { n: 0 };
      create() {
        this.root.append(this.text);
        return this.root.node;
      }
      sync() {
        this.text.set(this.state.n);
      }
    }
    const parent = host();
    const r = new Counter();
    r.mount(parent, null, {});
    let seen = '';
    r.setState({ n: 7 }, () => {
      seen = markup(parent);
    });
    expect(seen).toBe('<i>7</i>');
  });

  it('setPresent detaches and re-attaches the root element at the same position', () => {
    class Toggle extends Renderer<{ on: boolean }> {
      root = htmlEl('b');
      create() {
        return this.root.node;
      }
      sync() {
        this.setPresent(this.props.on);
      }
    }
    const parent = host();
    parent.appendChild(document.createElement('u'));
    const r = new Toggle();
    r.mount(parent, parent.firstChild, { on: true });
    expect(markup(parent)).toBe('<b></b><u></u>');
    r.update({ on: false });
    expect(markup(parent)).toBe('<u></u>');
    r.update({ on: true });
    expect(markup(parent)).toBe('<b></b><u></u>');
  });

  it('destroy runs dispose depth-first and removes all DOM including pass-through children', () => {
    const parent = host();
    const calls: string[] = [];
    class Inner extends Renderer<{ calls: string[] }> {
      root = htmlEl('em');
      create() {
        return this.root.node;
      }
      sync() {}
      dispose() {
        this.props.calls.push('inner dispose');
      }
    }
    class Outer extends Renderer<{ calls: string[] }> {
      child!: ReturnType<Renderer<object>['slot']>;
      create() {
        this.child = this.slot();
        return null;
      }
      sync() {
        this.child.set(Inner, { calls: this.props.calls });
      }
      dispose() {
        this.props.calls.push('outer dispose');
      }
    }
    const r = new Outer();
    r.mount(parent, null, { calls });
    expect(markup(parent)).toBe('<em></em>');
    r.destroy();
    expect(calls).toEqual(['outer dispose', 'inner dispose']);
    expect(parent.innerHTML).toBe('');
  });

  // a slot rebuilt inside an ElSlot init callback (the tooltip row's icon, which changes host when valueAlign flips) left the previous slot registered and its child mounted
  it('releaseRegion destroys a replaced slot and drops it from the cascade', () => {
    const parent = host();
    const disposed: string[] = [];
    class Inner extends Renderer<{ id: string }> {
      root = htmlEl('em');
      create() {
        return this.root.node;
      }
      sync() {}
      dispose() {
        disposed.push(this.props.id);
      }
    }
    class Outer extends Renderer<{ id: string }> {
      root = htmlEl('div');
      child: ReturnType<Renderer<object>['slot']> | null = null;
      create() {
        return this.root.node;
      }
      sync() {
        if (this.child !== null) {
          this.releaseRegion(this.child);
        }
        this.child = this.slot(this.root);
        this.child.set(Inner, { id: this.props.id });
      }
    }
    const r = new Outer();
    r.mount(parent, null, { id: 'first' });
    expect(markup(parent)).toBe('<div><em></em></div>');

    r.update({ id: 'second' });
    expect(disposed).toEqual(['first']);
    // exactly one child remains: the replaced slot took its DOM with it
    expect(markup(parent)).toBe('<div><em></em></div>');

    r.destroy();
    // the released slot is not disposed twice, and the live one still cascades
    expect(disposed).toEqual(['first', 'second']);
    expect(parent.innerHTML).toBe('');
  });
});

describe('setProperty', () => {
  it('ignores the reserved children, key and ref props', () => {
    const div = document.createElement('div');
    setProperty(div, 'children', undefined, 'x', false);
    setProperty(div, 'key', undefined, 'x', false);
    setProperty(div, 'ref', undefined, 'x', false);
    expect(div.attributes.length).toBe(0);
  });

  it('writes form element value, checked and selected as properties', () => {
    const input = document.createElement('input');
    setProperty(input, 'value', undefined, 'abc', false);
    expect(input.value).toBe('abc');
    expect(input.getAttribute('value')).toBeNull();

    setProperty(input, 'value', 'abc', null, false);
    expect(input.value).toBe('');

    input.type = 'checkbox';
    setProperty(input, 'checked', undefined, true, false);
    expect(input.checked).toBe(true);
  });

  it('removes attributes for null and false, writes empty string for true', () => {
    const div = document.createElement('div');
    setProperty(div, 'hidden', undefined, true, false);
    expect(div.getAttribute('hidden')).toBe('');
    setProperty(div, 'hidden', true, false, false);
    expect(div.hasAttribute('hidden')).toBe(false);
    setProperty(div, 'title', undefined, 'x', false);
    setProperty(div, 'title', 'x', null, false);
    expect(div.hasAttribute('title')).toBe(false);
  });

  it('accepts style strings via cssText and transitions between string and object styles', () => {
    const div = document.createElement('div');
    setProperty(div, 'style', undefined, 'width: 10px; color: red;', false);
    expect(div.style.width).toBe('10px');
    expect(div.style.color).toBe('red');

    // string -> object: the cssText is cleared before the object is applied
    setProperty(div, 'style', 'width: 10px; color: red;', { height: 5 }, false);
    expect(div.style.width).toBe('');
    expect(div.style.color).toBe('');
    expect(div.style.height).toBe('5px');

    // null-valued style properties clear back to empty, but the emptied
    // attribute stays: an object style is truthy, so the removal branch is skipped
    setProperty(div, 'style', { height: 5 }, { height: null }, false);
    expect(div.style.height).toBe('');
    expect(div.getAttribute('style')).toBe('');
  });

  it('removes the emptied style attribute when the style value itself is cleared', () => {
    const div = document.createElement('div');
    setProperty(div, 'style', undefined, { height: 5 }, false);
    expect(div.getAttribute('style')).toBe('height: 5px;');

    // object -> null: the declaration empties and style="" goes with it
    setProperty(div, 'style', { height: 5 }, null, false);
    expect(div.hasAttribute('style')).toBe(false);

    // string form: cssText is emptied and the attribute removed
    const stringDiv = document.createElement('div');
    setProperty(stringDiv, 'style', undefined, 'width: 10px;', false);
    setProperty(stringDiv, 'style', 'width: 10px;', '', false);
    expect(stringDiv.hasAttribute('style')).toBe(false);

    // and a string cleared with null takes the same path
    const nulledDiv = document.createElement('div');
    setProperty(nulledDiv, 'style', undefined, 'width: 10px;', false);
    setProperty(nulledDiv, 'style', 'width: 10px;', null, false);
    expect(nulledDiv.hasAttribute('style')).toBe(false);
  });

  it('keeps a style attribute that still holds declarations after a clear', () => {
    const div = document.createElement('div');
    // a declaration this renderer never wrote must survive the removal branch
    div.style.color = 'red';
    setProperty(div, 'style', undefined, { height: 5 }, false);
    setProperty(div, 'style', { height: 5 }, null, false);
    expect(div.getAttribute('style')).toBe('color: red;');
  });
});

describe('shallowEqual', () => {
  it('compares own keys and values one level deep', () => {
    expect(shallowEqual({ a: 1 }, { a: 1 })).toBe(true);
    expect(shallowEqual({ a: 1 }, { a: 2 })).toBe(false);
    expect(shallowEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    expect(shallowEqual({ a: 1, b: 2 }, { a: 1 })).toBe(false);
    const same = { x: 1 };
    expect(shallowEqual(same, same)).toBe(true);
  });

  it('treats non-objects as equal only by identity', () => {
    expect(shallowEqual(1, 1)).toBe(true);
    expect(shallowEqual(1, 2)).toBe(false);
    expect(shallowEqual(null, {})).toBe(false);
    expect(shallowEqual({}, null)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// keyed lists
// ---------------------------------------------------------------------------

interface Row { id: string; label: string }

// create() builds bare structure only — all content comes from update(), so a
// block created and never updated would show up as an empty <li>
const rowAdapter = {
  key: (row: Row) => row.id,
  create: () => {
    const root = htmlEl('li');
    const text = textEl();
    root.append(text);
    return { root, text };
  },
  update: (handle: { root: El; text: ReturnType<typeof textEl> }, row: Row) => {
    handle.root.set({ 'data-id': row.id });
    handle.text.set(row.label);
  }
};

describe('ElList', () => {
  it('handles enter, update, exit and reorder by key', () => {
    const parent = host();
    const list = new ElList<Row>(parent, null);

    list.sync([{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }, { id: 'c', label: 'C' }], rowAdapter);
    expect(markup(parent)).toBe('<li data-id="a">A</li><li data-id="b">B</li><li data-id="c">C</li>');
    const [nodeA, nodeB] = Array.from(parent.querySelectorAll('li'));

    // reorder + update + remove + add
    list.sync([{ id: 'b', label: 'B2' }, { id: 'a', label: 'A' }, { id: 'd', label: 'D' }], rowAdapter);
    expect(markup(parent)).toBe('<li data-id="b">B2</li><li data-id="a">A</li><li data-id="d">D</li>');
    // nodes were moved, not recreated
    expect(Array.from(parent.querySelectorAll('li'))[0]).toBe(nodeB);
    expect(Array.from(parent.querySelectorAll('li'))[1]).toBe(nodeA);

    list.sync([], rowAdapter);
    expect(markup(parent)).toBe('');
  });

  // only a pass-through renderer (one with no element of its own) destroys a list
  // with removeDom, since a hosted list is discarded with its owner's element
  it('removes its blocks and anchor on destroy(true)', () => {
    const parent = host();
    const list = new ElList<Row>(parent, null);
    list.sync([{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }], rowAdapter);
    expect(parent.childNodes.length).toBe(3); // two blocks plus the anchor comment

    list.destroy(true);
    expect(markup(parent)).toBe('');
    expect(parent.childNodes.length).toBe(0);
  });

  it('leaves the DOM alone on destroy(false)', () => {
    const parent = host();
    const list = new ElList<Row>(parent, null);
    list.sync([{ id: 'a', label: 'A' }], rowAdapter);

    list.destroy(false);
    expect(markup(parent)).toBe('<li data-id="a">A</li>');
  });

  it('does not leak DOM nodes when items have duplicate keys', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const parent = host();
      const list = new ElList<Row>(parent, null);

      const rows = [{ id: 'a', label: 'A1' }, { id: 'a', label: 'A2' }, { id: 'b', label: 'B' }];
      list.sync(rows, rowAdapter);
      expect(parent.querySelectorAll('li').length).toBe(3);

      // re-syncing with persistent duplicates must warn and keep the node
      // count stable instead of orphaning one extra node per sync
      list.sync(rows, rowAdapter);
      list.sync(rows, rowAdapter);
      expect(parent.querySelectorAll('li').length).toBe(3);
      expect(warn).toHaveBeenCalledWith('mochart list has duplicate key: a');

      list.sync([], rowAdapter);
      expect(markup(parent)).toBe('');
    }
    finally {
      warn.mockRestore();
    }
  });
});

describe('RendererList (via Renderer.rendererList)', () => {
  it('keys child renderers, reuses by key+class, destroys leavers', () => {
    const destroyed: string[] = [];
    class Item extends Renderer<{ id: string; label: string }> {
      root = htmlEl('p');
      text = textEl();
      create() {
        this.root.append(this.text);
        return this.root.node;
      }
      sync() {
        this.text.set(this.props.label);
      }
      dispose() {
        destroyed.push(this.props.id);
      }
    }
    class ListHost extends Renderer<{ rows: Row[] }> {
      root = htmlEl('div');
      list!: ReturnType<Renderer<object>['rendererList']>;
      create() {
        this.list = this.rendererList(this.root);
        return this.root.node;
      }
      sync() {
        this.list.sync(this.props.rows.map((row) => ({ key: row.id, ctor: Item, props: { id: row.id, label: row.label } })));
      }
    }

    const parent = host();
    const r = new ListHost();
    r.mount(parent, null, { rows: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }] });
    expect(markup(parent)).toBe('<div><p>A</p><p>B</p></div>');

    r.update({ rows: [{ id: 'b', label: 'B' }, { id: 'a', label: 'A2' }] });
    expect(markup(parent)).toBe('<div><p>B</p><p>A2</p></div>');
    expect(destroyed).toEqual([]);

    r.update({ rows: [{ id: 'b', label: 'B' }] });
    expect(markup(parent)).toBe('<div><p>B</p></div>');
    expect(destroyed).toEqual(['a']);

    r.destroy();
    expect(parent.innerHTML).toBe('');
    expect(destroyed).toEqual(['a', 'b']);
  });

  it('does not leak renderers when items have duplicate keys', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      class Item extends Renderer<{ label: string }> {
        root = htmlEl('p');
        text = textEl();
        create() {
          this.root.append(this.text);
          return this.root.node;
        }
        sync() {
          this.text.set(this.props.label);
        }
      }
      class ListHost extends Renderer<{ rows: Row[] }> {
        root = htmlEl('div');
        list!: ReturnType<Renderer<object>['rendererList']>;
        create() {
          this.list = this.rendererList(this.root);
          return this.root.node;
        }
        sync() {
          this.list.sync(this.props.rows.map((row) => ({ key: row.id, ctor: Item, props: { label: row.label } })));
        }
      }

      const parent = host();
      const r = new ListHost();
      const rows = [{ id: 'a', label: 'A1' }, { id: 'a', label: 'A2' }, { id: 'b', label: 'B' }];
      r.mount(parent, null, { rows });
      expect(parent.querySelectorAll('p').length).toBe(3);

      r.update({ rows: [...rows] });
      r.update({ rows: [...rows] });
      expect(parent.querySelectorAll('p').length).toBe(3);
      expect(warn).toHaveBeenCalledWith('mochart renderer list has duplicate key: a');

      r.destroy();
      expect(parent.innerHTML).toBe('');
    }
    finally {
      warn.mockRestore();
    }
  });

  it('replaces the renderer when the same key comes back with a different class', () => {
    const events: string[] = [];
    class ItemA extends Renderer<{ label: string }> {
      root = htmlEl('p');
      text = textEl();
      create() {
        this.root.append(this.text);
        return this.root.node;
      }
      sync() {
        this.text.set(this.props.label);
      }
      dispose() {
        events.push('a dispose');
      }
    }
    class ItemB extends ItemA {
      root = htmlEl('q');
      override dispose() {
        events.push('b dispose');
      }
    }
    class ListHost extends Renderer<{ ctor: typeof ItemA }> {
      root = htmlEl('div');
      list!: ReturnType<Renderer<object>['rendererList']>;
      create() {
        this.list = this.rendererList(this.root);
        return this.root.node;
      }
      sync() {
        this.list.sync([{ key: 'same', ctor: this.props.ctor, props: { label: 'x' } }]);
      }
    }

    const parent = host();
    const r = new ListHost();
    r.mount(parent, null, { ctor: ItemA });
    expect(markup(parent)).toBe('<div><p>x</p></div>');

    r.update({ ctor: ItemB });
    expect(markup(parent)).toBe('<div><q>x</q></div>');
    expect(events).toEqual(['a dispose']);
    r.destroy();
  });

  it('reorders and mid-inserts pass-through renderers whose DOM lives in a self-anchored slot', () => {
    class Leaf extends Renderer<{ label: string }> {
      root = htmlEl('p');
      text = textEl();
      create() {
        this.root.append(this.text);
        return this.root.node;
      }
      sync() {
        this.text.set(this.props.label);
      }
    }
    class PassThrough extends Renderer<{ label: string }> {
      leaf!: ReturnType<Renderer<object>['slot']>;
      create() {
        this.leaf = this.slot();
        return null;
      }
      sync() {
        this.leaf.set(Leaf, { label: this.props.label });
      }
    }
    class ListHost extends Renderer<{ rows: Row[] }> {
      root = htmlEl('div');
      list!: ReturnType<Renderer<object>['rendererList']>;
      create() {
        this.list = this.rendererList(this.root);
        return this.root.node;
      }
      sync() {
        this.list.sync(this.props.rows.map((row) => ({ key: row.id, ctor: PassThrough, props: { label: row.label } })));
      }
    }

    const parent = host();
    const r = new ListHost();
    r.mount(parent, null, { rows: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }] });
    expect(markup(parent)).toBe('<div><p>A</p><p>B</p></div>');
    const [pA, pB] = Array.from(parent.querySelectorAll('p'));

    r.update({ rows: [{ id: 'b', label: 'B' }, { id: 'a', label: 'A' }] });
    expect(markup(parent)).toBe('<div><p>B</p><p>A</p></div>');
    expect(Array.from(parent.querySelectorAll('p'))).toEqual([pB, pA]);

    r.update({ rows: [{ id: 'b', label: 'B' }, { id: 'c', label: 'C' }, { id: 'a', label: 'A' }] });
    expect(markup(parent)).toBe('<div><p>B</p><p>C</p><p>A</p></div>');

    r.update({ rows: [{ id: 'a', label: 'A' }, { id: 'c', label: 'C' }] });
    expect(markup(parent)).toBe('<div><p>A</p><p>C</p></div>');
    expect(parent.querySelector('p')).toBe(pA);

    r.destroy();
    expect(parent.innerHTML).toBe('');
  });

  it('moves a rooted renderer with its self-anchored region as one span and re-attaches a hidden root inside it', () => {
    interface Item { id: string; on: boolean }
    class Badge extends Renderer<{ label: string }> {
      root = htmlEl('i');
      text = textEl();
      create() {
        this.root.append(this.text);
        return this.root.node;
      }
      sync() {
        this.text.set(this.props.label);
      }
    }
    class Rooted extends Renderer<Item> {
      root = htmlEl('p');
      text = textEl();
      badge!: ReturnType<Renderer<object>['slot']>;
      create() {
        this.text.set(this.props.id.toUpperCase());
        this.root.append(this.text);
        // created before the root is inserted, so the region's DOM lands ahead of it
        this.badge = this.slot();
        return this.root.node;
      }
      sync() {
        this.badge.set(Badge, { label: this.props.id });
        this.setPresent(this.props.on);
      }
    }
    class ListHost extends Renderer<{ items: Item[] }> {
      root = htmlEl('div');
      list!: ReturnType<Renderer<object>['rendererList']>;
      create() {
        this.list = this.rendererList(this.root);
        return this.root.node;
      }
      sync() {
        this.list.sync(this.props.items.map((item) => ({ key: item.id, ctor: Rooted, props: item })));
      }
    }

    const parent = host();
    const r = new ListHost();
    r.mount(parent, null, { items: [{ id: 'a', on: true }, { id: 'b', on: true }] });
    expect(markup(parent)).toBe('<div><i>a</i><p>A</p><i>b</i><p>B</p></div>');
    const [pA, pB] = Array.from(parent.querySelectorAll('p'));
    const [iA, iB] = Array.from(parent.querySelectorAll('i'));

    r.update({ items: [{ id: 'b', on: true }, { id: 'a', on: true }] });
    expect(markup(parent)).toBe('<div><i>b</i><p>B</p><i>a</i><p>A</p></div>');
    expect(Array.from(parent.querySelectorAll('p'))).toEqual([pB, pA]);
    expect(Array.from(parent.querySelectorAll('i'))).toEqual([iB, iA]);

    // a hidden root still moves with its region and comes back inside its own span
    r.update({ items: [{ id: 'a', on: false }, { id: 'b', on: true }] });
    expect(markup(parent)).toBe('<div><i>a</i><i>b</i><p>B</p></div>');
    r.update({ items: [{ id: 'a', on: true }, { id: 'b', on: true }] });
    expect(markup(parent)).toBe('<div><i>a</i><p>A</p><i>b</i><p>B</p></div>');
    expect(parent.querySelector('p')).toBe(pA);

    r.destroy();
    expect(parent.innerHTML).toBe('');
  });

  it('moves every node of a pass-through renderer with several self-anchored regions, empty ones included', () => {
    interface Item { id: string; icon: boolean; tags: string[] }
    const tagAdapter = {
      key: (tag: string) => tag,
      create: () => {
        const root = htmlEl('b');
        const text = textEl();
        root.append(text);
        return { root, text };
      },
      update: (handle: { root: El; text: ReturnType<typeof textEl> }, tag: string) => {
        handle.text.set(tag);
      }
    };
    class Multi extends Renderer<Item> {
      icon!: ReturnType<Renderer<object>['elSlot']>;
      tags!: ReturnType<Renderer<object>['elList']>;
      create() {
        this.icon = this.elSlot();
        this.tags = this.elList();
        return null;
      }
      sync() {
        this.icon.set(this.props.icon ? 'i' : null, () => htmlEl('i'))?.set({ 'data-id': this.props.id });
        this.tags.sync(this.props.tags, tagAdapter);
      }
    }
    class ListHost extends Renderer<{ items: Item[] }> {
      root = htmlEl('div');
      list!: ReturnType<Renderer<object>['rendererList']>;
      create() {
        this.list = this.rendererList(this.root);
        return this.root.node;
      }
      sync() {
        this.list.sync(this.props.items.map((item) => ({ key: item.id, ctor: Multi, props: item })));
      }
    }

    const parent = host();
    const r = new ListHost();
    r.mount(parent, null, { items: [{ id: 'a', icon: true, tags: ['a1', 'a2'] }, { id: 'b', icon: false, tags: ['b1'] }] });
    expect(markup(parent)).toBe('<div><i data-id="a"></i><b>a1</b><b>a2</b><b>b1</b></div>');
    const [a1, a2, b1] = Array.from(parent.querySelectorAll('b'));

    r.update({ items: [{ id: 'b', icon: false, tags: ['b1'] }, { id: 'a', icon: true, tags: ['a1', 'a2'] }] });
    expect(markup(parent)).toBe('<div><b>b1</b><i data-id="a"></i><b>a1</b><b>a2</b></div>');
    expect(Array.from(parent.querySelectorAll('b'))).toEqual([b1, a1, a2]);

    // b's empty icon slot moved with it: showing the icon now lands inside b's span
    r.update({ items: [{ id: 'b', icon: true, tags: ['b1', 'b2'] }, { id: 'a', icon: false, tags: ['a2'] }] });
    expect(markup(parent)).toBe('<div><i data-id="b"></i><b>b1</b><b>b2</b><b>a2</b></div>');
    expect(Array.from(parent.querySelectorAll('b'))).toEqual([b1, expect.anything(), a2]);

    r.update({ items: [{ id: 'a', icon: false, tags: ['a2'] }, { id: 'b', icon: true, tags: ['b1', 'b2'] }] });
    expect(markup(parent)).toBe('<div><b>a2</b><i data-id="b"></i><b>b1</b><b>b2</b></div>');

    r.destroy();
    expect(parent.innerHTML).toBe('');
  });

  it('reorders pass-through renderers inside a pass-through host\'s self-anchored list without touching outside siblings', () => {
    class Leaf extends Renderer<{ label: string }> {
      root = htmlEl('p');
      text = textEl();
      create() {
        this.root.append(this.text);
        return this.root.node;
      }
      sync() {
        this.text.set(this.props.label);
      }
    }
    class PassThrough extends Renderer<{ label: string }> {
      leaf!: ReturnType<Renderer<object>['slot']>;
      create() {
        this.leaf = this.slot();
        return null;
      }
      sync() {
        this.leaf.set(Leaf, { label: this.props.label });
      }
    }
    class PassHost extends Renderer<{ rows: Row[] }> {
      list!: ReturnType<Renderer<object>['rendererList']>;
      create() {
        this.list = this.rendererList();
        return null;
      }
      sync() {
        this.list.sync(this.props.rows.map((row) => ({ key: row.id, ctor: PassThrough, props: { label: row.label } })));
      }
    }

    const parent = host();
    parent.appendChild(document.createElement('u'));
    const r = new PassHost();
    r.mount(parent, parent.firstChild, { rows: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }, { id: 'c', label: 'C' }] });
    expect(markup(parent)).toBe('<p>A</p><p>B</p><p>C</p><u></u>');
    const [pA, pB, pC] = Array.from(parent.querySelectorAll('p'));

    r.update({ rows: [{ id: 'c', label: 'C' }, { id: 'a', label: 'A' }, { id: 'b', label: 'B' }] });
    expect(markup(parent)).toBe('<p>C</p><p>A</p><p>B</p><u></u>');
    expect(Array.from(parent.querySelectorAll('p'))).toEqual([pC, pA, pB]);

    r.update({ rows: [{ id: 'b', label: 'B' }, { id: 'c', label: 'C' }] });
    expect(markup(parent)).toBe('<p>B</p><p>C</p><u></u>');
    expect(Array.from(parent.querySelectorAll('p'))).toEqual([pB, pC]);

    r.destroy();
    expect(parent.innerHTML).toBe('<u></u>');
  });
});

describe('Slot', () => {
  class SlotA extends Renderer<{ label: string }> {
    root = htmlEl('p');
    text = textEl();
    create() {
      this.root.append(this.text);
      return this.root.node;
    }
    sync() {
      this.text.set(this.props.label);
    }
  }
  class SlotB extends SlotA {
    root = htmlEl('q');
  }
  class SlotHost extends Renderer<{ ctor: typeof SlotA | null }> {
    root = htmlEl('div');
    child!: ReturnType<Renderer<object>['slot']>;
    create() {
      this.child = this.slot(this.root);
      return this.root.node;
    }
    sync() {
      this.child.set(this.props.ctor, { label: 'x' });
    }
  }

  it('destroys and remounts on class change, clears on null, exposes the current renderer', () => {
    const parent = host();
    const r = new SlotHost();
    r.mount(parent, null, { ctor: SlotA });
    expect(markup(parent)).toBe('<div><p>x</p></div>');
    expect(r.child.get()).toBeInstanceOf(SlotA);

    r.update({ ctor: SlotB });
    expect(markup(parent)).toBe('<div><q>x</q></div>');
    expect(r.child.get()).toBeInstanceOf(SlotB);

    r.update({ ctor: null });
    expect(markup(parent)).toBe('<div></div>');
    expect(r.child.get()).toBeNull();
    r.destroy();
    expect(parent.innerHTML).toBe('');
  });
});

describe('ElSlot', () => {
  it('reuses the element for an unchanged key, swaps on key change and clears on null', () => {
    const parent = host();
    const slot = new ElSlot(parent, null);

    const rect = slot.set('rect', () => svgEl('rect'))!;
    rect.set({ width: 5 });
    expect(markup(parent)).toBe('<rect width="5"></rect>');

    // same key: init is not called again, the same El comes back
    const again = slot.set('rect', () => {
      throw new Error('should not init for an unchanged key');
    });
    expect(again).toBe(rect);

    const circle = slot.set('circle', () => svgEl('circle'))!;
    expect(circle).not.toBe(rect);
    expect(markup(parent)).toBe('<circle></circle>');

    slot.set(null);
    expect(markup(parent)).toBe('');

    slot.set('rect', () => svgEl('rect'));
    slot.destroy(true);
    expect(parent.innerHTML).toBe('');
  });
});

describe('Renderer edge cases', () => {
  it('honors a shouldSync override in both update and setState', () => {
    class Gated extends Renderer<{ v: number }, { s: number }> {
      root = htmlEl('span');
      state = { s: 0 };
      syncCount = 0;
      shouldSync(nextProps: { v: number }, nextState: { s: number }) {
        return nextProps.v + nextState.s > 0;
      }
      create() {
        return this.root.node;
      }
      sync() {
        this.syncCount++;
      }
    }
    const parent = host();
    const r = new Gated();
    r.mount(parent, null, { v: 1 });
    expect(r.syncCount).toBe(1);

    r.update({ v: -1 });
    expect(r.syncCount).toBe(1); // gated off

    r.setState({ s: 2 });
    expect(r.syncCount).toBe(2); // -1 + 2 > 0

    r.setState({ s: 0 });
    expect(r.syncCount).toBe(2); // gated off again
    r.destroy();
  });

  it('setState with a functional updater returning null skips the sync but still runs the callback', () => {
    class Quiet extends Renderer<object, { n: number }> {
      root = htmlEl('span');
      state = { n: 1 };
      syncCount = 0;
      create() {
        return this.root.node;
      }
      sync() {
        this.syncCount++;
      }
    }
    const parent = host();
    const r = new Quiet();
    r.mount(parent, null, {});
    expect(r.syncCount).toBe(1);

    let called = false;
    r.setState(() => null, () => { called = true; });
    expect(r.syncCount).toBe(1);
    expect(called).toBe(true);

    r.setState(() => null);
    expect(r.syncCount).toBe(1);
    r.destroy();
  });

  it('ignores update and setState after destroy, and destroy is idempotent', () => {
    class Plain extends Renderer<{ v: number }> {
      root = htmlEl('span');
      syncCount = 0;
      create() {
        return this.root.node;
      }
      sync() {
        this.syncCount++;
      }
    }
    const parent = host();
    const r = new Plain();
    r.mount(parent, null, { v: 1 });
    r.destroy();
    r.destroy();
    r.update({ v: 2 });
    r.setState({});
    expect(r.syncCount).toBe(1);
    expect(parent.innerHTML).toBe('');
  });
});
