<script lang="ts">
  import { getPath, navigate } from './router.svelte.js';

  import demoData from '@mochart/demo-data';

  import { demoText, isPhoneViewport, phoneFallbackDemoMode, watchPhoneViewport } from '@mochart/demo-common';
  import type { ShowcaseMode, SwitchableDemoMode } from '@mochart/demo-common';

  import GalleryPage from '../src/components/gallery/GalleryPage.svelte';
  import DemoSingle from '../src/components/single/DemoSingle.svelte';
  import DemoMulti from '../src/components/multi/DemoMulti.svelte';
  import DemoRandom from '../src/components/random/DemoRandom.svelte';
  import DemoTransition from '../src/components/transition/DemoTransition.svelte';
  import DemoRotation from '../src/components/rotation/DemoRotation.svelte';
  import DemoSparkline from '../src/components/sparkline/DemoSparkline.svelte';

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

  // The gallery at /demos is the landing route; a demo is always viewed at
  // /<mode>/<demoId>. The legacy scheme used a 'demos' pseudo-demo-id for the
  // list ("/single/demos"), so those URLs redirect to the gallery.
  function resolveRoute(path: string): Route {
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
  }

  let isPhone = $state(isPhoneViewport());
  $effect(() => watchPhoneViewport(value => { isPhone = value; }));

  // Multi mode is not offered on a phone, so a /multi/<demoId> URL — a shared
  // link, or a rotation to portrait while multi is open — redirects to the
  // fallback mode for the same demo like any other unshowable route.
  function resolveForViewport(resolved: Route): Route {
    if (resolved.mode === 'multi' && resolved.demoId !== undefined && isPhone) {
      return { redirect: `/${phoneFallbackDemoMode}/${resolved.demoId}` };
    }
    return resolved;
  }

  const route = $derived(resolveForViewport(resolveRoute(getPath())));

  $effect(() => {
    if (route.redirect !== undefined) {
      navigate(route.redirect, { replace: true });
    }
  });

  function onBackToDemos() {
    navigate('/demos');
  }

  function onOpenDemo(demoId: string) {
    navigate(`/single/${demoId}`);
  }

  function onOpenPage(mode: ShowcaseMode) {
    navigate(`/${mode}`);
  }

  // Switching mode keeps the current demo; the demo id comes from the URL so
  // the switcher stays correct after any navigation.
  function onModeChanged(nextDemoMode: SwitchableDemoMode) {
    const currentDemoId = resolveRoute(getPath()).demoId;
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

  const demoId = $derived(route.demoId);
  const isKnownDemo = $derived(demoId !== undefined && demoObjectMap[demoId] !== undefined);
  const randomId = $derived(Number(route.randomId));
  const isValidRandomId = $derived(randomId > Number.MIN_SAFE_INTEGER && randomId < Number.MAX_SAFE_INTEGER);

  // The randomize buttons read the demo id / random id from the current URL so
  // they stay correct after any navigation.
  function getCurrentRandomDemoId(): string {
    const currentDemoId = resolveRoute(getPath()).demoId;
    return currentDemoId !== undefined ? currentDemoId : demoIds[0];
  }

  function getCurrentRandomId(): number {
    return Number(resolveRoute(getPath()).randomId);
  }

  function incrementRandomId() {
    navigate(`/random/${getCurrentRandomDemoId()}/${Math.floor(getCurrentRandomId()) + 1}`);
  }

  function decrementRandomId() {
    navigate(`/random/${getCurrentRandomDemoId()}/${Math.floor(getCurrentRandomId()) - 1}`);
  }
</script>

{#if route.redirect !== undefined}
  <!-- redirecting -->
{:else if route.notFound !== undefined}
  <div class="mochart-demo-message"><div class="demo-alert demo-alert-error" role="alert">{demoText.routeErrors.noRoute(route.notFound)}</div></div>
{:else if route.gallery === true}
  <GalleryPage {demoData} {siteRootUrl} {onOpenDemo} {onOpenPage} />
{:else if route.mode === 'transition'}
  <DemoTransition {siteRootUrl} {onBackToDemos} />
{:else if route.mode === 'rotation'}
  <DemoRotation {siteRootUrl} {onBackToDemos} />
{:else if route.mode === 'sparkline'}
  <DemoSparkline {siteRootUrl} {onBackToDemos} />
{:else if !isKnownDemo}
  <div class="mochart-demo-message"><div class="demo-alert demo-alert-error" role="alert">{demoText.routeErrors.noDemo(demoId!)}</div></div>
{:else if route.mode === 'single'}
  <DemoSingle {demoData} initialDemoId={demoId!} {siteRootUrl} {onModeChanged} {onBackToDemos} />
{:else if route.mode === 'multi'}
  <DemoMulti {demoData} initialDemoId={demoId!} {siteRootUrl} {onModeChanged} {onBackToDemos} />
{:else if route.mode === 'random'}
  {#if !isValidRandomId}
    <div class="mochart-demo-message"><div class="demo-alert demo-alert-error" role="alert">{demoText.routeErrors.badRandomId(route.randomId!)}</div></div>
  {:else}
    <DemoRandom {demoData} initialDemoId={demoId!} {siteRootUrl} {onModeChanged} {onBackToDemos}
      {randomId} {incrementRandomId} {decrementRandomId} />
  {/if}
{/if}
