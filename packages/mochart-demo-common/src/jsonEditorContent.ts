import type { JsonEditorHandle, JsonEditorSupport } from '@mochart/editor';
import { parseJson } from './json';

type EditorModule = typeof import('@mochart/editor');

export interface JsonEditorContentOptions {
  value: string;
  ariaLabel: string;
  readOnly?: boolean;
  /** Normalize programmatic values to 2-space JSON (initial value and every setValue); user-typed text is never touched. */
  formatOnSet?: boolean;
  /** Built from the lazily imported module so support code stays in the editor chunk. */
  support?: (editor: EditorModule) => JsonEditorSupport | JsonEditorSupport[];
  onChange?: (value: string) => void;
}

export interface JsonEditorContentHandle {
  el: HTMLElement;
  getValue(): string;
  setValue(value: string): void;
  /** Pretty-print the current JSON; returns false (and leaves the text alone) when it doesn't parse. */
  format(): boolean;
  destroy(): void;
}

function formatJson(text: string): string {
  try {
    return JSON.stringify(parseJson(text), null, 2);
  }
  catch {
    return text;
  }
}

/** CodeMirror-backed drop-in for the demos' JSON textareas; loads @mochart/editor lazily to keep it out of the main chunk. */
export function createJsonEditorContent(options: JsonEditorContentOptions): JsonEditorContentHandle {
  const container = document.createElement('div');
  container.className = 'text-area-content';
  const normalize = options.formatOnSet === true ? formatJson : (text: string) => text;
  const isDark = () => document.documentElement.classList.contains('dark');
  let value = normalize(options.value);
  let editor: JsonEditorHandle | null = null;
  let themeObserver: MutationObserver | null = null;
  let destroyed = false;

  import('@mochart/editor').then(module => {
    if (destroyed) {
      return;
    }
    editor = module.createJsonEditor(container, {
      value,
      ariaLabel: options.ariaLabel,
      theme: isDark() ? 'dark' : 'light',
      readOnly: options.readOnly,
      support: options.support?.(module),
      onChange: options.onChange
    });
    // Follow the site theme off <html>'s dark class: the demos' ThemeController only notifies its own listeners.
    themeObserver = new MutationObserver(() => editor?.setTheme(isDark() ? 'dark' : 'light'));
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  }, (error: unknown) => console.error('failed to load @mochart/editor', error));

  return {
    el: container,
    getValue: () => editor ? editor.getValue() : value,
    setValue(nextValue: string) {
      value = normalize(nextValue);
      editor?.setValue(value);
    },
    format() {
      if (editor) {
        return editor.format();
      }
      try {
        value = JSON.stringify(parseJson(value), null, 2);
        return true;
      }
      catch {
        return false;
      }
    },
    destroy() {
      destroyed = true;
      themeObserver?.disconnect();
      editor?.destroy();
    }
  };
}
