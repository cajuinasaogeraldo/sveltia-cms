<script>
  import {
    Alert,
    AlertDialog,
    Button,
    Divider,
    Icon,
    Menu,
    MenuButton,
    MenuItem,
    MenuItemCheckbox,
    Toast,
    Toolbar,
    TruncatedText,
  } from '@sveltia/ui';
  import { _, locale as appLocale } from 'svelte-i18n';

  import BackButton from '$lib/components/common/page-toolbar/back-button.svelte';
  import { goto } from '$lib/services/app/navigation';
  import { getCollectionLabel } from '$lib/services/contents/collection';
  import { entryDraft, entryDraftModified } from '$lib/services/contents/draft';
  import { createDraft } from '$lib/services/contents/draft/create';
  import { revertChanges } from '$lib/services/contents/draft/update/revert';
  import { copyFromLocaleToast } from '$lib/services/contents/editor';
  import { entryEditorSettings } from '$lib/services/contents/editor/settings';
  import { getEntrySummary } from '$lib/services/contents/entry/summary';
  import { getLocaleLabel } from '$lib/services/contents/i18n';
  import { STATUS_LABELS } from '$lib/services/contents/workflow';
  import {
    cleanupWorkflowEditor,
    saveWorkflowEntry,
    workflowEditorEntry,
  } from '$lib/services/contents/workflow/editor';
  import { isMediumScreen, isSmallScreen } from '$lib/services/user/env';
  import { prefs } from '$lib/services/user/prefs';

  let showValidationToast = $state(false);
  let showErrorDialog = $state(false);
  let errorMessage = $state('');
  let saving = $state(false);
  /** @type {MenuButton | undefined} */
  let menuButton = $state();

  const workflowEntry = $derived($workflowEditorEntry);
  const collection = $derived($entryDraft?.collection);
  const collectionFile = $derived($entryDraft?.collectionFile);
  const originalEntry = $derived($entryDraft?.originalEntry);
  const collectionLabel = $derived($appLocale && collection ? getCollectionLabel(collection) : '');
  const canPreview = $derived($entryDraft?.canPreview ?? true);
  const modified = $derived($entryDraftModified);
  const errorCount = $derived(
    Object.values($entryDraft?.validities ?? {})
      .map((validity) => Object.values(validity).map(({ valid }) => !valid))
      .flat(1)
      .filter(Boolean).length,
  );

  /**
   * Go back to the workflow board.
   */
  const goBackToWorkflow = () => {
    cleanupWorkflowEditor();
    goto('/workflow', { transitionType: 'backwards' });
  };

  /**
   * Save the entry to the PR branch.
   */
  const save = async () => {
    saving = true;

    try {
      const result = await saveWorkflowEntry();

      if (!result.success) {
        if (result.error === 'validation_failed') {
          showValidationToast = true;
        } else {
          showErrorDialog = true;
          errorMessage = result.error ?? 'Unknown error';
        }

        return;
      }

      // On successful save, either close or reset draft
      if ($prefs?.closeOnSave ?? true) {
        goBackToWorkflow();
      } else if (collection && originalEntry) {
        // Reset the draft with updated entry
        createDraft({
          collection,
          collectionFile,
          originalEntry,
          expanderStates: $entryDraft?.expanderStates,
        });
      }
    } catch (/** @type {any} */ ex) {
      showErrorDialog = true;
      errorMessage = ex.message ?? 'Unexpected error';
      // eslint-disable-next-line no-console
      console.error(ex);
    } finally {
      saving = false;
    }
  };
</script>

<Toolbar variant="primary" aria-label={$_('primary')}>
  <BackButton
    aria-label={$_('cancel_editing')}
    useShortcut={$prefs.closeWithEscape}
    onclick={goBackToWorkflow}
  />
  <h2 role="none">
    <TruncatedText>
      {@const entrySummary =
        collection && originalEntry && $appLocale
          ? getEntrySummary(collection, originalEntry)
          : (workflowEntry?.title ?? workflowEntry?.slug ?? '')}
      {#if $isSmallScreen}
        {entrySummary}
      {:else}
        {$_('edit_entry_title', {
          values: { collection: collectionLabel, entry: entrySummary },
        })}
      {/if}
    </TruncatedText>
  </h2>
  {#if workflowEntry}
    <div role="none" class="workflow-badge">
      <Icon name="account_tree" />
      <span class="branch-status">{STATUS_LABELS[workflowEntry.status]}</span>
      {#if workflowEntry.prNumber}
        <a
          href={workflowEntry.prUrl}
          target="_blank"
          rel="noopener noreferrer"
          class="pr-link"
          title="View Pull Request"
        >
          #{workflowEntry.prNumber}
        </a>
      {/if}
    </div>
  {/if}
  <MenuButton
    variant="ghost"
    iconic
    popupPosition="bottom-right"
    aria-label={$_('show_editor_options')}
    bind:this={menuButton}
  >
    {#snippet popup()}
      <Menu aria-label={$_('editor_options')}>
        <MenuItem
          label={$_('revert_all_changes')}
          disabled={!modified}
          onclick={() => {
            revertChanges();
          }}
        />
        {#if !($isSmallScreen || $isMediumScreen)}
          <Divider />
          <MenuItemCheckbox
            label={$_('show_preview')}
            checked={$entryEditorSettings?.showPreview}
            disabled={!canPreview}
            onChange={() => {
              entryEditorSettings.update((view = {}) => ({
                ...view,
                showPreview: !view.showPreview,
              }));
            }}
          />
          <MenuItemCheckbox
            label={$_('sync_scrolling')}
            checked={$entryEditorSettings?.syncScrolling}
            disabled={!canPreview && Object.keys($entryDraft?.currentValues ?? {}).length === 1}
            onChange={() => {
              entryEditorSettings.update((view = {}) => ({
                ...view,
                syncScrolling: !view.syncScrolling,
              }));
            }}
          />
        {/if}
      </Menu>
    {/snippet}
  </MenuButton>
  <Button
    variant="primary"
    label={saving ? $_('saving') : $_('save_to_branch', { default: 'Save to Branch' })}
    disabled={!modified || saving}
    keyShortcuts="Accel+S"
    onclick={save}
  >
    <Icon slot="start-icon" name="commit" />
  </Button>
</Toolbar>

<Toast bind:show={showValidationToast}>
  <Alert status="error">
    {$_(errorCount === 1 ? 'entry_validation_error' : 'entry_validation_errors', {
      values: { count: errorCount },
    })}
  </Alert>
</Toast>

<Toast id={$copyFromLocaleToast.id} bind:show={$copyFromLocaleToast.show}>
  {@const { status, message, count, sourceLanguage } = $copyFromLocaleToast}
  <Alert {status}>
    {$_(`editor.${message}`, {
      values: {
        count,
        source: sourceLanguage ? (getLocaleLabel(sourceLanguage) ?? sourceLanguage) : '',
      },
    })}
  </Alert>
</Toast>

<AlertDialog
  bind:open={showErrorDialog}
  title={$_('saving_entry.error.title')}
  onClose={() => {
    menuButton?.focus();
  }}
>
  {$_('saving_entry.error.description')}
  {#if errorMessage}
    <div role="none" class="error">
      {errorMessage}
    </div>
  {/if}
</AlertDialog>

<style lang="scss">
  .workflow-badge {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 12px;
    border-radius: 16px;
    background-color: var(--sui-tertiary-background-color);
    border: 1px solid var(--sui-warning-border-color);
    font-size: var(--sui-font-size-small);
    white-space: nowrap;

    :global(svg) {
      width: 16px;
      height: 16px;
      color: var(--sui-warning-foreground-color);
    }

    .branch-status {
      font-weight: 600;
      color: var(--sui-warning-foreground-color);
    }

    .pr-link {
      color: var(--sui-primary-accent-color);
      font-weight: 500;
      text-decoration: none;

      &:hover {
        text-decoration: underline;
      }
    }
  }

  .error {
    margin-top: 8px;
    border-radius: var(--sui-control-medium-border-radius);
    padding: 12px;
    background-color: var(--sui-secondary-background-color);
    font-size: var(--sui-font-size-default);
    line-height: 1.5;
  }
</style>
