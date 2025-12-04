// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import {
  clearActivePreview,
  clearPreviewQueue,
  enqueuePreview,
  getActivePreview,
  initPreviewQueue,
  invalidatePreviousPreviews,
  isActivePreview,
  isInPreviewHistory,
  previewQueue,
  updateActivePreviewUrl,
} from './preview-queue';

describe('preview-queue', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    // Reset queue state
    clearPreviewQueue();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('enqueuePreview', () => {
    test('sets entry as active preview when queue is empty', () => {
      enqueuePreview('posts', 'my-article');

      const active = getActivePreview();

      expect(active).not.toBeNull();
      expect(active?.collection).toBe('posts');
      expect(active?.slug).toBe('my-article');
      expect(active?.timestamp).toBeGreaterThan(0);
    });

    test('moves previous active to history when new preview is enqueued', () => {
      enqueuePreview('posts', 'article-1');
      enqueuePreview('posts', 'article-2');

      const active = getActivePreview();

      expect(active?.slug).toBe('article-2');
      expect(isInPreviewHistory('posts', 'article-1')).toBe(true);
    });

    test('does not duplicate entry in history when same entry is re-enqueued', () => {
      enqueuePreview('posts', 'article-1');
      enqueuePreview('posts', 'article-2');
      enqueuePreview('posts', 'article-1');

      const active = getActivePreview();

      expect(active?.slug).toBe('article-1');
      expect(isInPreviewHistory('posts', 'article-1')).toBe(false);
      expect(isInPreviewHistory('posts', 'article-2')).toBe(true);
    });

    test('stores preview URL when provided', () => {
      enqueuePreview('posts', 'my-article', 'https://preview.example.com');

      const active = getActivePreview();

      expect(active?.previewUrl).toBe('https://preview.example.com');
    });

    test('limits history to 10 entries', () => {
      for (let i = 0; i < 12; i += 1) {
        enqueuePreview('posts', `article-${i}`);
      }

      let historyCount = 0;

      previewQueue.subscribe((state) => {
        historyCount = state.history.length;
      })();

      expect(historyCount).toBeLessThanOrEqual(10);
    });

    test('persists state to localStorage', () => {
      enqueuePreview('posts', 'my-article');

      const stored = localStorage.getItem('sveltia-cms-preview-queue');

      expect(stored).not.toBeNull();

      const parsed = JSON.parse(stored ?? '');

      expect(parsed.activePreview.slug).toBe('my-article');
    });
  });

  describe('isActivePreview', () => {
    test('returns true for active preview entry', () => {
      enqueuePreview('posts', 'my-article');

      expect(isActivePreview('posts', 'my-article')).toBe(true);
    });

    test('returns false for non-active entry', () => {
      enqueuePreview('posts', 'article-1');
      enqueuePreview('posts', 'article-2');

      expect(isActivePreview('posts', 'article-1')).toBe(false);
      expect(isActivePreview('posts', 'article-2')).toBe(true);
    });

    test('returns false when queue is empty', () => {
      expect(isActivePreview('posts', 'my-article')).toBe(false);
    });
  });

  describe('updateActivePreviewUrl', () => {
    test('updates preview URL for active entry', () => {
      enqueuePreview('posts', 'my-article');
      updateActivePreviewUrl('posts', 'my-article', 'https://new-url.example.com');

      const active = getActivePreview();

      expect(active?.previewUrl).toBe('https://new-url.example.com');
    });

    test('does not update URL for non-active entry', () => {
      enqueuePreview('posts', 'article-1');
      enqueuePreview('posts', 'article-2');
      updateActivePreviewUrl('posts', 'article-1', 'https://should-not-update.com');

      const active = getActivePreview();

      expect(active?.slug).toBe('article-2');
      expect(active?.previewUrl).toBeUndefined();
    });
  });

  describe('clearActivePreview', () => {
    test('clears active preview when matching', () => {
      enqueuePreview('posts', 'my-article');
      clearActivePreview('posts', 'my-article');

      expect(getActivePreview()).toBeNull();
    });

    test('does not clear active preview when not matching', () => {
      enqueuePreview('posts', 'article-1');
      clearActivePreview('posts', 'article-2');

      expect(getActivePreview()?.slug).toBe('article-1');
    });

    test('preserves history when clearing active', () => {
      enqueuePreview('posts', 'article-1');
      enqueuePreview('posts', 'article-2');
      clearActivePreview('posts', 'article-2');

      expect(isInPreviewHistory('posts', 'article-1')).toBe(true);
    });
  });

  describe('invalidatePreviousPreviews', () => {
    test('clears history but keeps active preview', () => {
      enqueuePreview('posts', 'article-1');
      enqueuePreview('posts', 'article-2');
      enqueuePreview('posts', 'article-3');

      invalidatePreviousPreviews();

      expect(getActivePreview()?.slug).toBe('article-3');
      expect(isInPreviewHistory('posts', 'article-1')).toBe(false);
      expect(isInPreviewHistory('posts', 'article-2')).toBe(false);
    });
  });

  describe('initPreviewQueue', () => {
    test('restores state from localStorage', () => {
      const storedState = {
        activePreview: {
          collection: 'posts',
          slug: 'restored-article',
          timestamp: Date.now(),
        },
        history: [],
      };

      localStorage.setItem('sveltia-cms-preview-queue', JSON.stringify(storedState));

      initPreviewQueue();

      expect(getActivePreview()?.slug).toBe('restored-article');
    });

    test('handles missing localStorage gracefully', () => {
      initPreviewQueue();

      expect(getActivePreview()).toBeNull();
    });

    test('handles corrupted localStorage gracefully', () => {
      localStorage.setItem('sveltia-cms-preview-queue', 'invalid-json');

      initPreviewQueue();

      expect(getActivePreview()).toBeNull();
    });
  });

  describe('clearPreviewQueue', () => {
    test('clears both active and history', () => {
      enqueuePreview('posts', 'article-1');
      enqueuePreview('posts', 'article-2');

      clearPreviewQueue();

      expect(getActivePreview()).toBeNull();
      expect(isInPreviewHistory('posts', 'article-1')).toBe(false);
    });
  });
});
