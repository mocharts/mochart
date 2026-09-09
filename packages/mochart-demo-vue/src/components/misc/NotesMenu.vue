<script setup lang="ts">
import { watch } from 'vue';

import { demoText, notesMenuPlacement } from '@mochart/demo-common';

import Icon from './Icon.vue';
import { useMenu } from './useMenu';

// The "about this demo" button in each mode's navigation row: an info icon
// that opens the demo's `notes` (the detail kept out of its one-sentence
// gallery description) in a popover panel. This is the desktop shape; below
// the phone breakpoint the navigation row folds into an overflow menu, where
// a popover cannot come along — its panel would be a descendant of an element
// the menu hides with `display: none` — so TopBar renders NotesMenuItem (a
// disclosure row inside the panel) instead of this.
//
// Positioning, dismissal, focus return and the disclosure ARIA come from
// `useMenu` (demo-common's menu geometry + dismissal under vue state).
interface Props {
  /** Demo title, shown as the panel heading. */
  title: string;
  /** The demo's notes; nothing renders when there are none. */
  notes?: string;
}

const props = withDefaults(defineProps<Props>(), { notes: undefined });

const { open, close, setTrigger, setPanel, triggerProps, panelProps, isPositioned } = useMenu({
  placement: notesMenuPlacement
});

// Close whenever the demo changes under us (history navigation between demos).
watch(() => [props.title, props.notes], () => {
  close();
});
</script>

<template>
  <div v-if="props.notes !== undefined" class="demo-btn-group mochart-demo-notes-menu">
    <button :ref="setTrigger" type="button" v-bind="triggerProps"
            :class="'demo-btn demo-btn-secondary mochart-demo-notes-trigger' + (open ? ' active' : '')"
            :title="demoText.demoNotes.trigger.tooltip" :aria-label="demoText.demoNotes.trigger.aria">
      <Icon size="lg" :fixed-width="true" name="circle-info" />
    </button>
    <div :ref="setPanel" v-bind="panelProps"
         :class="'demo-menu demo-menu-notes' + (isPositioned ? ' open' : '')">
      <span class="demo-menu-notes-title">{{ props.title }}</span>
      <span class="demo-menu-notes-body">{{ props.notes }}</span>
    </div>
  </div>
</template>
