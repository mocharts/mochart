<script setup lang="ts">
import { computed, watchEffect } from 'vue';

import { navigate, getPath } from './router';

import demoData from '@mochart/demo-data';

import { demoText, phoneFallbackDemoMode } from '@mochart/demo-common';
import type { ShowcaseMode, SwitchableDemoMode } from '@mochart/demo-common';

import { usePhoneViewport } from '../src/components/misc/usePhoneViewport';

import GalleryPage from '../src/components/gallery/GalleryPage.vue';
import DemoSingle from '../src/components/single/DemoSingle.vue';
import DemoMulti from '../src/components/multi/DemoMulti.vue';
import DemoRandom from '../src/components/random/DemoRandom.vue';
import DemoTransition from '../src/components/transition/DemoTransition.vue';
import DemoRotation from '../src/components/rotation/DemoRotation.vue';
import DemoSparkline from '../src/components/sparkline/DemoSparkline.vue';

interface Route {
  redirect?: string;
  notFound?: string;
  gallery?: boolean;
  mode?: string;
  demoId?: string;
  randomId?: string;
}

const { demoIds, demoObjectMap } = demoData;

// The site build injects VITE_SITE_ROOT (the docs site root) so the demo can
// link back to it; standalone dev/build leaves it unset and no link renders.
// Every view places the link itself (top-left, before its own navigation).
// For styling/debugging without a site build, `?siteRoot` forces the button
// (linking to `/`), and `?siteRoot=<url>` points it at a specific target.
function getDebugSiteRootUrl(): string | undefined {
  const param = new URLSearchParams(window.location.search).get('siteRoot');
  if (param === null) {
    return undefined;
  }
  return param === '' ? '/' : param;
}

const siteRootUrl = (import.meta.env.VITE_SITE_ROOT as string | undefined) ?? getDebugSiteRootUrl();

const isPhone = usePhoneViewport();

// The gallery at /demos is the landing route; a demo is always viewed at
// /<mode>/<demoId>. The legacy scheme used a 'demos' pseudo-demo-id for the
// list ("/single/demos"), so those URLs redirect to the gallery.
const route = computed((): Route => {
  const path = getPath();
  const segments = path.split('/').filter(segment => segment.length > 0);
  if (segments.length === 0) {
    return { redirect: '/demos' };
  }
  const [mode, demoId, randomId] = segments;
  if (mode === 'demos' && segments.length === 1) {
    return { gallery: true };
  }
  if ((mode === 'single' || mode === 'multi' || mode === 'random') && demoId === 'demos') {
    return { redirect: '/demos' };
  }
  if ((mode === 'single' || mode === 'multi' || mode === 'random') && segments.length === 1) {
    return { redirect: '/demos' };
  }
  if ((mode === 'single' || mode === 'multi') && segments.length === 2) {
    // A phone cannot show the multi grid, so its URL redirects to the fallback
    // mode instead — including on a rotation into phone width, since the flag is
    // reactive. The fallback never redirects in turn, so this settles in one pass.
    if (mode === 'multi' && isPhone.value) {
      return { redirect: `/${phoneFallbackDemoMode}/${demoId}` };
    }
    return { mode, demoId };
  }
  if (mode === 'random' && segments.length === 2) {
    return { redirect: `/random/${demoId}/0` };
  }
  if (mode === 'random' && segments.length === 3) {
    return { mode, demoId, randomId };
  }
  if ((mode === 'transition' || mode === 'rotation' || mode === 'sparkline') && segments.length === 1) {
    return { mode };
  }
  return { notFound: path };
});

watchEffect(() => {
  if (route.value.redirect !== undefined) {
    navigate(route.value.redirect, { replace: true });
  }
});

function onBackToDemos() {
  navigate('/demos');
}

function onOpenDemo(nextDemoId: string) {
  navigate(`/single/${nextDemoId}`);
}

function onOpenPage(mode: ShowcaseMode) {
  navigate(`/${mode}`);
}

// Switching mode keeps the current demo; the demo id comes from the URL so
// the switcher stays correct after any navigation.
function onModeChanged(nextDemoMode: SwitchableDemoMode) {
  const currentDemoId = route.value.demoId;
  if (currentDemoId === undefined) {
    navigate('/demos');
  }
  else if (nextDemoMode === 'random') {
    navigate(`/random/${currentDemoId}/0`);
  }
  else {
    navigate(`/${nextDemoMode}/${currentDemoId}`);
  }
}

const demoId = computed(() => route.value.demoId !== undefined ? route.value.demoId : demoIds[0]);
const isKnownDemo = computed(() => demoObjectMap[demoId.value] !== undefined);
const randomId = computed(() => Number(route.value.randomId));
const isValidRandomId = computed(() => randomId.value > Number.MIN_SAFE_INTEGER && randomId.value < Number.MAX_SAFE_INTEGER);

// The randomize buttons read the demo id / random id from the current URL so
// they stay correct after any navigation.
function incrementRandomId() {
  navigate(`/random/${demoId.value}/${Math.floor(randomId.value) + 1}`);
}

function decrementRandomId() {
  navigate(`/random/${demoId.value}/${Math.floor(randomId.value) - 1}`);
}
</script>

<template>
  <template v-if="route.redirect !== undefined">
    <!-- redirecting -->
  </template>
  <div v-else-if="route.notFound !== undefined" class="mochart-demo-message"><div class="demo-alert demo-alert-error" role="alert">{{ demoText.routeErrors.noRoute(route.notFound!) }}</div></div>
  <GalleryPage v-else-if="route.gallery === true"
               :demo-data="demoData" :site-root-url="siteRootUrl"
               :on-open-demo="onOpenDemo" :on-open-page="onOpenPage" />
  <DemoTransition v-else-if="route.mode === 'transition'"
                  :site-root-url="siteRootUrl" :on-back-to-demos="onBackToDemos" />
  <DemoRotation v-else-if="route.mode === 'rotation'"
                :site-root-url="siteRootUrl" :on-back-to-demos="onBackToDemos" />
  <DemoSparkline v-else-if="route.mode === 'sparkline'"
                 :site-root-url="siteRootUrl" :on-back-to-demos="onBackToDemos" />
  <div v-else-if="!isKnownDemo" class="mochart-demo-message"><div class="demo-alert demo-alert-error" role="alert">{{ demoText.routeErrors.noDemo(demoId) }}</div></div>
  <DemoSingle v-else-if="route.mode === 'single'"
              :demo-data="demoData" :initial-demo-id="demoId" :site-root-url="siteRootUrl"
              :on-mode-changed="onModeChanged" :on-back-to-demos="onBackToDemos" />
  <DemoMulti v-else-if="route.mode === 'multi'"
             :demo-data="demoData" :initial-demo-id="demoId" :site-root-url="siteRootUrl"
             :on-mode-changed="onModeChanged" :on-back-to-demos="onBackToDemos" />
  <template v-else-if="route.mode === 'random'">
    <div v-if="!isValidRandomId" class="mochart-demo-message"><div class="demo-alert demo-alert-error" role="alert">{{ demoText.routeErrors.badRandomId(route.randomId!) }}</div></div>
    <DemoRandom v-else
                :demo-data="demoData" :initial-demo-id="demoId" :site-root-url="siteRootUrl"
                :on-mode-changed="onModeChanged" :on-back-to-demos="onBackToDemos"
                :random-id="randomId" :increment-random-id="incrementRandomId" :decrement-random-id="decrementRandomId" />
  </template>
</template>
