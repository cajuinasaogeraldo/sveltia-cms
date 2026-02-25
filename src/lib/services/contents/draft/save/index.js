import { get } from 'svelte/store';

import { backend, isLastCommitPublished } from '$lib/services/backends';
import { skipCIEnabled } from '$lib/services/backends/git/shared/integration';
import { saveChanges } from '$lib/services/backends/save';
import { cmsConfig } from '$lib/services/config';
import {
  contentUpdatesToast,
  UPDATE_TOAST_DEFAULT_STATE,
} from '$lib/services/contents/collection/data';
import { entryDraft } from '$lib/services/contents/draft';
import { deleteBackup } from '$lib/services/contents/draft/backup';
import { callEventHooks } from '$lib/services/contents/draft/events';
import { createSavingEntryData } from '$lib/services/contents/draft/save/changes';
import { getSlugs } from '$lib/services/contents/draft/slugs';
import { validateEntry } from '$lib/services/contents/draft/validate';
import { expandInvalidFields } from '$lib/services/contents/editor/expanders';
import { getEntrySummary } from '$lib/services/contents/entry/summary';
import {
  currentWorkflowBranch,
  currentWorkflowEntry,
  updateUnpublishedEntry,
} from '$lib/services/contents/workflow';
import { commitToBranch, persistUnpublishedEntry } from '$lib/services/contents/workflow/actions';
import { batchModeEnabled, persistBatchEntry } from '$lib/services/contents/workflow/batch';
import { clearPreviewState } from '$lib/services/contents/workflow/preview';

/**
 * @import { ChangeResults, Entry, EntryDraft } from '$lib/types/private';
 */

/**
 * Check if editorial workflow is enabled.
 * @returns {boolean} Whether editorial workflow is enabled.
 */
const isEditorialWorkflowEnabled = () => {
  const config = get(cmsConfig);

  return config?.publish_mode === 'editorial_workflow';
};

/**
 * Update the application stores with deployment settings.
 * @param {object} args Arguments.
 * @param {boolean | undefined} args.skipCI Whether to disable automatic deployments for the change.
 * @param {boolean} [args.isWorkflow] Whether this is a workflow save (not direct publish).
 */
const updateStores = ({ skipCI, isWorkflow = false }) => {
  const published = !isWorkflow && !!get(backend)?.isGit && !(skipCI ?? get(skipCIEnabled));

  contentUpdatesToast.set({
    ...UPDATE_TOAST_DEFAULT_STATE,
    saved: true,
    published,
    count: 1,
  });

  isLastCommitPublished.set(published);
};

/**
 * Save the entry draft.
 * @param {object} [options] Options.
 * @param {boolean} [options.skipCI] Whether to disable automatic deployments for the change.
 * @returns {Promise<Entry>} Saved entry.
 * @throws {Error} When the entry could not be validated or saved.
 */
export const saveEntry = async ({ skipCI = undefined } = {}) => {
  const draft = /** @type {EntryDraft} */ (get(entryDraft));
  const { collection, isNew, collectionName, fileName, currentValues } = draft;

  if (!validateEntry()) {
    expandInvalidFields({ collectionName, fileName, currentValues });

    throw new Error('validation_failed');
  }

  const slugs = getSlugs({ draft });
  const { defaultLocaleSlug } = slugs;
  const { savingEntry, changes, savingAssets } = await createSavingEntryData({ draft, slugs });
  // Check if we're editing an existing workflow entry
  const workflowBranch = get(currentWorkflowBranch);
  const workflowEntry = get(currentWorkflowEntry);

  if (workflowBranch && workflowEntry && !isNew) {
    // Editing existing workflow entry - commit to PR branch
    try {
      updateUnpublishedEntry(collectionName, workflowEntry.slug, { isPersisting: true });

      const commitSha = await commitToBranch(workflowBranch, changes);

      // Clear preview state since content changed
      clearPreviewState(collectionName, workflowEntry.slug);

      // Get entry title for update
      const title = getEntrySummary(collection, savingEntry) ?? defaultLocaleSlug;
      const { content: data = {} } = savingEntry.locales[Object.keys(savingEntry.locales)[0]] ?? {};

      updateUnpublishedEntry(collectionName, workflowEntry.slug, {
        isPersisting: false,
        data,
        title,
        headSha: commitSha,
        updatedAt: new Date(),
      });

      updateStores({ skipCI, isWorkflow: true });
      deleteBackup(collectionName, defaultLocaleSlug);

      return savingEntry;
    } catch (/** @type {any} */ ex) {
      updateUnpublishedEntry(collectionName, workflowEntry.slug, { isPersisting: false });
      // eslint-disable-next-line no-console
      console.error(ex.cause ?? ex);

      throw new Error('saving_failed', { cause: ex.cause ?? ex });
    }
  }

  // Check if batch mode is enabled
  const isBatch = get(batchModeEnabled);

  if (isBatch) {
    // Batch mode: save in the batch instead of creating individual branch
    try {
      const title = getEntrySummary(collection, savingEntry) ?? defaultLocaleSlug;
      const { content: data = {} } = savingEntry.locales[Object.keys(savingEntry.locales)[0]] ?? {};

      await persistBatchEntry({
        collection: collectionName,
        slug: defaultLocaleSlug,
        title,
        data,
        changes,
      });

      updateStores({ skipCI, isWorkflow: true });
      deleteBackup(collectionName, isNew ? '' : defaultLocaleSlug);

      return savingEntry;
    } catch (/** @type {any} */ ex) {
      // eslint-disable-next-line no-console
      console.error(ex.cause ?? ex);

      throw new Error('saving_failed', { cause: ex.cause ?? ex });
    }
  }

  // Check if editorial workflow is enabled (for new entries)
  if (isEditorialWorkflowEnabled() && get(backend)?.isGit) {
    try {
      // Get entry title for the PR
      const title = getEntrySummary(collection, savingEntry) ?? defaultLocaleSlug;
      // Get entry data from the default locale
      const { content: data = {} } = savingEntry.locales[Object.keys(savingEntry.locales)[0]] ?? {};

      await persistUnpublishedEntry({
        collection: collectionName,
        slug: defaultLocaleSlug,
        title,
        data,
        changes,
      });

      updateStores({ skipCI, isWorkflow: true });
      deleteBackup(collectionName, isNew ? '' : defaultLocaleSlug);

      return savingEntry;
    } catch (/** @type {any} */ ex) {
      // eslint-disable-next-line no-console
      console.error(ex.cause ?? ex);

      throw new Error('saving_failed', { cause: ex.cause ?? ex });
    }
  }

  // Standard save (direct commit)
  /** @type {ChangeResults} */
  let results;

  try {
    results = await saveChanges({
      changes,
      savingEntries: [savingEntry],
      savingAssets,
      options: {
        commitType: isNew ? 'create' : 'update',
        collection,
        skipCI,
      },
    });
  } catch (/** @type {any} */ ex) {
    // eslint-disable-next-line no-console
    console.error(ex.cause ?? ex);

    throw new Error('saving_failed', { cause: ex.cause ?? ex });
  }

  await callEventHooks({ type: 'postSave', draft, savingEntry });

  updateStores({ skipCI });
  deleteBackup(collectionName, isNew ? '' : defaultLocaleSlug);

  return results.savedEntries[0];
};
