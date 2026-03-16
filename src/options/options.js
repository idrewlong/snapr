/**
 * options.js — Settings page controller
 *
 * Sections: Defaults, Filename, Saving, Appearance, Full-page,
 *           History, Keyboard shortcut, About
 */

'use strict';

import { buildFilename, slugify } from '../lib/filename.js';
import { getSettings, updateSettings, getHistory, removeHistoryRecord, clearHistory } from '../lib/storage.js';

const isExtension = typeof chrome !== 'undefined' && !!chrome?.runtime?.id;

// Sample context used for filename pattern preview
const PREVIEW_CTX = {
  url:    'https://shop.example.com/products/sale',
  title:  'Sale | Example Shop',
  mode:   'viewport',
  width:  1440,
  height: 900,
};

let settings = {};
let allHistory = [];
let clearConfirmPending = false;

// ── Boot ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  settings = await getSettings();

  applyTheme(settings.theme);
  hydrateAll(settings);
  await loadHistory();
  initEventListeners();
  populateAbout();
});

// ── Theme ─────────────────────────────────────────────────────────────────────

function applyTheme(theme) {
  if (theme === 'system') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.dataset.theme = theme;
  }
}

// ── Hydrate ───────────────────────────────────────────────────────────────────

function hydrateAll(s) {
  setSegControl('modeControl',   s.mode);
  setSegControl('formatControl', s.format);
  setSegControl('sizeControl',   s.sizePreset);
  setSegControl('themeControl',  s.theme);

  document.getElementById('qualityInput').value    = s.quality;
  document.getElementById('customW').value         = s.customWidth;
  document.getElementById('customH').value         = s.customHeight;
  document.getElementById('patternInput').value    = s.filenamePattern;
  document.getElementById('maxHeightSlider').value = s.maxFullPageHeight;
  document.getElementById('maxHeightValue').value  = formatPx(s.maxFullPageHeight);

  setRadio('saveLocationGroup', s.saveLocation);
  toggleCustomSizeRow(s.sizePreset);
  updateFilenamePreview(s.filenamePattern, s.format);
}

function setSegControl(id, value) {
  document.querySelectorAll(`#${id} .seg-btn`).forEach(btn => {
    btn.classList.toggle('active', btn.dataset.value === value);
  });
}

function setRadio(groupId, value) {
  document.querySelectorAll(`#${groupId} input[type="radio"]`).forEach(radio => {
    radio.checked = radio.value === value;
  });
}

function toggleCustomSizeRow(sizePreset) {
  document.getElementById('customSizeRow').classList.toggle('hidden', sizePreset !== 'Custom');
}

// ── Event listeners ───────────────────────────────────────────────────────────

function initEventListeners() {
  // Segmented controls
  bindSegControl('modeControl',   v => save({ mode: v }));
  bindSegControl('formatControl', v => {
    save({ format: v });
    updateFilenamePreview(settings.filenamePattern, v);
  });
  bindSegControl('sizeControl', v => {
    save({ sizePreset: v });
    toggleCustomSizeRow(v);
  });
  bindSegControl('themeControl', v => {
    save({ theme: v });
    applyTheme(v);
  });

  // Debounced inputs
  document.getElementById('qualityInput').addEventListener('input', debounce((e) => {
    const val = clamp(parseInt(e.target.value, 10) || 90, 1, 100);
    e.target.value = val;
    save({ quality: val });
  }, 400));

  document.getElementById('customW').addEventListener('input', debounce((e) => {
    save({ customWidth: parseInt(e.target.value, 10) || 1440 });
  }, 400));

  document.getElementById('customH').addEventListener('input', debounce((e) => {
    save({ customHeight: parseInt(e.target.value, 10) || 900 });
  }, 400));

  document.getElementById('patternInput').addEventListener('input', debounce((e) => {
    const pattern = e.target.value.trim() || '{domain}-{path}';
    save({ filenamePattern: pattern });
    updateFilenamePreview(pattern, settings.format);
  }, 400));

  // Saving radio
  document.querySelectorAll('#saveLocationGroup input[type="radio"]').forEach(radio => {
    radio.addEventListener('change', () => save({ saveLocation: radio.value }));
  });

  // Max height slider
  const slider = document.getElementById('maxHeightSlider');
  const sliderOut = document.getElementById('maxHeightValue');
  slider.addEventListener('input', () => {
    sliderOut.value = formatPx(slider.value);
  });
  slider.addEventListener('change', debounce(() => {
    save({ maxFullPageHeight: parseInt(slider.value, 10) });
  }, 300));

  // History search
  document.getElementById('historySearch').addEventListener('input', debounce((e) => {
    renderHistory(allHistory, e.target.value.trim().toLowerCase());
  }, 200));

  // Export history
  document.getElementById('exportHistoryBtn').addEventListener('click', exportHistory);

  // Clear all history
  document.getElementById('clearHistoryBtn').addEventListener('click', handleClearHistory);

  // Keyboard shortcut link
  document.getElementById('shortcutLink').addEventListener('click', (e) => {
    e.preventDefault();
    if (isExtension) {
      chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
    }
  });
}

function bindSegControl(id, onChange) {
  document.querySelectorAll(`#${id} .seg-btn`).forEach(btn => {
    btn.addEventListener('click', () => {
      setSegControl(id, btn.dataset.value);
      onChange(btn.dataset.value);
    });
  });
}

// ── Save ──────────────────────────────────────────────────────────────────────

async function save(partial) {
  Object.assign(settings, partial);
  if (isExtension) {
    await updateSettings(partial);
  } else {
    const cur = JSON.parse(localStorage.getItem('snapr_settings') || '{}');
    localStorage.setItem('snapr_settings', JSON.stringify({ ...cur, ...partial }));
  }
}

// ── Filename preview ──────────────────────────────────────────────────────────

function updateFilenamePreview(pattern, format) {
  const stem = buildFilename(pattern, PREVIEW_CTX);
  const ext  = (format || 'PNG').toLowerCase();
  document.getElementById('filenamePreview').textContent = `${stem}.${ext}`;
}

// ── History ───────────────────────────────────────────────────────────────────

async function loadHistory() {
  allHistory = isExtension
    ? await getHistory()
    : JSON.parse(localStorage.getItem('snapr_history') || '[]');
  renderHistory(allHistory, '');
}

function renderHistory(items, query) {
  const filtered = query
    ? items.filter(r => r.filename.toLowerCase().includes(query))
    : items;

  const list  = document.getElementById('historyFullList');
  const empty = document.getElementById('historyEmpty');

  list.querySelectorAll('.history-record').forEach(el => el.remove());

  if (filtered.length === 0) {
    empty.textContent = query ? 'No matches.' : 'No captures yet.';
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';

  filtered.forEach(record => {
    const row = document.createElement('div');
    row.className = 'history-record';
    row.dataset.id = record.id;
    row.innerHTML = `
      <div class="history-thumb">
        <img src="${record.thumbnail || ''}" alt="" loading="lazy">
      </div>
      <div class="history-info">
        <div class="history-name">${escHtml(record.filename)}</div>
        <div class="history-meta">${timeAgo(record.capturedAt)} · ${record.mode || ''}</div>
      </div>
      <span class="history-badge">${(record.format || 'png').toUpperCase()}</span>
      <button class="history-del-btn" title="Delete" aria-label="Delete">✕</button>`;

    row.querySelector('.history-del-btn').addEventListener('click', async () => {
      row.style.cssText = 'opacity:0;transform:translateX(8px);transition:opacity .2s,transform .2s';
      setTimeout(async () => {
        row.remove();
        allHistory = allHistory.filter(r => r.id !== record.id);
        if (isExtension) {
          await removeHistoryRecord(record.id);
        } else {
          localStorage.setItem('snapr_history', JSON.stringify(allHistory));
        }
        if (list.querySelectorAll('.history-record').length === 0) {
          empty.textContent = query ? 'No matches.' : 'No captures yet.';
          empty.style.display = 'block';
        }
      }, 220);
    });

    list.appendChild(row);
  });
}

function exportHistory() {
  if (allHistory.length === 0) {
    showToast('History is empty.', 'warning');
    return;
  }
  const exportData = allHistory.map(({ thumbnail: _thumb, ...rest }) => rest);
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `snapr-history-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast(`Exported ${exportData.length} records.`, 'success');
}

async function handleClearHistory() {
  const btn = document.getElementById('clearHistoryBtn');

  if (!clearConfirmPending) {
    clearConfirmPending = true;
    btn.textContent = 'Confirm clear';
    btn.classList.add('confirm');
    setTimeout(() => {
      clearConfirmPending = false;
      btn.textContent = 'Clear all';
      btn.classList.remove('confirm');
    }, 3000);
    return;
  }

  clearConfirmPending = false;
  btn.textContent = 'Clear all';
  btn.classList.remove('confirm');

  if (isExtension) {
    await clearHistory();
  } else {
    localStorage.removeItem('snapr_history');
  }
  allHistory = [];
  renderHistory([], '');
  showToast('History cleared.', 'success');
}

// ── About ─────────────────────────────────────────────────────────────────────

function populateAbout() {
  let version = '1.0.0';
  if (isExtension && chrome.runtime.getManifest) {
    version = chrome.runtime.getManifest().version;
  }
  document.getElementById('aboutVersion').textContent = version;
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function formatPx(n) {
  return `${Number(n).toLocaleString()} px`;
}

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr ago`;
  return `${Math.floor(h / 24)} days ago`;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Toast ─────────────────────────────────────────────────────────────────────

let _toastId = 0;

function showToast(msg, type = 'info') {
  const container = document.getElementById('toastContainer');
  const id        = ++_toastId;
  const icons     = { success: '✓', error: '⚠', warning: '!', info: 'ℹ' };

  const toast = document.createElement('div');
  toast.id        = `toast-${id}`;
  toast.className = `toast ${type !== 'info' ? type : ''}`.trim();
  toast.innerHTML = `
    <span>${icons[type] || 'ℹ'}</span>
    <span class="toast-msg">${escHtml(msg)}</span>
    <button class="toast-close" aria-label="Dismiss">✕</button>`;
  toast.querySelector('.toast-close').addEventListener('click', () => dismissToast(id));

  container.appendChild(toast);
  setTimeout(() => dismissToast(id), 5000);
}

function dismissToast(id) {
  const toast = document.getElementById(`toast-${id}`);
  if (!toast) return;
  toast.classList.add('dismissing');
  setTimeout(() => toast.remove(), 280);
}
