import { get } from 'svelte/store';

import { repository } from '$lib/services/backends/git/github/repository';
import { fetchAPI } from '$lib/services/backends/git/shared/api';
import { cmsConfig } from '$lib/services/config';
import { getUnpublishedEntry, updateUnpublishedEntry } from '$lib/services/contents/workflow';
import {
  enqueuePreview,
  updateActivePreviewUrl,
} from '$lib/services/contents/workflow/preview-queue';

/**
 * @import { PreviewStatus, UnpublishedEntry } from '$lib/types/private';
 * @import { GitHubBackend } from '$lib/types/public';
 */

/** Polling interval for checking workflow status (in milliseconds). */
const POLL_INTERVAL = 5000;
/** Maximum polling duration (in milliseconds). */
const MAX_POLL_DURATION = 10 * 60 * 1000; // 10 minutes
/** LocalStorage key for preview state. */
const PREVIEW_STORAGE_KEY = 'sveltia-cms-preview-state';

/**
 * @typedef {object} StoredPreviewState
 * @property {string} collection Collection name.
 * @property {string} slug Entry slug.
 * @property {PreviewStatus} status Preview status.
 * @property {string} [previewUrl] Preview URL.
 * @property {number} [workflowRunId] Workflow run ID.
 * @property {number} dispatchTime Dispatch timestamp (ms).
 * @property {number} [prNumber] PR number for validation.
 * @property {string} [headSha] SHA of the commit the preview was built for.
 */

/**
 * Get all stored preview states from localStorage.
 * @returns {StoredPreviewState[]} Array of stored preview states.
 */
const getStoredPreviewStates = () => {
  try {
    const stored = localStorage.getItem(PREVIEW_STORAGE_KEY);

    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

/**
 * Save preview states to localStorage.
 * @param {StoredPreviewState[]} states Preview states to save.
 */
const savePreviewStates = (states) => {
  try {
    // Keep only states from the last 24 hours
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const filtered = states.filter((s) => s.dispatchTime > dayAgo);

    localStorage.setItem(PREVIEW_STORAGE_KEY, JSON.stringify(filtered));
  } catch {
    // Ignore storage errors
  }
};

/**
 * Save preview state for an entry.
 * @param {string} collection Collection name.
 * @param {string} slug Entry slug.
 * @param {Partial<StoredPreviewState>} state State to save.
 */
const savePreviewState = (collection, slug, state) => {
  const states = getStoredPreviewStates();
  const key = `${collection}/${slug}`;
  const index = states.findIndex((s) => `${s.collection}/${s.slug}` === key);

  if (index >= 0) {
    states[index] = { ...states[index], ...state };
  } else {
    states.push({
      collection,
      slug,
      status: 'building',
      dispatchTime: Date.now(),
      ...state,
    });
  }

  savePreviewStates(states);
};

/**
 * Get stored preview state for an entry.
 * @param {string} collection Collection name.
 * @param {string} slug Entry slug.
 * @returns {StoredPreviewState | undefined} Stored state or undefined.
 */
const getStoredPreviewState = (collection, slug) => {
  const states = getStoredPreviewStates();

  return states.find((s) => s.collection === collection && s.slug === slug);
};

/**
 * Remove stored preview state for an entry.
 * @param {string} collection Collection name.
 * @param {string} slug Entry slug.
 */
const removeStoredPreviewState = (collection, slug) => {
  const states = getStoredPreviewStates();
  const filtered = states.filter((s) => !(s.collection === collection && s.slug === slug));

  savePreviewStates(filtered);
};

/**
 * Sanitize a branch name for use in URLs.
 * Replaces non-alphanumeric characters with hyphens and removes consecutive/leading/trailing
 * hyphens.
 * @param {string} branch Original branch name.
 * @returns {string} Sanitized branch name.
 */
const sanitizeBranchName = (branch) =>
  branch
    .replace(/[^a-zA-Z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

/**
 * Get preview URL template from CMS config.
 * @returns {string | undefined} Preview URL template or undefined.
 */
const getPreviewUrlTemplate = () => {
  const config = get(cmsConfig);
  const backend = /** @type {GitHubBackend | undefined} */ (config?.backend);

  return backend?.preview_url;
};

/**
 * Check if preview is enabled (preview_url is configured).
 * @returns {boolean} Whether preview is enabled.
 */
export const isPreviewEnabled = () => !!getPreviewUrlTemplate();

/**
 * Build the preview URL for an entry by replacing placeholders. Supported placeholders include
 * `{{branch}}` (the entry's branch name), `{{branch_safe}}` (URL-safe branch name),
 * `{{collection}}` (the collection name), `{{slug}}` (the entry slug), `{{pr_number}}` (the pull
 * request number), `{{timestamp}}` (current timestamp in milliseconds), and `{{title}}`
 * (URL-encoded entry title).
 * @param {UnpublishedEntry} entry The entry.
 * @returns {string | undefined} Preview URL or undefined if not configured.
 */
export const buildPreviewUrl = (entry) => {
  const previewUrl = getPreviewUrlTemplate();

  if (!entry.branch || !previewUrl) {
    return undefined;
  }

  const timestamp = Date.now().toString();
  const branchSafe = sanitizeBranchName(entry.branch);

  return previewUrl
    .replace(/\{\{branch\}\}/g, entry.branch)
    .replace(/\{\{branch_safe\}\}/g, branchSafe)
    .replace(/\{\{collection\}\}/g, entry.collection)
    .replace(/\{\{slug\}\}/g, entry.slug)
    .replace(/\{\{pr_number\}\}/g, String(entry.prNumber ?? ''))
    .replace(/\{\{timestamp\}\}/g, timestamp)
    .replace(/\{\{title\}\}/g, encodeURIComponent(entry.title ?? entry.slug));
};

/**
 * Trigger a repository dispatch event to build a preview.
 * This dispatches a `sveltia-cms-preview` event that can be handled by GitHub Actions.
 * @param {UnpublishedEntry} entry The entry to build preview for.
 * @returns {Promise<void>}
 * @see https://docs.github.com/en/rest/repos/repos#create-a-repository-dispatch-event
 */
const triggerRepositoryDispatch = async (entry) => {
  const { owner, repo } = repository;

  await fetchAPI(`/repos/${owner}/${repo}/dispatches`, {
    method: 'POST',
    body: {
      event_type: 'sveltia-cms-preview',
      client_payload: {
        branch: entry.branch,
        branch_safe: sanitizeBranchName(entry.branch ?? ''),
        collection: entry.collection,
        slug: entry.slug,
        pr_number: entry.prNumber,
        title: entry.title,
      },
    },
    responseType: 'raw', // API returns 204 No Content
  });
};

/**
 * Find the workflow run triggered by our dispatch event.
 * @param {Date} dispatchTime Time when the dispatch was triggered.
 * @returns {Promise<{ id: number, status: string, conclusion: string | null } | undefined>}
 * Workflow run info or undefined if not found.
 */
const findWorkflowRun = async (dispatchTime) => {
  const { owner, repo } = repository;

  try {
    const query = `event=repository_dispatch&per_page=5&created=>${dispatchTime.toISOString()}`;

    const result = /** @type {{ workflow_runs: any[] }} */ (
      await fetchAPI(`/repos/${owner}/${repo}/actions/runs?${query}`)
    );

    if (result.workflow_runs?.length > 0) {
      const run = result.workflow_runs[0];

      return {
        id: run.id,
        status: run.status,
        conclusion: run.conclusion,
      };
    }
  } catch {
    // Ignore errors - we'll retry on next poll
  }

  return undefined;
};

/**
 * Poll the workflow run status until it completes or times out.
 * @param {string} collection Collection name.
 * @param {string} slug Entry slug.
 * @param {Date} dispatchTime Time when the dispatch was triggered.
 * @param {string} [headSha] SHA of the commit the preview is being built for.
 * @returns {Promise<void>}
 */
const pollWorkflowStatus = async (collection, slug, dispatchTime, headSha) => {
  const startTime = Date.now();

  /**
   * Poll once and schedule the next poll if needed.
   */
  const poll = async () => {
    // Check if we've exceeded the max poll duration
    if (Date.now() - startTime > MAX_POLL_DURATION) {
      updateUnpublishedEntry(collection, slug, {
        previewStatus: 'error',
        isBuildingPreview: false,
      });
      savePreviewState(collection, slug, { status: 'error' });

      return;
    }

    const entry = getUnpublishedEntry(collection, slug);

    // Stop polling if entry no longer exists or preview was cancelled
    if (!entry || entry.previewStatus !== 'building') {
      return;
    }

    const run = await findWorkflowRun(dispatchTime);

    if (run) {
      if (run.status === 'completed') {
        if (run.conclusion === 'success') {
          const url = buildPreviewUrl(entry);

          updateUnpublishedEntry(collection, slug, {
            previewStatus: 'ready',
            previewUrl: url,
            isBuildingPreview: false,
            workflowRunId: run.id,
            previewForSha: headSha,
          });
          savePreviewState(collection, slug, {
            status: 'ready',
            previewUrl: url,
            workflowRunId: run.id,
            headSha,
          });

          // Update the preview queue with the URL
          if (url) {
            updateActivePreviewUrl(collection, slug, url);
          }
        } else {
          updateUnpublishedEntry(collection, slug, {
            previewStatus: 'error',
            isBuildingPreview: false,
            workflowRunId: run.id,
          });
          savePreviewState(collection, slug, { status: 'error', workflowRunId: run.id });
        }

        return;
      }

      // Still running - update with run ID if we found it
      updateUnpublishedEntry(collection, slug, {
        workflowRunId: run.id,
      });
      savePreviewState(collection, slug, { workflowRunId: run.id });
    }

    // Continue polling
    setTimeout(poll, POLL_INTERVAL);
  };

  // Start polling after a short delay to give GitHub time to create the run
  setTimeout(poll, 2000);
};

/**
 * Build preview for an entry.
 * This triggers a `sveltia-cms-preview` repository dispatch event that can be handled
 * by a GitHub Actions workflow to build and deploy the preview. The function also starts
 * polling for workflow run status to track the build progress.
 * @param {string} collection Collection name.
 * @param {string} slug Entry slug.
 * @returns {Promise<void>}
 * @throws {Error} If preview_url is not configured or entry not found.
 */
export const buildPreview = async (collection, slug) => {
  const entry = getUnpublishedEntry(collection, slug);

  if (!entry) {
    throw new Error('Entry not found');
  }

  if (!isPreviewEnabled()) {
    throw new Error('Preview is not configured. Set preview_url in your CMS config.');
  }

  // Add to preview queue - this invalidates previous previews
  enqueuePreview(collection, slug);

  const dispatchTime = new Date();
  const { headSha } = entry;

  updateUnpublishedEntry(collection, slug, {
    isBuildingPreview: true,
    previewStatus: 'building',
    workflowRunId: undefined,
    previewForSha: undefined,
  });

  // Save to localStorage for persistence across page reloads
  savePreviewState(collection, slug, {
    collection,
    slug,
    status: 'building',
    dispatchTime: dispatchTime.getTime(),
    prNumber: entry.prNumber,
    headSha,
  });

  try {
    // Trigger repository dispatch for the user's CI/CD to handle
    await triggerRepositoryDispatch(entry);

    // Start polling for workflow status (runs in background)
    pollWorkflowStatus(collection, slug, dispatchTime, headSha);
  } catch (/** @type {any} */ error) {
    // eslint-disable-next-line no-console
    console.error('Failed to build preview:', error);

    updateUnpublishedEntry(collection, slug, {
      isBuildingPreview: false,
      previewStatus: 'error',
    });
    savePreviewState(collection, slug, { status: 'error' });

    throw error;
  }
};

/**
 * Restore preview state from localStorage and resume polling if needed.
 * This should be called when the workflow page loads to restore any in-progress previews.
 * @param {string} collection Collection name.
 * @param {string} slug Entry slug.
 */
export const restorePreviewState = (collection, slug) => {
  const stored = getStoredPreviewState(collection, slug);

  if (!stored) {
    return;
  }

  const entry = getUnpublishedEntry(collection, slug);

  if (!entry) {
    removeStoredPreviewState(collection, slug);

    return;
  }

  // Validate that the PR number matches (entry might have been recreated)
  if (stored.prNumber && entry.prNumber !== stored.prNumber) {
    removeStoredPreviewState(collection, slug);

    return;
  }

  // If the entry has been updated (new commit), the preview is outdated
  if (stored.headSha && entry.headSha && stored.headSha !== entry.headSha) {
    removeStoredPreviewState(collection, slug);

    return;
  }

  // If the stored state is ready or error, just restore it
  if (stored.status === 'ready' || stored.status === 'error') {
    updateUnpublishedEntry(collection, slug, {
      previewStatus: stored.status,
      previewUrl: stored.previewUrl,
      workflowRunId: stored.workflowRunId,
      previewForSha: stored.headSha,
      isBuildingPreview: false,
    });

    return;
  }

  // If it was building, check if it's still within the timeout
  if (stored.status === 'building') {
    const elapsed = Date.now() - stored.dispatchTime;

    if (elapsed > MAX_POLL_DURATION) {
      // Timeout - mark as error
      updateUnpublishedEntry(collection, slug, {
        previewStatus: 'error',
        isBuildingPreview: false,
      });
      savePreviewState(collection, slug, { status: 'error' });

      return;
    }

    // Resume polling
    updateUnpublishedEntry(collection, slug, {
      previewStatus: 'building',
      isBuildingPreview: true,
      workflowRunId: stored.workflowRunId,
    });

    pollWorkflowStatus(collection, slug, new Date(stored.dispatchTime), stored.headSha);
  }
};

/**
 * Check if the preview is outdated (entry has been updated since the preview was built).
 * @param {string} collection Collection name.
 * @param {string} slug Entry slug.
 * @returns {boolean} Whether the preview is outdated.
 */
export const isPreviewOutdated = (collection, slug) => {
  const entry = getUnpublishedEntry(collection, slug);

  if (!entry || !entry.previewForSha || !entry.headSha) {
    return false;
  }

  return entry.previewForSha !== entry.headSha;
};

/**
 * Get the current preview status for an entry.
 * Since preview builds are handled externally by the user's CI/CD,
 * we can only return the locally stored status.
 * @param {string} collection Collection name.
 * @param {string} slug Entry slug.
 * @returns {PreviewStatus} Current preview status.
 */
export const getPreviewStatus = (collection, slug) => {
  const entry = getUnpublishedEntry(collection, slug);

  if (!entry || !entry.branch) {
    return 'idle';
  }

  return entry.previewStatus ?? 'idle';
};

/**
 * Clear preview state for an entry. Useful when the entry is published or deleted.
 * @param {string} collection Collection name.
 * @param {string} slug Entry slug.
 */
export const clearPreviewState = (collection, slug) => {
  removeStoredPreviewState(collection, slug);

  const entry = getUnpublishedEntry(collection, slug);

  if (entry) {
    updateUnpublishedEntry(collection, slug, {
      previewStatus: 'idle',
      previewUrl: undefined,
      workflowRunId: undefined,
      isBuildingPreview: false,
      previewForSha: undefined,
    });
  }
};
