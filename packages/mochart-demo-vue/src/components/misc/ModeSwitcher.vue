<script setup lang="ts">
import { computed } from 'vue';

import { demoModeIcons, demoText, getAvailableDemoModes } from '@mochart/demo-common';
import type { SwitchableDemoMode } from '@mochart/demo-common';

import Icon from './Icon.vue';
import { usePhoneViewport } from './usePhoneViewport';

// The in-demo Single/Multi/Random mode switcher (transition/rotation are gallery pages, not modes).
interface Props {
  demoMode: SwitchableDemoMode;
  onModeChanged: (nextDemoMode: SwitchableDemoMode) => void;
}

const props = defineProps<Props>();

const isPhone = usePhoneViewport();
const availableModes = computed(() => getAvailableDemoModes(isPhone.value));
</script>

<!-- A named group (no arrow keys); the current mode is a filled disabled segment in the strip, but gets the `.active` tint and is inert in the phone overflow menu. -->
<template>
  <div class="mochart-demo-mode-switcher">
    <span class="demo-label">{{ demoText.modeSwitcher.label }}</span>
    <div class="demo-toolbar" role="group" :aria-label="demoText.modeSwitcher.groupAria">
      <button v-for="mode in availableModes" :key="mode" type="button"
              :class="'demo-btn demo-btn-' + (mode === props.demoMode ? 'primary' : 'secondary') + (mode === props.demoMode && isPhone ? ' active' : '')"
              :disabled="mode === props.demoMode && !isPhone" :title="demoText.modeSwitcher.modes[mode].title"
              :aria-current="mode === props.demoMode ? 'page' : undefined"
              @click="mode !== props.demoMode && props.onModeChanged(mode)">
        <Icon size="lg" :fixed-width="true" :name="demoModeIcons[mode]" /><span class="btn-label">{{ demoText.modeSwitcher.modes[mode].label }}</span>
      </button>
    </div>
  </div>
</template>
