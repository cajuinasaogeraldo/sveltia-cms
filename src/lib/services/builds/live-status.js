import { get, writable } from 'svelte/store';

import { backend } from '$lib/services/backends';
import { repository } from '$lib/services/backends/git/github/repository';
import { fetchAPI } from '$lib/services/backends/git/shared/api';

/**
 * @import { Writable } from 'svelte/store';
 */

/** Polling interval for checking live build status (in milliseconds). */
const POLL_INTERVAL = 30000; // 30 seconds
/** LocalStorage key for live build state. */
const LIVE_BUILD_STORAGE_KEY = 'sveltia-cms-live-builds';
/** Maximum number of builds to store in history. */
const MAX_BUILD_HISTORY = 5;

/**
 * @typedef {object} LiveBuild
 * @property {number} id Workflow run ID.
 * @property {string} name Workflow name.
 * @property {string} status Workflow status (queued, in_progress, completed).
 * @property {string | null} conclusion Workflow conclusion (success, failure, cancelled, etc.).
 * @property {string} htmlUrl URL to view the workflow run on GitHub.
 * @property {string} createdAt ISO timestamp when the run was created.
 * @property {string} [updatedAt] ISO timestamp when the run was last updated.
 * @property {string} headSha Commit SHA that triggered the run.
 * @property {string} [headBranch] Branch name (should be main/master).
 */

/**
 * @typedef {object} LiveBuildState
 * @property {LiveBuild | null} currentBuild Currently running build (if any).
 * @property {LiveBuild[]} history Recent completed builds.
 * @property {number} lastPolled Timestamp of last poll.
 */

/**
 * Live builds store.
 * @type {Writable<LiveBuildState>}
 */
export const liveBuildState = writable({
  currentBuild: null,
  history: [],
  lastPolled: 0,
});

/**
 * Whether there's a live build currently running.
 * @type {Writable<boolean>}
 */
export const isLiveBuildRunning = writable(false);

/**
 * Whether polling is active.
 * @type {Writable<boolean>}
 */
export const isPollingLiveBuilds = writable(false);

/** @type {number | null} */
let pollIntervalId = null;
/** @type {boolean} */
let isPageVisible = true;
/**
 * Get the storage key for live builds.
 * @returns {string} Storage key.
 */
const getStorageKey = () => LIVE_BUILD_STORAGE_KEY;

/**
 * Load live build state from localStorage.
 * @returns {LiveBuildState | null} Stored state or null.
 */
const loadFromStorage = () => {
  try {
    const stored = localStorage.getItem(getStorageKey());

    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Ignore storage errors
  }

  return null;
};

/**
 * Save live build state to localStorage.
 * @param {LiveBuildState} state State to save.
 */
const saveToStorage = (state) => {
  try {
    localStorage.setItem(getStorageKey(), JSON.stringify(state));
  } catch {
    // Ignore storage errors
  }
};

/**
 * Check if the backend is GitHub.
 * @returns {boolean} Whether using GitHub backend.
 */
const isGitHubBackend = () => {
  const _backend = get(backend);

  return !!(_backend?.isGit && _backend?.name === 'github');
};

/**
 * Map GitHub API workflow run to LiveBuild type.
 * @param {any} run Raw workflow run from API.
 * @returns {LiveBuild} Mapped LiveBuild object.
 */
const mapWorkflowRun = (run) => ({
  id: run.id,
  name: run.name || run.display_title || 'Build',
  status: run.status,
  conclusion: run.conclusion,
  htmlUrl: run.html_url,
  createdAt: run.created_at,
  updatedAt: run.updated_at,
  headSha: run.head_sha,
  headBranch: run.head_branch,
});

/**
 * Fetch recent workflow runs from GitHub Actions for the main branch.
 * @returns {Promise<LiveBuild[]>} Array of workflow runs.
 */
const fetchWorkflowRuns = async () => {
  if (!isGitHubBackend()) {
    return [];
  }

  const { owner, repo } = repository;

  try {
    // Fetch workflow runs for push events on main/master branch
    const query = `branch=main&event=push&per_page=${MAX_BUILD_HISTORY}`;

    const result = /** @type {{ workflow_runs: any[] }} */ (
      await fetchAPI(`/repos/${owner}/${repo}/actions/runs?${query}`)
    );

    if (!result.workflow_runs?.length) {
      // Try master branch if main has no runs
      const masterQuery = `branch=master&event=push&per_page=${MAX_BUILD_HISTORY}`;

      const masterResult = /** @type {{ workflow_runs: any[] }} */ (
        await fetchAPI(`/repos/${owner}/${repo}/actions/runs?${masterQuery}`)
      );

      if (masterResult.workflow_runs?.length) {
        return masterResult.workflow_runs.map(mapWorkflowRun);
      }

      return [];
    }

    return result.workflow_runs.map(mapWorkflowRun);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to fetch workflow runs:', error);

    return [];
  }
};

/**
 * Update live build state from fetched runs.
 * @param {LiveBuild[]} runs Workflow runs from API.
 */
const updateBuildState = (runs) => {
  if (!runs.length) {
    return;
  }

  // Find currently running build (queued or in_progress)
  const currentBuild = runs.find((run) => run.status === 'queued' || run.status === 'in_progress');

  // Get completed builds for history
  const completedBuilds = runs
    .filter((run) => run.status === 'completed')
    .slice(0, MAX_BUILD_HISTORY);

  const newState = {
    currentBuild: currentBuild ?? null,
    history: completedBuilds,
    lastPolled: Date.now(),
  };

  liveBuildState.set(newState);
  isLiveBuildRunning.set(!!currentBuild);
  saveToStorage(newState);
};

/**
 * Poll for live build status.
 */
const pollLiveBuilds = async () => {
  if (!isPageVisible || !isGitHubBackend()) {
    return;
  }

  const runs = await fetchWorkflowRuns();

  updateBuildState(runs);
};

/**
 * Handle page visibility change.
 */
const handleVisibilityChange = () => {
  isPageVisible = document.visibilityState === 'visible';

  if (isPageVisible && get(isPollingLiveBuilds)) {
    // Immediately poll when page becomes visible
    pollLiveBuilds();
  }
};

/**
 * Start polling for live builds.
 * Should be called after user authentication.
 */
export const startLiveBuildPolling = () => {
  if (!isGitHubBackend()) {
    return;
  }

  // Don't start if already polling
  if (pollIntervalId !== null) {
    return;
  }

  isPollingLiveBuilds.set(true);

  // Load initial state from storage
  const stored = loadFromStorage();

  if (stored) {
    liveBuildState.set(stored);
    isLiveBuildRunning.set(!!stored.currentBuild);
  }

  // Set up visibility change listener
  document.addEventListener('visibilitychange', handleVisibilityChange);

  // Initial poll
  pollLiveBuilds();

  // Start polling interval
  pollIntervalId = window.setInterval(pollLiveBuilds, POLL_INTERVAL);
};

/**
 * Stop polling for live builds.
 * Should be called on user logout.
 */
export const stopLiveBuildPolling = () => {
  if (pollIntervalId !== null) {
    clearInterval(pollIntervalId);
    pollIntervalId = null;
  }

  document.removeEventListener('visibilitychange', handleVisibilityChange);

  isPollingLiveBuilds.set(false);
  isLiveBuildRunning.set(false);
};

/**
 * Force refresh live build status.
 * @returns {Promise<void>}
 */
export const refreshLiveBuilds = async () => {
  await pollLiveBuilds();
};

/**
 * Get the current build if running.
 * @returns {LiveBuild | null} Current build or null.
 */
export const getCurrentBuild = () => get(liveBuildState).currentBuild;

/**
 * Get recent build history.
 * @returns {LiveBuild[]} Array of recent builds.
 */
export const getBuildHistory = () => get(liveBuildState).history;

/**
 * Clear live build state.
 */
export const clearLiveBuildState = () => {
  liveBuildState.set({
    currentBuild: null,
    history: [],
    lastPolled: 0,
  });
  isLiveBuildRunning.set(false);

  try {
    localStorage.removeItem(getStorageKey());
  } catch {
    // Ignore storage errors
  }
};
