<script lang="ts">
  // The Single/Multi/Random mode switcher in the demo navigation strip (transition/rotation are gallery pages, not modes).
  import { demoModeIcons, demoText, getAvailableDemoModes } from '@mochart/demo-common';
  import type { SwitchableDemoMode } from '@mochart/demo-common';

  import Icon from './Icon.svelte';
  import { createPhoneViewport } from './phoneViewport.svelte';

  interface Props {
    demoMode: SwitchableDemoMode;
    onModeChanged: (nextDemoMode: SwitchableDemoMode) => void;
  }

  let { demoMode, onModeChanged }: Props = $props();

  const phone = createPhoneViewport();

  const modes = $derived(getAvailableDemoModes(phone.isPhone));
</script>

<!-- A named group (no arrow keys); the current mode is a filled disabled segment in the strip, but gets the `.active` tint and is inert in the phone overflow menu. -->
<div class="mochart-demo-mode-switcher">
  <span class="demo-label">{demoText.modeSwitcher.label}</span>
  <div class="demo-toolbar" role="group" aria-label={demoText.modeSwitcher.groupAria}>
    {#each modes as mode (mode)}
      <button type="button"
              class={"demo-btn demo-btn-" + (mode === demoMode ? "primary" : "secondary") + (mode === demoMode && phone.isPhone ? " active" : "")}
              disabled={mode === demoMode && !phone.isPhone} title={demoText.modeSwitcher.modes[mode].title}
              aria-current={mode === demoMode ? 'page' : undefined}
              onclick={() => { if (mode !== demoMode) { onModeChanged(mode); } }}>
        <Icon size="lg" fixedWidth={true} name={demoModeIcons[mode]} /><span class="btn-label">{demoText.modeSwitcher.modes[mode].label}</span>
      </button>
    {/each}
  </div>
</div>
