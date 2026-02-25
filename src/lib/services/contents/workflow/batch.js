import { LocalStorage } from '@sveltia/utils/storage';
import { derived, get, writable } from 'svelte/store';
import { _ } from 'svelte-i18n';

import {
  closePullRequest,
  createBranch,
  createPullRequest,
  deleteBranch,
  getStatusFromLabels,
  getStatusLabel,
  listPullRequests,
  mergePullRequest,
  updatePRStatus,
} from '$lib/services/backends/git/github/pull-requests';
import { repository } from '$lib/services/backends/git/github/repository';
import { createWorkflowMessage } from '$lib/services/backends/git/shared/commits';
import { cmsConfig } from '$lib/services/config';
import { getEntryKey, WORKFLOW_STATUS } from '$lib/services/contents/workflow';
import { commitToBranch } from '$lib/services/contents/workflow/actions';
import { triggerRepositoryDispatch } from '$lib/services/contents/workflow/preview';

/**
 * @import { Batch } from '$lib/types/private';
 * @import { BatchEntry } from '$lib/types/private';
 * @import { FileChange } from '$lib/types/private';
 * @import { PreviewStatus } from '$lib/types/private';
 * @import { WorkflowStatus } from '$lib/types/private';
 */

const BATCH_MODE_STORAGE_KEY = 'sveltia-cms.batch-mode';
const BATCHES_STORAGE_KEY = 'sveltia-cms.batches';
const BATCH_PREVIEW_STORAGE_KEY = 'sveltia-cms-batch-preview-state';

/** Toggle to enable/disable batch mode with persistence. */
export const batchModeEnabled = writable(false);

// Load initial value and persist changes
(async () => {
  try {
    const saved = await LocalStorage.get(BATCH_MODE_STORAGE_KEY);

    if (saved !== undefined) {
      batchModeEnabled.set(saved);
    }
  } catch {
    // Ignore storage errors
  }
})();

batchModeEnabled.subscribe(async (value) => {
  try {
    await LocalStorage.set(BATCH_MODE_STORAGE_KEY, value);
  } catch {
    // Ignore storage errors
  }
});

/** List of all batches (including inactive ones). */
export const allBatches = writable(/** @type {Batch[]} */ ([]));

/** Currently active batch (null if none). */
export const activeBatch = writable(/** @type {Batch | null} */ (null));

/** Derived store: whether batch mode is currently enabled. */
export const isBatchMode = derived(batchModeEnabled, (m) => m === true);

/**
 * Get the batch branch name from config.
 * @returns {string} Branch name for batch mode.
 */
export const getBatchBranch = () => {
  const config = get(cmsConfig);

  // @ts-ignore - batch_branch is a custom property we added
  return config?.backend?.batch_branch || 'cms/workflow';
};

/**
 * Get list of selectable batches (in Draft or Review, not in Ready or building).
 * @returns {Batch[]} List of batches that can be selected.
 */
export const getSelectableBatches = () => {
  const batches = get(allBatches);

  return batches.filter(
    (b) =>
      b.isActive && b.status !== WORKFLOW_STATUS.PENDING_PUBLISH && b.previewStatus !== 'building',
  );
};

/**
 * Creates a new batch (marks previous as inactive).
 * The actual batch will be created on the first save operation.
 */
const createNewBatch = async () => {
  // Mark all existing batches as inactive
  allBatches.update((batches) => batches.map((b) => ({ ...b, isActive: false })));

  // Clear active batch - new one will be created on first save
  activeBatch.set(null);
};

/**
 * Adds an entry to an existing batch.
 * @param {Batch} batch Existing batch.
 * @param {object} args Entry arguments.
 * @param {string} args.collection Collection name.
 * @param {string} args.slug Entry slug.
 * @param {string} args.title Entry title.
 * @param {Record<string, any>} args.data Entry data.
 * @param {FileChange[]} args.changes File changes to commit.
 */
const addToBatch = async (batch, { collection, slug, title, data, changes }) => {
  // Import the necessary modules dynamically
  const { fetchGraphQL } = await import('$lib/services/backends/git/shared/api');
  const { encodeBase64 } = await import('@sveltia/utils/file');
  const { createCommitMessage } = await import('$lib/services/backends/git/shared/commits');

  const { owner, repo } = repository;

  // Prepare file additions
  const additions = await Promise.all(
    changes
      .filter(({ action }) => ['create', 'update', 'move'].includes(action))
      .map(async ({ path, data: fileData }) => ({
        path,
        contents: await encodeBase64(fileData ?? ''),
      })),
  );

  const deletions = changes
    .filter(({ action }) => ['move', 'delete'].includes(action))
    .map(({ previousPath, path }) => ({ path: previousPath ?? path }));

  // Part of the query to fetch new file SHAs
  const fileShaQuery = additions
    .map(({ path }, index) => `file_${index}: file(path: ${JSON.stringify(path)}) { oid }`)
    .join(' ');

  const query = `
    mutation($input: CreateCommitOnBranchInput!) {
      createCommitOnBranch(input: $input) {
        commit {
          oid
          committedDate
          ${fileShaQuery}
        }
      }
    }
  `;

  // Use the batch's stored headSha as expectedHeadOid - this is the key fix!
  const expectedHeadOid = batch.headSha;

  const input = {
    branch: {
      repositoryNameWithOwner: `${owner}/${repo}`,
      branchName: batch.branch,
    },
    expectedHeadOid,
    fileChanges: { additions, deletions },
    message: {
      headline: createCommitMessage(changes, { commitType: 'create' }),
    },
  };

  const {
    createCommitOnBranch: { commit },
  } = /** @type {{ createCommitOnBranch: { commit: Record<string, any> }}} */ (
    await fetchGraphQL(query, { input })
  );

  const commitSha = commit.oid;
  /** @type {Map<string, BatchEntry>} */
  const entries = new Map(batch.entries);

  entries.set(getEntryKey(collection, slug), { collection, slug, title, data });

  /** @type {Batch} */
  const updated = {
    ...batch,
    entries,
    headSha: commitSha,
    updatedAt: new Date(),
  };

  activeBatch.set(updated);
  allBatches.update((batches) => batches.map((b) => (b.id === batch.id ? updated : b)));
};

/**
 * Creates a new batch with branch and PR.
 * @param {object} args Batch creation arguments.
 * @param {string} args.collection Collection name.
 * @param {string} args.slug Entry slug.
 * @param {string} args.title Entry title.
 * @param {Record<string, any>} args.data Entry data.
 * @param {FileChange[]} args.changes File changes to commit.
 * @param {string} args.branchName Branch name for the batch.
 */
const createBatch = async ({ collection, slug, title, data, changes, branchName }) => {
  const baseBranch = repository.branch ?? 'main';

  // Check if there's an existing PR for this branch (from previous session)
  const existingPRs = await listPullRequests({ states: ['OPEN'] });
  const existingPR = existingPRs.find((pr) => pr.headBranch === branchName);

  if (existingPR) {
    // Reuse existing PR - check if we already have a batch for this PR in memory
    const batchByPR = get(allBatches).find((b) => b.prNumber === existingPR.number);

    if (batchByPR) {
      // Add to existing batch
      await addToBatch(batchByPR, { collection, slug, title, data, changes });
      activeBatch.set(batchByPR);
      return;
    }

    // PR exists but we don't have it in memory - create a batch for it
    await addToBatchToExistingBranch(branchName, {
      collection,
      slug,
      title,
      data,
      changes,
      prNumber: existingPR.number,
      prStatus: getStatusFromLabels(existingPR.labels),
      existingHeadSha: existingPR.headSha,
    });
    return;
  }

  // No existing PR - create new branch and PR
  try {
    await createBranch(branchName, baseBranch);
  } catch (/** @type {any} */ error) {
    // Branch might already exist - try to reuse it
    if (error.message?.includes('already exists') || error.status === 422) {
      // Continue - we'll add to the existing branch
    } else {
      throw error;
    }
  }

  const commitSha = await commitToBranch(branchName, changes);

  const prTitle = createWorkflowMessage('batchPrTitle', {
    collection: '',
    slug: '',
    title: '',
  });

  const prBody = createWorkflowMessage('batchPrBody', {
    collection: '',
    slug: '',
    title: '',
  });

  const pr = await createPullRequest({
    title: prTitle,
    body: prBody,
    head: branchName,
    base: baseBranch,
    labels: [getStatusLabel(WORKFLOW_STATUS.DRAFT)],
  });

  /** @type {Map<string, BatchEntry>} */
  const entries = new Map([[getEntryKey(collection, slug), { collection, slug, title, data }]]);

  /** @type {Batch} */
  const newBatch = {
    // Use PR number as ID base so it's consistent across sessions
    id: `batch-pr-${pr.number}`,
    branch: branchName,
    prNumber: pr.number,
    entries,
    status: WORKFLOW_STATUS.DRAFT,
    createdAt: new Date(),
    previewStatus: 'idle',
    previewUrl: null,
    isActive: true,
    headSha: commitSha,
    isPersisting: false,
    isUpdatingStatus: false,
    isPublishing: false,
    isDeleting: false,
    isBuildingPreview: false,
  };

  activeBatch.set(newBatch);
  allBatches.update((batches) => [...batches, newBatch]);
};

/**
 * Adds an entry to an existing batch branch with an existing PR.
 * Uses a fixed ID based on PR number so it can be recovered later.
 * @param {string} branchName Branch name.
 * @param {object} args Entry arguments.
 * @param {string} args.collection Collection name.
 * @param {string} args.slug Entry slug.
 * @param {string} args.title Entry title.
 * @param {Record<string, any>} args.data Entry data.
 * @param {FileChange[]} args.changes File changes to commit.
 * @param {number} args.prNumber Existing PR number.
 * @param {WorkflowStatus} args.prStatus PR workflow status.
 * @param {string} args.existingHeadSha Current HEAD SHA of the branch.
 */
const addToBatchToExistingBranch = async (
  branchName,
  { collection, slug, title, data, changes, prNumber, prStatus, existingHeadSha },
) => {
  // Import the necessary modules dynamically
  const { fetchGraphQL } = await import('$lib/services/backends/git/shared/api');
  const { encodeBase64 } = await import('@sveltia/utils/file');
  const { createCommitMessage } = await import('$lib/services/backends/git/shared/commits');

  const { owner, repo } = repository;

  // Prepare file additions
  const additions = await Promise.all(
    changes
      .filter(({ action }) => ['create', 'update', 'move'].includes(action))
      .map(async ({ path, data: fileData }) => ({
        path,
        contents: await encodeBase64(fileData ?? ''),
      })),
  );

  const deletions = changes
    .filter(({ action }) => ['move', 'delete'].includes(action))
    .map(({ previousPath, path }) => ({ path: previousPath ?? path }));

  // Part of the query to fetch new file SHAs
  const fileShaQuery = additions
    .map(({ path }, index) => `file_${index}: file(path: ${JSON.stringify(path)}) { oid }`)
    .join(' ');

  const query = `
    mutation($input: CreateCommitOnBranchInput!) {
      createCommitOnBranch(input: $input) {
        commit {
          oid
          committedDate
          ${fileShaQuery}
        }
      }
    }
  `;

  const input = {
    branch: {
      repositoryNameWithOwner: `${owner}/${repo}`,
      branchName,
    },
    expectedHeadOid: existingHeadSha,
    fileChanges: { additions, deletions },
    message: {
      headline: createCommitMessage(changes, { commitType: 'create' }),
    },
  };

  const {
    createCommitOnBranch: { commit },
  } = /** @type {{ createCommitOnBranch: { commit: Record<string, any> }}} */ (
    await fetchGraphQL(query, { input })
  );

  const commitSha = commit.oid;
  /** @type {Map<string, BatchEntry>} */
  const entries = new Map([[getEntryKey(collection, slug), { collection, slug, title, data }]]);

  /** @type {Batch} */
  const newBatch = {
    // Use PR number as ID base so it's consistent across sessions
    id: `batch-pr-${prNumber}`,
    branch: branchName,
    prNumber,
    entries,
    status: prStatus,
    createdAt: new Date(),
    previewStatus: 'idle',
    previewUrl: null,
    isActive: true,
    headSha: commitSha,
    isPersisting: false,
    isUpdatingStatus: false,
    isPublishing: false,
    isDeleting: false,
    isBuildingPreview: false,
  };

  activeBatch.set(newBatch);
  allBatches.update((batches) => [...batches, newBatch]);
};

/**
 * Tries to enable batch mode with validation checks.
 * Shows confirmation dialogs if the current active batch is in a state that would block changes.
 * @returns {Promise<boolean>} True if batch mode was enabled, false if user cancelled.
 */
export const enableBatchMode = async () => {
  const batches = get(allBatches);
  // Find the currently active batch
  const active = batches.find((b) => b.isActive);

  if (!active) {
    batchModeEnabled.set(true);
    return true;
  }

  // Validation checks
  if (active.status === WORKFLOW_STATUS.PENDING_PUBLISH) {
    // Batch is in Ready state - ask if user wants to create a new batch
    // eslint-disable-next-line no-alert
    if (
      !window.confirm(
        get(_)('batch_ready_alert', {
          default: 'The last batch changes are already ready. Open a new batch?',
        }),
      )
    ) {
      return false;
    }

    // Create new batch
    await createNewBatch();
  } else if (active.previewStatus === 'building') {
    // Batch is building preview - ask if user wants to create a new batch
    // eslint-disable-next-line no-alert
    if (
      !window.confirm(
        get(_)('batch_building_alert', {
          default: 'Preview is currently building. Open a new batch?',
        }),
      )
    ) {
      return false;
    }

    // Create new batch
    await createNewBatch();
  }

  batchModeEnabled.set(true);
  return true;
};

/**
 * Disables batch mode without deleting the batch.
 * The batch remains visible but inactive.
 */
export const disableBatchMode = () => {
  batchModeEnabled.set(false);
};

/**
 * Adds or updates an entry in the current batch.
 * Creates a new batch if none exists.
 * @param {object} args Entry arguments.
 * @param {string} args.collection Collection name.
 * @param {string} args.slug Entry slug.
 * @param {string} args.title Entry title.
 * @param {Record<string, any>} args.data Entry data.
 * @param {FileChange[]} args.changes File changes to commit.
 */
export const persistBatchEntry = async ({ collection, slug, title, data, changes }) => {
  const batch = get(activeBatch);
  const branchName = getBatchBranch();

  if (!batch) {
    // Create new batch with branch and PR
    await createBatch({ collection, slug, title, data, changes, branchName });
  } else {
    // Add to existing batch
    await addToBatch(batch, { collection, slug, title, data, changes });
  }
};

/**
 * Updates the status of the current batch.
 * @param {WorkflowStatus} newStatus New workflow status.
 */
export const updateBatchStatus = async (newStatus) => {
  const batch = get(activeBatch);

  if (!batch || !batch.prNumber) return;

  activeBatch.update((b) => (b ? { ...b, isUpdatingStatus: true } : null));
  allBatches.update((batches) =>
    batches.map((b) => (b.id === batch.id ? { ...b, isUpdatingStatus: true } : b)),
  );

  try {
    await updatePRStatus(batch.prNumber, batch.status, newStatus);

    /** @type {Batch} */
    const updated = {
      ...batch,
      status: newStatus,
      isUpdatingStatus: false,
      updatedAt: new Date(),
    };

    activeBatch.set(updated);
    allBatches.update((batches) => batches.map((b) => (b.id === batch.id ? updated : b)));
  } catch (/** @type {any} */ error) {
    activeBatch.update((b) => (b ? { ...b, isUpdatingStatus: false } : null));
    allBatches.update((batches) =>
      batches.map((b) => (b.id === batch.id ? { ...b, isUpdatingStatus: false } : b)),
    );
    throw error;
  }
};

/**
 * Publishes the current batch (merges the PR).
 */
export const publishBatch = async () => {
  const batch = get(activeBatch);

  if (!batch) throw new Error('No active batch');

  activeBatch.update((b) => (b ? { ...b, isPublishing: true } : null));
  allBatches.update((batches) =>
    batches.map((b) => (b.id === batch.id ? { ...b, isPublishing: true } : b)),
  );

  try {
    const commitTitle = createWorkflowMessage('batchPublish', {
      collection: '',
      slug: '',
      title: '',
    });

    await mergePullRequest(batch.prNumber, { commitTitle });

    // Delete the branch after merging
    try {
      await deleteBranch(batch.branch);
    } catch {
      // Ignore branch deletion errors
    }

    // Remove from list and clear active
    allBatches.update((batches) => batches.filter((b) => b.id !== batch.id));
    activeBatch.set(null);
  } catch (/** @type {any} */ error) {
    activeBatch.update((b) => (b ? { ...b, isPublishing: false } : null));
    allBatches.update((batches) =>
      batches.map((b) => (b.id === batch.id ? { ...b, isPublishing: false } : b)),
    );
    throw error;
  }
};

/**
 * Deletes the current batch (closes PR without merging).
 */
export const deleteBatch = async () => {
  const batch = get(activeBatch);

  if (!batch) return;

  activeBatch.update((b) => (b ? { ...b, isDeleting: true } : null));
  allBatches.update((batches) =>
    batches.map((b) => (b.id === batch.id ? { ...b, isDeleting: true } : b)),
  );

  try {
    await closePullRequest(batch.prNumber);

    // Delete the branch
    try {
      await deleteBranch(batch.branch);
    } catch {
      // Ignore branch deletion errors
    }

    // Remove from list and clear active
    allBatches.update((batches) => batches.filter((b) => b.id !== batch.id));
    activeBatch.set(null);
  } catch (/** @type {any} */ error) {
    activeBatch.update((b) => (b ? { ...b, isDeleting: false } : null));
    allBatches.update((batches) =>
      batches.map((b) => (b.id === batch.id ? { ...b, isDeleting: false } : b)),
    );
    throw error;
  }
};

/**
 * Sets which batch is currently active.
 * @param {string} batchId Batch ID to activate.
 */
export const setActiveBatch = (batchId) => {
  allBatches.update((batches) =>
    batches.map((b) => ({
      ...b,
      isActive: b.id === batchId,
    })),
  );

  const batch = get(allBatches).find((b) => b.id === batchId);

  activeBatch.set(batch ?? null);
};

/**
 * Loads existing batches from PRs on the batch branch.
 * Should be called during initialization to recover existing batches.
 */
export const loadExistingBatches = async () => {
  try {
    const saved = await LocalStorage.get(BATCHES_STORAGE_KEY);

    if (saved && Array.isArray(saved) && saved.length > 0) {
      // Convert entries back to Map
      const batches = saved.map((b) => ({
        ...b,
        entries: new Map(Object.entries(b.entries)),
        createdAt: new Date(b.createdAt),
        updatedAt: b.updatedAt ? new Date(b.updatedAt) : undefined,
      }));

      allBatches.set(batches);

      // Set active batch
      const active = batches.find((b) => b.isActive);

      if (active) {
        activeBatch.set(active);

        // Restore preview state from localStorage if exists
        restoreBatchPreviewState(active);
      }

      return;
    }
  } catch {
    // Ignore errors loading saved batches - continue to load from PRs
  }

  // If no batches in localStorage, try to load from existing PRs
  try {
    const branchName = getBatchBranch();
    const existingPRs = await listPullRequests({ states: ['OPEN'] });
    const batchPR = existingPRs.find((pr) => pr.headBranch === branchName);

    if (batchPR) {
      // Load entries from the PR
      const { getPullRequestFiles } = await import('$lib/services/backends/git/github/pull-requests');
      const prFiles = await getPullRequestFiles(batchPR.number);

      // eslint-disable-next-line no-console
      console.log('[Batch] Recovering from PR #', batchPR.number, 'with', prFiles.length, 'files');

      // Create entries from changed files
      /** @type {Map<string, BatchEntry>} */
      const entriesMap = new Map();

      for (const file of prFiles) {
        // Skip deleted files
        if (file.status === 'removed') continue;

        // eslint-disable-next-line no-console
        console.log('[Batch] Processing file:', file.path);

        // Try to parse the file path to get collection and slug
        // Format: content/collection/slug.md or content/collection/slug/index.md
        const pathParts = file.path.split('/');
        if (pathParts.length < 2) continue;

        const fileName = pathParts[pathParts.length - 1];
        const slug = fileName.replace(/\.(md|json|yaml|yml)$/i, '');
        const collection = pathParts[pathParts.length - 2];

        // Check if this is a content file (supports multiple path formats)
        const isContentFile =
          file.path.includes('/content/') ||
          file.path.includes('/src/content/') ||
          file.path.includes('/src/data/') ||
          file.path.match(/^(posts|pages|content|docs|data)\//) ||
          file.path.match(/^src\/(posts|pages|content|docs|data)\//);

        if (!isContentFile) {
          // eslint-disable-next-line no-console
          console.log('[Batch] Skipping non-content file:', file.path);
          continue;
        }

        // Extract collection name from path
        let collectionName = collection;

        // Remove common prefixes
        if (file.path.startsWith('src/content/')) {
          collectionName = file.path.replace('src/content/', '').split('/')[0];
        } else if (file.path.startsWith('src/data/')) {
          collectionName = file.path.replace('src/data/', '').split('/')[0];
        } else if (file.path.startsWith('src/')) {
          collectionName = file.path.replace('src/', '').split('/')[0];
        } else if (file.path.startsWith('content/')) {
          collectionName = file.path.replace('content/', '').split('/')[0];
        } else {
          collectionName = file.path.split('/')[0];
        }

        // Skip if collection is the same as slug (it's a folder/collection index)
        if (collectionName === slug) {
          // eslint-disable-next-line no-console
          console.log('[Batch] Skipping index file:', file.path);
          continue;
        }

        const key = getEntryKey(collectionName, slug);

        // Only add if not already in the map
        if (!entriesMap.has(key)) {
          // eslint-disable-next-line no-console
          console.log('[Batch] Adding entry:', collectionName, slug, 'from:', file.path);
          entriesMap.set(key, {
            collection: collectionName,
            slug,
            title: slug, // Will be updated when loaded
            data: {},
          });
        }
      }

      // eslint-disable-next-line no-console
      console.log('[Batch] Recovered', entriesMap.size, 'entries from PR');

      // Create a batch from the existing PR
      const prStatus = getStatusFromLabels(batchPR.labels);

      /** @type {Batch} */
      const recoveredBatch = {
        id: `batch-pr-${batchPR.number}`,
        branch: branchName,
        prNumber: batchPR.number,
        entries: entriesMap,
        status: prStatus,
        createdAt: new Date(batchPR.createdAt),
        previewStatus: 'idle',
        previewUrl: null,
        isActive: true,
        headSha: batchPR.headSha,
        isPersisting: false,
        isUpdatingStatus: false,
        isPublishing: false,
        isDeleting: false,
        isBuildingPreview: false,
      };

      allBatches.set([recoveredBatch]);
      activeBatch.set(recoveredBatch);

      // Restore preview state from localStorage if exists
      restoreBatchPreviewState(recoveredBatch);
    }
  } catch {
    // Ignore errors loading from PRs
  }
};

/**
 * Restore preview state for a batch from localStorage.
 * @param {Batch} batch Batch to restore preview state for.
 */
const restoreBatchPreviewState = (batch) => {
  try {
    const stored = localStorage.getItem(BATCH_PREVIEW_STORAGE_KEY);

    // eslint-disable-next-line no-console
    console.log('[Batch Preview] Restoring from localStorage:', !!stored);

    if (!stored) return;

    const states = JSON.parse(stored);
    // eslint-disable-next-line no-console
    console.log('[Batch Preview] Stored states:', states);

    const batchState = states.find((s) => s.batchId === batch.id || (s.collection === 'batch' && s.slug === 'changes'));

    // eslint-disable-next-line no-console
    console.log('[Batch Preview] Found batch state:', batchState);

    if (batchState && batchState.status !== 'building') {
      // If preview is ready or has an error, restore the state
      if (batchState.status === 'ready' && batchState.previewUrl) {
        // eslint-disable-next-line no-console
        console.log('[Batch Preview] Restoring ready state with URL:', batchState.previewUrl);

        const updated = {
          ...batch,
          previewStatus: 'ready',
          previewUrl: batchState.previewUrl,
          isBuildingPreview: false,
        };

        activeBatch.set(updated);
        allBatches.update((batches) =>
          batches.map((b) => (b.id === batch.id ? updated : b)),
        );
      } else if (batchState.status === 'error') {
        // eslint-disable-next-line no-console
        console.log('[Batch Preview] Restoring error state');

        const updated = {
          ...batch,
          previewStatus: 'error',
          isBuildingPreview: false,
        };

        activeBatch.set(updated);
        allBatches.update((batches) =>
          batches.map((b) => (b.id === batch.id ? updated : b)),
        );
      }
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[Batch Preview] Error restoring preview state:', e);
  }
};

// Persist batches to localStorage when they change
allBatches.subscribe(async (batches) => {
  try {
    // Convert Maps to objects for JSON serialization
    const serialized = batches.map((b) => ({
      ...b,
      entries: Object.fromEntries(b.entries),
    }));

    await LocalStorage.set(BATCHES_STORAGE_KEY, serialized);
  } catch {
    // Ignore storage errors
  }
});

/**
 * Builds a preview for the current batch.
 * Uses the same preview system as individual entries.
 */
export const buildBatchPreview = async () => {
  const batch = get(activeBatch);

  if (!batch) {
    throw new Error('No active batch');
  }

  // Update status
  activeBatch.update((b) =>
    b ? { ...b, previewStatus: 'building', isBuildingPreview: true } : null,
  );
  allBatches.update((batches) =>
    batches.map((b) =>
      b.id === batch.id ? { ...b, previewStatus: 'building', isBuildingPreview: true } : b,
    ),
  );

  try {
    const { headSha } = batch;

    // Create a "virtual" entry for the preview system
    /** @type {any} */
    const previewEntry = {
      branch: batch.branch,
      collection: 'batch',
      slug: 'changes',
      title: `Batch Changes (${batch.entries.size} entries)`,
      prNumber: batch.prNumber,
      headSha,
      status: WORKFLOW_STATUS.DRAFT,
      data: {},
    };

    // Trigger the preview build
    await triggerRepositoryDispatch(previewEntry);

    // Start polling for workflow status
    pollBatchPreviewStatus(batch, new Date(), headSha);
  } catch (/** @type {any} */ error) {
    activeBatch.update((b) =>
      b ? { ...b, previewStatus: 'error', isBuildingPreview: false } : null,
    );
    allBatches.update((batches) =>
      batches.map((b) =>
        b.id === batch.id ? { ...b, previewStatus: 'error', isBuildingPreview: false } : b,
      ),
    );
    throw error;
  }
};

/**
 * Poll the workflow status for batch preview.
 * Similar to pollWorkflowStatus but updates batch instead of unpublished entry.
 * @param {Batch} batch The batch to poll for.
 * @param {Date} dispatchTime When the dispatch was triggered.
 * @param {string} headSha HEAD SHA for the preview.
 */
const pollBatchPreviewStatus = async (batch, dispatchTime, headSha) => {
  const POLL_INTERVAL = 3000; // Poll every 3 seconds instead of 5
  const MAX_POLL_DURATION = 10 * 60 * 1000; // 10 minutes
  const startTime = Date.now();

  // Import the findWorkflowRun function dynamically
  const { findWorkflowRun } = await import('$lib/services/contents/workflow/preview');
  const { buildPreviewUrl } = await import('$lib/services/contents/workflow/preview');

  /**
   * Save preview state to localStorage.
   * @param {string} status Preview status.
   * @param {string|null} [url] Preview URL.
   */
  const savePreviewState = (status, url) => {
    try {
      const key = `batch/changes`;
      const stored = localStorage.getItem(BATCH_PREVIEW_STORAGE_KEY);
      const states = stored ? JSON.parse(stored) : [];

      const index = states.findIndex((s) => s.collection === 'batch' && s.slug === 'changes');
      const entry = {
        collection: 'batch',
        slug: 'changes',
        status,
        dispatchTime: dispatchTime.getTime(),
        prNumber: batch.prNumber,
        headSha,
        previewUrl: url,
        batchId: batch.id,
      };

      if (index >= 0) {
        states[index] = entry;
      } else {
        states.push(entry);
      }

      localStorage.setItem(BATCH_PREVIEW_STORAGE_KEY, JSON.stringify(states));
    } catch (e) {
      // Ignore storage errors
    }
  };

  /**
   * Poll once and schedule the next poll if needed.
   */
  const poll = async () => {
    // Check if we've exceeded the max poll duration
    if (Date.now() - startTime > MAX_POLL_DURATION) {
      updateBatchPreviewStatus('batch', 'changes', 'error', null);
      savePreviewState('error', null);
      // eslint-disable-next-line no-console
      console.warn('[Batch Preview] Polling timeout');
      return;
    }

    // Get current batch state
    const currentBatch = get(activeBatch);
    if (!currentBatch || currentBatch.id !== batch.id) {
      // Batch is no longer active
      return;
    }

    // Stop polling if preview is no longer building
    if (currentBatch.previewStatus !== 'building') {
      return;
    }

    try {
      // eslint-disable-next-line no-console
      console.log('[Batch Preview] Polling for workflow run...');

      const run = await findWorkflowRun(dispatchTime);

      if (run) {
        // eslint-disable-next-line no-console
        console.log('[Batch Preview] Found workflow run:', run.status, run.conclusion);

        if (run.status === 'completed') {
          if (run.conclusion === 'success') {
            // Build preview URL for batch
            const url = buildPreviewUrl({
              collection: 'batch',
              slug: 'changes',
              title: `Batch Changes (${batch.entries.size} entries)`,
              branch: batch.branch,
              prNumber: batch.prNumber,
              headSha,
            });

            // eslint-disable-next-line no-console
            console.log('[Batch Preview] Preview ready:', url);

            updateBatchPreviewStatus('batch', 'changes', 'ready', url);
            savePreviewState('ready', url);
          } else {
            // eslint-disable-next-line no-console
            console.warn('[Batch Preview] Workflow failed:', run.conclusion);
            updateBatchPreviewStatus('batch', 'changes', 'error', null);
            savePreviewState('error', null);
          }

          return;
        }

        // Still running - update with run ID if we found it
        savePreviewState('building', null);
      }

      // Continue polling
      setTimeout(poll, POLL_INTERVAL);
    } catch (/** @type {any} */ error) {
      // eslint-disable-next-line no-console
      console.error('[Batch Preview] Error polling:', error);
      setTimeout(poll, POLL_INTERVAL);
    }
  };

  // Save initial building state
  savePreviewState('building', null);

  // Start polling after a short delay to give GitHub time to create the run
  setTimeout(poll, 2000);
};

/**
 * Updates the preview status for a batch.
 * Called by the preview polling system.
 * @param {string} collection Collection name (should be 'batch').
 * @param {string} slug Slug (should be 'changes').
 * @param {PreviewStatus} status New preview status.
 * @param {string | null} [url] Preview URL.
 */
export const updateBatchPreviewStatus = (collection, slug, status, url) => {
  const batch = get(activeBatch);

  if (!batch || collection !== 'batch' || slug !== 'changes') {
    return;
  }

  /** @type {Batch} */
  const updated = {
    ...batch,
    previewStatus: status,
    previewUrl: url ?? null,
    isBuildingPreview: status === 'building',
  };

  activeBatch.set(updated);
  allBatches.update((batches) => batches.map((b) => (b.id === batch.id ? updated : b)));
};

/**
 * Clears the current batch (creates a new empty one).
 */
export const clearCurrentBatch = () => {
  activeBatch.set(null);
};
