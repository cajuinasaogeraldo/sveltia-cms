import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import * as commits from '$lib/services/backends/git/github/commits';
import * as pullRequests from '$lib/services/backends/git/github/pull-requests';
import * as sharedCommits from '$lib/services/backends/git/shared/commits';
import {
  getUnpublishedEntry,
  resetWorkflowStore,
  setUnpublishedEntries,
  unpublishedEntries,
} from '$lib/services/contents/workflow';
import {
  deleteUnpublishedEntry,
  isWorkflowEnabled,
  loadUnpublishedEntries,
  persistUnpublishedEntry,
  publishEntry,
  updateEntryStatus,
} from '$lib/services/contents/workflow/actions';
import * as preview from '$lib/services/contents/workflow/preview';

/**
 * @typedef {import('$lib/types/private').UnpublishedEntry} UnpublishedEntry
 * @typedef {import('$lib/types/private').PullRequestInfo} PullRequestInfo
 * @typedef {import('$lib/types/private').CommitResults} CommitResults
 */

/**
 * Create a mock unpublished entry for testing.
 * @param {Partial<UnpublishedEntry>} overrides Properties to override.
 * @returns {UnpublishedEntry} Mock entry.
 */
const createMockEntry = (overrides = {}) =>
  /** @type {UnpublishedEntry} */ ({
    collection: 'posts',
    slug: 'test-post',
    status: 'draft',
    title: 'Test Post',
    data: {},
    ...overrides,
  });

/**
 * Create a mock pull request info for testing.
 * @param {Partial<PullRequestInfo>} overrides Properties to override.
 * @returns {PullRequestInfo} Mock PR.
 */
const createMockPR = (overrides = {}) =>
  /** @type {PullRequestInfo} */ ({
    number: 1,
    title: 'Test PR',
    body: 'Test body',
    state: 'open',
    url: 'https://github.com/test/repo/pull/1',
    headBranch: 'cms/posts/test-post',
    headSha: 'abc123',
    baseBranch: 'main',
    labels: ['sveltia-cms/draft'],
    createdAt: new Date(),
    updatedAt: new Date(),
    author: 'user',
    ...overrides,
  });

/**
 * Create mock commit results for testing.
 * @param {Partial<CommitResults>} overrides Properties to override.
 * @returns {CommitResults} Mock results.
 */
const createMockCommitResults = (overrides = {}) =>
  /** @type {CommitResults} */ ({
    sha: 'commit-sha',
    files: [],
    ...overrides,
  });

vi.mock('svelte/store', async () => {
  const actual = await vi.importActual('svelte/store');

  return {
    ...actual,
    get: vi.fn((store) => {
      // Handle real stores
      if (store && typeof store.subscribe === 'function') {
        /** @type {any} */
        let value;

        store.subscribe((/** @type {any} */ v) => {
          value = v;
        })();

        return value;
      }

      return store;
    }),
  };
});

vi.mock('$lib/services/backends', () => ({
  backend: {
    subscribe: vi.fn((fn) => {
      fn({ isGit: true, name: 'github' });

      return () => {};
    }),
  },
}));

vi.mock('$lib/services/backends/git/github/repository', () => ({
  repository: {
    owner: 'test-owner',
    repo: 'test-repo',
    branch: 'main',
  },
}));

vi.mock('$lib/services/backends/git/github/commits', () => ({
  commitChanges: vi.fn(),
}));

vi.mock('$lib/services/backends/git/github/pull-requests', () => ({
  addLabels: vi.fn(),
  closePullRequest: vi.fn(),
  createBranch: vi.fn(),
  createPullRequest: vi.fn(),
  deleteBranch: vi.fn(),
  getBranchName: vi.fn((collection, slug) => `cms/${collection}/${slug}`),
  getStatusFromLabels: vi.fn(() => 'draft'),
  getStatusLabel: vi.fn((status) => `sveltia-cms/${status}`),
  listPullRequests: vi.fn(),
  mergePullRequest: vi.fn(),
  parseBranchName: vi.fn((branch) => {
    const match = branch.match(/^cms\/([^/]+)\/(.+)$/);

    if (match) {
      return { collection: match[1], slug: match[2] };
    }

    return null;
  }),
  removeLabel: vi.fn(),
  updatePRStatus: vi.fn(),
}));

vi.mock('$lib/services/backends/git/shared/commits', () => ({
  createWorkflowMessage: vi.fn((type, { slug, title }) => {
    if (type === 'workflowPublish') {
      return `Publish Posts "${slug}"`;
    }

    if (type === 'workflowPrTitle') {
      return `Editorial Workflow: ${title || slug}`;
    }

    if (type === 'workflowPrBody') {
      return `Creating entry: Posts/${slug}`;
    }

    return '';
  }),
}));

vi.mock('$lib/services/config', () => ({
  cmsConfig: {
    subscribe: vi.fn((fn) => {
      fn({ publish_mode: 'editorial_workflow' });

      return () => {};
    }),
  },
}));

vi.mock('$lib/services/contents/workflow/preview', () => ({
  clearPreviewState: vi.fn(),
}));

describe('workflow actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetWorkflowStore();
  });

  afterEach(() => {
    resetWorkflowStore();
  });

  describe('isWorkflowEnabled', () => {
    test('returns true when publish_mode is editorial_workflow', () => {
      vi.mocked(get).mockReturnValueOnce({ publish_mode: 'editorial_workflow' });
      expect(isWorkflowEnabled()).toBe(true);
    });

    test('returns false when publish_mode is not set', () => {
      vi.mocked(get).mockReturnValueOnce({});
      expect(isWorkflowEnabled()).toBe(false);
    });

    test('returns false when publish_mode is simple', () => {
      vi.mocked(get).mockReturnValueOnce({ publish_mode: 'simple' });
      expect(isWorkflowEnabled()).toBe(false);
    });
  });

  describe('loadUnpublishedEntries', () => {
    test('loads entries from GitHub PRs', async () => {
      vi.mocked(get)
        .mockReturnValueOnce({ publish_mode: 'editorial_workflow' }) // isWorkflowEnabled
        .mockReturnValueOnce(false) // workflowEntriesLoaded
        .mockReturnValueOnce({ isGit: true, name: 'github' }); // backend

      vi.mocked(pullRequests.listPullRequests).mockResolvedValue([
        {
          number: 1,
          title: 'Editorial Workflow: My Post',
          body: 'Creating entry',
          state: 'open',
          url: 'https://github.com/test/repo/pull/1',
          headBranch: 'cms/posts/my-post',
          headSha: 'abc123',
          baseBranch: 'main',
          labels: ['sveltia-cms/draft'],
          createdAt: new Date(),
          updatedAt: new Date(),
          author: 'user',
        },
      ]);

      await loadUnpublishedEntries();

      expect(pullRequests.listPullRequests).toHaveBeenCalledWith({ states: ['OPEN'] });

      const entries = get(unpublishedEntries);

      expect(entries.size).toBe(1);

      const entry = entries.get('posts.my-post');

      expect(entry?.collection).toBe('posts');
      expect(entry?.slug).toBe('my-post');
      expect(entry?.title).toBe('My Post');
      expect(entry?.prNumber).toBe(1);
    });

    test('skips loading when workflow is not enabled', async () => {
      vi.mocked(get).mockReturnValueOnce({ publish_mode: 'simple' });

      await loadUnpublishedEntries();

      expect(pullRequests.listPullRequests).not.toHaveBeenCalled();
    });

    test('skips loading when entries are already loaded', async () => {
      vi.mocked(get)
        .mockReturnValueOnce({ publish_mode: 'editorial_workflow' })
        .mockReturnValueOnce(true); // workflowEntriesLoaded

      await loadUnpublishedEntries();

      expect(pullRequests.listPullRequests).not.toHaveBeenCalled();
    });

    test('skips non-cms branches', async () => {
      vi.mocked(get)
        .mockReturnValueOnce({ publish_mode: 'editorial_workflow' })
        .mockReturnValueOnce(false)
        .mockReturnValueOnce({ isGit: true, name: 'github' });

      vi.mocked(pullRequests.listPullRequests).mockResolvedValue([
        createMockPR({
          number: 1,
          title: 'Feature branch',
          headBranch: 'feature/something',
          headSha: 'abc123',
          labels: [],
        }),
      ]);

      await loadUnpublishedEntries();

      expect(get(unpublishedEntries).size).toBe(0);
    });
  });

  describe('persistUnpublishedEntry', () => {
    test('creates new branch and PR for new entry', async () => {
      vi.mocked(commits.commitChanges).mockResolvedValue(createMockCommitResults());
      vi.mocked(pullRequests.createPullRequest).mockResolvedValue(
        createMockPR({
          number: 42,
          url: 'https://github.com/test/repo/pull/42',
          title: 'Editorial Workflow: New Post',
        }),
      );

      const result = await persistUnpublishedEntry({
        collection: 'posts',
        slug: 'new-post',
        title: 'New Post',
        data: { title: 'New Post' },
        changes: [
          {
            action: 'create',
            path: 'content/posts/new-post.md',
            data: '---\ntitle: New Post\n---',
          },
        ],
      });

      expect(pullRequests.createBranch).toHaveBeenCalledWith('cms/posts/new-post', 'main');
      expect(commits.commitChanges).toHaveBeenCalled();
      expect(pullRequests.createPullRequest).toHaveBeenCalled();
      expect(sharedCommits.createWorkflowMessage).toHaveBeenCalledWith('workflowPrTitle', {
        collection: 'posts',
        slug: 'new-post',
        title: 'New Post',
      });
      expect(sharedCommits.createWorkflowMessage).toHaveBeenCalledWith('workflowPrBody', {
        collection: 'posts',
        slug: 'new-post',
        title: 'New Post',
      });
      expect(result.prNumber).toBe(42);
      expect(result.collection).toBe('posts');
      expect(result.slug).toBe('new-post');
    });

    test('updates existing entry when PR exists', async () => {
      // Setup existing entry
      setUnpublishedEntries([
        createMockEntry({
          collection: 'posts',
          slug: 'existing-post',
          status: 'draft',
          title: 'Existing',
          prNumber: 10,
          branch: 'cms/posts/existing-post',
        }),
      ]);

      vi.mocked(commits.commitChanges).mockResolvedValue(
        createMockCommitResults({ sha: 'new-commit-sha' }),
      );

      const result = await persistUnpublishedEntry({
        collection: 'posts',
        slug: 'existing-post',
        title: 'Updated Post',
        data: { title: 'Updated Post' },
        changes: [
          {
            action: 'update',
            path: 'content/posts/existing-post.md',
            data: '---\ntitle: Updated\n---',
          },
        ],
      });

      expect(pullRequests.createBranch).not.toHaveBeenCalled();
      expect(pullRequests.createPullRequest).not.toHaveBeenCalled();
      expect(commits.commitChanges).toHaveBeenCalled();
      expect(preview.clearPreviewState).toHaveBeenCalledWith('posts', 'existing-post');
      expect(result.title).toBe('Updated Post');
    });

    test('cleans up branch on PR creation failure', async () => {
      vi.mocked(commits.commitChanges).mockResolvedValue(createMockCommitResults({ sha: 'sha' }));
      vi.mocked(pullRequests.createPullRequest).mockRejectedValue(new Error('PR creation failed'));

      await expect(
        persistUnpublishedEntry({
          collection: 'posts',
          slug: 'fail-post',
          title: 'Fail',
          data: {},
          changes: [],
        }),
      ).rejects.toThrow('PR creation failed');

      expect(pullRequests.deleteBranch).toHaveBeenCalledWith('cms/posts/fail-post');
    });
  });

  describe('updateEntryStatus', () => {
    test('updates PR labels for status change', async () => {
      setUnpublishedEntries([
        createMockEntry({
          collection: 'posts',
          slug: 'my-post',
          status: 'draft',
          prNumber: 5,
        }),
      ]);

      await updateEntryStatus('posts', 'my-post', 'pending_review');

      expect(pullRequests.updatePRStatus).toHaveBeenCalledWith(5, 'draft', 'pending_review');

      const entry = getUnpublishedEntry('posts', 'my-post');

      expect(entry?.status).toBe('pending_review');
    });

    test('throws error when entry not found', async () => {
      await expect(updateEntryStatus('posts', 'non-existent', 'pending_review')).rejects.toThrow(
        'Entry not found',
      );
    });

    test('does nothing when status is the same', async () => {
      setUnpublishedEntries([
        createMockEntry({
          collection: 'posts',
          slug: 'my-post',
          status: 'draft',
          prNumber: 5,
        }),
      ]);

      await updateEntryStatus('posts', 'my-post', 'draft');

      expect(pullRequests.updatePRStatus).not.toHaveBeenCalled();
    });
  });

  describe('publishEntry', () => {
    test('merges PR using createWorkflowMessage and removes entry', async () => {
      setUnpublishedEntries([
        createMockEntry({
          collection: 'posts',
          slug: 'ready-post',
          status: 'pending_publish',
          title: 'Ready Post',
          prNumber: 20,
          branch: 'cms/posts/ready-post',
        }),
      ]);

      vi.mocked(pullRequests.mergePullRequest).mockResolvedValue({ sha: 'merge-sha' });

      await publishEntry('posts', 'ready-post');

      expect(sharedCommits.createWorkflowMessage).toHaveBeenCalledWith('workflowPublish', {
        collection: 'posts',
        slug: 'ready-post',
        title: 'Ready Post',
      });
      expect(pullRequests.mergePullRequest).toHaveBeenCalledWith(20, {
        commitTitle: 'Publish Posts "ready-post"',
      });
      expect(pullRequests.deleteBranch).toHaveBeenCalledWith('cms/posts/ready-post');
      expect(getUnpublishedEntry('posts', 'ready-post')).toBeUndefined();
    });

    test('throws error when entry not found', async () => {
      await expect(publishEntry('posts', 'non-existent')).rejects.toThrow('Entry not found');
    });

    test('continues even if branch deletion fails', async () => {
      setUnpublishedEntries([
        createMockEntry({
          collection: 'posts',
          slug: 'post',
          status: 'pending_publish',
          prNumber: 1,
          branch: 'cms/posts/post',
        }),
      ]);

      vi.mocked(pullRequests.mergePullRequest).mockResolvedValue({ sha: 'sha' });
      vi.mocked(pullRequests.deleteBranch).mockRejectedValue(new Error('Branch not found'));

      await publishEntry('posts', 'post');

      expect(getUnpublishedEntry('posts', 'post')).toBeUndefined();
    });
  });

  describe('deleteUnpublishedEntry', () => {
    test('closes PR and removes entry', async () => {
      setUnpublishedEntries([
        createMockEntry({
          collection: 'posts',
          slug: 'delete-me',
          status: 'draft',
          prNumber: 30,
          branch: 'cms/posts/delete-me',
        }),
      ]);

      await deleteUnpublishedEntry('posts', 'delete-me');

      expect(pullRequests.closePullRequest).toHaveBeenCalledWith(30);
      expect(pullRequests.deleteBranch).toHaveBeenCalledWith('cms/posts/delete-me');
      expect(getUnpublishedEntry('posts', 'delete-me')).toBeUndefined();
    });

    test('throws error when entry not found', async () => {
      await expect(deleteUnpublishedEntry('posts', 'non-existent')).rejects.toThrow(
        'Entry not found',
      );
    });

    test('continues even if branch deletion fails', async () => {
      setUnpublishedEntries([
        createMockEntry({
          collection: 'posts',
          slug: 'post',
          status: 'draft',
          prNumber: 1,
          branch: 'cms/posts/post',
        }),
      ]);

      vi.mocked(pullRequests.deleteBranch).mockRejectedValue(new Error('Branch not found'));

      await deleteUnpublishedEntry('posts', 'post');

      expect(getUnpublishedEntry('posts', 'post')).toBeUndefined();
    });
  });
});
