<script lang="ts">
  import { demoText, menuKeepOpenClassName } from '@mochart/demo-common';

  import Icon from './Icon.svelte';

  // The phone fold's stand-in for the NotesMenu popover: a `.demo-menu-item`
  // row that expands the same title and body inline, inside the navigation
  // row's overflow panel. `.demo-menu-keep-open` so revealing the note does
  // not also dismiss the menu it lives in; the panel's own `overflow-y: auto`
  // under its `max-height` is what makes a long note readable on a screen that
  // does not scroll.
  interface Props {
    title: string;
    notes?: string;
  }

  let { title, notes = undefined }: Props = $props();

  let expanded = $state(false);

  const uid = $props.id();
  const disclosureId = 'demo-notes-disclosure-' + uid;

  // A different demo's notes start collapsed again (history navigation).
  $effect(() => {
    void title;
    void notes;
    expanded = false;
  });
</script>

{#if notes !== undefined}
  <div class="mochart-demo-notes-item {menuKeepOpenClassName}">
    <button type="button" class="demo-menu-item"
            title={demoText.demoNotes.trigger.tooltip}
            aria-expanded={expanded} aria-controls={disclosureId}
            onclick={() => { expanded = !expanded; }}>
      <Icon fixedWidth={true} name="circle-info" /> <span>{demoText.demoNotes.trigger.aria}</span>
      <!-- `margin-left: auto` on the icon itself, matching the vanilla port's
           markup pixel for pixel. -->
      <Icon fixedWidth={true} name={expanded ? 'chevron-up' : 'chevron-down'} style="margin-left: auto;" />
    </button>
    <div class="demo-field" id={disclosureId} hidden={!expanded}>
      <span class="demo-menu-notes-title">{title}</span>
      <span class="demo-menu-notes-body">{notes}</span>
    </div>
  </div>
{/if}
