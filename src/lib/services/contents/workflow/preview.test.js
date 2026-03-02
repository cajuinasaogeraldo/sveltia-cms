import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { fetchAPI } from '$lib/services/backends/git/shared/api';
import { resetPipelineMonitor } from '$lib/services/builds/pipeline-monitor';
import { getUnpublishedEntry, updateUnpublishedEntry } from '$lib/services/contents/workflow';

import {
  buildPreview,
  buildPreviewUrl,
  getPreviewStatus,
  isPreviewEnabled,
  resetPreviewBuildingFlag,
} from './preview';

// Mock the stores and API before importing the module
vi.mock('svelte/store', async (importOriginal) => {
  const actual = await importOriginal();

  return {
    .../** @type {object} */ (actual),
    get: vi.fn(),
  };
});

vi.mock('$lib/services/backends/git/github/repository', () => ({
  repository: { owner: 'test-owner', repo: 'test-repo' },
}));

vi.mock('$lib/services/backends/git/shared/api', () => ({
  fetchAPI: vi.fn(),
}));

vi.mock('$lib/services/config', () => ({
  cmsConfig: {},
}));

vi.mock('$lib/services/contents/workflow', () => ({
  getUnpublishedEntry: vi.fn(),
  updateUnpublishedEntry: vi.fn(),
}));

vi.mock('$lib/services/contents/workflow/preview-queue', () => ({
  enqueuePreview: vi.fn(),
  updateActivePreviewUrl: vi.fn(),
}));

describe('preview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    resetPipelineMonitor();
    resetPreviewBuildingFlag();
  });

  afterEach(() => {
    vi.useRealTimers();
    resetPipelineMonitor();
    resetPreviewBuildingFlag();
  });

  describe('isPreviewEnabled', () => {
    test('returns true when preview_url is configured', () => {
      vi.mocked(get).mockReturnValue({
        backend: {
          name: 'github',
          preview_url: 'https://preview-{{branch_safe}}.example.com',
        },
      });

      expect(isPreviewEnabled()).toBe(true);
    });

    test('returns false when preview_url is not configured', () => {
      vi.mocked(get).mockReturnValue({
        backend: {
          name: 'github',
        },
      });

      expect(isPreviewEnabled()).toBe(false);
    });

    test('returns false when backend is not configured', () => {
      vi.mocked(get).mockReturnValue(undefined);

      expect(isPreviewEnabled()).toBe(false);
    });
  });

  describe('buildPreviewUrl', () => {
    const mockEntry = {
      slug: 'my-article',
      collection: 'posts',
      status: /** @type {const} */ ('pending_review'),
      data: {},
      branch: 'cms/posts/my-article',
      prNumber: 123,
      title: 'My Article Title',
    };

    test('replaces all placeholders correctly', () => {
      vi.mocked(get).mockReturnValue({
        backend: {
          name: 'github',
          preview_url:
            'https://preview-{{branch_safe}}.example.com/{{collection}}/{{slug}}?pr={{pr_number}}',
        },
      });

      const url = buildPreviewUrl(mockEntry);

      expect(url).toContain('https://preview-cms-posts-my-article.example.com');
      expect(url).toContain('/posts/my-article');
      expect(url).toContain('pr=123');
    });

    test('replaces {{branch}} with raw branch name', () => {
      vi.mocked(get).mockReturnValue({
        backend: {
          name: 'github',
          preview_url: 'https://example.com/{{branch}}',
        },
      });

      const url = buildPreviewUrl(mockEntry);

      expect(url).toBe('https://example.com/cms/posts/my-article');
    });

    test('replaces {{branch_safe}} with sanitized branch name', () => {
      vi.mocked(get).mockReturnValue({
        backend: {
          name: 'github',
          preview_url: 'https://{{branch_safe}}.example.com',
        },
      });

      const url = buildPreviewUrl(mockEntry);

      expect(url).toBe('https://cms-posts-my-article.example.com');
    });

    test('sanitizes branch name with special characters', () => {
      vi.mocked(get).mockReturnValue({
        backend: {
          name: 'github',
          preview_url: 'https://{{branch_safe}}.example.com',
        },
      });

      const entry = {
        ...mockEntry,
        branch: 'cms/tags/tag@special!chars#test',
      };

      const url = buildPreviewUrl(entry);

      expect(url).toBe('https://cms-tags-tag-special-chars-test.example.com');
    });

    test('removes leading and trailing hyphens from sanitized branch', () => {
      vi.mocked(get).mockReturnValue({
        backend: {
          name: 'github',
          preview_url: 'https://{{branch_safe}}.example.com',
        },
      });

      const entry = {
        ...mockEntry,
        branch: '/leading/slash/',
      };

      const url = buildPreviewUrl(entry);

      expect(url).toBe('https://leading-slash.example.com');
    });

    test('URL-encodes title in placeholder', () => {
      vi.mocked(get).mockReturnValue({
        backend: {
          name: 'github',
          preview_url: 'https://example.com?title={{title}}',
        },
      });

      const entry = {
        ...mockEntry,
        title: 'My Article & More',
      };

      const url = buildPreviewUrl(entry);

      expect(url).toBe('https://example.com?title=My%20Article%20%26%20More');
    });

    test('returns undefined when preview_url is not configured', () => {
      vi.mocked(get).mockReturnValue({
        backend: {
          name: 'github',
        },
      });

      const url = buildPreviewUrl(mockEntry);

      expect(url).toBeUndefined();
    });

    test('returns undefined when entry has no branch', () => {
      vi.mocked(get).mockReturnValue({
        backend: {
          name: 'github',
          preview_url: 'https://example.com/{{branch}}',
        },
      });

      const entry = {
        ...mockEntry,
        branch: undefined,
      };

      const url = buildPreviewUrl(entry);

      expect(url).toBeUndefined();
    });

    test('includes timestamp placeholder', () => {
      vi.mocked(get).mockReturnValue({
        backend: {
          name: 'github',
          preview_url: 'https://example.com?t={{timestamp}}',
        },
      });

      vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));

      const url = buildPreviewUrl(mockEntry);

      expect(url).toContain('t=');
      expect(url).toMatch(/t=\d+/);
    });

    test('uses slug as fallback for empty title', () => {
      vi.mocked(get).mockReturnValue({
        backend: {
          name: 'github',
          preview_url: 'https://example.com?title={{title}}',
        },
      });

      const entry = {
        ...mockEntry,
        title: undefined,
      };

      const url = buildPreviewUrl(entry);

      expect(url).toBe('https://example.com?title=my-article');
    });
  });

  describe('buildPreview', () => {
    const mockEntry = {
      slug: 'my-article',
      collection: 'posts',
      status: /** @type {const} */ ('pending_review'),
      data: {},
      branch: 'cms/posts/my-article',
      prNumber: 123,
      title: 'My Article',
    };

    test('throws error when entry is not found', async () => {
      vi.mocked(getUnpublishedEntry).mockReturnValue(undefined);

      await expect(buildPreview('posts', 'my-article')).rejects.toThrow('Entry not found');
    });

    test('throws error when preview is not configured', async () => {
      vi.mocked(getUnpublishedEntry).mockReturnValue(mockEntry);
      vi.mocked(get).mockReturnValue({
        backend: {
          name: 'github',
        },
      });

      await expect(buildPreview('posts', 'my-article')).rejects.toThrow(
        'Preview is not configured',
      );
    });

    test('triggers repository dispatch event', async () => {
      vi.mocked(getUnpublishedEntry).mockReturnValue(mockEntry);
      vi.mocked(get).mockReturnValue({
        backend: {
          name: 'github',
          preview_url: 'https://example.com/{{branch}}',
        },
      });
      vi.mocked(fetchAPI).mockResolvedValue({});

      await buildPreview('posts', 'my-article');

      expect(fetchAPI).toHaveBeenCalledWith(
        '/repos/test-owner/test-repo/dispatches',
        expect.objectContaining({
          method: 'POST',
          body: expect.objectContaining({
            event_type: 'sveltia-cms-preview',
            client_payload: expect.objectContaining({
              branch: 'cms/posts/my-article',
              branch_safe: 'cms-posts-my-article',
              collection: 'posts',
              slug: 'my-article',
              pr_number: 123,
              title: 'My Article',
            }),
          }),
          responseType: 'raw',
        }),
      );
    });

    test('updates entry status to building', async () => {
      vi.mocked(getUnpublishedEntry).mockReturnValue(mockEntry);
      vi.mocked(get).mockReturnValue({
        backend: {
          name: 'github',
          preview_url: 'https://example.com/{{branch}}',
        },
      });
      vi.mocked(fetchAPI).mockResolvedValue({});

      await buildPreview('posts', 'my-article');

      expect(updateUnpublishedEntry).toHaveBeenCalledWith('posts', 'my-article', {
        isBuildingPreview: true,
        previewStatus: 'building',
        workflowRunId: undefined,
      });
    });

    test('updates entry to error status on dispatch failure', async () => {
      vi.mocked(getUnpublishedEntry).mockReturnValue(mockEntry);
      vi.mocked(get).mockReturnValue({
        backend: {
          name: 'github',
          preview_url: 'https://example.com/{{branch}}',
        },
      });
      vi.mocked(fetchAPI).mockRejectedValue(new Error('API error'));

      await expect(buildPreview('posts', 'my-article')).rejects.toThrow('API error');

      expect(updateUnpublishedEntry).toHaveBeenCalledWith('posts', 'my-article', {
        isBuildingPreview: false,
        previewStatus: 'error',
      });
    });

    test('continues tracking by workflow run ID until completion', async () => {
      const entryState = {
        slug: 'my-article',
        collection: 'posts',
        status: /** @type {const} */ ('pending_review'),
        data: {},
        branch: 'cms/posts/my-article',
        prNumber: 123,
        title: 'My Article',
        headSha: 'abc123',
      };

      vi.mocked(getUnpublishedEntry).mockImplementation(() => entryState);
      vi.mocked(updateUnpublishedEntry).mockImplementation((_, __, updates) => {
        Object.assign(entryState, updates);
      });

      vi.mocked(get).mockReturnValue({
        backend: {
          name: 'github',
          preview_url: 'https://preview.example.com/{{slug}}',
        },
      });

      let snapshotCallCount = 0;

      vi.mocked(fetchAPI).mockImplementation(async (url) => {
        if (
          url ===
          '/repos/test-owner/test-repo/actions/runs?status=queued&status=in_progress&per_page=20'
        ) {
          return { workflow_runs: [] };
        }

        if (url === '/repos/test-owner/test-repo/dispatches') {
          return {};
        }

        if (url === '/repos/test-owner/test-repo/actions/runs?per_page=100') {
          snapshotCallCount += 1;

          const status = snapshotCallCount > 1 ? 'completed' : 'in_progress';
          const conclusion = snapshotCallCount > 1 ? 'success' : null;

          return {
            workflow_runs: [
              {
                id: 777,
                status,
                conclusion,
                name: 'Preview Deploy',
                head_branch: 'cms/posts/my-article',
                head_sha: 'abc123',
                created_at: '2100-01-01T00:00:00Z',
              },
            ],
          };
        }

        return { workflow_runs: [] };
      });

      await buildPreview('posts', 'my-article');

      await vi.advanceTimersByTimeAsync(2000);
      await vi.advanceTimersByTimeAsync(10000);

      expect(fetchAPI).toHaveBeenCalledWith(
        '/repos/test-owner/test-repo/actions/runs?per_page=100',
      );
      expect(updateUnpublishedEntry).toHaveBeenCalledWith(
        'posts',
        'my-article',
        expect.objectContaining({
          previewStatus: 'ready',
          workflowRunId: 777,
          isBuildingPreview: false,
        }),
      );
    });

    test('detects completion via recent preview fallback without workflow run ID', async () => {
      const entryState = {
        slug: 'my-article',
        collection: 'posts',
        status: /** @type {const} */ ('pending_review'),
        data: {},
        branch: 'cms/posts/my-article',
        prNumber: 123,
        title: 'My Article',
        headSha: 'abc123',
      };

      vi.mocked(getUnpublishedEntry).mockImplementation(() => entryState);
      vi.mocked(updateUnpublishedEntry).mockImplementation((_, __, updates) => {
        Object.assign(entryState, updates);
      });

      vi.mocked(get).mockReturnValue({
        backend: {
          name: 'github',
          preview_url: 'https://preview.example.com/{{slug}}',
        },
      });

      vi.mocked(fetchAPI).mockImplementation(async (url) => {
        if (
          url ===
          '/repos/test-owner/test-repo/actions/runs?status=queued&status=in_progress&per_page=20'
        ) {
          return { workflow_runs: [] };
        }

        if (url === '/repos/test-owner/test-repo/dispatches') {
          return {};
        }

        if (url === '/repos/test-owner/test-repo/actions/runs?per_page=100') {
          return {
            workflow_runs: [
              {
                id: 888,
                status: 'completed',
                conclusion: 'success',
                name: 'Preview Deploy',
                head_branch: 'cms/posts/my-article',
                head_sha: 'abc123',
                created_at: '2100-01-01T00:00:00Z',
              },
            ],
          };
        }

        return { workflow_runs: [] };
      });

      await buildPreview('posts', 'my-article');

      await vi.advanceTimersByTimeAsync(2000);

      expect(fetchAPI).toHaveBeenCalledWith(
        '/repos/test-owner/test-repo/actions/runs?per_page=100',
      );
      expect(updateUnpublishedEntry).toHaveBeenCalledWith(
        'posts',
        'my-article',
        expect.objectContaining({
          previewStatus: 'ready',
          workflowRunId: 888,
          isBuildingPreview: false,
        }),
      );
    });

    test('detects repository_dispatch completion even when run branch is main', async () => {
      const entryState = {
        slug: 'my-article',
        collection: 'posts',
        status: /** @type {const} */ ('pending_review'),
        data: {},
        branch: 'cms/posts/my-article',
        prNumber: 123,
        title: 'My Article',
        headSha: 'abc123',
      };

      vi.mocked(getUnpublishedEntry).mockImplementation(() => entryState);
      vi.mocked(updateUnpublishedEntry).mockImplementation((_, __, updates) => {
        Object.assign(entryState, updates);
      });

      vi.mocked(get).mockReturnValue({
        backend: {
          name: 'github',
          preview_url: 'https://preview.example.com/{{slug}}',
        },
      });

      vi.mocked(fetchAPI).mockImplementation(async (url) => {
        if (
          url ===
          '/repos/test-owner/test-repo/actions/runs?status=queued&status=in_progress&per_page=20'
        ) {
          return { workflow_runs: [] };
        }

        if (url === '/repos/test-owner/test-repo/dispatches') {
          return {};
        }

        if (url === '/repos/test-owner/test-repo/actions/runs?per_page=100') {
          return {
            workflow_runs: [
              {
                id: 999,
                status: 'completed',
                conclusion: 'success',
                name: 'Preview Deploy',
                event: 'repository_dispatch',
                head_branch: 'main',
                head_sha: 'different-from-entry-sha',
                created_at: '2100-01-01T00:00:00Z',
              },
            ],
          };
        }

        if (
          url ===
          '/repos/test-owner/test-repo/actions/runs?branch=cms%2Fposts%2Fmy-article&per_page=20'
        ) {
          return { workflow_runs: [] };
        }

        return { workflow_runs: [] };
      });

      await buildPreview('posts', 'my-article');
      await vi.advanceTimersByTimeAsync(2000);

      expect(updateUnpublishedEntry).toHaveBeenCalledWith(
        'posts',
        'my-article',
        expect.objectContaining({
          previewStatus: 'ready',
          workflowRunId: 999,
          isBuildingPreview: false,
        }),
      );
    });
  });

  describe('getPreviewStatus', () => {
    test('returns idle when entry is not found', () => {
      vi.mocked(getUnpublishedEntry).mockReturnValue(undefined);

      expect(getPreviewStatus('posts', 'my-article')).toBe('idle');
    });

    test('returns idle when entry has no branch', () => {
      vi.mocked(getUnpublishedEntry).mockReturnValue({
        slug: 'my-article',
        collection: 'posts',
        status: /** @type {const} */ ('draft'),
        data: {},
      });

      expect(getPreviewStatus('posts', 'my-article')).toBe('idle');
    });

    test('returns idle when previewStatus is not set', () => {
      vi.mocked(getUnpublishedEntry).mockReturnValue({
        slug: 'my-article',
        collection: 'posts',
        status: /** @type {const} */ ('pending_review'),
        data: {},
        branch: 'cms/posts/my-article',
      });

      expect(getPreviewStatus('posts', 'my-article')).toBe('idle');
    });

    test('returns the current preview status', () => {
      vi.mocked(getUnpublishedEntry).mockReturnValue({
        slug: 'my-article',
        collection: 'posts',
        status: /** @type {const} */ ('pending_review'),
        data: {},
        branch: 'cms/posts/my-article',
        previewStatus: 'building',
      });

      expect(getPreviewStatus('posts', 'my-article')).toBe('building');
    });
  });
});
