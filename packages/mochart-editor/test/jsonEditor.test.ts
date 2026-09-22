import { describe, expect, it, vi } from 'vitest';
import { EditorView } from '@codemirror/view';
import { createJsonEditor } from '../src';
import { defineSupport } from '../src/support';

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

  // Regression: the read-only flag blocks user input only, so format() still rewrote a read-only document
  it('refuses to format a read-only document', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const onChange = vi.fn();
    const editor = createJsonEditor(host, { value: '{"a":1}', ariaLabel: 'Configuration', readOnly: true, onChange });

    expect(editor.format()).toBe(false);
    expect(editor.getValue()).toBe('{"a":1}');
    expect(onChange).not.toHaveBeenCalled();
    editor.setReadOnly(false);
    expect(editor.format()).toBe(true);
    expect(editor.getValue()).toBe('{\n  "a": 1\n}');
    editor.destroy();
    host.remove();
  });

  // Regression: format() replaced the whole document with no selection, sending the caret to the start,
  // and did so even when the text was already formatted, adding an undo step and an onChange
  it('keeps the caret in place when formatting and leaves formatted text alone', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const onChange = vi.fn();
    const editor = createJsonEditor(host, { value: '{"aaa":1,"bbb":2}', ariaLabel: 'Configuration', onChange });
    const view = EditorView.findFromDOM(editor.element)!;

    editor.showFocusRange('{"aaa":1,"b'.length);
    expect(editor.format()).toBe(true);
    const formatted = '{\n  "aaa": 1,\n  "bbb": 2\n}';
    expect(editor.getValue()).toBe(formatted);
    expect(view.state.selection.main.head).toBe(formatted.indexOf('"bbb"') + 2);

    onChange.mockClear();
    expect(editor.format()).toBe(true);
    expect(onChange).not.toHaveBeenCalled();
    editor.destroy();
    host.remove();
  });

  // Regression: setValue kept the previous document's validity and aria-invalid until the lint delay passed
  it('resets validity to pending on a controlled update until the new document is linted', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const onDiagnostics = vi.fn();
    const editor = createJsonEditor(host, { value: '{', ariaLabel: 'Configuration', onDiagnostics });
    const content = () => editor.element.querySelector<HTMLElement>('.cm-content')!;

    await vi.waitFor(() => expect(editor.element.dataset.validity).toBe('invalid'));
    expect(onDiagnostics.mock.lastCall![0]).not.toHaveLength(0);
    editor.setValue('{"a": 1}');
    expect(editor.element.dataset.validity).toBe('pending');
    expect(content().getAttribute('aria-invalid')).toBe('false');
    // the host's list is cleared with the validity, not left holding the replaced document's problems
    expect(onDiagnostics.mock.lastCall![0]).toEqual([]);
    await vi.waitFor(() => expect(editor.element.dataset.validity).toBe('valid'));

    editor.setValue('{');
    expect(editor.element.dataset.validity).toBe('pending');
    await vi.waitFor(() => expect(content().getAttribute('aria-invalid')).toBe('true'));
    editor.destroy();
    host.remove();
  });

  // Regression: format() re-serialised through JSON.stringify, so 1e3 became 1000, 1e400 became null, long
  // integers lost precision, escapes were rewritten, and the caret, restored by counting non-whitespace
  // characters, landed inside the next string or past the end whenever a literal changed length
  it('keeps every literal as written when formatting, and the caret in its token', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const source = '{"a": 1e3, "b": "x   y", "c": 1e400, "d": 12345678901234567890, "e": 1.0, "f": "\\u00e9", "g": -0}';
    const editor = createJsonEditor(host, { value: source, ariaLabel: 'Configuration' });
    const view = EditorView.findFromDOM(editor.element)!;

    // caret between the spaces inside "x   y"
    const inString = source.indexOf('x  ') + 2;
    editor.showFocusRange(inString);
    expect(editor.format()).toBe(true);
    const formatted = '{\n  "a": 1e3,\n  "b": "x   y",\n  "c": 1e400,\n  "d": 12345678901234567890,\n  "e": 1.0,\n  "f": "\\u00e9",\n  "g": -0\n}';
    expect(editor.getValue()).toBe(formatted);
    expect(view.state.selection.main.head).toBe(formatted.indexOf('x  ') + 2);

    // caret in the whitespace before the closing brace lands right after the last token
    editor.setValue(source);
    editor.showFocusRange(source.length - 1);
    expect(editor.format()).toBe(true);
    expect(view.state.selection.main.head).toBe(formatted.lastIndexOf('-0') + 2);
    editor.destroy();
  });

  // Regression: the layout from the syntax tree repeated the indentation option as given, so 0 no longer compacted
  // to one line, 20 indented by 20 where JSON.stringify stops at 10, and a negative number threw
  it('reads the indentation option the way JSON.stringify reads its space argument', () => {
    const formatted = (indentation: number | string) => {
      const host = document.createElement('div');
      document.body.appendChild(host);
      const editor = createJsonEditor(host, { value: '{ "a": [1, {"b": 2}], "c": {} }', ariaLabel: 'Configuration', indentation });
      expect(editor.format()).toBe(true);
      const text = editor.getValue();
      editor.destroy();
      host.remove();
      return text;
    };
    const parsed = JSON.parse('{ "a": [1, {"b": 2}], "c": {} }') as unknown;
    for (const indentation of [0, -1, 2.7, 20, '', '\t', 'abcdefghijklm']) {
      expect(formatted(indentation)).toBe(JSON.stringify(parsed, null, indentation));
    }
  });

  it('leaves invalid JSON unchanged when formatting', () => {
    const host = document.createElement('div');
    const editor = createJsonEditor(host, { value: '{', ariaLabel: 'Configuration' });
    expect(editor.format()).toBe(false);
    expect(editor.getValue()).toBe('{');
    editor.destroy();
  });

  // Regression: a support's diagnostics call was unguarded, so one throw escaped the linter and left
  // every diagnostic, validity state and aria-invalid frozen on the previous pass
  it('reports a support whose diagnostics throw instead of freezing diagnostics', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const onDiagnostics = vi.fn();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const failure = new Error('boom');
    const broken = defineSupport('broken', { extensions: [], diagnostics: () => { throw failure; } });
    const editor = createJsonEditor(host, { value: '{"a": 1}', ariaLabel: 'Configuration', support: broken, onDiagnostics });
    const content = editor.element.querySelector<HTMLElement>('.cm-content')!;

    await vi.waitFor(() => expect(content.getAttribute('aria-invalid')).toBe('true'));
    expect(editor.element.dataset.validity).toBe('invalid');
    const diagnostics = onDiagnostics.mock.lastCall![0] as { message: string; severity: string }[];
    expect(diagnostics).toEqual([expect.objectContaining({ severity: 'error', source: 'mochart', message: 'broken diagnostics failed: boom' })]);
    // the cause is not discarded: CodeMirror's exception logging reaches the console when no sink is configured
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('broken diagnostics'), failure);
    consoleError.mockRestore();
    editor.destroy();
    host.remove();
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
