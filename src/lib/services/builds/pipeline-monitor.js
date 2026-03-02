import { repository } from '$lib/services/backends/git/github/repository';
import { fetchAPI } from '$lib/services/backends/git/shared/api';

/**
 * @typedef {object} PipelineMonitorState
 * @property {any[]} runs Recent workflow runs from GitHub Actions API.
 * @property {number} lastUpdated Timestamp in milliseconds.
 */

/** Polling interval for the centralized pipeline monitor (ms). */
const POLL_INTERVAL = 10000;
/** Number of runs to fetch on each centralized poll. */
const RUNS_PER_PAGE = 100;

/** @type {PipelineMonitorState} */
let state = {
  runs: [],
  lastUpdated: 0,
};

/** @type {Set<(runs: any[]) => (boolean | Promise<boolean>)>} */
const listeners = new Set();
/** @type {ReturnType<typeof globalThis.setInterval> | null} */
let pollTimerId = null;
/** @type {Promise<any[]> | null} */
let inFlightFetch = null;
/** @type {boolean} */
let isTickRunning = false;

/**
 * Fetch workflow runs once.
 * @returns {Promise<any[]>} Workflow runs array.
 */
const fetchPipelineRuns = async () => {
  if (inFlightFetch) {
    return inFlightFetch;
  }

  const { owner, repo } = repository;

  inFlightFetch = (async () => {
    try {
      const query = `per_page=${RUNS_PER_PAGE}`;

      const result = /** @type {{ workflow_runs: any[] }} */ (
        await fetchAPI(`/repos/${owner}/${repo}/actions/runs?${query}`)
      );

      state = {
        runs: result.workflow_runs ?? [],
        lastUpdated: Date.now(),
      };

      return state.runs;
    } catch {
      state = {
        runs: [],
        lastUpdated: Date.now(),
      };

      return [];
    } finally {
      inFlightFetch = null;
    }
  })();

  return inFlightFetch;
};

/**
 * Execute one polling tick.
 */
const runTick = async () => {
  if (isTickRunning) {
    return;
  }

  isTickRunning = true;

  try {
    const runs = await fetchPipelineRuns();
    const callbacks = [...listeners];

    const keepResults = await Promise.all(
      callbacks.map(async (callback) => {
        try {
          return await callback(runs);
        } catch {
          return false;
        }
      }),
    );

    callbacks.forEach((callback, index) => {
      if (!keepResults[index]) {
        listeners.delete(callback);
      }
    });

    if (listeners.size === 0 && pollTimerId !== null) {
      clearInterval(pollTimerId);
      pollTimerId = null;
    }
  } finally {
    isTickRunning = false;
  }
};

/**
 * Ensure centralized polling is running.
 */
const ensurePolling = () => {
  if (pollTimerId !== null) {
    return;
  }

  pollTimerId = globalThis.setInterval(() => {
    runTick();
  }, POLL_INTERVAL);
};

/**
 * Register a consumer to receive centralized pipeline snapshots.
 * Return `false` from the callback to unregister automatically.
 * @param {(runs: any[]) => (boolean | Promise<boolean>)} callback Snapshot consumer callback.
 * @returns {() => void} Unregister callback.
 */
export const registerPipelineListener = (callback) => {
  listeners.add(callback);
  ensurePolling();

  return () => {
    listeners.delete(callback);

    if (listeners.size === 0 && pollTimerId !== null) {
      clearInterval(pollTimerId);
      pollTimerId = null;
    }
  };
};

/**
 * Force a refresh and return the latest runs snapshot.
 * @returns {Promise<any[]>} Latest workflow runs.
 */
export const refreshPipelineRuns = async () => {
  const runs = await fetchPipelineRuns();

  return runs;
};

/**
 * Get current cached snapshot.
 * @returns {PipelineMonitorState} Snapshot state.
 */
export const getPipelineSnapshot = () => state;

/**
 * Reset monitor internal state.
 * Intended for tests.
 */
export const resetPipelineMonitor = () => {
  if (pollTimerId !== null) {
    clearInterval(pollTimerId);
    pollTimerId = null;
  }

  listeners.clear();
  inFlightFetch = null;
  isTickRunning = false;
  state = {
    runs: [],
    lastUpdated: 0,
  };
};
