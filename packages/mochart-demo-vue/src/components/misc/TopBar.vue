<script setup lang="ts">
import { computed, useSlots } from 'vue';

import { demoText, navMenuPlacement } from '@mochart/demo-common';
import type { SwitchableDemoMode } from '@mochart/demo-common';

import BackToDemosButton from './BackToDemosButton.vue';
import ModeSwitcher from './ModeSwitcher.vue';
import NotesMenu from './NotesMenu.vue';
import NotesMenuItem from './NotesMenuItem.vue';
import OverflowMenu from './OverflowMenu.vue';
import SiteRootButton from './SiteRootButton.vue';
import ThemeToggleButton from './ThemeToggleButton.vue';
import { usePhoneViewport } from './usePhoneViewport';

// The bar across the top of every demo view: the site-root link, the back
// link to the gallery, the view's tab strip (the `#tabs` slot), the "about
// this demo" popover, the Single/Multi/Random mode switcher and the theme
// toggle. It was hand-written six times (and in two shapes) before this — the
// same consolidation the vanilla port made in its TopBar.ts, whose header
// documents the design.
//
// The phone fold: below the phone breakpoint a bar that can fold keeps
// exactly one thing directly tappable — the tab strip — and renders
// everything else inside a single `…` menu at the far end. Each control
// renders in exactly ONE of the two places, from the same definition, so
// nothing is duplicated (see OverflowMenu.vue). A bar folds only when it has
// tabs, notes or a mode switcher: rotation and sparkline have none of the
// three, their bar is just the back link and the theme toggle (which fits at
// every width), and folding them would produce a row whose only content is a
// `…` holding two rows.
interface Props {
  /** Undefined in a standalone build, where there is no docs site to go back to. */
  siteRootUrl?: string;
  onBackToDemos: () => void;
  /** The demo the ⓘ popover describes. The standalone pages describe none. */
  notes?: { title: string; notes?: string };
  /** Omitted by the pages that are not one of the three switchable modes. */
  modes?: { demoMode: SwitchableDemoMode; onModeChanged: (nextDemoMode: SwitchableDemoMode) => void };
}

const props = withDefaults(defineProps<Props>(), {
  siteRootUrl: undefined,
  notes: undefined,
  modes: undefined
});

const slots = useSlots();
const hasTabs = computed(() => slots.tabs !== undefined);

const isPhone = usePhoneViewport();
const canFold = computed(() => hasTabs.value || props.notes !== undefined || props.modes !== undefined);
const folded = computed(() => isPhone.value && canFold.value);
const hasNotes = computed(() => props.notes !== undefined && props.notes.notes !== undefined);
</script>

<template>
  <!-- `demo-has-overflow` gates the stylesheet's `flex-wrap: nowrap` chain,
       which is only safe while the row's surplus has somewhere to go — the
       class and the trigger that justifies it render together or not at all. -->
  <div v-if="folded" class="mochart-demo-tabs-container demo-has-overflow">
    <div class="mochart-demo-nav-group">
      <slot name="tabs"></slot>
    </div>
    <OverflowMenu :text="demoText.overflowMenu.nav" :placement="navMenuPlacement">
      <!-- The menu's contents, in the order a thumb should meet them: what
           this demo is, then where else to see it, then how it looks, then the
           two ways out. The about row has no trailing divider when the Mode
           section follows — the section label draws its own rule above itself
           whenever it is not the panel's first child. -->
      <NotesMenuItem v-if="props.notes !== undefined" :title="props.notes.title" :notes="props.notes.notes" />
      <div v-if="hasNotes && props.modes === undefined" class="demo-menu-divider"></div>
      <template v-if="props.modes !== undefined">
        <div class="demo-menu-section-label">{{ demoText.modeSwitcher.menuSectionLabel }}</div>
        <ModeSwitcher :demo-mode="props.modes.demoMode" :on-mode-changed="props.modes.onModeChanged" />
        <div class="demo-menu-divider"></div>
      </template>
      <ThemeToggleButton />
      <div class="demo-menu-divider"></div>
      <BackToDemosButton :on-back-to-demos="props.onBackToDemos" />
      <SiteRootButton :site-root-url="props.siteRootUrl" />
    </OverflowMenu>
  </div>
  <!-- The trailing slot is the one place the two historical shapes differ:
       with a mode switcher it is a second nav group holding the switcher and
       the toggle; without one the toggle is a direct child of the row (an
       intermediate group of one would add its own gap and move it). -->
  <div v-else class="mochart-demo-tabs-container">
    <div class="mochart-demo-nav-group">
      <SiteRootButton :site-root-url="props.siteRootUrl" />
      <BackToDemosButton :on-back-to-demos="props.onBackToDemos" />
      <slot name="tabs"></slot>
      <NotesMenu v-if="props.notes !== undefined" :title="props.notes.title" :notes="props.notes.notes" />
    </div>
    <div v-if="props.modes !== undefined" class="mochart-demo-nav-group">
      <ModeSwitcher :demo-mode="props.modes.demoMode" :on-mode-changed="props.modes.onModeChanged" />
      <ThemeToggleButton />
    </div>
    <ThemeToggleButton v-else />
  </div>
</template>
