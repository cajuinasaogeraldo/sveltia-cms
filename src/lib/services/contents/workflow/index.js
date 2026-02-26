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
  [...$entries.values()].filter(
    (entry) => entry.status === WORKFLOW_STATUS.DRAFT && !entry.isTemporary,
  ),
);

/**
 * Derived store: entries with status 'pending_review'.
 */
export const pendingReviewEntries = derived(unpublishedEntries, ($entries) =>
  [...$entries.values()].filter(
    (entry) => entry.status === WORKFLOW_STATUS.PENDING_REVIEW && !entry.isTemporary,
  ),
);

/**
 * Derived store: entries with status 'pending_publish'.
 */
export const pendingPublishEntries = derived(unpublishedEntries, ($entries) =>
  [...$entries.values()].filter(
    (entry) => entry.status === WORKFLOW_STATUS.PENDING_PUBLISH && !entry.isTemporary,
  ),
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
 * Preserves temporary entries that may have been added (e.g., from batch mode).
 * @param {UnpublishedEntry[]} entries Entries to set.
 */
export const setUnpublishedEntries = (entries) => {
  const entriesMap = new Map();

  entries.forEach((entry) => {
    entriesMap.set(getEntryKey(entry.collection, entry.slug), entry);
  });

  // Preserve any temporary entries from the current store
  const currentEntries = get(unpublishedEntries);
  currentEntries.forEach((entry, key) => {
    if (entry.isTemporary && !entriesMap.has(key)) {
      entriesMap.set(key, entry);
    }
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

/**
 * Store to track if we're currently editing a workflow entry.
 * @type {Writable<string | null>}
 */
export const currentWorkflowBranch = writable(null);

/**
 * Store to track the current workflow entry being edited.
 * @type {Writable<UnpublishedEntry | null>}
 */
export const currentWorkflowEntry = writable(null);

/**
 * Set the current workflow branch context for editing.
 * @param {UnpublishedEntry | null} entry Workflow entry or null to clear.
 */
export const setWorkflowEditContext = (entry) => {
  if (entry && entry.branch) {
    currentWorkflowBranch.set(entry.branch);
    currentWorkflowEntry.set(entry);
  } else {
    currentWorkflowBranch.set(null);
    currentWorkflowEntry.set(null);
  }
};

/**
 * Clear the workflow edit context.
 */
export const clearWorkflowEditContext = () => {
  currentWorkflowBranch.set(null);
  currentWorkflowEntry.set(null);
};

/**
 * Generate a GitHub raw URL for an asset in a workflow branch.
 * @param {string} assetPath Asset path (e.g., /src/assets/images/photo.jpg).
 * @param {object} repoInfo Repository information.
 * @param {string} repoInfo.owner Repository owner.
 * @param {string} repoInfo.repo Repository name.
 * @returns {string | null} GitHub raw URL or null if not in workflow mode.
 */
export const getWorkflowAssetURL = (assetPath, repoInfo) => {
  const workflowBranch = get(currentWorkflowBranch);

  if (!workflowBranch) {
    return null;
  }

  const { owner, repo } = repoInfo;

  if (!owner || !repo) {
    return null;
  }

  // Remove leading slash if present
  const cleanPath = assetPath.startsWith('/') ? assetPath.slice(1) : assetPath;

  // Encode the path properly for URL, preserving UTF-8 characters
  const encodedPath = cleanPath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');

  // Encode the branch name
  const encodedBranch = encodeURIComponent(workflowBranch);

  return `https://raw.githubusercontent.com/${owner}/${repo}/${encodedBranch}/${encodedPath}`;
};
