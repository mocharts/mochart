<script lang="ts">
  // The standalone demo gallery page (the /demos landing route): the curated
  // demos, the feature-coverage test demos in a collapsed section and the
  // standalone showcase pages.
  import { demoText, getGallerySections } from '@mochart/demo-common';
  import type { GalleryItem, GallerySection, ShowcaseMode } from '@mochart/demo-common';

  import Icon from '../misc/Icon.svelte';
  import SiteRootButton from '../misc/SiteRootButton.svelte';
  import ThemeToggleButton from '../misc/ThemeToggleButton.svelte';

  import type { DemoData } from '../../types';

  interface Props {
    demoData: DemoData;
    siteRootUrl?: string;
    onOpenDemo: (demoId: string) => void;
    onOpenPage: (mode: ShowcaseMode) => void;
  }

  let { demoData, siteRootUrl = undefined, onOpenDemo, onOpenPage }: Props = $props();

  const pageIcons: Record<ShowcaseMode, string> = {
    transition: 'right-left',
    rotation: 'repeat',
    sparkline: 'chart-line'
  };

  const sections = $derived(getGallerySections(demoData));

  // Which cards have their notes expanded, keyed the same way the {#each} is.
  const notesOpen = $state<Record<string, boolean>>({});

  function itemKey(item: GalleryItem): string {
    return item.kind === 'demo' ? item.id : item.mode;
  }

  function onItemClick(item: GalleryItem) {
    if (item.kind === 'demo') {
      onOpenDemo(item.id);
    }
    else {
      onOpenPage(item.mode);
    }
  }
</script>

{#snippet sectionHeader(section: GallerySection)}
  <span class="mochart-demo-gallery-section-title">{section.title}</span>
  {#if section.hint !== undefined}
    <span class="mochart-demo-gallery-section-hint">{section.hint}</span>
  {/if}
{/snippet}

<!-- A demo's `notes` hang off the card behind a toggle. The toggle and the notes
     prose are siblings of the open-demo button rather than children of it, since
     a <button> may not contain interactive content, so the card chrome lives on
     the .demo-list-entry wrapper (see demo.css). -->
{#snippet sectionItems(section: GallerySection)}
  <div class="demo-list">
    {#each section.items as item (itemKey(item))}
      <div class="demo-list-entry">
        <div class="demo-list-row">
          <button type="button" class="demo-list-item"
                  onclick={() => onItemClick(item)}>
            {#if item.kind === 'page'}
              <Icon fixedWidth name={pageIcons[item.mode]} />
            {/if}
            <span class="mochart-demo-item-title">{item.title}</span>
            {#if item.description !== undefined}
              <span class="mochart-demo-item-description">{item.description}</span>
            {/if}
          </button>
          {#if item.notes !== undefined}
            <button type="button"
                    class={'demo-btn demo-btn-secondary mochart-demo-notes-toggle' + (notesOpen[itemKey(item)] ? ' active' : '')}
                    aria-expanded={notesOpen[itemKey(item)] ?? false} aria-label={demoText.demoNotes.galleryToggle.aria}
                    title={notesOpen[itemKey(item)] ? demoText.demoNotes.galleryToggle.tooltipHide : demoText.demoNotes.galleryToggle.tooltipShow}
                    onclick={() => { notesOpen[itemKey(item)] = !notesOpen[itemKey(item)]; }}>
              <Icon fixedWidth name="circle-info" />
            </button>
          {/if}
        </div>
        {#if item.notes !== undefined && notesOpen[itemKey(item)]}
          <div class="mochart-demo-notes">{item.notes}</div>
        {/if}
      </div>
    {/each}
  </div>
{/snippet}

<div class="mochart-demo-container">
  <div class="mochart-demo-gallery-header">
    {#if siteRootUrl !== undefined}
      <SiteRootButton {siteRootUrl} />
    {/if}
    <ThemeToggleButton />
  </div>
  <div class="mochart-demo-content-pane">
    <div class="mochart-demo-gallery">
      {#each sections as section (section.key)}
        {#if section.collapsed}
          <!-- Collapsed sections use native details/summary: no state to manage
               and keyboard/screen-reader behavior comes for free. -->
          <details class="mochart-demo-gallery-section">
            <summary class="mochart-demo-gallery-section-header">
              <Icon fixedWidth name="flask" />
              {@render sectionHeader(section)}
            </summary>
            {@render sectionItems(section)}
          </details>
        {:else}
          <section class="mochart-demo-gallery-section">
            <div class="mochart-demo-gallery-section-header">
              {@render sectionHeader(section)}
            </div>
            {@render sectionItems(section)}
          </section>
        {/if}
      {/each}
    </div>
  </div>
</div>
