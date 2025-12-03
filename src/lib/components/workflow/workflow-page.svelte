<script>
  import { Alert, Button, Group, Icon, Spacer, Toast } from '@sveltia/ui';
  import { onMount } from 'svelte';
  import { _ } from 'svelte-i18n';

  import PageContainer from '$lib/components/common/page-container.svelte';
  import { goto } from '$lib/services/app/navigation';
  import {
    draftEntries,
    pendingPublishEntries,
    pendingReviewEntries,
    WORKFLOW_STATUS,
    workflowLoading,
  } from '$lib/services/contents/workflow';
  import {
    deleteUnpublishedEntry,
    loadUnpublishedEntries,
    publishEntry,
    updateEntryStatus,
  } from '$lib/services/contents/workflow/actions';
  import {
    buildPreview,
    isPreviewEnabled,
    isPreviewOutdated,
    restorePreviewState,
  } from '$lib/services/contents/workflow/preview';

  /**
   * @import { UnpublishedEntry, WorkflowStatus } from '$lib/types/private';
   */

  /** @type {UnpublishedEntry | null} */
  let draggedEntry = $state(null);
  /** @type {WorkflowStatus | null} */
  let dragOverStatus = $state(null);
  let showErrorToast = $state(false);
  let errorMessage = $state('');

  onMount(() => {
    loadUnpublishedEntries();
  });

  // Restore preview states when entries load
  $effect(() => {
    const allEntries = [...$pendingReviewEntries, ...$pendingPublishEntries];

    allEntries.forEach((entry) => {
      // Only restore if the entry doesn't have a current preview status
      if (!entry.previewStatus || entry.previewStatus === 'idle') {
        restorePreviewState(entry.collection, entry.slug);
      }
    });
  });

  /**
   * Handle status change.
   * @param {UnpublishedEntry} entry Entry.
   * @param {WorkflowStatus} newStatus New status.
   */
  const handleStatusChange = async (entry, newStatus) => {
    try {
      await updateEntryStatus(entry.collection, entry.slug, newStatus);
    } catch (/** @type {any} */ error) {
      // eslint-disable-next-line no-console
      console.error('Failed to update status:', error);
    }
  };

  /**
   * Handle publish.
   * @param {UnpublishedEntry} entry Entry.
   */
  const handlePublish = async (entry) => {
    const message = $_('confirm_publish', { default: `Publish "${entry.title ?? entry.slug}"?` });

    // eslint-disable-next-line no-alert
    if (!globalThis.confirm(message)) {
      return;
    }

    try {
      await publishEntry(entry.collection, entry.slug);
    } catch (/** @type {any} */ error) {
      // eslint-disable-next-line no-console
      console.error('Failed to publish:', error);
    }
  };

  /**
   * Handle delete.
   * @param {UnpublishedEntry} entry Entry.
   */
  const handleDelete = async (entry) => {
    const message = $_('confirm_delete_draft', {
      default: `Delete draft "${entry.title ?? entry.slug}"?`,
    });

    // eslint-disable-next-line no-alert
    if (!globalThis.confirm(message)) {
      return;
    }

    try {
      await deleteUnpublishedEntry(entry.collection, entry.slug);
    } catch (/** @type {any} */ error) {
      // eslint-disable-next-line no-console
      console.error('Failed to delete:', error);
    }
  };

  /**
   * Handle build preview.
   * @param {UnpublishedEntry} entry Entry.
   */
  const handleBuildPreview = async (entry) => {
    try {
      await buildPreview(entry.collection, entry.slug);
    } catch (/** @type {any} */ error) {
      // eslint-disable-next-line no-console
      console.error('Failed to build preview:', error);
    }
  };

  /**
   * Open preview URL in new tab.
   * @param {UnpublishedEntry} entry Entry.
   */
  const openPreview = (entry) => {
    if (entry.previewUrl) {
      globalThis.open(entry.previewUrl, '_blank');
    }
  };

  /**
   * Navigate to edit entry.
   * @param {UnpublishedEntry} entry Entry.
   */
  const editEntry = (entry) => {
    goto(`/collections/${entry.collection}/entries/${entry.slug}`, {
      transitionType: 'forwards',
    });
  };

  /**
   * Get preview button label.
   * @param {UnpublishedEntry} entry Entry.
   * @returns {string} Button label.
   */
  const getPreviewButtonLabel = (entry) => {
    if (entry.isBuildingPreview) {
      return $_('building_preview', { default: 'Building...' });
    }

    const outdated = isPreviewOutdated(entry.collection, entry.slug);

    if (entry.previewStatus === 'ready' && entry.previewUrl && !outdated) {
      return $_('view_preview', { default: 'View Preview' });
    }

    if (entry.previewStatus === 'error') {
      return $_('retry_preview', { default: 'Retry Preview' });
    }

    if (outdated) {
      return $_('rebuild_preview', { default: 'Rebuild Preview' });
    }

    return $_('build_preview', { default: 'Build Preview' });
  };

  /**
   * Check if preview can be viewed (ready and not outdated).
   * @param {UnpublishedEntry} entry Entry.
   * @returns {boolean} Whether preview can be viewed.
   */
  const canViewPreview = (entry) => {
    if (!entry.previewUrl || entry.previewStatus !== 'ready') {
      return false;
    }

    return !isPreviewOutdated(entry.collection, entry.slug);
  };

  /**
   * Handle drag start.
   * @param {UnpublishedEntry} entry Entry being dragged.
   */
  const handleDragStart = (entry) => {
    draggedEntry = entry;
  };

  /**
   * Handle drag over column.
   * @param {DragEvent} event Drag event.
   * @param {WorkflowStatus} status Target status.
   */
  const handleDragOver = (event, status) => {
    event.preventDefault();
    dragOverStatus = status;
  };

  /**
   * Handle drag leave column.
   */
  const handleDragLeave = () => {
    dragOverStatus = null;
  };

  /**
   * Handle drop on column.
   * @param {WorkflowStatus} targetStatus Target status.
   */
  const handleDrop = async (targetStatus) => {
    if (!draggedEntry || draggedEntry.status === targetStatus) {
      draggedEntry = null;
      dragOverStatus = null;
      return;
    }

    const entry = draggedEntry;
    draggedEntry = null;
    dragOverStatus = null;

    try {
      await handleStatusChange(entry, targetStatus);
    } catch (/** @type {any} */ error) {
      errorMessage =
        error.message || $_('status_change_failed', { default: 'Failed to change status' });
      showErrorToast = true;
    }
  };

  /**
   * Handle drag end.
   */
  const handleDragEnd = () => {
    draggedEntry = null;
    dragOverStatus = null;
  };
</script>

<PageContainer aria-label={$_('editorial_workflow')}>
  {#snippet main()}
    {#if $workflowLoading}
      <div role="none" class="loading">
        <span>{$_('loading')}</span>
      </div>
    {:else}
      <div role="none" class="columns">
        <Group class="column" aria-labelledby="draft-column-title">
          <header role="none">
            <h3 role="none" id="draft-column-title">{$_('status.drafts')}</h3>
            <span class="count">{$draftEntries.length}</span>
          </header>
          <div
            role="none"
            class="entries"
            class:drag-over={dragOverStatus === WORKFLOW_STATUS.DRAFT}
            ondragover={(e) => handleDragOver(e, WORKFLOW_STATUS.DRAFT)}
            ondragleave={handleDragLeave}
            ondrop={() => handleDrop(WORKFLOW_STATUS.DRAFT)}
          >
            {#each $draftEntries as entry (entry.slug)}
              <article
                class="entry-card"
                class:busy={entry.isUpdatingStatus || entry.isDeleting}
                class:dragging={draggedEntry?.slug === entry.slug}
                draggable={!entry.isUpdatingStatus && !entry.isDeleting}
                ondragstart={() => handleDragStart(entry)}
                ondragend={handleDragEnd}
              >
                <button type="button" class="entry-header" onclick={() => editEntry(entry)}>
                  <span class="title">{entry.title ?? entry.slug}</span>
                  <span class="collection">{entry.collection}</span>
                </button>
                <div role="none" class="actions">
                  <Button
                    variant="tertiary"
                    size="small"
                    label={$_('request_review', { default: 'Request Review' })}
                    disabled={entry.isUpdatingStatus}
                    onclick={() => handleStatusChange(entry, WORKFLOW_STATUS.PENDING_REVIEW)}
                  />
                  <Spacer flex />
                  <Button
                    variant="tertiary"
                    size="small"
                    iconic
                    aria-label={$_('delete')}
                    disabled={entry.isDeleting}
                    onclick={() => handleDelete(entry)}
                  >
                    <Icon name="delete" />
                  </Button>
                </div>
              </article>
            {:else}
              <p class="empty">{$_('no_entries', { default: 'No drafts' })}</p>
            {/each}
          </div>
        </Group>

        <Group class="column" aria-labelledby="review-column-title">
          <header role="none">
            <h3 role="none" id="review-column-title">{$_('status.in_review')}</h3>
            <span class="count">{$pendingReviewEntries.length}</span>
          </header>
          <div
            role="none"
            class="entries"
            class:drag-over={dragOverStatus === WORKFLOW_STATUS.PENDING_REVIEW}
            ondragover={(e) => handleDragOver(e, WORKFLOW_STATUS.PENDING_REVIEW)}
            ondragleave={handleDragLeave}
            ondrop={() => handleDrop(WORKFLOW_STATUS.PENDING_REVIEW)}
          >
            {#each $pendingReviewEntries as entry (entry.slug)}
              {@const isBusy =
                entry.isUpdatingStatus || entry.isDeleting || entry.isBuildingPreview}
              <article
                class="entry-card"
                class:busy={isBusy}
                class:dragging={draggedEntry?.slug === entry.slug}
                draggable={!isBusy}
                ondragstart={() => handleDragStart(entry)}
                ondragend={handleDragEnd}
              >
                <button type="button" class="entry-header" onclick={() => editEntry(entry)}>
                  <span class="title">{entry.title ?? entry.slug}</span>
                  <span class="collection">{entry.collection}</span>
                </button>
                <div role="none" class="actions">
                  <Button
                    variant="tertiary"
                    size="small"
                    label={$_('approve', { default: 'Approve' })}
                    disabled={entry.isUpdatingStatus}
                    onclick={() => handleStatusChange(entry, WORKFLOW_STATUS.PENDING_PUBLISH)}
                  />
                  <Button
                    variant="tertiary"
                    size="small"
                    label={$_('request_changes', { default: 'Request Changes' })}
                    disabled={entry.isUpdatingStatus}
                    onclick={() => handleStatusChange(entry, WORKFLOW_STATUS.DRAFT)}
                  />
                  {#if isPreviewEnabled()}
                    {#if canViewPreview(entry)}
                      <Button
                        variant="tertiary"
                        size="small"
                        label={getPreviewButtonLabel(entry)}
                        onclick={() => openPreview(entry)}
                      >
                        <Icon slot="start-icon" name="open_in_new" />
                      </Button>
                    {:else}
                      <Button
                        variant="tertiary"
                        size="small"
                        label={getPreviewButtonLabel(entry)}
                        disabled={entry.isBuildingPreview}
                        onclick={() => handleBuildPreview(entry)}
                      >
                        <Icon slot="start-icon" name="visibility" />
                      </Button>
                    {/if}
                  {/if}
                  <Spacer flex />
                  <Button
                    variant="tertiary"
                    size="small"
                    iconic
                    aria-label={$_('delete')}
                    disabled={entry.isDeleting}
                    onclick={() => handleDelete(entry)}
                  >
                    <Icon name="delete" />
                  </Button>
                </div>
              </article>
            {:else}
              <p class="empty">{$_('no_entries', { default: 'No entries in review' })}</p>
            {/each}
          </div>
        </Group>

        <Group class="column" aria-labelledby="ready-column-title">
          <header role="none">
            <h3 role="none" id="ready-column-title">{$_('status.ready')}</h3>
            <span class="count">{$pendingPublishEntries.length}</span>
          </header>
          <div
            role="none"
            class="entries"
            class:drag-over={dragOverStatus === WORKFLOW_STATUS.PENDING_PUBLISH}
            ondragover={(e) => handleDragOver(e, WORKFLOW_STATUS.PENDING_PUBLISH)}
            ondragleave={handleDragLeave}
            ondrop={() => handleDrop(WORKFLOW_STATUS.PENDING_PUBLISH)}
          >
            {#each $pendingPublishEntries as entry (entry.slug)}
              {@const isBusy = entry.isUpdatingStatus || entry.isPublishing || entry.isDeleting}
              <article
                class="entry-card"
                class:busy={isBusy}
                class:dragging={draggedEntry?.slug === entry.slug}
                draggable={!isBusy}
                ondragstart={() => handleDragStart(entry)}
                ondragend={handleDragEnd}
              >
                <button type="button" class="entry-header" onclick={() => editEntry(entry)}>
                  <span class="title">{entry.title ?? entry.slug}</span>
                  <span class="collection">{entry.collection}</span>
                </button>
                <div role="none" class="actions">
                  <Button
                    variant="primary"
                    size="small"
                    label={entry.isPublishing
                      ? $_('publishing', { default: 'Publishing...' })
                      : $_('publish')}
                    disabled={entry.isPublishing}
                    onclick={() => handlePublish(entry)}
                  />
                  <Button
                    variant="tertiary"
                    size="small"
                    label={$_('back_to_review', { default: 'Back to Review' })}
                    disabled={entry.isUpdatingStatus}
                    onclick={() => handleStatusChange(entry, WORKFLOW_STATUS.PENDING_REVIEW)}
                  />
                  <Spacer flex />
                  <Button
                    variant="tertiary"
                    size="small"
                    iconic
                    aria-label={$_('delete')}
                    disabled={entry.isDeleting}
                    onclick={() => handleDelete(entry)}
                  >
                    <Icon name="delete" />
                  </Button>
                </div>
              </article>
            {:else}
              <p class="empty">{$_('no_entries', { default: 'No entries ready to publish' })}</p>
            {/each}
          </div>
        </Group>
      </div>
    {/if}
  {/snippet}
</PageContainer>

<Toast bind:show={showErrorToast}>
  <Alert status="error">
    {errorMessage}
  </Alert>
</Toast>

<style lang="scss">
  .loading {
    flex: auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    color: var(--sui-secondary-foreground-color);
  }

  .columns {
    flex: auto;
    display: flex;
    gap: 4px;
    background-color: var(--sui-secondary-background-color);

    @media (width < 768px) {
      flex-direction: column;
      gap: 0;
    }

    :global {
      .column {
        flex: auto;
        display: flex;
        flex-direction: column;
        width: calc(100% / 3);
        background-color: var(--sui-primary-background-color);

        @media (width < 768px) {
          width: 100%;
          min-height: 200px;
        }
      }
    }

    header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 0 16px;
      height: 40px;
      background-color: var(--sui-tertiary-background-color);

      h3 {
        font-size: var(--sui-font-size-x-large);
      }

      .count {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 24px;
        height: 24px;
        padding: 0 8px;
        border-radius: 12px;
        background-color: var(--sui-secondary-background-color);
        font-size: var(--sui-font-size-small);
        font-weight: 600;
      }
    }
  }

  .entries {
    flex: auto;
    overflow-y: auto;
    padding: 8px;
    min-height: 100px;
    transition:
      background-color 0.2s,
      border 0.2s;

    &.drag-over {
      background-color: var(--sui-hover-background-color);
      border: 2px dashed var(--sui-primary-accent-color);
      border-radius: 8px;
    }
  }

  .entry-card {
    margin-bottom: 8px;
    border: 1px solid var(--sui-secondary-border-color);
    border-radius: 8px;
    background-color: var(--sui-primary-background-color);
    transition:
      opacity 0.2s,
      transform 0.2s,
      box-shadow 0.2s;
    cursor: move;

    &.busy {
      opacity: 0.6;
      pointer-events: none;
      cursor: default;
    }

    &.dragging {
      opacity: 0.5;
      transform: scale(0.95);
      cursor: grabbing;
    }

    &:not(.busy):not(.dragging):hover {
      border-color: var(--sui-primary-accent-color);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    @media (prefers-reduced-motion) {
      transition: none;
    }
  }

  .entry-header {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    width: 100%;
    padding: 12px;
    border: none;
    background: none;
    cursor: pointer;
    text-align: left;

    &:hover {
      background-color: var(--sui-hover-background-color);
    }

    .title {
      font-weight: 500;
      color: var(--sui-primary-foreground-color);
      overflow-wrap: break-word;
    }

    .collection {
      margin-top: 4px;
      font-size: var(--sui-font-size-small);
      color: var(--sui-secondary-foreground-color);
    }
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    padding: 8px 12px;
    border-top: 1px solid var(--sui-secondary-border-color);
  }

  .empty {
    padding: 24px;
    text-align: center;
    color: var(--sui-secondary-foreground-color);
    font-style: italic;
  }
</style>
