import { get } from 'svelte/store';

import { cmsConfig } from '$lib/services/config';
import { getCollection, getCollectionLabel } from '$lib/services/contents/collection';
import { user } from '$lib/services/user';

/**
 * @import { CommitOptions, FileChange, User } from '$lib/types/private';
 * @import { GitBackend } from '$lib/types/public';
 */

/**
 * Default commit message templates.
 * @see https://decapcms.org/docs/configuration-options/#commit-message-templates
 * @see https://sveltiacms.app/en/docs/backends#commit-messages
 */
const DEFAULT_COMMIT_MESSAGES = {
  create: 'Create {{collection}} "{{slug}}"',
  update: 'Update {{collection}} "{{slug}}"',
  delete: 'Delete {{collection}} "{{slug}}"',
  uploadMedia: 'Upload "{{path}}"',
  deleteMedia: 'Delete "{{path}}"',
  openAuthoring: '{{message}}',
  // Editorial Workflow messages
  workflowPublish: 'Publish {{collection}} "{{slug}}"',
  workflowPrTitle: 'Editorial Workflow: {{title}}',
  workflowPrBody: 'Creating entry: {{collection}}/{{slug}}',
  // Batch Mode messages
  batchPrTitle: 'Editorial Workflow: Batch Changes',
  batchPrBody: 'Multiple changes in batch',
  batchPublish: 'Publish batch changes',
};

/**
 * Create a workflow message (for PR titles, bodies, and publish commits).
 * @param
 * {'workflowPublish' | 'workflowPrTitle' | 'workflowPrBody' | 'batchPrTitle'
 * | 'batchPrBody' | 'batchPublish'} messageType Message type.
 * @param {object} context Message context.
 * @param {string} context.collection Collection name.
 * @param {string} context.slug Entry slug.
 * @param {string} [context.title] Entry title.
 * @returns {string} Formatted message.
 */
export const createWorkflowMessage = (messageType, { collection, slug, title }) => {
  const { commit_messages: customCommitMessages = {} } = /** @type {GitBackend} */ (
    get(cmsConfig)?.backend ?? {}
  );

  const { email = '', login = '', name = '' } = /** @type {User} */ (get(user)) ?? {};
  const collectionObj = collection ? getCollection(collection) : undefined;

  const collectionLabel = collectionObj
    ? getCollectionLabel(collectionObj, { useSingular: true })
    : '';

  // @ts-ignore
  let message = customCommitMessages[messageType] || DEFAULT_COMMIT_MESSAGES[messageType] || '';

  message = message
    .replaceAll('{{slug}}', slug || '')
    .replaceAll('{{collection}}', collectionLabel)
    .replaceAll('{{title}}', title || slug || '')
    .replaceAll('{{author-email}}', email ?? '')
    .replaceAll('{{author-login}}', login ?? '')
    .replaceAll('{{author-name}}', name ?? '');

  return message;
};

/**
 * Create a Git commit message.
 * @param {FileChange[]} changes File changes to be saved.
 * @param {CommitOptions} options Commit options.
 * @returns {string} Formatted message.
 */
export const createCommitMessage = (
  changes,
  { commitType = 'update', collection, skipCI = undefined },
) => {
  const {
    commit_messages: customCommitMessages = {},
    skip_ci: skipCIEnabled,
    automatic_deployments: autoDeploy,
  } = /** @type {GitBackend} */ (get(cmsConfig)?.backend ?? {});

  const { email = '', login = '', name = '' } = /** @type {User} */ (get(user));
  const [firstSlug = ''] = changes.map((item) => item.slug).filter(Boolean);
  const [firstPath, ...remainingPaths] = changes.map(({ path }) => path);
  const collectionLabel = collection ? getCollectionLabel(collection, { useSingular: true }) : '';
  // @ts-ignore
  let message = customCommitMessages[commitType] || DEFAULT_COMMIT_MESSAGES[commitType] || '';

  if (['create', 'update', 'delete'].includes(commitType)) {
    message = message
      .replaceAll('{{slug}}', firstSlug)
      .replaceAll('{{collection}}', collectionLabel)
      .replaceAll('{{path}}', firstPath)
      .replaceAll('{{author-email}}', email)
      .replaceAll('{{author-login}}', login)
      .replaceAll('{{author-name}}', name);
  }

  if (['uploadMedia', 'deleteMedia'].includes(commitType)) {
    message = message
      .replaceAll('{{path}}', firstPath)
      .replaceAll('{{author-email}}', email)
      .replaceAll('{{author-login}}', login)
      .replaceAll('{{author-name}}', name);

    if (remainingPaths.length) {
      message += ` +${remainingPaths.length}`;
    }
  }

  if (['openAuthoring'].includes(commitType)) {
    message = message
      .replaceAll('{{message}}', commitType)
      .replaceAll('{{author-email}}', email)
      .replaceAll('{{author-login}}', login)
      .replaceAll('{{author-name}}', name);
  }

  // If requested, disable automatic deployments by using the standard `[skip ci]` prefix supported
  // by major CI/CD providers, including GitHub Actions and Cloudflare Pages. To avoid unexpected
  // data retention, deployments for deletion commits are not skipped.
  // https://docs.github.com/en/actions/managing-workflow-runs/skipping-workflow-runs
  // https://docs.gitlab.com/ee/ci/pipelines/#skip-a-pipeline
  // https://developers.cloudflare.com/pages/platform/branch-build-controls/#skip-builds
  if (
    !['delete', 'deleteMedia'].includes(commitType) &&
    // Cannot use the `skipCIEnabled` store here because it leads to an uninitialized store error
    (skipCI ?? (skipCIEnabled === true || autoDeploy === false))
  ) {
    message = `[skip ci] ${message}`;
  }

  return message;
};
