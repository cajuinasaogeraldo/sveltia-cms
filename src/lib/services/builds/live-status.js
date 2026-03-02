import { get, writable } from 'svelte/store';

import { backend } from '$lib/services/backends';
import {
  refreshPipelineRuns,
  registerPipelineListener,
} from '$lib/services/builds/pipeline-monitor';

/**
 * @import { Writable } from 'svelte/store';
 */

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

/**
 * Notifies when a build completes (successfully or with failure).
 * Emits the completed build object.
 * @type {Writable<LiveBuild | null>}
 */
export const buildCompletedNotification = writable(null);

/** @type {(() => void) | null} */
let unregisterPipelineListener = null;
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
 * Update live build state from fetched runs.
 * @param {LiveBuild[]} runs Workflow runs from API.
 */
function updateBuildState(runs) {
  if (!runs.length) {
    return;
  }

  // Get previous state to detect build completion
  const prevState = get(liveBuildState);
  const previousRunningBuildId = prevState.currentBuild?.id ?? null;
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

  // Detect if a previously running build has completed
  if (previousRunningBuildId && !currentBuild) {
    const completedBuild = completedBuilds.find((run) => run.id === previousRunningBuildId);

    if (completedBuild) {
      // Notify that the build completed
      buildCompletedNotification.set(completedBuild);
    }
  }
}

/**
 * Update live build state from raw workflow runs.
 * @param {any[]} rawRuns Raw workflow runs from API.
 */
const updateBuildStateFromRawRuns = (rawRuns) => {
  const runs = rawRuns.map(mapWorkflowRun);

  updateBuildState(runs);
};

/**
 * Load initial state from localStorage without starting polling.
 * Used to show cached state immediately before polling starts.
 */
export const loadInitialState = () => {
  const stored = loadFromStorage();

  if (stored) {
    liveBuildState.set(stored);
    // Don't set isLiveBuildRunning from cached state, wait for fresh poll
  }
};

/**
 * Start polling for live builds.
 * Should be called when the popup menu is opened or when a build is running.
 */
export const startLiveBuildPolling = () => {
  if (!isGitHubBackend()) {
    return;
  }

  // Don't start if already polling
  if (unregisterPipelineListener !== null) {
    return;
  }

  isPollingLiveBuilds.set(true);

  unregisterPipelineListener = registerPipelineListener(async (runs) => {
    if (!get(isPollingLiveBuilds)) {
      return false;
    }

    if (!isGitHubBackend()) {
      return true;
    }

    updateBuildStateFromRawRuns(runs);

    return true;
  });

  refreshPipelineRuns().then((runs) => {
    updateBuildStateFromRawRuns(runs);
  });
};

/**
 * Stop polling for live builds.
 * Should be called on user logout.
 */
export const stopLiveBuildPolling = () => {
  if (unregisterPipelineListener !== null) {
    unregisterPipelineListener();
    unregisterPipelineListener = null;
  }

  isPollingLiveBuilds.set(false);
  // Don't reset isLiveBuildRunning here - let it be determined by actual build state
};

/**
 * Force refresh live build status.
 * @returns {Promise<void>}
 */
export const refreshLiveBuilds = async () => {
  const runs = await refreshPipelineRuns();

  updateBuildStateFromRawRuns(runs);
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
