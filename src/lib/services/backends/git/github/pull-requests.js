import { get } from 'svelte/store';
import { _ } from 'svelte-i18n';

import { repository } from '$lib/services/backends/git/github/repository';
import { fetchAPI, fetchGraphQL } from '$lib/services/backends/git/shared/api';
import { cmsConfig } from '$lib/services/config';

/**
 * @import { CreatePROptions, PullRequestInfo, WorkflowStatus } from '$lib/types/private';
 */

/**
 * Get the CMS label prefix from config or use default.
 * @returns {string} Label prefix.
 */
const getLabelPrefix = () => {
  const config = get(cmsConfig);

  const backend = /** @type {import('$lib/types/public').GitHubBackend | undefined} */ (
    config?.backend
  );

  return backend?.cms_label_prefix ?? 'sveltia-cms/';
};

/**
 * Get the label for a workflow status.
 * @param {WorkflowStatus} status Workflow status.
 * @returns {string} Label name.
 */
export const getStatusLabel = (status) => `${getLabelPrefix()}${status}`;

/**
 * Get workflow status from PR labels.
 * @param {string[]} labels Label names.
 * @returns {WorkflowStatus} Workflow status.
 */
export const getStatusFromLabels = (labels) => {
  const prefix = getLabelPrefix();
  const statusLabel = labels.find((label) => label.startsWith(prefix));

  if (statusLabel) {
    const status = statusLabel.replace(prefix, '');

    if (['draft', 'pending_review', 'pending_publish'].includes(status)) {
      return /** @type {WorkflowStatus} */ (status);
    }
  }

  return 'draft';
};

/**
 * Generate branch name for editorial workflow.
 * @param {string} collection Collection name.
 * @param {string} slug Entry slug.
 * @returns {string} Branch name.
 */
export const getBranchName = (collection, slug) => `cms/${collection}/${slug}`;

/**
 * Parse branch name to get collection and slug.
 * @param {string} branchName Branch name.
 * @returns {{ collection: string, slug: string } | null} Parsed info or null.
 */
export const parseBranchName = (branchName) => {
  const match = branchName.match(/^cms\/([^/]+)\/(.+)$/);

  if (match) {
    return { collection: match[1], slug: match[2] };
  }

  return null;
};

const LIST_PULL_REQUESTS_QUERY = `
  query($owner: String!, $repo: String!, $states: [PullRequestState!]) {
    repository(owner: $owner, name: $repo) {
      pullRequests(first: 100, states: $states, orderBy: { field: UPDATED_AT, direction: DESC }) {
        nodes {
          number
          title
          body
          state
          url
          headRefName
          baseRefName
          createdAt
          updatedAt
          author {
            login
          }
          labels(first: 10) {
            nodes {
              name
            }
          }
        }
      }
    }
  }
`;

/**
 * List pull requests for editorial workflow.
 * @param {object} [options] Options.
 * @param {('OPEN' | 'CLOSED' | 'MERGED')[]} [options.states] PR states to filter.
 * @returns {Promise<PullRequestInfo[]>} List of PRs.
 */
export const listPullRequests = async ({ states = ['OPEN'] } = {}) => {
  const { repo } = repository;
  const prefix = getLabelPrefix();

  const result = /** @type {{ repository: { pullRequests: { nodes: any[] } } }} */ (
    await fetchGraphQL(LIST_PULL_REQUESTS_QUERY, { states })
  );

  if (!result.repository) {
    throw new Error('Failed to list pull requests.', {
      cause: new Error(get(_)('repository_not_found', { values: { repo } })),
    });
  }

  const prs = result.repository.pullRequests.nodes
    // Filter only CMS-related PRs (branches starting with cms/)
    .filter((pr) => pr.headRefName.startsWith('cms/'))
    // Filter only PRs with CMS labels
    .filter((pr) =>
      pr.labels.nodes.some((/** @type {{ name: string }} */ label) =>
        label.name.startsWith(prefix),
      ),
    )
    .map((pr) => ({
      number: pr.number,
      title: pr.title,
      body: pr.body,
      state: pr.state.toLowerCase(),
      url: pr.url,
      headBranch: pr.headRefName,
      baseBranch: pr.baseRefName,
      labels: pr.labels.nodes.map((/** @type {{ name: string }} */ label) => label.name),
      createdAt: new Date(pr.createdAt),
      updatedAt: new Date(pr.updatedAt),
      author: pr.author?.login,
    }));

  return prs;
};

/**
 * Get a single pull request by number.
 * @param {number} prNumber PR number.
 * @returns {Promise<PullRequestInfo>} PR info.
 */
export const getPullRequest = async (prNumber) => {
  const { owner, repo } = repository;
  const result = /** @type {any} */ (await fetchAPI(`/repos/${owner}/${repo}/pulls/${prNumber}`));

  return {
    number: result.number,
    title: result.title,
    body: result.body,
    state: result.state,
    url: result.html_url,
    headBranch: result.head.ref,
    baseBranch: result.base.ref,
    labels: result.labels.map((/** @type {{ name: string }} */ label) => label.name),
    createdAt: new Date(result.created_at),
    updatedAt: new Date(result.updated_at),
    author: result.user?.login,
  };
};

/**
 * Create a new branch.
 * @param {string} branchName New branch name.
 * @param {string} [fromBranch] Source branch (defaults to repository branch).
 * @returns {Promise<void>}
 * @see https://docs.github.com/en/rest/git/refs#create-a-reference
 */
export const createBranch = async (branchName, fromBranch) => {
  const { owner, repo, branch: defaultBranch } = repository;
  const sourceBranch = fromBranch ?? defaultBranch ?? 'main';

  // First, get the SHA of the source branch
  const refResult = /** @type {{ object: { sha: string } }} */ (
    await fetchAPI(`/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(sourceBranch)}`)
  );

  const { sha } = refResult.object;

  // Create the new branch
  await fetchAPI(`/repos/${owner}/${repo}/git/refs`, {
    method: 'POST',
    body: {
      ref: `refs/heads/${branchName}`,
      sha,
    },
  });
};

/**
 * Delete a branch.
 * @param {string} branchName Branch name to delete.
 * @returns {Promise<void>}
 * @see https://docs.github.com/en/rest/git/refs#delete-a-reference
 */
export const deleteBranch = async (branchName) => {
  const { owner, repo } = repository;

  await fetchAPI(`/repos/${owner}/${repo}/git/refs/heads/${encodeURIComponent(branchName)}`, {
    method: 'DELETE',
    responseType: 'raw',
  });
};

/**
 * Add labels to a pull request.
 * @param {number} prNumber PR number.
 * @param {string[]} labels Labels to add.
 * @returns {Promise<void>}
 * @see https://docs.github.com/en/rest/issues/labels#add-labels-to-an-issue
 */
export const addLabels = async (prNumber, labels) => {
  const { owner, repo } = repository;

  await fetchAPI(`/repos/${owner}/${repo}/issues/${prNumber}/labels`, {
    method: 'POST',
    body: { labels },
  });
};

/**
 * Create a pull request.
 * @param {CreatePROptions} options PR options.
 * @returns {Promise<PullRequestInfo>} Created PR info.
 * @see https://docs.github.com/en/rest/pulls/pulls#create-a-pull-request
 */
export const createPullRequest = async ({ title, body, head, base, labels = [] }) => {
  const { owner, repo, branch: defaultBranch } = repository;
  const baseBranch = base ?? defaultBranch ?? 'main';

  // Create the PR
  const result = /** @type {any} */ (
    await fetchAPI(`/repos/${owner}/${repo}/pulls`, {
      method: 'POST',
      body: {
        title,
        body,
        head,
        base: baseBranch,
      },
    })
  );

  const prNumber = result.number;

  // Add labels if provided
  if (labels.length > 0) {
    await addLabels(prNumber, labels);
  }

  return {
    number: prNumber,
    title: result.title,
    body: result.body,
    state: result.state,
    url: result.html_url,
    headBranch: result.head.ref,
    baseBranch: result.base.ref,
    labels,
    createdAt: new Date(result.created_at),
    updatedAt: new Date(result.updated_at),
    author: result.user?.login,
  };
};

/**
 * Remove a label from a pull request.
 * @param {number} prNumber PR number.
 * @param {string} label Label to remove.
 * @returns {Promise<void>}
 * @see https://docs.github.com/en/rest/issues/labels#remove-a-label-from-an-issue
 */
export const removeLabel = async (prNumber, label) => {
  const { owner, repo } = repository;

  await fetchAPI(`/repos/${owner}/${repo}/issues/${prNumber}/labels/${encodeURIComponent(label)}`, {
    method: 'DELETE',
    responseType: 'raw',
  });
};

/**
 * Update PR labels for workflow status change.
 * @param {number} prNumber PR number.
 * @param {WorkflowStatus} oldStatus Old status.
 * @param {WorkflowStatus} newStatus New status.
 * @returns {Promise<void>}
 */
export const updatePRStatus = async (prNumber, oldStatus, newStatus) => {
  const oldLabel = getStatusLabel(oldStatus);
  const newLabel = getStatusLabel(newStatus);

  // Remove old status label
  try {
    await removeLabel(prNumber, oldLabel);
  } catch {
    // Label might not exist, ignore
  }

  // Add new status label
  await addLabels(prNumber, [newLabel]);
};

/**
 * Merge a pull request.
 * @param {number} prNumber PR number.
 * @param {object} [options] Merge options.
 * @param {'merge' | 'squash' | 'rebase'} [options.mergeMethod] Merge method.
 * @param {string} [options.commitTitle] Commit title for squash/merge.
 * @returns {Promise<{ sha: string }>} Merge commit SHA.
 * @see https://docs.github.com/en/rest/pulls/pulls#merge-a-pull-request
 */
export const mergePullRequest = async (prNumber, { mergeMethod = 'squash', commitTitle } = {}) => {
  const { owner, repo } = repository;
  const config = get(cmsConfig);

  const backend = /** @type {import('$lib/types/public').GitHubBackend | undefined} */ (
    config?.backend
  );

  const useSquash = backend?.squash_merges !== false;

  const result = /** @type {{ sha: string }} */ (
    await fetchAPI(`/repos/${owner}/${repo}/pulls/${prNumber}/merge`, {
      method: 'PUT',
      body: {
        merge_method: useSquash ? 'squash' : mergeMethod,
        commit_title: commitTitle,
      },
    })
  );

  return { sha: result.sha };
};

/**
 * Close a pull request without merging.
 * @param {number} prNumber PR number.
 * @returns {Promise<void>}
 * @see https://docs.github.com/en/rest/pulls/pulls#update-a-pull-request
 */
export const closePullRequest = async (prNumber) => {
  const { owner, repo } = repository;

  await fetchAPI(`/repos/${owner}/${repo}/pulls/${prNumber}`, {
    method: 'PATCH',
    body: { state: 'closed' },
  });
};

/**
 * Get files changed in a pull request.
 * @param {number} prNumber PR number.
 * @returns {Promise<{ path: string, status: string, contents?: string }[]>} Changed files.
 * @see https://docs.github.com/en/rest/pulls/pulls#list-pull-requests-files
 */
export const getPullRequestFiles = async (prNumber) => {
  const { owner, repo } = repository;

  const result = /** @type {any[]} */ (
    await fetchAPI(`/repos/${owner}/${repo}/pulls/${prNumber}/files`)
  );

  return result.map((file) => ({
    path: file.filename,
    status: file.status,
    patch: file.patch,
  }));
};

/**
 * Get file content from a specific branch.
 * @param {string} path File path.
 * @param {string} branchName Branch name.
 * @returns {Promise<string>} File content.
 * @see https://docs.github.com/en/rest/repos/contents#get-repository-content
 */
export const getFileFromBranch = async (path, branchName) => {
  const { owner, repo } = repository;
  const encodedPath = encodeURIComponent(path);
  const encodedBranch = encodeURIComponent(branchName);

  const result = /** @type {{ content: string, encoding: string }} */ (
    await fetchAPI(`/repos/${owner}/${repo}/contents/${encodedPath}?ref=${encodedBranch}`)
  );

  if (result.encoding === 'base64') {
    return atob(result.content);
  }

  return result.content;
};
