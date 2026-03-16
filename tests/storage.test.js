/**
 * tests/storage.test.js
 * Unit tests for src/lib/storage.js
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  getSettings,
  updateSettings,
  getHistory,
  addHistoryRecord,
  removeHistoryRecord,
  clearHistory,
} from '../src/lib/storage.js';
import { DEFAULT_SETTINGS, HISTORY_MAX_ITEMS } from '../src/lib/constants.js';

// ── getSettings ────────────────────────────────────────────────────────────────

describe('getSettings', () => {
  it('returns default settings when storage is empty', async () => {
    const settings = await getSettings();
    expect(settings).toMatchObject(DEFAULT_SETTINGS);
  });

  it('merges stored values over defaults', async () => {
    chrome.storage.sync.set({ format: 'WebP', quality: 75 });
    const settings = await getSettings();
    expect(settings.format).toBe('WebP');
    expect(settings.quality).toBe(75);
    // Unset keys still use defaults
    expect(settings.mode).toBe(DEFAULT_SETTINGS.mode);
  });

  it('returns all expected keys', async () => {
    const settings = await getSettings();
    const expectedKeys = Object.keys(DEFAULT_SETTINGS);
    expectedKeys.forEach(key => expect(settings).toHaveProperty(key));
  });

  it('does not mutate DEFAULT_SETTINGS', async () => {
    const original = { ...DEFAULT_SETTINGS };
    await getSettings();
    expect(DEFAULT_SETTINGS).toEqual(original);
  });
});

// ── updateSettings ─────────────────────────────────────────────────────────────

describe('updateSettings', () => {
  it('persists a partial update', async () => {
    await updateSettings({ format: 'JPG' });
    expect(chrome.storage.sync.set).toHaveBeenCalledWith({ format: 'JPG' });
  });

  it('can update multiple keys at once', async () => {
    await updateSettings({ format: 'WebP', quality: 80 });
    expect(chrome.storage.sync.set).toHaveBeenCalledWith({ format: 'WebP', quality: 80 });
  });

  it('stored value is visible via getSettings', async () => {
    await updateSettings({ maxFullPageHeight: 20000 });
    const settings = await getSettings();
    expect(settings.maxFullPageHeight).toBe(20000);
  });
});

// ── getHistory ─────────────────────────────────────────────────────────────────

describe('getHistory', () => {
  it('returns an empty array when no history exists', async () => {
    const history = await getHistory();
    expect(history).toEqual([]);
  });

  it('returns stored history array', async () => {
    const record = { id: '1', filename: 'test.png', capturedAt: new Date().toISOString() };
    await chrome.storage.local.set({ history: [record] });
    const history = await getHistory();
    expect(history).toHaveLength(1);
    expect(history[0].id).toBe('1');
  });
});

// ── addHistoryRecord ───────────────────────────────────────────────────────────

describe('addHistoryRecord', () => {
  const makeRecord = (id) => ({
    id,
    url:        'https://example.com',
    filename:   `${id}.png`,
    format:     'png',
    mode:       'viewport',
    width:      1440,
    height:     900,
    thumbnail:  'data:image/jpeg;base64,/9j/',
    capturedAt: new Date().toISOString(),
    settings:   {},
  });

  it('prepends a record to history', async () => {
    await addHistoryRecord(makeRecord('first'));
    await addHistoryRecord(makeRecord('second'));
    const history = await getHistory();
    expect(history[0].id).toBe('second'); // most recent first
    expect(history[1].id).toBe('first');
  });

  it('does not exceed HISTORY_MAX_ITEMS', async () => {
    for (let i = 0; i < HISTORY_MAX_ITEMS + 5; i++) {
      await addHistoryRecord(makeRecord(String(i)));
    }
    const history = await getHistory();
    expect(history).toHaveLength(HISTORY_MAX_ITEMS);
  });

  it('evicts the oldest record when at capacity', async () => {
    for (let i = 0; i < HISTORY_MAX_ITEMS; i++) {
      await addHistoryRecord(makeRecord(`old-${i}`));
    }
    await addHistoryRecord(makeRecord('newest'));
    const history = await getHistory();
    expect(history[0].id).toBe('newest');
    expect(history).toHaveLength(HISTORY_MAX_ITEMS);
    // The oldest record should be gone
    expect(history.find(r => r.id === 'old-0')).toBeUndefined();
  });
});

// ── removeHistoryRecord ────────────────────────────────────────────────────────

describe('removeHistoryRecord', () => {
  it('removes a record by id', async () => {
    await chrome.storage.local.set({
      history: [
        { id: 'a', filename: 'a.png' },
        { id: 'b', filename: 'b.png' },
        { id: 'c', filename: 'c.png' },
      ],
    });
    await removeHistoryRecord('b');
    const history = await getHistory();
    expect(history).toHaveLength(2);
    expect(history.find(r => r.id === 'b')).toBeUndefined();
  });

  it('is a no-op for a non-existent id', async () => {
    await chrome.storage.local.set({ history: [{ id: 'x', filename: 'x.png' }] });
    await removeHistoryRecord('does-not-exist');
    const history = await getHistory();
    expect(history).toHaveLength(1);
  });

  it('handles empty history gracefully', async () => {
    await expect(removeHistoryRecord('any')).resolves.toBeUndefined();
  });
});

// ── clearHistory ───────────────────────────────────────────────────────────────

describe('clearHistory', () => {
  it('empties the history array', async () => {
    await chrome.storage.local.set({
      history: [{ id: '1' }, { id: '2' }],
    });
    await clearHistory();
    const history = await getHistory();
    expect(history).toEqual([]);
  });

  it('is idempotent on already-empty history', async () => {
    await clearHistory();
    await clearHistory();
    const history = await getHistory();
    expect(history).toEqual([]);
  });
});
