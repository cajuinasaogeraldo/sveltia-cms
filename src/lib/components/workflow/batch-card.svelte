<script>
  import { Button, Icon, Spacer } from '@sveltia/ui';
  import { get } from 'svelte/store';
  import { _ } from 'svelte-i18n';

  import { goto } from '$lib/services/app/navigation';
  import { repository } from '$lib/services/backends/git/github/repository';
  import {
    currentWorkflowBranch,
    currentWorkflowEntry,
    getEntryKey,
    unpublishedEntries,
    WORKFLOW_STATUS,
  } from '$lib/services/contents/workflow';
  import {
    buildBatchPreview,
    deleteBatch,
    publishBatch,
    updateBatchStatus,
  } from '$lib/services/contents/workflow/batch';
  import { isAnyPreviewBuilding, isPreviewEnabled } from '$lib/services/contents/workflow/preview';

  import { confirmDeleteBatch, confirmPublishBatch } from './confirm-dialog.js';
  import ConfirmDialog from './confirm-dialog.svelte';

  /**
   * @import { Batch, BatchEntry, WorkflowStatus } from '$lib/types/private';
   */

  // Props: batch, onStatusChange, onDelete, onDragStart, onDragEnd
  const { batch, onStatusChange, onDelete, onDragStart, onDragEnd } = $props();

  /** @type {boolean} */
  const isBusy = $derived(
    (batch.isPersisting ?? false) ||
      (batch.isUpdatingStatus ?? false) ||
      (batch.isPublishing ?? false) ||
      (batch.isDeleting ?? false) ||
      (batch.isBuildingPreview ?? false),
  );

  /** @type {boolean} Whether any preview (batch or regular entry) is currently building. */
  const globalPreviewBuilding = $derived(isAnyPreviewBuilding());

  /** @type {boolean} */
  const canViewPreview = $derived(
    batch.previewStatus === 'ready' && batch.previewUrl !== null && batch.previewUrl !== undefined,
  );

  /** @type {string} */
  const previewButtonLabel = $derived.by(() => {
    if (batch.isBuildingPreview) {
      return get(_)('building_preview', { default: 'Building...' });
    }

    if (canViewPreview) {
      // When preview is ready, show "Rebuild" option instead
      return get(_)('rebuild_preview', { default: 'Rebuild' });
    }

    if (batch.previewStatus === 'error') {
      return get(_)('retry_preview', { default: 'Retry Preview' });
    }

    return get(_)('build_preview', { default: 'Build Preview' });
  });

  /** @type {BatchEntry[]} */
  const entriesList = $derived.by(() => [...batch.entries.values()]);

  /**
   * Handle clicking on an entry to edit it.
   * Configure workflow branch so the entry loads from the batch branch.
   * @param {BatchEntry} entry Entry to edit.
   */
  const editEntry = (entry) => {
    // Create a temporary unpublished entry so loadEntryFromWorkflowBranch can find it
    const tempUnpublishedEntry = {
      collection: entry.collection,
      slug: entry.slug,
      status: batch.status,
      data: entry.data ?? {},
      branch: batch.branch,
      prNumber: batch.prNumber,
      headSha: batch.headSha,
      updatedAt: new Date(),
      // Mark as temporary so it won't show in kanban (filtered in derived stores)
      isTemporary: true,
    };

    // Add to unpublishedEntries store temporarily with the correct key
    unpublishedEntries.update((entries) => {
      // eslint-disable-next-line svelte/prefer-svelte-reactivity -- Regular store, not Svelte store
      const newMap = new Map(entries);

      newMap.set(getEntryKey(entry.collection, entry.slug), tempUnpublishedEntry);
      return newMap;
    });

    // Configure workflow branch so the CMS loads the entry from the batch branch
    currentWorkflowBranch.set(batch.branch);

    // Create a minimal workflow entry object
    currentWorkflowEntry.set(tempUnpublishedEntry);

    // Navigate to workflow editor instead of regular editor
    const encodedCollection = encodeURIComponent(entry.collection);
    const encodedSlug = encodeURIComponent(entry.slug);

    goto(`/workflow/edit/${encodedCollection}/${encodedSlug}`, { transitionType: 'forwards' });
  };

  /**
   * Handle status change.
   * @param {WorkflowStatus} newStatus New status.
   */
  const handleStatusChange = async (newStatus) => {
    try {
      await updateBatchStatus(newStatus);
      onStatusChange?.(newStatus);
    } catch (/** @type {any} */ error) {
      // eslint-disable-next-line no-console
      console.error('Failed to update batch status:', error);
    }
  };

  /**
   * Handle publish batch.
   */
  const handlePublish = async () => {
    const confirmed = await confirmPublishBatch();

    if (!confirmed) return;

    try {
      await publishBatch();
    } catch (/** @type {any} */ error) {
      // eslint-disable-next-line no-console
      console.error('Failed to publish batch:', error);
    }
  };

  /**
   * Handle delete batch.
   */
  const handleDelete = async () => {
    const confirmed = await confirmDeleteBatch();

    if (!confirmed) return;

    try {
      await deleteBatch();
      onDelete?.();
    } catch (/** @type {any} */ error) {
      // eslint-disable-next-line no-console
      console.error('Failed to delete batch:', error);
    }
  };

  /**
   * Handle build/rebuild preview.
   * Always rebuilds - user can view preview separately if needed.
   */
  const handleBuildPreview = async () => {
    try {
      await buildBatchPreview();
    } catch (/** @type {any} */ error) {
      // eslint-disable-next-line no-console
      console.error('Failed to build preview:', error);
    }
  };

  /**
   * Handle view preview in new tab.
   */
  const handleViewPreview = () => {
    if (batch.previewUrl) {
      globalThis.open(batch.previewUrl, '_blank');
    }
  };
</script>

<article
  class="entry-card batch-card"
  class:busy={isBusy}
  draggable={!isBusy}
  ondragstart={onDragStart}
  ondragend={onDragEnd}
>
  <div class="batch-header">
    <div class="batch-title">
      <Icon name="inventory_2" />
      <span class="title-text">{$_('batch_changes', { default: 'Batch Changes' })}</span>
      <span class="batch-count">({batch.entries.size})</span>
    </div>
    {#if batch.prNumber}
      <a
        href="https://github.com/{repository.owner}/{repository.repo}/pull/{batch.prNumber}"
        target="_blank"
        rel="noopener noreferrer"
        class="pr-link"
      >
        #{batch.prNumber}
        <Icon name="open_in_new" />
      </a>
    {/if}
  </div>

  <div class="batch-entries">
    {#each entriesList as entry (entry.collection + entry.slug)}
      <button type="button" class="batch-entry" onclick={() => editEntry(entry)}>
        <span class="entry-title">{entry.title}</span>
        <span class="entry-collection">{entry.collection}</span>
      </button>
    {/each}
  </div>

  <div class="actions">
    {#if batch.status === WORKFLOW_STATUS.DRAFT}
      <Button
        variant="tertiary"
        size="small"
        label={$_('request_review', { default: 'Request Review' })}
        disabled={isBusy}
        onclick={() => handleStatusChange(WORKFLOW_STATUS.PENDING_REVIEW)}
      />
    {:else if batch.status === WORKFLOW_STATUS.PENDING_REVIEW}
      <!-- Commented out: In review status, users can drag the batch to change status -->
      <!--
      <Button
        variant="tertiary"
        size="small"
        label={$_('approve', { default: 'Approve' })}
        disabled={isBusy}
        onclick={() => handleStatusChange(WORKFLOW_STATUS.PENDING_PUBLISH)}
      />
      <Button
        variant="tertiary"
        size="small"
        label={$_('request_changes', { default: 'Request Changes' })}
        disabled={isBusy}
        onclick={() => handleStatusChange(WORKFLOW_STATUS.DRAFT)}
      />
      -->
    {:else if batch.status === WORKFLOW_STATUS.PENDING_PUBLISH}
      <Button
        variant="primary"
        size="small"
        label={batch.isPublishing
          ? $_('publishing', { default: 'Publishing...' })
          : $_('publish_batch', { default: 'Publish Batch' })}
        disabled={isBusy}
        onclick={handlePublish}
      />
      <Button
        variant="tertiary"
        size="small"
        label={$_('back_to_review', { default: 'Back to Review' })}
        disabled={isBusy}
        onclick={() => handleStatusChange(WORKFLOW_STATUS.PENDING_REVIEW)}
      />
    {/if}

    {#if isPreviewEnabled()}
      <!-- View Preview button - shown when preview is ready -->
      {#if canViewPreview}
        <Button
          variant="tertiary"
          size="small"
          label={$_('view_preview', { default: 'View Preview' })}
          onclick={handleViewPreview}
        >
          <Icon slot="start-icon" name="open_in_new" />
        </Button>
      {/if}

      <!-- Rebuild button - always shown when preview is enabled -->
      <Button
        variant="tertiary"
        size="small"
        label={previewButtonLabel}
        disabled={batch.isBuildingPreview || globalPreviewBuilding}
        onclick={handleBuildPreview}
      >
        <Icon slot="start-icon" name="refresh" />
      </Button>
    {/if}

    <Spacer flex />
    {#if batch.status !== WORKFLOW_STATUS.PENDING_PUBLISH}
      <Button
        variant="tertiary"
        size="small"
        iconic
        aria-label={$_('delete')}
        disabled={isBusy}
        onclick={handleDelete}
      >
        <Icon name="delete" />
      </Button>
    {/if}
  </div>
</article>

<ConfirmDialog />

<style lang="scss">
  .batch-card {
    --border-color: var(--sui-secondary-border-color);
    --bg-color: var(--sui-primary-background-color);
    --hover-bg-color: var(--sui-hover-background-color);
    --text-color: var(--sui-primary-foreground-color);
    --secondary-text-color: var(--sui-secondary-foreground-color);

    display: flex;
    flex-direction: column;
    max-height: 307px;
    border: 2px solid var(--sui-primary-accent-color);
    border-radius: 8px;
    background-color: var(--bg-color);
    transition:
      opacity 0.2s,
      box-shadow 0.2s;

    &.busy {
      opacity: 0.6;
      pointer-events: none;
    }

    &:not(.busy):hover {
      border-color: var(--sui-primary-accent-color);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    @media (prefers-reduced-motion) {
      transition: none;
    }
  }

  .batch-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border-color);
  }

  .batch-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;
    color: var(--text-color);

    .title-text {
      font-size: var(--sui-font-size-large);
    }

    .batch-count {
      font-size: var(--sui-font-size-small);
      color: var(--secondary-text-color);
    }
  }

  .pr-link {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: var(--sui-font-size-small);
    color: var(--sui-primary-accent-color);
    text-decoration: none;
    transition: background-color 0.2s;

    &:hover {
      background-color: var(--hover-bg-color);
    }
  }

  .batch-entries {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 4px;

    &::-webkit-scrollbar {
      width: 6px;
    }

    &::-webkit-scrollbar-track {
      background: transparent;
    }

    &::-webkit-scrollbar-thumb {
      background-color: var(--sui-secondary-border-color);
      border-radius: 3px;

      &:hover {
        background-color: var(--sui-tertiary-border-color);
      }
    }
  }

  .batch-entry {
    display: flex;
    flex-direction: column;
    padding: 8px 12px;
    border-radius: 4px;
    background-color: var(--sui-secondary-background-color);
    border: none;
    cursor: pointer;
    text-align: left;
    transition: background-color 0.2s;

    &:hover {
      background-color: var(--hover-bg-color);
    }
  }

  .entry-title {
    font-weight: 500;
    color: var(--text-color);
  }

  .entry-collection {
    font-size: var(--sui-font-size-small);
    color: var(--secondary-text-color);
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    padding: 8px 12px;
    border-top: 1px solid var(--border-color);
  }
</style>
