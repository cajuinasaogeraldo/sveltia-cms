// @vitest-environment jsdom

import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// Mock dependencies before importing
vi.mock('$lib/services/backends/git/github/repository', () => ({
  repository: { owner: 'test-owner', repo: 'test-repo' },
}));

vi.mock('$lib/services/backends/git/shared/api', () => ({
  fetchAPI: vi.fn(),
}));

vi.mock('$lib/services/backends', async () => {
  const { writable } = await import('svelte/store');

  return {
    backend: writable({ isGit: true, name: 'github' }),
  };
});

// Imports after mocks (ESLint will warn but this is necessary for vitest mocking)
// eslint-disable-next-line import/first
import { fetchAPI } from '$lib/services/backends/git/shared/api';

// eslint-disable-next-line import/first
import {
  clearLiveBuildState,
  getBuildHistory,
  getCurrentBuild,
  isLiveBuildRunning,
  isPollingLiveBuilds,
  liveBuildState,
  loadInitialState,
  refreshLiveBuilds,
  startLiveBuildPolling,
  stopLiveBuildPolling,
} from './live-status';

describe('live-status', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    localStorage.clear();
    clearLiveBuildState();
    stopLiveBuildPolling();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    stopLiveBuildPolling();
  });

  describe('fetchWorkflowRuns', () => {
    test('fetches workflow runs from GitHub API', async () => {
      vi.mocked(fetchAPI).mockResolvedValue({
        workflow_runs: [
          {
            id: 123,
            name: 'Build',
            status: 'completed',
            conclusion: 'success',
            html_url: 'https://github.com/test/repo/actions/runs/123',
            created_at: '2025-01-01T00:00:00Z',
            updated_at: '2025-01-01T00:05:00Z',
            head_sha: 'abc123',
            head_branch: 'main',
          },
        ],
      });

      await refreshLiveBuilds();

      expect(fetchAPI).toHaveBeenCalledWith(
        '/repos/test-owner/test-repo/actions/runs?branch=main&event=push&per_page=5',
      );
    });

    test('falls back to master branch if main has no runs', async () => {
      vi.mocked(fetchAPI)
        .mockResolvedValueOnce({ workflow_runs: [] })
        .mockResolvedValueOnce({
          workflow_runs: [
            {
              id: 456,
              name: 'Build',
              status: 'completed',
              conclusion: 'success',
              html_url: 'https://github.com/test/repo/actions/runs/456',
              created_at: '2025-01-01T00:00:00Z',
              head_sha: 'def456',
              head_branch: 'master',
            },
          ],
        });

      await refreshLiveBuilds();

      expect(fetchAPI).toHaveBeenCalledTimes(2);
      expect(fetchAPI).toHaveBeenLastCalledWith(
        '/repos/test-owner/test-repo/actions/runs?branch=master&event=push&per_page=5',
      );
    });
  });

  describe('updateBuildState', () => {
    test('identifies currently running build', async () => {
      vi.mocked(fetchAPI).mockResolvedValue({
        workflow_runs: [
          {
            id: 123,
            name: 'Build',
            status: 'in_progress',
            conclusion: null,
            html_url: 'https://github.com/test/repo/actions/runs/123',
            created_at: '2025-01-01T00:00:00Z',
            head_sha: 'abc123',
            head_branch: 'main',
          },
        ],
      });

      await refreshLiveBuilds();

      expect(get(isLiveBuildRunning)).toBe(true);
      expect(getCurrentBuild()?.id).toBe(123);
    });

    test('sets isLiveBuildRunning to false when no active build', async () => {
      vi.mocked(fetchAPI).mockResolvedValue({
        workflow_runs: [
          {
            id: 123,
            name: 'Build',
            status: 'completed',
            conclusion: 'success',
            html_url: 'https://github.com/test/repo/actions/runs/123',
            created_at: '2025-01-01T00:00:00Z',
            head_sha: 'abc123',
            head_branch: 'main',
          },
        ],
      });

      await refreshLiveBuilds();

      expect(get(isLiveBuildRunning)).toBe(false);
      expect(getCurrentBuild()).toBeNull();
    });

    test('stores completed builds in history', async () => {
      vi.mocked(fetchAPI).mockResolvedValue({
        workflow_runs: [
          {
            id: 123,
            name: 'Build 1',
            status: 'completed',
            conclusion: 'success',
            html_url: 'https://github.com/test/repo/actions/runs/123',
            created_at: '2025-01-01T00:00:00Z',
            head_sha: 'abc123',
            head_branch: 'main',
          },
          {
            id: 122,
            name: 'Build 2',
            status: 'completed',
            conclusion: 'failure',
            html_url: 'https://github.com/test/repo/actions/runs/122',
            created_at: '2024-12-31T00:00:00Z',
            head_sha: 'def456',
            head_branch: 'main',
          },
        ],
      });

      await refreshLiveBuilds();

      const history = getBuildHistory();

      expect(history).toHaveLength(2);
      expect(history[0].conclusion).toBe('success');
      expect(history[1].conclusion).toBe('failure');
    });

    test('persists state to localStorage', async () => {
      vi.mocked(fetchAPI).mockResolvedValue({
        workflow_runs: [
          {
            id: 123,
            name: 'Build',
            status: 'completed',
            conclusion: 'success',
            html_url: 'https://github.com/test/repo/actions/runs/123',
            created_at: '2025-01-01T00:00:00Z',
            head_sha: 'abc123',
            head_branch: 'main',
          },
        ],
      });

      await refreshLiveBuilds();

      const stored = localStorage.getItem('sveltia-cms-live-builds');

      expect(stored).not.toBeNull();

      const parsed = JSON.parse(stored ?? '');

      expect(parsed.history).toHaveLength(1);
    });
  });

  describe('polling', () => {
    test('starts polling on startLiveBuildPolling', async () => {
      vi.mocked(fetchAPI).mockResolvedValue({ workflow_runs: [] });

      startLiveBuildPolling();

      expect(get(isPollingLiveBuilds)).toBe(true);
      expect(fetchAPI).toHaveBeenCalled();
    });

    test('stops polling on stopLiveBuildPolling', () => {
      vi.mocked(fetchAPI).mockResolvedValue({ workflow_runs: [] });

      startLiveBuildPolling();
      stopLiveBuildPolling();

      expect(get(isPollingLiveBuilds)).toBe(false);
    });

    test('polls at 30 second intervals', async () => {
      vi.mocked(fetchAPI).mockResolvedValue({
        workflow_runs: [
          {
            id: 123,
            name: 'Build',
            status: 'completed',
            conclusion: 'success',
            html_url: 'https://github.com/test/repo/actions/runs/123',
            created_at: '2025-01-01T00:00:00Z',
            head_sha: 'abc123',
            head_branch: 'main',
          },
        ],
      });

      startLiveBuildPolling();

      const initialCalls = vi.mocked(fetchAPI).mock.calls.length;

      // Advance 30 seconds
      await vi.advanceTimersByTimeAsync(30000);
      expect(fetchAPI).toHaveBeenCalledTimes(initialCalls + 1);

      // Advance another 30 seconds
      await vi.advanceTimersByTimeAsync(30000);
      expect(fetchAPI).toHaveBeenCalledTimes(initialCalls + 2);
    });

    test('does not start polling twice', () => {
      vi.mocked(fetchAPI).mockResolvedValue({ workflow_runs: [] });

      startLiveBuildPolling();
      startLiveBuildPolling();

      expect(fetchAPI).toHaveBeenCalledTimes(1);
    });
  });

  describe('clearLiveBuildState', () => {
    test('clears all state', async () => {
      vi.mocked(fetchAPI).mockResolvedValue({
        workflow_runs: [
          {
            id: 123,
            name: 'Build',
            status: 'completed',
            conclusion: 'success',
            html_url: 'https://github.com/test/repo/actions/runs/123',
            created_at: '2025-01-01T00:00:00Z',
            head_sha: 'abc123',
            head_branch: 'main',
          },
        ],
      });

      await refreshLiveBuilds();
      clearLiveBuildState();

      expect(getCurrentBuild()).toBeNull();
      expect(getBuildHistory()).toHaveLength(0);
      expect(get(isLiveBuildRunning)).toBe(false);
    });

    test('clears localStorage', async () => {
      vi.mocked(fetchAPI).mockResolvedValue({
        workflow_runs: [
          {
            id: 123,
            name: 'Build',
            status: 'completed',
            conclusion: 'success',
            html_url: 'https://github.com/test/repo/actions/runs/123',
            created_at: '2025-01-01T00:00:00Z',
            head_sha: 'abc123',
            head_branch: 'main',
          },
        ],
      });

      await refreshLiveBuilds();
      clearLiveBuildState();

      expect(localStorage.getItem('sveltia-cms-live-builds')).toBeNull();
    });
  });

  describe('liveBuildState store', () => {
    test('is reactive', async () => {
      const states = /** @type {any[]} */ ([]);

      const unsubscribe = liveBuildState.subscribe((state) => {
        states.push(state);
      });

      vi.mocked(fetchAPI).mockResolvedValue({
        workflow_runs: [
          {
            id: 123,
            name: 'Build',
            status: 'in_progress',
            conclusion: null,
            html_url: 'https://github.com/test/repo/actions/runs/123',
            created_at: '2025-01-01T00:00:00Z',
            head_sha: 'abc123',
            head_branch: 'main',
          },
        ],
      });

      await refreshLiveBuilds();

      unsubscribe();

      // Initial state + updated state
      expect(states.length).toBeGreaterThanOrEqual(2);
      expect(states[states.length - 1].currentBuild?.id).toBe(123);
    });
  });

  describe('loadInitialState', () => {
    test('loads state from localStorage without starting polling', () => {
      const storedState = {
        currentBuild: null,
        history: [
          {
            id: 456,
            name: 'Build',
            status: 'completed',
            conclusion: 'success',
            htmlUrl: 'https://github.com/test/repo/actions/runs/456',
            createdAt: '2025-01-01T00:00:00Z',
            headSha: 'def456',
            headBranch: 'main',
          },
        ],
        lastPolled: Date.now() - 60000,
      };

      localStorage.setItem('sveltia-cms-live-builds', JSON.stringify(storedState));

      loadInitialState();

      const state = get(liveBuildState);

      expect(state.history).toHaveLength(1);
      expect(state.history[0].id).toBe(456);
      expect(get(isPollingLiveBuilds)).toBe(false);
    });

    test('does nothing if localStorage is empty', () => {
      loadInitialState();

      const state = get(liveBuildState);

      expect(state.history).toHaveLength(0);
      expect(state.currentBuild).toBeNull();
    });
  });
});
