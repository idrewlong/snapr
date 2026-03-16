/**
 * storage.js — chrome.storage wrapper
 *
 * Provides typed read/write access to sync (settings) and local (history) storage.
 * All reads merge against DEFAULT_SETTINGS so callers always get a complete object.
 *
 * Write rate limit: chrome.storage.sync allows 120 writes/min.
 * Callers that write on every keystroke should debounce before calling updateSettings().
 */

import { DEFAULT_SETTINGS, HISTORY_MAX_ITEMS } from './constants.js';

// ── Settings (synced across devices) ─────────────────────────────────────────

export async function getSettings() {
  const stored = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  return { ...DEFAULT_SETTINGS, ...stored };
}

export async function updateSettings(partial) {
  await chrome.storage.sync.set(partial);
}


// ── History (local only — larger quota) ──────────────────────────────────────

export async function getHistory() {
  const { history = [] } = await chrome.storage.local.get({ history: [] });
  return history;
}

/**
 * Prepends a new CaptureRecord to history, evicting the oldest if over the cap.
 * @param {CaptureRecord} record
 */
export async function addHistoryRecord(record) {
  const history = await getHistory();
  const updated = [record, ...history].slice(0, HISTORY_MAX_ITEMS);
  await chrome.storage.local.set({ history: updated });
}

export async function removeHistoryRecord(id) {
  const history = await getHistory();
  await chrome.storage.local.set({ history: history.filter(r => r.id !== id) });
}

export async function clearHistory() {
  await chrome.storage.local.set({ history: [] });
}

/**
 * @typedef {Object} CaptureRecord
 * @property {string} id           - crypto.randomUUID()
 * @property {string} url          - Page URL at capture time
 * @property {string} filename     - Downloaded filename
 * @property {string} format       - 'png' | 'jpg' | 'webp'
 * @property {string} mode         - 'viewport' | 'fullpage' | 'element'
 * @property {number} width        - Captured width in CSS px
 * @property {number} height       - Captured height in CSS px
 * @property {string} thumbnail    - Base64 data URL (~200px wide)
 * @property {string} capturedAt   - ISO 8601 timestamp
 * @property {Object} settings     - Copy of settings used for this capture
 */
