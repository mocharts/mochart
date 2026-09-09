<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';

import { controlsMenuPlacement, createShareLinkCopier, demoText } from '@mochart/demo-common';
import type { ShareState } from '@mochart/demo-common';

import Icon from './Icon.vue';
import { useMenu } from './useMenu';

// A collapsed export/share menu placed at the end of each mode's controls row.
// The trigger uses a share icon; the menu holds PNG / SVG downloads and (when a
// share state is provided) a copy-share-link item. The parent supplies the
// export actions so this component stays agnostic about single vs. tiled charts.
//
// Positioning, dismissal, focus return and the disclosure ARIA come from
// `useMenu` (demo-common's menu geometry + dismissal under vue state) —
// including the reason any of it is hand-rolled (the controls strips clip an
// absolutely-positioned dropdown, and the chart's interaction rect eats clicks
// through anything stacked below it). What stays here is what the composable
// does not know about: the items, their copied label, and `disabled`.
interface Props {
  exportPng: () => void;
  exportSvg: () => void;
  /** Omit to hide the Share item (e.g. a chart whose state isn't shareable). */
  getShareState?: () => ShareState;
  disabled?: boolean;
  /**
   * The hosting pane's active state. A deactivated pane is only marked inert,
   * and an open panel is `position: fixed` — it would keep painting over the
   * pane that replaced this one. False closes the menu.
   */
  active?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  getShareState: undefined,
  disabled: false,
  active: true
});

const copied = ref(false);
const shareLinkCopier = createShareLinkCopier(nextCopied => { copied.value = nextCopied; });

const { open, close, setTrigger, setPanel, triggerProps, panelProps, isPositioned } = useMenu({
  placement: controlsMenuPlacement
});

// A disabled trigger fires no click, so the menu cannot be opened — but one
// already open when its trigger is disabled would be stranded.
watch(() => [props.disabled, props.active], () => {
  if (props.disabled || !props.active) {
    close();
  }
});

onBeforeUnmount(() => shareLinkCopier.dispose());

function runAndClose(action: () => void) {
  action();
  close();
}

function onShare() {
  if (!props.getShareState) {
    return;
  }
  shareLinkCopier.copy(props.getShareState());
  close();
}
</script>

<template>
  <div class="demo-btn-group mochart-export-share-menu">
    <button :ref="setTrigger" type="button" v-bind="triggerProps"
            :class="'demo-btn demo-btn-secondary demo-menu-trigger' + (open ? ' active' : '')"
            :disabled="props.disabled"
            :title="demoText.exportShareMenu.trigger.tooltip" :aria-label="demoText.exportShareMenu.trigger.aria">
      <Icon size="lg" :fixed-width="true" name="share-nodes" />
    </button>
    <div :ref="setPanel" v-bind="panelProps"
         :class="'demo-menu' + (isPositioned ? ' open' : '')">
      <button type="button" class="demo-menu-item" :aria-label="demoText.exportButtons.png.aria" @click="runAndClose(props.exportPng)">
        <Icon :fixed-width="true" name="file-image" /> <span>{{ demoText.exportButtons.png.label }}</span>
      </button>
      <button type="button" class="demo-menu-item" :aria-label="demoText.exportButtons.svg.aria" @click="runAndClose(props.exportSvg)">
        <Icon :fixed-width="true" name="file-code" /> <span>{{ demoText.exportButtons.svg.label }}</span>
      </button>
      <template v-if="props.getShareState">
        <div class="demo-menu-divider"></div>
        <button type="button" class="demo-menu-item" :aria-label="demoText.shareButton.aria" @click="onShare">
          <Icon :fixed-width="true" :name="copied ? 'check' : 'link'" /> <span>{{ copied ? demoText.shareButton.tooltipCopied : demoText.shareButton.label }}</span>
        </button>
      </template>
    </div>
  </div>
</template>
