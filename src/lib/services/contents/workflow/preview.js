import { get } from 'svelte/store';

import { repository } from '$lib/services/backends/git/github/repository';
import { fetchAPI } from '$lib/services/backends/git/shared/api';
import { cmsConfig } from '$lib/services/config';
import { getUnpublishedEntry, updateUnpublishedEntry } from '$lib/services/contents/workflow';

/**
 * @import { PreviewStatus, UnpublishedEntry } from '$lib/types/private';
 * @import { GitHubBackend } from '$lib/types/public';
 */

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
 * `{{branch}}` (the entry's branch name), `{{collection}}` (the collection name), `{{slug}}` (the
 * entry slug), `{{pr_number}}` (the pull request number), `{{timestamp}}` (current timestamp in
 * milliseconds), and `{{title}}` (URL-encoded entry title).
 * @param {UnpublishedEntry} entry The entry.
 * @returns {string | undefined} Preview URL or undefined if not configured.
 */
export const buildPreviewUrl = (entry) => {
  const previewUrl = getPreviewUrlTemplate();

  if (!entry.branch || !previewUrl) {
    return undefined;
  }

  const timestamp = Date.now().toString();

  return previewUrl
    .replace(/\{\{branch\}\}/g, entry.branch)
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
        collection: entry.collection,
        slug: entry.slug,
        prNumber: entry.prNumber,
        title: entry.title,
      },
    },
  });
};

/**
 * Build preview for an entry.
 * This triggers a `sveltia-cms-preview` repository dispatch event that can be handled
 * by a GitHub Actions workflow to build and deploy the preview.
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

  updateUnpublishedEntry(collection, slug, {
    isBuildingPreview: true,
    previewStatus: 'building',
  });

  try {
    // Trigger repository dispatch for the user's CI/CD to handle
    await triggerRepositoryDispatch(entry);

    // Build the preview URL
    const url = buildPreviewUrl(entry);

    updateUnpublishedEntry(collection, slug, {
      isBuildingPreview: false,
      previewStatus: 'ready',
      previewUrl: url,
    });
  } catch (/** @type {any} */ error) {
    // eslint-disable-next-line no-console
    console.error('Failed to build preview:', error);

    updateUnpublishedEntry(collection, slug, {
      isBuildingPreview: false,
      previewStatus: 'error',
    });

    throw error;
  }
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
