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
 * Check if a file path belongs to a specific entry slug.
 * Handles various path formats including i18n structures and nested paths.
 * @param {string} filePath File path.
 * @param {string} slug Entry slug.
 * @param {import('$lib/types/private').InternalI18nOptions} i18nConfig I18n configuration.
 * @returns {boolean} True if the file belongs to the entry.
 */
const fileBelongsToEntry = (filePath, slug, i18nConfig) => {
  const { structure } = i18nConfig;

  // Extract the filename from path
  const parts = filePath.split('/');
  const fileName = parts[parts.length - 1] ?? '';

  // Handle nested slugs (e.g., "2024/my-post" or "blog/2024/my-post")
  // We need to check if the file path contains the slug parts
  const slugParts = slug.split('/');

  if (structure === 'multiple_files') {
    // Format: posts/my-slug.en.md, posts/my-slug.md, or posts/2024/my-slug.md
    // For nested slugs, the last part of the slug should match the filename
    const lastSlugPart = slugParts[slugParts.length - 1];

    // Match: my-slug.md, my-slug.en.md, my-slug.en-US.md
    const slugPattern = new RegExp(
      `^${lastSlugPart.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\.[a-z]{2}(-[A-Z]{2})?)?\\.(md|json|yaml|yml)$`,
    );
    return slugPattern.test(fileName);
  }

  if (structure === 'multiple_folders') {
    // Format: posts/en/my-slug.md, posts/en/2024/my-slug.md
    // For nested slugs, the filename should match the last part of the slug
    const lastSlugPart = slugParts[slugParts.length - 1];
    const baseFileName = fileName.replace(/\.(md|json|yaml|yml)$/, '');

    // The filename should match the last part of the slug
    if (baseFileName !== lastSlugPart) {
      return false;
    }

    // Additionally, verify the path contains all slug parts in order
    const pathWithoutExt = filePath.replace(/\.(md|json|yaml|yml)$/, '');
    const slugPattern = slugParts.join('/');

    // Check if the path contains the slug pattern (e.g., "posts/2024/my-post")
    return pathWithoutExt.includes(slugPattern);
  }

  // For single_file or default: check if filename starts with slug
  // For nested slugs like "2024/my-post", check if path contains slug
  if (slugParts.length > 1) {
    const slugPattern = slugParts.join('/');
    return filePath.includes(slugPattern);
  }

  return fileName.startsWith(`${slug}.`);
};

/**
 * Load an entry from a workflow PR branch.
 * @param {string} collection Collection name.
 * @param {string} slug Entry slug.
 * @returns {Promise<Entry | null>} Loaded entry or null if not found.
 */
export const loadEntryFromWorkflowBranch = async (collection, slug) => {
  const unpublishedEntry = getUnpublishedEntry(collection, slug);

  if (!unpublishedEntry) {
    // eslint-disable-next-line no-console
    console.warn(
      `[loadEntryFromWorkflowBranch] No unpublished entry found for "${collection}/${slug}"`,
    );
    return null;
  }

  if (!unpublishedEntry.prNumber || !unpublishedEntry.branch) {
    // eslint-disable-next-line no-console
    console.warn(
      `[loadEntryFromWorkflowBranch] Entry "${collection}/${slug}" missing prNumber or branch`,
      unpublishedEntry,
    );
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

    const i18nConfig = collectionConfig._i18n;

    let entryFiles = prFiles.filter(
      (file) =>
        file.status !== 'removed' &&
        collectionFolder &&
        file.path.startsWith(`${collectionFolder}/`) &&
        fileBelongsToEntry(file.path, slug, i18nConfig),
    );

    // Fallback: if no files found with strict filter, try a more relaxed approach
    // This handles cases where the file structure doesn't exactly match expectations
    if (entryFiles.length === 0) {
      // Try to find files that contain the slug anywhere in the path
      entryFiles = prFiles.filter((file) => {
        if (file.status === 'removed') return false;
        if (!collectionFolder) return false;

        // Must be in the collection folder
        if (!file.path.startsWith(`${collectionFolder}/`)) return false;

        // Check if the file path contains the slug (handling nested paths)
        // For slug "2024/my-post", we look for files containing "my-post"
        const slugParts = slug.split('/');
        const lastSlugPart = slugParts[slugParts.length - 1];

        // Check if filename contains the last part of the slug
        const fileName = file.path.split('/').pop() ?? '';
        const fileNameWithoutExt = fileName.replace(/\.(md|json|yaml|yml)$/i, '');

        return (
          fileNameWithoutExt === lastSlugPart || fileNameWithoutExt.startsWith(`${lastSlugPart}.`)
        );
      });
    }

    if (entryFiles.length === 0) {
      // Debug log to help troubleshoot
      // eslint-disable-next-line no-console
      console.warn(
        `No files found for entry "${collection}/${slug}". PR files:`,
        prFiles.map((f) => f.path),
      );
      return null;
    }

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
