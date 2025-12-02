import { derived, get, writable } from 'svelte/store';

/**
 * @import { Writable } from 'svelte/store';
 * @import { UnpublishedEntry, WorkflowStatus } from '$lib/types/private';
 */

/**
 * Workflow status constants.
 * @type {Record<string, WorkflowStatus>}
 */
export const WORKFLOW_STATUS = /** @type {const} */ ({
  DRAFT: 'draft',
  PENDING_REVIEW: 'pending_review',
  PENDING_PUBLISH: 'pending_publish',
});

/**
 * Status display labels for UI.
 * @type {Record<WorkflowStatus, string>}
 */
export const STATUS_LABELS = {
  draft: 'Draft',
  pending_review: 'In Review',
  pending_publish: 'Ready',
};

/**
 * Whether the editorial workflow feature is enabled based on the CMS config.
 * @type {Writable<boolean>}
 */
export const isEditorialWorkflow = writable(false);

/**
 * Whether unpublished entries are currently being loaded.
 * @type {Writable<boolean>}
 */
export const workflowLoading = writable(false);

/**
 * Whether unpublished entries have been loaded at least once.
 * @type {Writable<boolean>}
 */
export const workflowEntriesLoaded = writable(false);

/**
 * Map of unpublished entries. Key is `${collection}.${slug}`.
 * @type {Writable<Map<string, UnpublishedEntry>>}
 */
export const unpublishedEntries = writable(new Map());

/**
 * Get the key for an unpublished entry.
 * @param {string} collection Collection name.
 * @param {string} slug Entry slug.
 * @returns {string} Key.
 */
export const getEntryKey = (collection, slug) => `${collection}.${slug}`;

/**
 * Get an unpublished entry by collection and slug.
 * @param {string} collection Collection name.
 * @param {string} slug Entry slug.
 * @returns {UnpublishedEntry | undefined} Entry or undefined.
 */
export const getUnpublishedEntry = (collection, slug) =>
  get(unpublishedEntries).get(getEntryKey(collection, slug));

/**
 * Derived store: entries with status 'draft'.
 */
export const draftEntries = derived(unpublishedEntries, ($entries) =>
  [...$entries.values()].filter((entry) => entry.status === WORKFLOW_STATUS.DRAFT),
);

/**
 * Derived store: entries with status 'pending_review'.
 */
export const pendingReviewEntries = derived(unpublishedEntries, ($entries) =>
  [...$entries.values()].filter((entry) => entry.status === WORKFLOW_STATUS.PENDING_REVIEW),
);

/**
 * Derived store: entries with status 'pending_publish'.
 */
export const pendingPublishEntries = derived(unpublishedEntries, ($entries) =>
  [...$entries.values()].filter((entry) => entry.status === WORKFLOW_STATUS.PENDING_PUBLISH),
);

/**
 * Set loading state.
 * @param {boolean} loading Whether loading.
 */
export const setWorkflowLoading = (loading) => {
  workflowLoading.set(loading);
};

/**
 * Set all unpublished entries.
 * @param {UnpublishedEntry[]} entries Entries to set.
 */
export const setUnpublishedEntries = (entries) => {
  const entriesMap = new Map();

  entries.forEach((entry) => {
    entriesMap.set(getEntryKey(entry.collection, entry.slug), entry);
  });

  unpublishedEntries.set(entriesMap);
  workflowEntriesLoaded.set(true);
  workflowLoading.set(false);
};

/**
 * Update a single unpublished entry.
 * @param {string} collection Collection name.
 * @param {string} slug Entry slug.
 * @param {Partial<UnpublishedEntry>} updates Partial updates to apply.
 */
export const updateUnpublishedEntry = (collection, slug, updates) => {
  unpublishedEntries.update((entries) => {
    const key = getEntryKey(collection, slug);
    const entry = entries.get(key);

    if (entry) {
      entries.set(key, { ...entry, ...updates });
    }

    return new Map(entries);
  });
};

/**
 * Add a new unpublished entry.
 * @param {UnpublishedEntry} entry Entry to add.
 */
export const addUnpublishedEntry = (entry) => {
  unpublishedEntries.update((entries) => {
    entries.set(getEntryKey(entry.collection, entry.slug), entry);

    return new Map(entries);
  });
};

/**
 * Remove an unpublished entry.
 * @param {string} collection Collection name.
 * @param {string} slug Entry slug.
 */
export const removeUnpublishedEntry = (collection, slug) => {
  unpublishedEntries.update((entries) => {
    entries.delete(getEntryKey(collection, slug));

    return new Map(entries);
  });
};

/**
 * Reset the workflow store to initial state.
 */
export const resetWorkflowStore = () => {
  unpublishedEntries.set(new Map());
  workflowEntriesLoaded.set(false);
  workflowLoading.set(false);
};
