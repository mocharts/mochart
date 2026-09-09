<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue';

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

const props = defineProps<Props>();

const hostElement = ref<HTMLDivElement | null>(null);
let handle: JsonEditorContentHandle | null = null;
let lastUserValue: string | null = null;

// CodeMirror-backed replacement for the old TextAreaContent: same controlled value/onChange contract.
onMounted(() => {
  const options: JsonEditorContentOptions = {
    value: props.value,
    ariaLabel: props.ariaLabel,
    readOnly: props.readOnly,
    formatOnSet: props.formatOnSet,
    onChange: text => {
      lastUserValue = text;
      props.onChange?.(text);
    }
  };
  if (props.mochartSupport) {
    options.support = editor => editor.createMochartConfigSupport();
  }
  handle = createJsonEditorContent(options);
  hostElement.value!.appendChild(handle.el);
});

onUnmounted(() => {
  const current = handle;
  handle = null;
  current?.destroy();
  current?.el.remove();
});

// Skip the echo of the user's own edit; everything else is programmatic.
watch(() => props.value, (nextValue) => {
  if (nextValue !== lastUserValue) {
    lastUserValue = null;
    handle?.setValue(nextValue);
  }
});

defineExpose({
  /** Pretty-print the current JSON; returns false (and leaves the text alone) when it doesn't parse. */
  format: (): boolean => handle?.format() ?? false
});
</script>

<template>
  <div class="mochart-demo-text-area-container" ref="hostElement"></div>
</template>
