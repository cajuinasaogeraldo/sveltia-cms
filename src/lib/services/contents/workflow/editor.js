import { get, writable } from 'svelte/store';

import { getCollection } from '$lib/services/contents/collection';
import { entryDraft } from '$lib/services/contents/draft';
import { createDraft } from '$lib/services/contents/draft/create';
import { createSavingEntryData } from '$lib/services/contents/draft/save/changes';
import { getSlugs } from '$lib/services/contents/draft/slugs';
import { validateEntry } from '$lib/services/contents/draft/validate';
import { expandInvalidFields } from '$lib/services/contents/editor/expanders';
import { getEntrySummary } from '$lib/services/contents/entry/summary';
import {
  getUnpublishedEntry,
  updateUnpublishedEntry,
  WORKFLOW_STATUS,
} from '$lib/services/contents/workflow';
import { commitToBranch, loadUnpublishedEntries } from '$lib/services/contents/workflow/actions';
import { loadEntryFromWorkflowBranch } from '$lib/services/contents/workflow/load-entry';
import { clearPreviewState } from '$lib/services/contents/workflow/preview';

/**
 * @import { Writable } from 'svelte/store';
 * @import { EntryDraft, UnpublishedEntry } from '$lib/types/private';
 */

/**
 * Whether the workflow editor is currently loading.
 * @type {Writable<boolean>}
 */
export const workflowEditorLoading = writable(false);

/**
 * Error message for the workflow editor, if any.
 * @type {Writable<string | null>}
 */
export const workflowEditorError = writable(null);

/**
 * The current unpublished entry being edited in the workflow editor.
 * @type {Writable<UnpublishedEntry | null>}
 */
export const workflowEditorEntry = writable(null);

/**
 * Initialize the workflow editor for a specific entry.
 * This loads the entry from the PR branch and creates a draft.
 * @param {string} collectionName Collection name.
 * @param {string} slug Entry slug.
 * @returns {Promise<{ success: boolean, error?: string }>} Result.
 */
export const initWorkflowEditor = async (collectionName, slug) => {
  workflowEditorLoading.set(true);
  workflowEditorError.set(null);
  workflowEditorEntry.set(null);

  try {
    // Get collection config
    const collection = getCollection(collectionName);

    if (!collection) {
      throw new Error(`Collection "${collectionName}" not found`);
    }

    // Get unpublished entry - may need to load first
    let unpublishedEntry = getUnpublishedEntry(collectionName, slug);

    if (!unpublishedEntry) {
      // Try to load unpublished entries first
      await loadUnpublishedEntries();
      unpublishedEntry = getUnpublishedEntry(collectionName, slug);
    }

    if (!unpublishedEntry) {
      throw new Error(`Unpublished entry "${collectionName}/${slug}" not found`);
    }

    // Check if entry status allows editing
    if (unpublishedEntry.status === WORKFLOW_STATUS.PENDING_PUBLISH) {
      throw new Error(
        'Cannot edit entries in Ready status. Move back to Draft or In Review first.',
      );
    }

    // Store the unpublished entry reference
    workflowEditorEntry.set(unpublishedEntry);

    // Load entry content from PR branch
    const entry = await loadEntryFromWorkflowBranch(collectionName, slug);

    if (!entry) {
      throw new Error('Failed to load entry from PR branch');
    }

    // Create draft for editing
    createDraft({
      collection,
      originalEntry: entry,
    });

    workflowEditorLoading.set(false);

    return { success: true };
  } catch (/** @type {any} */ error) {
    const errorMessage = error.message || 'Failed to initialize workflow editor';

    workflowEditorError.set(errorMessage);
    workflowEditorLoading.set(false);

    // eslint-disable-next-line no-console
    console.error('Workflow editor init error:', error);

    return { success: false, error: errorMessage };
  }
};

/**
 * Save the current workflow entry draft to the PR branch.
 * @returns {Promise<{ success: boolean, error?: string }>} Result.
 */
export const saveWorkflowEntry = async () => {
  const draft = /** @type {EntryDraft} */ (get(entryDraft));
  const unpublishedEntry = get(workflowEditorEntry);

  if (!draft || !unpublishedEntry) {
    return { success: false, error: 'No draft or unpublished entry' };
  }

  const { collection, collectionName, fileName, currentValues } = draft;

  // Validate entry
  if (!validateEntry()) {
    expandInvalidFields({ collectionName, fileName, currentValues });

    return { success: false, error: 'validation_failed' };
  }

  const { branch, slug } = unpublishedEntry;

  if (!branch) {
    return { success: false, error: 'No branch found for unpublished entry' };
  }

  try {
    // Mark as saving
    updateUnpublishedEntry(collectionName, slug, { isPersisting: true });

    // Get slugs and create saving data
    const slugs = getSlugs({ draft });
    const { defaultLocaleSlug } = slugs;
    const { savingEntry, changes } = await createSavingEntryData({ draft, slugs });
    // Commit to branch
    const commitSha = await commitToBranch(branch, changes);

    // Clear preview state since content changed
    clearPreviewState(collectionName, slug);

    // Get entry title for update
    const title = getEntrySummary(collection, savingEntry) ?? defaultLocaleSlug;
    const { content: data = {} } = savingEntry.locales[Object.keys(savingEntry.locales)[0]] ?? {};

    // Update the unpublished entry store
    updateUnpublishedEntry(collectionName, slug, {
      isPersisting: false,
      data,
      title,
      headSha: commitSha,
      updatedAt: new Date(),
    });

    // Update local reference
    const updatedEntry = getUnpublishedEntry(collectionName, slug);

    if (updatedEntry) {
      workflowEditorEntry.set(updatedEntry);
    }

    return { success: true };
  } catch (/** @type {any} */ error) {
    updateUnpublishedEntry(collectionName, slug, { isPersisting: false });

    const errorMessage = error.message || 'Failed to save to PR branch';

    // eslint-disable-next-line no-console
    console.error('Workflow save error:', error);

    return { success: false, error: errorMessage };
  }
};

/**
 * Clean up workflow editor state.
 */
export const cleanupWorkflowEditor = () => {
  workflowEditorLoading.set(false);
  workflowEditorError.set(null);
  workflowEditorEntry.set(null);
  entryDraft.set(null);
};
