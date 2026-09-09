import { basicSetup } from 'codemirror';
import { Compartment, EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { json, jsonParseLinter } from '@codemirror/lang-json';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { linter, type Diagnostic } from '@codemirror/lint';
import { tags } from '@lezer/highlight';
import type { JsonEditorDiagnostic, JsonEditorHandle, JsonEditorOptions } from './types.js';
import { supportImplementation } from './support.js';
import { duplicateJsonKeyMessage, findDuplicateJsonKeys, parseJson } from './jsonDuplicateKeys.js';

// JSON.parse keeps the last of repeated keys silently, so the syntax layer flags the later ones as errors
function duplicateKeyDiagnostics(text: string): Diagnostic[] {
  return findDuplicateJsonKeys(text).map(duplicate => ({
    from: duplicate.from,
    to: duplicate.to,
    severity: 'error',
    message: duplicateJsonKeyMessage(duplicate),
    source: 'json',
    path: [...duplicate.path, duplicate.key]
  } as Diagnostic));
}

function publicDiagnostic(diagnostic: Diagnostic): JsonEditorDiagnostic {
  const source = diagnostic.source === 'mochart' ? 'mochart' : 'json';
  return {
    from: diagnostic.from,
    to: diagnostic.to,
    severity: diagnostic.severity,
    message: diagnostic.message,
    source,
    ...(('path' in diagnostic && Array.isArray(diagnostic.path)) ? { path: diagnostic.path } : {})
  };
}

const darkHighlightStyle = HighlightStyle.define([
  { tag: tags.propertyName, color: '#79c0ff' },
  { tag: tags.string, color: '#a5d6ff' },
  { tag: [tags.number, tags.bool, tags.null], color: '#ffab70' },
  { tag: tags.invalid, color: '#ff7b72', textDecoration: 'underline wavy' }
]);

// Selection and other-occurrence colours come from editor.css custom properties in both themes, so the selection stays an accent fill and the occurrence tint a neutral one
const selectionTheme = EditorView.theme({
  // the focused selector mirrors CodeMirror's own, which is too specific for a plain '&.cm-focused .cm-selectionBackground' to beat
  '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
    backgroundColor: 'var(--mochart-editor-selection)'
  },
  '.cm-selectionMatch': { backgroundColor: 'var(--mochart-editor-match)' }
});

const darkTheme = [
  EditorView.theme({
    '&': {
      color: 'var(--mochart-editor-foreground)',
      backgroundColor: 'var(--mochart-editor-background)'
    },
    '.cm-content': { caretColor: '#f0f6fc' },
    '.cm-cursor, .cm-dropCursor': { borderLeftColor: '#f0f6fc' },
    '.cm-activeLine': { backgroundColor: 'rgb(110 118 129 / 12%)' },
    '.cm-activeLineGutter': { backgroundColor: 'rgb(110 118 129 / 18%)' },
    '.cm-tooltip': {
      color: 'var(--mochart-editor-foreground)',
      backgroundColor: 'var(--mochart-editor-gutter)',
      borderColor: 'var(--mochart-editor-border)'
    },
    '.cm-tooltip-autocomplete > ul > li[aria-selected]': {
      color: '#fff',
      backgroundColor: '#1f6feb'
    }
  }, { dark: true }),
  syntaxHighlighting(darkHighlightStyle)
];

/** Mount a strict JSON editor into `host` and return its imperative handle. */
export function createJsonEditor(host: HTMLElement, options: JsonEditorOptions): JsonEditorHandle {
  const indentation = options.indentation ?? 2;
  const supports = options.support ? (Array.isArray(options.support) ? options.support : [options.support]) : [];
  const implementations = supports.map(supportImplementation);
  const readOnly = new Compartment();
  const theme = new Compartment();
  let externalUpdate = false;
  // the current compartment values, so a state rebuilt for a controlled replacement keeps them
  let currentReadOnly = options.readOnly === true;
  let currentTheme: 'light' | 'dark' = options.theme ?? 'light';

  const syntaxLinter = jsonParseLinter();
  const diagnosticsExtension = linter(view => {
    const diagnostics = syntaxLinter(view);
    if (diagnostics.length === 0) {
      diagnostics.push(...duplicateKeyDiagnostics(view.state.doc.toString()));
      for (const implementation of implementations) {
        if (implementation.diagnostics) diagnostics.push(...implementation.diagnostics(view));
      }
    }
    const publicDiagnostics = diagnostics.map(publicDiagnostic);
    const hasErrors = publicDiagnostics.some(diagnostic => diagnostic.severity === 'error');
    view.contentDOM.setAttribute('aria-invalid', String(hasErrors));
    element.dataset.validity = hasErrors ? 'invalid' : 'valid';
    options.onDiagnostics?.(publicDiagnostics);
    return diagnostics;
  }, { delay: 250 });

  const element = document.createElement('div');
  element.className = 'mochart-editor';
  element.dataset.theme = options.theme ?? 'light';
  element.dataset.validity = 'pending';
  host.appendChild(element);

  const contentAttributes: Record<string, string> = {
    'aria-label': options.ariaLabel,
    'aria-invalid': 'false',
    'aria-multiline': 'true',
    'aria-readonly': String(options.readOnly === true),
    spellcheck: 'false'
  };
  if (options.ariaDescribedBy) contentAttributes['aria-describedby'] = options.ariaDescribedBy;

  const makeExtensions = () => [
    basicSetup,
    json(),
    diagnosticsExtension,
    selectionTheme,
    readOnly.of(EditorState.readOnly.of(currentReadOnly)),
    theme.of(currentTheme === 'dark' ? darkTheme : []),
    EditorView.contentAttributes.of(contentAttributes),
    EditorView.updateListener.of(update => {
      if (update.docChanged && !externalUpdate) options.onChange?.(update.state.doc.toString());
    }),
    EditorView.theme({
      '&': { height: '100%' },
      '.cm-scroller': { overflow: 'auto' },
      '.cm-content': { minHeight: '100%' }
    }),
    ...implementations.flatMap(implementation => implementation.extensions),
    // basicSetup includes a gutter; hide it without disabling folding/search.
    ...(options.lineNumbers === false ? [EditorView.theme({ '.cm-gutters': { display: 'none' } })] : [])
  ];

  const view = new EditorView({
    parent: element,
    state: EditorState.create({ doc: options.value ?? '', extensions: makeExtensions() })
  });

  return {
    element,
    getValue: () => view.state.doc.toString(),
    setValue(value: string) {
      if (value === view.state.doc.toString()) return;
      // a fresh state, not a change: the host replaced the document, so undo must not bring the old one back
      externalUpdate = true;
      view.setState(EditorState.create({ doc: value, extensions: makeExtensions() }));
      externalUpdate = false;
    },
    setReadOnly(value: boolean) {
      currentReadOnly = value;
      contentAttributes['aria-readonly'] = String(value);
      view.dispatch({ effects: readOnly.reconfigure(EditorState.readOnly.of(value)) });
      view.contentDOM.setAttribute('aria-readonly', String(value));
    },
    setTheme(value: 'light' | 'dark') {
      if (element.dataset.theme === value) return;
      element.dataset.theme = value;
      currentTheme = value;
      view.dispatch({ effects: theme.reconfigure(value === 'dark' ? darkTheme : []) });
    },
    focus: () => view.focus(),
    showFocusRange(from: number, to = from) {
      const documentLength = view.state.doc.length;
      const anchor = Math.max(0, Math.min(from, documentLength));
      const head = Math.max(anchor, Math.min(to, documentLength));
      view.dispatch({
        selection: { anchor, head },
        scrollIntoView: true
      });
      view.focus();
    },
    format() {
      try {
        const parsed = parseJson(view.state.doc.toString());
        const formatted = JSON.stringify(parsed, null, indentation);
        externalUpdate = true;
        view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: formatted } });
        externalUpdate = false;
        options.onChange?.(formatted);
        return true;
      }
      catch {
        return false;
      }
    },
    destroy() {
      view.destroy();
      element.remove();
    }
  };
}
