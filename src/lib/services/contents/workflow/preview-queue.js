import { get, writable } from 'svelte/store';

/**
 * @import { Writable } from 'svelte/store';
 */

/** LocalStorage key for preview queue state. */
const PREVIEW_QUEUE_STORAGE_KEY = 'sveltia-cms-preview-queue';

/**
 * @typedef {object} PreviewQueueEntry
 * @property {string} collection Collection name.
 * @property {string} slug Entry slug.
 * @property {number} timestamp Timestamp when preview was queued.
 * @property {string} [previewUrl] Preview URL if available.
 */

/**
 * @typedef {object} PreviewQueueState
 * @property {PreviewQueueEntry | null} activePreview Currently active preview entry.
 * @property {PreviewQueueEntry[]} history Previous previews (not currently active).
 */

/**
 * Preview queue store.
 * @type {Writable<PreviewQueueState>}
 */
export const previewQueue = writable({
  activePreview: null,
  history: [],
});

/**
 * Get the storage key for the preview queue.
 * @returns {string} Storage key.
 */
const getStorageKey = () => PREVIEW_QUEUE_STORAGE_KEY;

/**
 * Load preview queue state from localStorage.
 * @returns {PreviewQueueState | null} Stored state or null.
 */
const loadFromStorage = () => {
  try {
    const stored = localStorage.getItem(getStorageKey());

    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Ignore storage errors
  }

  return null;
};

/**
 * Save preview queue state to localStorage.
 * @param {PreviewQueueState} state State to save.
 */
const saveToStorage = (state) => {
  try {
    localStorage.setItem(getStorageKey(), JSON.stringify(state));
  } catch {
    // Ignore storage errors
  }
};

/**
 * Initialize preview queue from localStorage.
 */
export const initPreviewQueue = () => {
  const stored = loadFromStorage();

  if (stored) {
    previewQueue.set(stored);
  }
};

/**
 * Get the entry key for comparison.
 * @param {string} collection Collection name.
 * @param {string} slug Entry slug.
 * @returns {string} Entry key.
 */
const getEntryKey = (collection, slug) => `${collection}.${slug}`;

/**
 * Enqueue a preview for an entry. This makes it the active preview and moves
 * any previously active preview to history.
 * @param {string} collection Collection name.
 * @param {string} slug Entry slug.
 * @param {string} [previewUrl] Preview URL if available.
 */
export const enqueuePreview = (collection, slug, previewUrl) => {
  const currentState = get(previewQueue);

  const newEntry = {
    collection,
    slug,
    timestamp: Date.now(),
    previewUrl,
  };

  // Move current active to history if it exists and is different
  const newHistory = [...currentState.history];

  if (currentState.activePreview) {
    const currentKey = getEntryKey(
      currentState.activePreview.collection,
      currentState.activePreview.slug,
    );

    const newKey = getEntryKey(collection, slug);

    if (currentKey !== newKey) {
      // Add to history, keeping max 10 entries
      newHistory.unshift(currentState.activePreview);

      if (newHistory.length > 10) {
        newHistory.pop();
      }
    }
  }

  // Remove the new entry from history if it was there
  const filteredHistory = newHistory.filter(
    (entry) => getEntryKey(entry.collection, entry.slug) !== getEntryKey(collection, slug),
  );

  const newState = {
    activePreview: newEntry,
    history: filteredHistory,
  };

  previewQueue.set(newState);
  saveToStorage(newState);
};

/**
 * Get the currently active preview entry.
 * @returns {PreviewQueueEntry | null} Active preview or null.
 */
export const getActivePreview = () => get(previewQueue).activePreview;

/**
 * Check if a specific entry is the currently active preview.
 * @param {string} collection Collection name.
 * @param {string} slug Entry slug.
 * @returns {boolean} Whether this entry is the active preview.
 */
export const isActivePreview = (collection, slug) => {
  const active = get(previewQueue).activePreview;

  if (!active) {
    return false;
  }

  return active.collection === collection && active.slug === slug;
};

/**
 * Update the preview URL for the active preview.
 * @param {string} collection Collection name.
 * @param {string} slug Entry slug.
 * @param {string} previewUrl Preview URL.
 */
export const updateActivePreviewUrl = (collection, slug, previewUrl) => {
  const currentState = get(previewQueue);

  if (
    currentState.activePreview &&
    currentState.activePreview.collection === collection &&
    currentState.activePreview.slug === slug
  ) {
    const newState = {
      ...currentState,
      activePreview: {
        ...currentState.activePreview,
        previewUrl,
      },
    };

    previewQueue.set(newState);
    saveToStorage(newState);
  }
};

/**
 * Invalidate all previous previews (clear history).
 * The active preview remains active.
 */
export const invalidatePreviousPreviews = () => {
  const currentState = get(previewQueue);

  const newState = {
    ...currentState,
    history: [],
  };

  previewQueue.set(newState);
  saveToStorage(newState);
};

/**
 * Clear the active preview (e.g., when it's published or deleted).
 * @param {string} collection Collection name.
 * @param {string} slug Entry slug.
 */
export const clearActivePreview = (collection, slug) => {
  const currentState = get(previewQueue);

  if (
    currentState.activePreview &&
    currentState.activePreview.collection === collection &&
    currentState.activePreview.slug === slug
  ) {
    const newState = {
      activePreview: null,
      history: currentState.history,
    };

    previewQueue.set(newState);
    saveToStorage(newState);
  }
};

/**
 * Clear all preview queue state.
 */
export const clearPreviewQueue = () => {
  const newState = {
    activePreview: null,
    history: [],
  };

  previewQueue.set(newState);
  saveToStorage(newState);
};

/**
 * Check if an entry has a preview in history (was previously built but superseded).
 * @param {string} collection Collection name.
 * @param {string} slug Entry slug.
 * @returns {boolean} Whether entry is in history.
 */
export const isInPreviewHistory = (collection, slug) => {
  const { history } = get(previewQueue);

  return history.some((entry) => entry.collection === collection && entry.slug === slug);
};
