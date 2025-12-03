import {
  getFileFromBranch,
  getPullRequestFiles,
} from '$lib/services/backends/git/github/pull-requests';
import { getCollection } from '$lib/services/contents/collection';
import { parseEntryFile } from '$lib/services/contents/file/parse';
import { getUnpublishedEntry } from '$lib/services/contents/workflow';

/**
 * @import { Entry, UnpublishedEntry } from '$lib/types/private';
 */

/**
 * Extract locale from file path based on collection i18n configuration.
 * @param {string} filePath File path.
 * @param {import('$lib/types/private').InternalI18nOptions} i18nConfig I18n configuration.
 * @returns {string | undefined} Locale code or undefined for default locale.
 */
const extractLocaleFromPath = (filePath, i18nConfig) => {
  const { structure, allLocales } = i18nConfig;

  if (!structure || structure === 'single_file') {
    return undefined;
  }

  if (structure === 'multiple_files') {
    // Format: posts/my-post.en.md
    const match = filePath.match(/\.([a-z]{2}(-[A-Z]{2})?)\.([^.]+)$/);

    if (match && allLocales.includes(match[1])) {
      return match[1];
    }
  }

  if (structure === 'multiple_folders') {
    // Format: posts/en/my-post.md or en/posts/my-post.md
    const matchedLocale = allLocales.find((locale) => filePath.includes(`/${locale}/`));

    if (matchedLocale) {
      return matchedLocale;
    }
  }

  return undefined;
};

/**
 * Load an entry from a workflow PR branch.
 * @param {string} collection Collection name.
 * @param {string} slug Entry slug.
 * @returns {Promise<Entry | null>} Loaded entry or null if not found.
 */
export const loadEntryFromWorkflowBranch = async (collection, slug) => {
  const unpublishedEntry = getUnpublishedEntry(collection, slug);

  if (!unpublishedEntry || !unpublishedEntry.prNumber || !unpublishedEntry.branch) {
    return null;
  }

  const collectionConfig = getCollection(collection);

  if (!collectionConfig) {
    throw new Error(`Collection "${collection}" not found`);
  }

  try {
    // Get list of files changed in this PR
    const prFiles = await getPullRequestFiles(unpublishedEntry.prNumber);

    // Filter files that belong to this collection
    const collectionFolder =
      collectionConfig._type === 'entry' ? collectionConfig._file.basePath : '';

    const entryFiles = prFiles.filter(
      (file) =>
        file.status !== 'removed' &&
        collectionFolder &&
        file.path.startsWith(`${collectionFolder}/`),
    );

    if (entryFiles.length === 0) {
      // No files found - this might be a new entry that hasn't been created yet
      return null;
    }

    const i18nConfig = collectionConfig._i18n;
    const { defaultLocale } = i18nConfig;

    // Load content from each file in parallel
    const fileResults = await Promise.all(
      entryFiles.map(async (file) => {
        try {
          const content = await getFileFromBranch(file.path, unpublishedEntry.branch ?? 'main');
          const locale = extractLocaleFromPath(file.path, i18nConfig) ?? defaultLocale;

          // Parse the file content
          const parsed = await parseEntryFile({
            type: 'entry',
            name: file.path.split('/').pop() ?? '',
            path: file.path,
            text: content,
            sha: unpublishedEntry.headSha ?? '',
            size: content.length,
            folder: {
              collectionName: collection,
              fileName: undefined,
            },
          });

          return { locale, parsed, path: file.path };
        } catch (/** @type {any} */ error) {
          // eslint-disable-next-line no-console
          console.error(`Failed to load file ${file.path}:`, error);

          return null;
        }
      }),
    );

    // Build locales map from results in the correct LocalizedEntry format
    /** @type {Record<string, any>} */
    const locales = {};

    fileResults.forEach((result) => {
      if (result) {
        // Create LocalizedEntry structure with slug, path, and content
        locales[result.locale] = {
          slug,
          path: result.path,
          content: result.parsed,
        };
      }
    });

    if (Object.keys(locales).length === 0) {
      return null;
    }

    // Construct Entry object compatible with the editor
    /** @type {Entry} */
    const entry = {
      id: `${collection}/${slug}`,
      slug,
      subPath: slug,
      locales,
      commitAuthor: {
        name: unpublishedEntry.author ?? 'Unknown',
        email: '',
      },
      commitDate: unpublishedEntry.updatedAt ?? new Date(),
    };

    return entry;
  } catch (/** @type {any} */ error) {
    // eslint-disable-next-line no-console
    console.error('Failed to load entry from workflow branch:', error);

    throw error;
  }
};
