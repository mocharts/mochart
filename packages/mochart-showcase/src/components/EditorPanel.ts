// A JSON editing panel built on @mochart/editor: toolbar (Format / Reset),
// the editor surface, and a diagnostics footer. The config tab passes
// createMochartConfigSupport() so it gets completions, hover docs and mochart
// validation; the data tab is a plain strict-JSON editor.

import { createJsonEditor } from '@mochart/editor';
import type { JsonEditorDiagnostic, JsonEditorSupport } from '@mochart/editor';

import { button, el } from '../ui/dom';

export interface JsonPanelOptions {
  ariaLabel: string;
  initialValue: string;
  dark: boolean;
  support?: JsonEditorSupport | JsonEditorSupport[];
  /** Called (debounced) whenever the edited text parses as JSON. */
  onParsed: (value: unknown) => void;
  onReset: () => void;
}

export interface JsonPanelHandle {
  el: HTMLElement;
  /** Replace the document (controlled update; does not trigger onParsed). */
  setValue(value: string): void;
  setTheme(dark: boolean): void;
  /** Show (or clear) a contextual hint line above the editor. */
  setHint(hint: string | null): void;
  destroy(): void;
}

const APPLY_DEBOUNCE_MS = 300;

export function jsonPanel(options: JsonPanelOptions): JsonPanelHandle {
  const host = el('div', { className: 'sc-editor-host' });
  const hintEl = el('p', { className: 'sc-editor-hint', attrs: { hidden: '' } });
  const statusEl = el('div', { className: 'sc-editor-status', attrs: { role: 'status' } });

  let applyTimer: ReturnType<typeof setTimeout> | null = null;
  let destroyed = false;

  const editor = createJsonEditor(host, {
    value: options.initialValue,
    ariaLabel: options.ariaLabel,
    theme: options.dark ? 'dark' : 'light',
    support: options.support,
    onChange(value) {
      if (applyTimer !== null) {
        clearTimeout(applyTimer);
      }
      applyTimer = setTimeout(() => {
        applyTimer = null;
        if (destroyed) {
          return;
        }
        let parsed: unknown;
        try {
          parsed = JSON.parse(value);
        }
        catch {
          // Syntax errors are already underlined by the editor; wait for
          // parseable JSON before applying anything.
          return;
        }
        options.onParsed(parsed);
      }, APPLY_DEBOUNCE_MS);
    },
    onDiagnostics(diagnostics) {
      renderStatus(diagnostics);
    }
  });

  function renderStatus(diagnostics: readonly JsonEditorDiagnostic[]): void {
    statusEl.replaceChildren();
    if (diagnostics.length === 0) {
      statusEl.append(el('span', { className: 'sc-editor-ok', text: 'No problems' }));
      return;
    }
    const problems = diagnostics.filter(d => d.severity === 'error' || d.severity === 'warning');
    const shown = (problems.length > 0 ? problems : diagnostics).slice(0, 3);
    statusEl.append(el('span', {
      className: 'sc-editor-problem-count',
      text: `${problems.length > 0 ? problems.length : diagnostics.length} problem${(problems.length > 0 ? problems.length : diagnostics.length) === 1 ? '' : 's'}`
    }));
    for (const diagnostic of shown) {
      const item = el('button', {
        className: 'sc-editor-problem',
        attrs: { type: 'button', title: diagnostic.message },
        text: diagnostic.message
      });
      item.addEventListener('click', () => editor.focusRange(diagnostic.from, diagnostic.to));
      statusEl.append(item);
    }
  }

  const formatButton = button({
    icon: 'braces',
    label: 'Format',
    title: 'Reformat the JSON',
    onClick: () => {
      editor.format();
    }
  });
  const resetButton = button({
    icon: 'undo',
    label: 'Reset',
    title: 'Restore the original value',
    onClick: options.onReset
  });
  const toolbar = el('div', { className: 'sc-editor-toolbar' }, [formatButton.el, resetButton.el]);

  const container = el('div', { className: 'sc-editor-panel' }, [toolbar, hintEl, host, statusEl]);

  return {
    el: container,
    setValue(value: string) {
      editor.setValue(value);
    },
    setTheme(dark: boolean) {
      editor.setTheme(dark ? 'dark' : 'light');
    },
    setHint(hint: string | null) {
      if (hint === null) {
        hintEl.textContent = '';
        hintEl.setAttribute('hidden', '');
      }
      else {
        hintEl.textContent = hint;
        hintEl.removeAttribute('hidden');
      }
    },
    destroy() {
      destroyed = true;
      if (applyTimer !== null) {
        clearTimeout(applyTimer);
      }
      editor.destroy();
    }
  };
}
