<script lang="ts">
  // CodeMirror-backed replacement for the old TextAreaContent: same controlled
  // value/onChange contract. Programmatic values flow through setValue; user
  // edits report up and their echo is skipped, so typing is never re-set.
  import { untrack } from 'svelte';

  import { createJsonEditorContent } from '@mochart/demo-common';

  import type { JsonEditorContentHandle, JsonEditorContentOptions } from '@mochart/demo-common';

  interface Props {
    value: string;
    ariaLabel: string;
    readOnly?: boolean;
    formatOnSet?: boolean;
    /** Attach the Mochart config completions/validation/hover support. */
    mochartSupport?: boolean;
    onChange?: (value: string) => void;
  }

  let { value, ariaLabel, readOnly = undefined, formatOnSet = undefined, mochartSupport = false, onChange = undefined }: Props = $props();

  let handle: JsonEditorContentHandle | null = null;
  let lastUserValue: string | null = null;

  /** Pretty-print the current JSON; returns false (and leaves the text alone) when it doesn't parse. */
  export function format(): boolean {
    return handle?.format() ?? false;
  }

  // Mount-once action: the option props are static per call site.
  function mountEditor(host: HTMLDivElement) {
    const options: JsonEditorContentOptions = {
      value,
      ariaLabel,
      readOnly,
      formatOnSet,
      onChange: (text) => {
        lastUserValue = text;
        onChange?.(text);
      }
    };
    if (mochartSupport) {
      options.support = (editor) => editor.createMochartConfigSupport();
    }
    const created = createJsonEditorContent(options);
    host.appendChild(created.el);
    handle = created;
    return {
      destroy() {
        handle = null;
        created.destroy();
        created.el.remove();
      }
    };
  }

  $effect(() => {
    // Skip the echo of the user's own edit; everything else is programmatic.
    const nextValue = value;
    untrack(() => {
      if (nextValue !== lastUserValue) {
        lastUserValue = null;
        handle?.setValue(nextValue);
      }
    });
  });
</script>

<div class="mochart-demo-text-area-container" use:mountEditor></div>
