import { get } from 'svelte/store';
import { writable } from 'svelte/store';
import { _ } from 'svelte-i18n';

/**
 * @typedef {{ show: boolean, title: string, message: string, onConfirm: () => void }} DialogState
 */

/** @type {import('svelte/store').Writable<DialogState>} */
export const dialogState = writable({
  show: false,
  title: '',
  message: '',
  onConfirm: () => {},
});

/**
 * Show a confirmation dialog.
 * @param {string} title Dialog title.
 * @param {string} message Dialog message.
 * @returns {Promise<boolean>} True if confirmed, false if cancelled.
 */
export const showConfirm = (title, message) => {
  return new Promise((resolve) => {
    dialogState.set({
      show: true,
      title,
      message,
      onConfirm: () => {
        resolve(true);
        closeDialog();
      },
    });
  });
};

/**
 * Close the dialog.
 */
export const closeDialog = () => {
  dialogState.update((s) => ({ ...s, show: false }));
};

/**
 * Show a confirmation dialog for batch publish.
 * @returns {Promise<boolean>} True if confirmed.
 */
export const confirmPublishBatch = () => {
  // Import dynamically to avoid circular dependency
  return import('$lib/services/contents/workflow/batch').then(({ activeBatch }) => {
    const batch = get(activeBatch);
    if (!batch) return false;

    const count = batch.entries.size;
    const title = get(_)('confirm_publish_batch', {
      default: 'Publish batch with {count} changes?',
      values: { count },
    });
    const message = get(_)(
      'confirm_publish_batch_message',
      {
        default:
          'This batch contains {count} changes. All changes will be published to the main branch and the PR will be merged.',
        values: { count },
      },
    );

    return showConfirm(title, message);
  });
};

/**
 * Show a confirmation dialog for batch delete.
 * @returns {Promise<boolean>} True if confirmed.
 */
export const confirmDeleteBatch = () => {
  // Import dynamically to avoid circular dependency
  return import('$lib/services/contents/workflow/batch').then(({ activeBatch }) => {
    const batch = get(activeBatch);
    if (!batch) return false;

    const count = batch.entries.size;
    const title = get(_)('confirm_delete_batch', {
      default: 'Delete this batch with {count} changes?',
      values: { count },
    });
    const message = get(_)(
      'confirm_delete_batch_message',
      {
        default:
          'This batch contains {count} changes. The PR will be closed without merging and the branch will be deleted.',
        values: { count },
      },
    );

    return showConfirm(title, message);
  });
};
