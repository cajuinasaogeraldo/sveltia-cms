import { get } from 'svelte/store';
import { _ } from 'svelte-i18n';

import { backend } from '$lib/services/backends';
import { commitChanges as githubCommitChanges } from '$lib/services/backends/git/github/commits';
import {
  closePullRequest,
  createBranch,
  createPullRequest,
  deleteBranch,
  getBranchName,
  getStatusFromLabels,
  getStatusLabel,
  listPullRequests,
  mergePullRequest,
  parseBranchName,
  updatePRStatus,
} from '$lib/services/backends/git/github/pull-requests';
import { repository } from '$lib/services/backends/git/github/repository';
import { cmsConfig } from '$lib/services/config';
import {
  addUnpublishedEntry,
  getUnpublishedEntry,
  isEditorialWorkflow,
  removeUnpublishedEntry,
  setUnpublishedEntries,
  setWorkflowLoading,
  updateUnpublishedEntry,
  WORKFLOW_STATUS,
  workflowEntriesLoaded,
} from '$lib/services/contents/workflow';

/**
 * @import { FileChange, UnpublishedEntry, WorkflowStatus } from '$lib/types/private';
 */

/**
 * Check if editorial workflow is enabled.
 * @returns {boolean} Whether editorial workflow is enabled.
 */
export const isWorkflowEnabled = () => {
  const config = get(cmsConfig);

  return config?.publish_mode === 'editorial_workflow';
};

/**
 * Initialize editorial workflow state based on config.
 */
export const initEditorialWorkflow = () => {
  const enabled = isWorkflowEnabled();

  isEditorialWorkflow.set(enabled);
};

/**
 * Load all unpublished entries from GitHub PRs.
 * @returns {Promise<void>}
 */
export const loadUnpublishedEntries = async () => {
  if (!isWorkflowEnabled()) {
    return;
  }

  // Check if already loaded
  if (get(workflowEntriesLoaded)) {
    return;
  }

  const _backend = get(backend);

  if (!_backend?.isGit || _backend.name !== 'github') {
    // eslint-disable-next-line no-console
    console.warn('Editorial workflow is only supported with GitHub backend');

    return;
  }

  try {
    setWorkflowLoading(true);

    const prs = await listPullRequests({ states: ['OPEN'] });

    /** @type {UnpublishedEntry[]} */
    const entries = prs
      .map((pr) => {
        const parsed = parseBranchName(pr.headBranch);

        if (!parsed) {
          return null;
        }

        const { collection, slug } = parsed;
        const status = getStatusFromLabels(pr.labels);
        // Extract title from PR title (format: "Editorial Workflow: <title>")
        const prTitle = pr.title.replace(/^Editorial Workflow:\s*/i, '') || slug;

        return /** @type {UnpublishedEntry} */ ({
          slug,
          collection,
          status,
          data: {},
          title: prTitle,
          prNumber: pr.number,
          prUrl: pr.url,
          branch: pr.headBranch,
          updatedAt: pr.updatedAt,
          author: pr.author,
        });
      })
      .filter(
        /** @type {(e: UnpublishedEntry | null) => e is UnpublishedEntry} */
        ((e) => e !== null),
      );

    setUnpublishedEntries(entries);
  } catch (/** @type {any} */ error) {
    // eslint-disable-next-line no-console
    console.error('Failed to load unpublished entries:', error);

    setWorkflowLoading(false);
  }
};

/**
 * Commit changes to a specific branch.
 * @param {string} branchName Branch name.
 * @param {FileChange[]} changes File changes.
 * @returns {Promise<void>}
 */
const commitToBranch = async (branchName, changes) => {
  // Temporarily switch repository branch context
  const originalBranch = repository.branch;

  try {
    Object.assign(repository, { branch: branchName });

    await githubCommitChanges(changes, { commitType: 'create' });
  } finally {
    // Restore original branch
    Object.assign(repository, { branch: originalBranch });
  }
};

/**
 * Create a new unpublished entry (creates branch and PR).
 * @param {object} args Arguments.
 * @param {string} args.collection Collection name.
 * @param {string} args.slug Entry slug.
 * @param {string} args.title Entry title.
 * @param {Record<string, any>} args.data Entry data.
 * @param {FileChange[]} args.changes File changes.
 * @param {WorkflowStatus} [args.status] Initial status.
 * @returns {Promise<UnpublishedEntry>} Created entry.
 */
export const persistUnpublishedEntry = async ({
  collection,
  slug,
  title,
  data,
  changes,
  status = WORKFLOW_STATUS.DRAFT,
}) => {
  const branchName = getBranchName(collection, slug);
  const baseBranch = repository.branch ?? 'main';
  // Check if entry already exists
  const existingEntry = getUnpublishedEntry(collection, slug);

  if (existingEntry) {
    // Update existing PR branch
    updateUnpublishedEntry(collection, slug, { isPersisting: true });

    try {
      // Commit changes to existing branch
      await commitToBranch(branchName, changes);

      updateUnpublishedEntry(collection, slug, {
        isPersisting: false,
        data,
        title,
        updatedAt: new Date(),
      });

      return /** @type {UnpublishedEntry} */ (getUnpublishedEntry(collection, slug));
    } catch (/** @type {any} */ error) {
      updateUnpublishedEntry(collection, slug, { isPersisting: false });

      throw error;
    }
  }

  // Create new branch and PR
  try {
    // Create branch
    await createBranch(branchName, baseBranch);

    // Commit changes to the new branch
    await commitToBranch(branchName, changes);

    // Create PR
    const statusLabel = getStatusLabel(status);

    const pr = await createPullRequest({
      title: `${get(_)('editorial_workflow')}: ${title}`,
      body: `Creating new entry: ${collection}/${slug}`,
      head: branchName,
      base: baseBranch,
      labels: [statusLabel],
    });

    /** @type {UnpublishedEntry} */
    const entry = {
      slug,
      collection,
      status,
      data,
      title,
      prNumber: pr.number,
      prUrl: pr.url,
      branch: branchName,
      updatedAt: new Date(),
    };

    addUnpublishedEntry(entry);

    return entry;
  } catch (/** @type {any} */ error) {
    // Cleanup: try to delete branch if PR creation failed
    try {
      await deleteBranch(branchName);
    } catch {
      // Ignore cleanup errors
    }

    throw error;
  }
};

/**
 * Update the status of an unpublished entry.
 * @param {string} collection Collection name.
 * @param {string} slug Entry slug.
 * @param {WorkflowStatus} newStatus New status.
 * @returns {Promise<void>}
 */
export const updateEntryStatus = async (collection, slug, newStatus) => {
  const entry = getUnpublishedEntry(collection, slug);

  if (!entry || !entry.prNumber) {
    throw new Error('Entry not found');
  }

  if (entry.status === newStatus) {
    return;
  }

  updateUnpublishedEntry(collection, slug, { isUpdatingStatus: true });

  try {
    await updatePRStatus(entry.prNumber, entry.status, newStatus);

    updateUnpublishedEntry(collection, slug, {
      status: newStatus,
      isUpdatingStatus: false,
      updatedAt: new Date(),
    });
  } catch (/** @type {any} */ error) {
    updateUnpublishedEntry(collection, slug, { isUpdatingStatus: false });

    throw error;
  }
};

/**
 * Publish an unpublished entry (merge PR).
 * @param {string} collection Collection name.
 * @param {string} slug Entry slug.
 * @returns {Promise<void>}
 */
export const publishEntry = async (collection, slug) => {
  const entry = getUnpublishedEntry(collection, slug);

  if (!entry || !entry.prNumber) {
    throw new Error('Entry not found');
  }

  updateUnpublishedEntry(collection, slug, { isPublishing: true });

  try {
    await mergePullRequest(entry.prNumber, {
      commitTitle: `Publish: ${entry.title ?? slug}`,
    });

    // Delete the branch after merging
    if (entry.branch) {
      try {
        await deleteBranch(entry.branch);
      } catch {
        // Ignore branch deletion errors
      }
    }

    removeUnpublishedEntry(collection, slug);
  } catch (/** @type {any} */ error) {
    updateUnpublishedEntry(collection, slug, { isPublishing: false });

    throw error;
  }
};

/**
 * Delete an unpublished entry (close PR without merging).
 * @param {string} collection Collection name.
 * @param {string} slug Entry slug.
 * @returns {Promise<void>}
 */
export const deleteUnpublishedEntry = async (collection, slug) => {
  const entry = getUnpublishedEntry(collection, slug);

  if (!entry || !entry.prNumber) {
    throw new Error('Entry not found');
  }

  updateUnpublishedEntry(collection, slug, { isDeleting: true });

  try {
    // Close the PR
    await closePullRequest(entry.prNumber);

    // Delete the branch
    if (entry.branch) {
      try {
        await deleteBranch(entry.branch);
      } catch {
        // Ignore branch deletion errors
      }
    }

    removeUnpublishedEntry(collection, slug);
  } catch (/** @type {any} */ error) {
    updateUnpublishedEntry(collection, slug, { isDeleting: false });

    throw error;
  }
};
