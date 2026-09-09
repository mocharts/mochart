<script setup lang="ts">
  // The phone fold's container: a single `…` trigger whose panel holds the
  // controls that did not fit in the strip beside it.
  //
  // The vanilla port MOVES its retained DOM nodes into the panel (hosts, not
  // mirrors — see the header of vanilla's OverflowMenu.ts). A vue component
  // owns its DOM, so the contract here is the same as the react and svelte
  // ports': every folded control is RENDERED in exactly one place — the strip
  // above the phone tier, this panel below it — from the same definition,
  // driven by the same state. Same outcome: no duplicate ids, no second
  // accessible name, no mirrored disabled/pressed state. A port that renders a
  // control twice and hides one with CSS has missed the design.
  //
  // The panel's children keep their own classes (`.demo-btn`,
  // `.demo-btn-group`, `.demo-toolbar`); `css/demo.css`'s `.demo-menu-overflow`
  // rules restyle them into full-width menu rows by context. Loose buttons
  // (not part of a group) should be wrapped in a `.demo-btn-group`, the class
  // those rules turn into a full-width column.
  //
  // Activating any button or link inside the panel closes it, except inside a
  // `.demo-menu-keep-open` subtree (a stepper beside a number input, say,
  // where closing after every press would make the control unusable).
  import { watch } from 'vue';

  import { isMenuDismissingClick } from '@mochart/demo-common';
  import type { MenuPlacement } from '@mochart/demo-common';

  import Icon from './Icon.vue';
  import { useMenu } from './useMenu';

  interface Props {
    /** Trigger copy — one of `demoText.overflowMenu.*`, so each trigger names what it holds. */
    text: { tooltip: string; aria: string };
    placement?: MenuPlacement;
    /** Anchor the panel to a whole row when the trigger is not the row's end. */
    getAnchor?: () => HTMLElement | null;
    disabled?: boolean;
    /**
     * The hosting pane's active state. A deactivated pane is only marked inert
     * and shifted offscreen, and an open panel is `position: fixed` — it would
     * keep painting over whichever pane replaced this one. False closes it.
     */
    active?: boolean;
  }

  const props = withDefaults(defineProps<Props>(), {
    placement: undefined,
    getAnchor: undefined,
    disabled: false,
    active: true
  });

  const { open, close, setTrigger, setPanel, triggerProps, panelProps, isPositioned } = useMenu({
    placement: props.placement,
    getAnchor: props.getAnchor
  });

  // A disabled trigger fires no click, so the menu cannot be opened — but one
  // already open when its trigger is disabled would be stranded.
  watch(() => [props.disabled, props.active], () => {
    if (props.disabled || !props.active) {
      close();
    }
  });

  function onPanelClick(event: MouseEvent): void {
    if (isMenuDismissingClick(event.target)) {
      close();
    }
  }
</script>

<template>
  <div class="demo-btn-group demo-overflow-menu">
    <button :ref="setTrigger" type="button" v-bind="triggerProps"
            :class="'demo-btn demo-btn-secondary' + (open ? ' active' : '')"
            :disabled="props.disabled" :title="props.text.tooltip" :aria-label="props.text.aria">
      <Icon size="lg" :fixed-width="true" name="ellipsis" />
    </button>
    <div :ref="setPanel" v-bind="panelProps"
         :class="'demo-menu demo-menu-overflow' + (isPositioned ? ' open' : '')"
         @click="onPanelClick">
      <slot></slot>
    </div>
  </div>
</template>
