import { describe, expect, it, vi } from 'vitest';
import { createJsonEditor } from '../src';

describe('JSON editor', () => {
  it('exposes an accessible multiline editing surface', () => {
    const help = document.createElement('p');
    help.id = 'config-help';
    const host = document.createElement('div');
    document.body.append(help, host);
    const editor = createJsonEditor(host, {
      value: '{"answer":42}',
      ariaLabel: 'Configuration',
      ariaDescribedBy: help.id
    });
    const content = editor.element.querySelector<HTMLElement>('.cm-content')!;

    expect(content.getAttribute('role')).toBe('textbox');
    expect(content.getAttribute('aria-label')).toBe('Configuration');
    expect(content.getAttribute('aria-describedby')).toBe(help.id);
    expect(content.getAttribute('aria-multiline')).toBe('true');
    expect(content.getAttribute('aria-invalid')).toBe('false');
    expect(content.getAttribute('aria-readonly')).toBe('false');

    editor.setReadOnly(true);
    expect(content.getAttribute('aria-readonly')).toBe('true');
    editor.destroy();
    help.remove();
    host.remove();
  });

  it('focuses a diagnostic range and clamps it to the document', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const editor = createJsonEditor(host, { value: '{}', ariaLabel: 'Configuration' });
    const content = editor.element.querySelector<HTMLElement>('.cm-content')!;

    expect(() => editor.showFocusRange(-20, 200)).not.toThrow();
    expect(document.activeElement).toBe(content);

    editor.destroy();
    host.remove();
  });

  it('marks invalid JSON for assistive technology', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const editor = createJsonEditor(host, { value: '{', ariaLabel: 'Configuration' });
    const content = editor.element.querySelector<HTMLElement>('.cm-content')!;

    await vi.waitFor(() => expect(content.getAttribute('aria-invalid')).toBe('true'));
    expect(editor.element.dataset.validity).toBe('invalid');

    editor.destroy();
    host.remove();
  });

  it('applies and updates the requested color treatment', () => {
    const host = document.createElement('div');
    const editor = createJsonEditor(host, {
      value: '{}',
      ariaLabel: 'Configuration',
      theme: 'dark'
    });
    expect(editor.element.dataset.theme).toBe('dark');
    expect(editor.element.querySelector('.cm-editor')?.className).toContain('cm-editor');

    editor.setTheme('light');
    expect(editor.element.dataset.theme).toBe('light');
    expect(() => editor.setTheme('dark')).not.toThrow();
    expect(editor.element.dataset.theme).toBe('dark');
    editor.destroy();
  });

  it('supports controlled updates, formatting, and cleanup', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const onChange = vi.fn();
    const editor = createJsonEditor(host, {
      value: '{"answer":42}',
      ariaLabel: 'Configuration',
      onChange
    });

    expect(editor.getValue()).toBe('{"answer":42}');
    expect(editor.format()).toBe(true);
    expect(editor.getValue()).toBe('{\n  "answer": 42\n}');
    expect(onChange).toHaveBeenLastCalledWith('{\n  "answer": 42\n}');

    onChange.mockClear();
    editor.setValue('{"external":true}');
    expect(editor.getValue()).toBe('{"external":true}');
    expect(onChange).not.toHaveBeenCalled();

    editor.destroy();
    expect(host.children).toHaveLength(0);
    host.remove();
  });

  // Regression: setValue dispatched a history-recorded change, so undo brought the host's previous document back
  it('does not undo a controlled setValue back to the previous document', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const onChange = vi.fn();
    const editor = createJsonEditor(host, { value: '{"a":1}', ariaLabel: 'Configuration', onChange });
    // a user edit first, so there is history to unwind
    expect(editor.format()).toBe(true);
    onChange.mockClear();

    editor.setValue('{"b":2}');
    editor.setReadOnly(true);
    editor.setReadOnly(false);
    const content = host.querySelector<HTMLElement>('.cm-content')!;
    content.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true, cancelable: true }));
    content.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', metaKey: true, bubbles: true, cancelable: true }));

    expect(editor.getValue()).toBe('{"b":2}');
    expect(onChange).not.toHaveBeenCalled();
    expect(content.getAttribute('aria-readonly')).toBe('false');
    editor.destroy();
    host.remove();
  });

  it('leaves invalid JSON unchanged when formatting', () => {
    const host = document.createElement('div');
    const editor = createJsonEditor(host, { value: '{', ariaLabel: 'Configuration' });
    expect(editor.format()).toBe(false);
    expect(editor.getValue()).toBe('{');
    editor.destroy();
  });

  it('reports repeated keys as errors on the later key and refuses to format them away', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const onDiagnostics = vi.fn();
    const value = '{"chart": {"type": "line"}, "series": [{"property": "a", "property": "b"}], "chart": {}}';
    const editor = createJsonEditor(host, { value, ariaLabel: 'Configuration', onDiagnostics });
    const content = editor.element.querySelector<HTMLElement>('.cm-content')!;

    await vi.waitFor(() => expect(content.getAttribute('aria-invalid')).toBe('true'));
    const diagnostics = onDiagnostics.mock.lastCall![0] as { from: number; to: number; message: string; severity: string; source: string; path?: unknown }[];
    expect(diagnostics.map(diagnostic => [value.slice(diagnostic.from, diagnostic.to), diagnostic.message, diagnostic.severity, diagnostic.source, diagnostic.path])).toEqual([
      ['"property"', 'Duplicate key "property" in series[0]', 'error', 'json', ['series', 0, 'property']],
      ['"chart"', 'Duplicate key "chart"', 'error', 'json', ['chart']]
    ]);
    expect(diagnostics[1].from).toBe(value.lastIndexOf('"chart"'));

    expect(editor.format()).toBe(false);
    expect(editor.getValue()).toBe(value);
    editor.destroy();
    host.remove();
  });
});
