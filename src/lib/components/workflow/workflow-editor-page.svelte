<script>
  import { EmptyState, Group } from '@sveltia/ui';
  import { onMount, tick, untrack } from 'svelte';
  import { _ } from 'svelte-i18n';

  import PaneBody from '$lib/components/contents/details/pane-body.svelte';
  import PaneHeader from '$lib/components/contents/details/pane-header.svelte';
  import WorkflowEditorToolbar from '$lib/components/workflow/workflow-editor-toolbar.svelte';
  import { parseLocation } from '$lib/services/app/navigation';
  import { entryDraft } from '$lib/services/contents/draft';
  import { editorFirstPane, editorSecondPane } from '$lib/services/contents/editor';
  import { entryEditorSettings } from '$lib/services/contents/editor/settings';
  import { getLocaleLabel } from '$lib/services/contents/i18n';
  import { DEFAULT_I18N_CONFIG } from '$lib/services/contents/i18n/config';
  import { setWorkflowEditContext } from '$lib/services/contents/workflow';
  import {
    cleanupWorkflowEditor,
    initWorkflowEditor,
    workflowEditorEntry,
    workflowEditorError,
    workflowEditorLoading,
  } from '$lib/services/contents/workflow/editor';
  import { isMediumScreen, isSmallScreen } from '$lib/services/user/env';

  /** @type {HTMLElement | undefined} */
  let firstPaneContentArea = $state();
  /** @type {HTMLElement | undefined} */
  let secondPaneContentArea = $state();
  let restoring = false;

  const collection = $derived($entryDraft?.collection);
  const collectionFile = $derived($entryDraft?.collectionFile);
  const { showPreview } = $derived($entryEditorSettings ?? {});
  const { i18nEnabled, allLocales, defaultLocale } = $derived(
    (collectionFile ?? collection)?._i18n ?? DEFAULT_I18N_CONFIG,
  );
  const canPreview = $derived($entryDraft?.canPreview ?? true);
  const paneStateKey = $derived(
    collectionFile?.name ? [collection?.name, collectionFile.name].join('|') : collection?.name,
  );

  /**
   * Parse collection and slug from URL. Expected format: /workflow/edit/:collection/:slug.
   * @returns {{ collectionName: string, slug: string } | null} Parsed params or null.
   */
  const parseRouteParams = () => {
    const { path } = parseLocation();
    const match = path.match(/^\/workflow\/edit\/([^/]+)\/(.+)$/);

    if (match) {
      return {
        collectionName: decodeURIComponent(match[1]),
        slug: decodeURIComponent(match[2]),
      };
    }

    return null;
  };

  /**
   * Restore the pane state from IndexedDB.
   * @returns {Promise<boolean>} Whether the panes are restored.
   */
  const restorePanes = async () => {
    const [_editorFirstPane, _editorSecondPane] =
      $entryEditorSettings?.paneStates?.[paneStateKey ?? ''] ?? [];

    if (
      restoring ||
      !_editorFirstPane ||
      !_editorSecondPane ||
      (!!_editorFirstPane.locale && !allLocales.includes(_editorFirstPane.locale)) ||
      (!!_editorSecondPane.locale && !allLocales.includes(_editorSecondPane.locale)) ||
      ((!showPreview || !canPreview) &&
        (_editorFirstPane.mode === 'preview' || _editorSecondPane.mode === 'preview'))
    ) {
      return false;
    }

    restoring = true;
    await tick();
    $editorFirstPane = _editorFirstPane;
    $editorSecondPane = _editorSecondPane;
    await tick();
    restoring = false;

    if ($isSmallScreen || $isMediumScreen) {
      $editorSecondPane = null;
    }

    return true;
  };

  /**
   * Configure editor panes based on settings.
   */
  const switchPanes = async () => {
    if (!$entryDraft) {
      return;
    }

    if (await restorePanes()) {
      return;
    }

    $editorFirstPane = { mode: 'edit', locale: $editorFirstPane?.locale ?? defaultLocale };

    if ($isSmallScreen || $isMediumScreen) {
      $editorSecondPane = null;
    } else if (!showPreview || !canPreview) {
      const otherLocales = i18nEnabled
        ? allLocales.filter((l) => l !== $editorFirstPane?.locale)
        : [];

      $editorSecondPane = otherLocales.length ? { mode: 'edit', locale: otherLocales[0] } : null;
    } else {
      $editorSecondPane = { mode: 'preview', locale: $editorFirstPane.locale };
    }
  };

  /**
   * Save the pane state to IndexedDB.
   */
  const savePanes = () => {
    if (!collection || restoring || !$editorFirstPane || !$editorSecondPane || !paneStateKey) {
      return;
    }

    entryEditorSettings.update((view = {}) => ({
      ...view,
      paneStates: {
        ...view.paneStates,
        [paneStateKey]: [$editorFirstPane, $editorSecondPane],
      },
    }));
  };

  /**
   * Initialize editor on mount.
   */
  onMount(() => {
    const params = parseRouteParams();

    if (!params) {
      // eslint-disable-next-line no-console
      console.error('Invalid workflow edit URL');

      return () => {};
    }

    const { collectionName, slug } = params;

    // Initialize asynchronously
    initWorkflowEditor(collectionName, slug).then(() => {
      // Set workflow edit context after successful init
      const entry = $workflowEditorEntry;

      if (entry) {
        setWorkflowEditContext(entry);
      }
    });

    return () => {
      cleanupWorkflowEditor();
    };
  });

  // Configure panes when draft is ready
  $effect(() => {
    if ($entryDraft) {
      void [showPreview, canPreview, $isSmallScreen, $isMediumScreen];

      untrack(() => {
        switchPanes();
      });
    }
  });

  // Save pane state when it changes
  $effect(() => {
    void [$editorFirstPane, $editorSecondPane];
    savePanes();
  });
</script>

<div role="group" class="wrapper workflow-editor" aria-label={$_('content_editor')}>
  {#if $workflowEditorLoading}
    <div role="none" class="loading-state">
      <span>{$_('loading')}</span>
    </div>
  {:else if $workflowEditorError}
    <div role="none" class="error-state">
      <EmptyState>
        <div role="none" class="error-title">{$_('error')}</div>
        <div role="none" class="error-message">{$workflowEditorError}</div>
      </EmptyState>
    </div>
  {:else if $entryDraft}
    {#key $entryDraft.id}
      <WorkflowEditorToolbar />
      <div role="none" class="cols">
        {#if collection}
          {#if $editorFirstPane}
            {@const { locale, mode } = $editorFirstPane ?? {}}
            <Group
              class="pane"
              aria-label={$_(mode === 'edit' ? 'edit_x_locale' : 'preview_x_locale', {
                values: { locale: getLocaleLabel(locale) ?? locale },
              })}
              data-locale={locale}
              data-mode={mode}
            >
              <PaneHeader
                id="first-pane-header"
                thisPane={editorFirstPane}
                thatPane={editorSecondPane}
              />
              <PaneBody
                id="first-pane-body"
                thisPane={editorFirstPane}
                bind:thisPaneContentArea={firstPaneContentArea}
                bind:thatPaneContentArea={secondPaneContentArea}
              />
            </Group>
          {/if}
          {#if $editorSecondPane}
            {@const { locale, mode } = $editorSecondPane ?? {}}
            <Group
              aria-label={$_(mode === 'edit' ? 'edit_x_locale' : 'preview_x_locale', {
                values: { locale: getLocaleLabel(locale) ?? locale },
              })}
              data-locale={locale}
              data-mode={mode}
            >
              <PaneHeader
                id="second-pane-header"
                thisPane={editorSecondPane}
                thatPane={editorFirstPane}
              />
              <PaneBody
                id="second-pane-body"
                thisPane={editorSecondPane}
                bind:thisPaneContentArea={secondPaneContentArea}
                bind:thatPaneContentArea={firstPaneContentArea}
              />
            </Group>
          {/if}
        {/if}
      </div>
    {/key}
  {/if}
</div>

<style lang="scss">
  .wrapper {
    display: flex;
    flex-direction: column;
    flex: auto;
    overflow: hidden;
    background-color: var(--sui-secondary-background-color);
  }

  .loading-state {
    flex: auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    color: var(--sui-secondary-foreground-color);
  }

  .error-state {
    flex: auto;
    display: flex;
    align-items: center;
    justify-content: center;

    .error-title {
      font-size: var(--sui-font-size-x-large);
      font-weight: 600;
      margin-bottom: 8px;
      color: var(--sui-error-foreground-color);
    }

    .error-message {
      color: var(--sui-secondary-foreground-color);
      max-width: 400px;
      text-align: center;
    }
  }

  .cols {
    flex: auto;
    overflow: hidden;
    display: flex;
    gap: 4px;
    background-color: var(--sui-secondary-background-color);

    :global {
      & > div {
        display: flex;
        flex-direction: column;
        min-width: 480px;
        background-color: var(--sui-primary-background-color);
        transition: all 500ms;

        &[data-mode='edit'] {
          flex: 1 1;
        }

        &[data-mode='preview'] {
          flex: 2 1;
        }

        @media (width < 768px) {
          min-width: auto;
        }
      }
    }
  }
</style>
