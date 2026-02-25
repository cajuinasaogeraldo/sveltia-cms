<script>
  import { Button, Group, Icon, Spacer } from '@sveltia/ui';
  import { get } from 'svelte/store';
  import { _ } from 'svelte-i18n';

  import { goto } from '$lib/services/app/navigation';
  import { repository } from '$lib/services/backends/git/github/repository';
  import { activeBatch } from '$lib/services/contents/workflow/batch';
  import {
    buildBatchPreview,
    deleteBatch,
    publishBatch,
    updateBatchStatus,
  } from '$lib/services/contents/workflow/batch';
  import {
    currentWorkflowBranch,
    currentWorkflowEntry,
    getEntryKey,
    unpublishedEntries,
    WORKFLOW_STATUS,
  } from '$lib/services/contents/workflow';
  import { isPreviewEnabled } from '$lib/services/contents/workflow/preview';
  import ConfirmDialog from './confirm-dialog.svelte';
  import { confirmDeleteBatch, confirmPublishBatch } from './confirm-dialog.js';

  /**
   * @import { Batch, BatchEntry, WorkflowStatus } from '$lib/types/private';
   */

  /** @type {{ batch: Batch, onStatusChange?: (status: WorkflowStatus) => void, onDelete?: () => void }} */
  let { batch, onStatusChange, onDelete } = $props();

  /** @type {boolean} */
  let isBusy = $derived(
    (batch.isPersisting ?? false) ||
      (batch.isUpdatingStatus ?? false) ||
      (batch.isPublishing ?? false) ||
      (batch.isDeleting ?? false) ||
      (batch.isBuildingPreview ?? false),
  );

  /** @type {boolean} */
  let canViewPreview = $derived(
    batch.previewStatus === 'ready' && batch.previewUrl !== null && batch.previewUrl !== undefined,
  );

  /** @type {string} */
  let previewButtonLabel = $derived.by(() => {
    if (batch.isBuildingPreview) {
      return get(_)('building_preview', { default: 'Building...' });
    }

    if (canViewPreview) {
      return get(_)('view_preview', { default: 'View Preview' });
    }

    if (batch.previewStatus === 'error') {
      return get(_)('retry_preview', { default: 'Retry Preview' });
    }

    return get(_)('build_preview', { default: 'Build Preview' });
  });

  /** @type {BatchEntry[]} */
  let entriesList = $derived.by(() => [...batch.entries.values()]);

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
      branch: batch.branch,
      prNumber: batch.prNumber,
      headSha: batch.headSha,
      updatedAt: new Date(),
    };

    // Add to unpublishedEntries store temporarily with the correct key
    unpublishedEntries.update((entries) => {
      const newMap = new Map(entries);
      newMap.set(getEntryKey(entry.collection, entry.slug), tempUnpublishedEntry);
      return newMap;
    });

    // Configure workflow branch so the CMS loads the entry from the batch branch
    currentWorkflowBranch.set({
      branch: batch.branch,
      prNumber: batch.prNumber,
    });

    // Create a minimal workflow entry object
    currentWorkflowEntry.set(tempUnpublishedEntry);

    goto(`/collections/${entry.collection}/entries/${entry.slug}`, { transitionType: 'forwards' });
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
   * Handle build preview.
   */
  const handleBuildPreview = async () => {
    if (canViewPreview && batch.previewUrl) {
      globalThis.open(batch.previewUrl, '_blank');
      return;
    }

    try {
      await buildBatchPreview();
    } catch (/** @type {any} */ error) {
      // eslint-disable-next-line no-console
      console.error('Failed to build preview:', error);
    }
  };
</script>

<article
  class="entry-card batch-card"
  class:busy={isBusy}
  draggable={false}
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
      <button
        type="button"
        class="batch-entry"
        onclick={() => editEntry(entry)}
      >
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
    {:else if batch.status === WORKFLOW_STATUS.PENDING_PUBLISH}
      <Button
        variant="primary"
        size="small"
        label={batch.isPublishing ? $_('publishing', { default: 'Publishing...' }) : $_('publish_batch', { default: 'Publish Batch' })}
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

    {#if batch.status === WORKFLOW_STATUS.PENDING_REVIEW && isPreviewEnabled()}
      <Button
        variant="tertiary"
        size="small"
        label={previewButtonLabel}
        disabled={batch.isBuildingPreview}
        onclick={handleBuildPreview}
      >
        {#if canViewPreview}
          <Icon slot="start-icon" name="open_in_new" />
        {:else}
          <Icon slot="start-icon" name="visibility" />
        {/if}
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
