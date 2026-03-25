/**
 * popup.js — Snapr popup controller
 *
 * NOTE: MV3 extension pages block inline onclick= handlers via CSP.
 * ALL event binding is done via addEventListener in initEventListeners().
 *
 * Capture is handled directly here (no service worker roundtrip) using:
 *   chrome.tabs.captureVisibleTab  → get image
 *   chrome.downloads.download      → save with file dialog
 *
 * Chrome API calls are shimmed when chrome.runtime.id is absent so this
 * file works identically in popup-preview.html (plain browser tab).
 */

'use strict';

import { buildFilename } from '../lib/filename.js';
import { capture as captureViewport } from '../background/capture-viewport.js';
import { imageToPdfDataUrl } from '../lib/pdf.js';

// ── Environment detection ─────────────────────────────────────────────────────

const isExtension = typeof chrome !== 'undefined' && !!chrome?.runtime?.id;

// ── Storage shim ──────────────────────────────────────────────────────────────

const storage = {
  async get(defaults) {
    if (isExtension) return chrome.storage.sync.get(defaults);
    return { ...defaults, ...JSON.parse(localStorage.getItem('snapr_settings') || '{}') };
  },
  async set(data) {
    if (isExtension) return chrome.storage.sync.set(data);
    const cur = JSON.parse(localStorage.getItem('snapr_settings') || '{}');
    localStorage.setItem('snapr_settings', JSON.stringify({ ...cur, ...data }));
  },
};

const historyStore = {
  async get() {
    if (isExtension) {
      const { history: h } = await chrome.storage.local.get({ history: [] });
      return h;
    }
    return JSON.parse(localStorage.getItem('snapr_history') || '[]');
  },
  async set(items) {
    if (isExtension) return chrome.storage.local.set({ history: items });
    localStorage.setItem('snapr_history', JSON.stringify(items));
  },
};

// ── Defaults ──────────────────────────────────────────────────────────────────

const DEFAULTS = {
  format:          'PNG',
  quality:         90,
  mode:            'viewport',
  sizePreset:      'As-is',
  customWidth:     1440,
  customHeight:    900,
  filenamePattern: '{domain}-{path}',
};

const SIZE_PRESETS = {
  'Desktop HD': { w: 1920, h: 1080 },
  'Desktop':    { w: 1440, h: 900  },
  'Laptop':     { w: 1280, h: 800  },
  'Tablet':     { w: 768,  h: 1024 },
  'Mobile':     { w: 375,  h: 812  },
};

// ── State ─────────────────────────────────────────────────────────────────────

let state           = { ...DEFAULTS };
let currentTab      = null;  // active tab info, queried at boot
let captureState    = 'idle'; // 'idle' | 'loading' | 'success' | 'error'
let filenameEditing = false;
let historyOpen     = false;
let pendingCapture  = null;  // set when popup reopens after element selection

// ── Boot ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  const saved = await storage.get(DEFAULTS);
  state = { ...DEFAULTS, ...saved };

  if (isExtension) {
    try {
      [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    } catch { /* ignore */ }
  }

  // Apply manually-set theme (overrides prefers-color-scheme)
  const { theme = 'system' } = await storage.get({ theme: 'system' });
  if (theme !== 'system') document.documentElement.dataset.theme = theme;
  updateThemeBtn(theme);

  renderAll();
  initEventListeners();

  // Check if we're reopening after an element capture
  const pending = await getPendingCapture();
  if (pending) {
    enterElementConfirmMode(pending);
  } else {
    loadThumbnail();
    loadHistory();
    if (isExtension) {
    checkForRestrictedPage();
    checkPageLoadingState();
  }
  }
});

async function checkForRestrictedPage() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;
    const url = tab.url || '';
    const restricted =
      url.startsWith('chrome://') ||
      url.startsWith('chrome-extension://') ||
      url.startsWith('edge://') ||
      url.startsWith('about:') ||
      url.includes('chrome.google.com/webstore');
    if (restricted) {
      const btn = document.getElementById('captureBtn');
      btn.disabled = true;
      btn.dataset.tooltip = "Screenshots aren't available on browser internal pages.";
      document.querySelectorAll('.mode-btn').forEach(b => b.disabled = true);
    }
  } catch { /* silently ignore — tab info unavailable */ }
}

async function checkPageLoadingState() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || tab.status !== 'loading') return;

    const btn  = document.getElementById('captureBtn');
    const text = document.getElementById('btnText');
    btn.disabled     = true;
    text.textContent = 'Loading…';

    const listener = (tabId, changeInfo) => {
      if (tabId !== tab.id || changeInfo.status !== 'complete') return;
      chrome.tabs.onUpdated.removeListener(listener);
      btn.disabled     = false;
      text.textContent = 'Capture';
    };
    chrome.tabs.onUpdated.addListener(listener);
  } catch { /* silently ignore — tab info unavailable */ }
}

// ── Event listeners (no inline onclick allowed in MV3) ────────────────────────

function initEventListeners() {
  // Mode buttons
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => setMode(btn.dataset.mode));
  });

  // Size dropdown
  document.getElementById('sizeTrigger').addEventListener('click', (e) => {
    e.stopPropagation();
    toggleSelect('sizeSelect');
  });
  document.querySelectorAll('#sizeMenu .flat-select-option').forEach(opt => {
    opt.addEventListener('click', () => selectSize(opt.dataset.value));
  });

  // Format dropdown
  document.getElementById('formatTrigger').addEventListener('click', (e) => {
    e.stopPropagation();
    toggleSelect('formatSelect');
  });
  document.querySelectorAll('#formatMenu .flat-select-option').forEach(opt => {
    opt.addEventListener('click', () => selectFormat(opt.dataset.value));
  });

  // Close dropdowns on outside click
  document.addEventListener('click', () => {
    document.querySelectorAll('.flat-select.open')
      .forEach(s => s.classList.remove('open'));
  });

  // Quality
  document.getElementById('qualityInput').addEventListener('change', (e) => {
    const val = Math.min(100, Math.max(1, parseInt(e.target.value, 10) || 90));
    e.target.value = val;
    state.quality = val;
    storage.set({ quality: val });
  });

  // Custom size
  document.getElementById('customW').addEventListener('change', (e) => {
    state.customWidth = parseInt(e.target.value, 10);
    storage.set({ customWidth: state.customWidth });
    updateSizeBadge();
  });
  document.getElementById('customH').addEventListener('change', (e) => {
    state.customHeight = parseInt(e.target.value, 10);
    storage.set({ customHeight: state.customHeight });
    updateSizeBadge();
  });

  // Capture
  document.getElementById('captureBtn').addEventListener('click', doCapture);

  // Enter key triggers capture
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !filenameEditing) doCapture();
  });

  // Filename edit
  document.getElementById('editLink').addEventListener('click', toggleFilenameEdit);
  document.getElementById('filenameInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') toggleFilenameEdit();
  });

  // History
  document.getElementById('historyBtn').addEventListener('click', toggleHistory);
  document.getElementById('historyToggleBtn').addEventListener('click', toggleHistory);

  // Theme toggle
  document.getElementById('themeBtn').addEventListener('click', cycleTheme);

  // Settings
  document.getElementById('settingsBtn').addEventListener('click', () => {
    if (isExtension) chrome.runtime.openOptionsPage();
  });

  // History view all
  document.getElementById('historyViewAll').addEventListener('click', (e) => {
    e.preventDefault();
    if (isExtension) chrome.runtime.openOptionsPage();
  });
}

// ── Render ────────────────────────────────────────────────────────────────────

function renderAll() {
  setMode(state.mode, false);
  selectSize(state.sizePreset, false);
  selectFormat(state.format, false);
  document.getElementById('qualityInput').value   = state.quality;
  document.getElementById('customW').value        = state.customWidth;
  document.getElementById('customH').value        = state.customHeight;
  updateFilename();
}

// ── Thumbnail ─────────────────────────────────────────────────────────────────

async function loadThumbnail() {
  try {
    let dataUrl;
    if (isExtension) {
      dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'jpeg', quality: 60 });
    } else {
      // Preview placeholder
      dataUrl = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='500'%3E%3Crect width='800' height='500' fill='%23f0f4f8'/%3E%3Crect x='0' y='0' width='800' height='42' fill='%23e2e8f0'/%3E%3Ccircle cx='18' cy='21' r='6' fill='%23FC5A57'/%3E%3Ccircle cx='34' cy='21' r='6' fill='%23FDBC2C'/%3E%3Ccircle cx='50' cy='21' r='6' fill='%2328C840'/%3E%3Crect x='80' y='12' width='500' height='18' rx='9' fill='%23fff' opacity='.7'/%3E%3Crect x='20' y='80' width='760' height='20' rx='4' fill='%23cbd5e1' opacity='.6'/%3E%3Crect x='20' y='160' width='360' height='160' rx='8' fill='%23dbeafe' opacity='.7'/%3E%3Crect x='400' y='160' width='380' height='160' rx='8' fill='%23e2e8f0' opacity='.6'/%3E%3C/svg%3E";
    }
    const img = document.getElementById('thumbnailImg');
    img.src = dataUrl;
    img.style.display = 'block';
    document.getElementById('skeleton').classList.add('hidden');
  } catch {
    document.getElementById('skeleton').classList.add('hidden');
  }
}

// ── Element confirm mode ──────────────────────────────────────────────────────

async function getPendingCapture() {
  if (!isExtension) return null;
  const { pendingCapture } = await chrome.storage.local.get({ pendingCapture: null });
  return pendingCapture || null;
}

function enterElementConfirmMode(pending) {
  // Show the cropped element as the preview thumbnail
  const img = document.getElementById('thumbnailImg');
  img.src = pending.dataUrl;
  img.style.display = 'block';
  img.style.objectFit = 'contain';       // don't crop the element preview
  img.style.background = 'var(--bg-secondary)';
  document.getElementById('skeleton').classList.add('hidden');

  // Mark Selected Area as active mode (lock other modes during confirm)
  state.mode = 'region';
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === 'region');
    if (btn.dataset.mode !== 'region') btn.disabled = true;
  });

  // Show a confirm banner below the thumbnail
  const banner = document.createElement('div');
  banner.id = 'confirmBanner';
  banner.innerHTML = `
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <rect x="1" y="1" width="10" height="10" rx="1" stroke="currentColor" stroke-width="1.3" stroke-dasharray="2.5 1.5"/>
    </svg>
    Area selected — adjust settings and capture
    <button id="discardBtn">✕ discard</button>`;

  const body = document.querySelector('.body');
  body.insertBefore(banner, body.children[1]); // after thumbnail

  document.getElementById('discardBtn').addEventListener('click', discardPendingCapture);

  updateFilename();
  loadHistory();

  // Store reference for doCapture to use
  pendingCapture = pending;
}

async function discardPendingCapture() {
  pendingCapture = null;
  if (isExtension) await chrome.storage.local.remove('pendingCapture');
  window.close();
}

// ── Mode ──────────────────────────────────────────────────────────────────────

async function setMode(mode, persist = true) {
  if (mode === 'region') {
    if (isExtension) {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        // Pre-capture the viewport NOW while we have user-gesture / activeTab context.
        // The service worker receives REGION_SELECTED in a message handler, which
        // does NOT carry the user gesture needed for captureVisibleTab in MV3.
        try {
          const screenshotDataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png' });
          await chrome.storage.local.set({ pendingScreenshot: screenshotDataUrl });
        } catch {
          // Non-fatal — service worker will attempt its own capture as fallback.
        }

        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files:  ['src/content/region-picker.js'],
        });
        window.close();
      } catch (err) {
        showToast("Can't inject picker on this page.", 'error');
      }
    } else {
      showToast('Selected Area mode: closes popup, drag to select a region.', 'info');
    }
    return;
  }

  state.mode = mode;
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });

  updateFilename();
  if (persist) storage.set({ mode });
}

// ── Size ──────────────────────────────────────────────────────────────────────

function selectSize(label, persist = true) {
  state.sizePreset = label;
  document.getElementById('sizeLabel').textContent = label;
  document.querySelectorAll('#sizeMenu .flat-select-option').forEach(o => {
    o.classList.toggle('selected', o.dataset.value === label);
  });
  document.getElementById('sizeSelect').classList.remove('open');

  const customRow = document.getElementById('customSizeRow');
  customRow.classList.toggle('visible', label === 'Custom');
  updateSizeBadge();
  if (persist) storage.set({ sizePreset: label });
}

function updateSizeBadge() {
  const badge  = document.getElementById('sizeBadge');
  const label  = state.sizePreset;
  const preset = SIZE_PRESETS[label];

  if (state.mode !== 'viewport' || label === 'As-is') {
    badge.classList.remove('visible');
  } else if (label === 'Custom') {
    badge.textContent = `${state.customWidth}×${state.customHeight}`;
    badge.classList.add('visible');
  } else if (preset) {
    badge.textContent = `${preset.w}×${preset.h}`;
    badge.classList.add('visible');
  }
}

// ── Format ────────────────────────────────────────────────────────────────────

function selectFormat(fmt, persist = true) {
  state.format = fmt;
  document.getElementById('formatLabel').textContent = fmt;
  document.querySelectorAll('#formatMenu .flat-select-option').forEach(o => {
    o.classList.toggle('selected', o.dataset.value === fmt);
  });
  document.getElementById('formatSelect').classList.remove('open');
  document.getElementById('qualityInput').disabled = (fmt === 'PNG' || fmt === 'PDF');
  updateFilename();
  if (persist) storage.set({ format: fmt });
}

// ── Dropdowns ─────────────────────────────────────────────────────────────────

function toggleSelect(id) {
  const sel    = document.getElementById(id);
  const isOpen = sel.classList.contains('open');
  document.querySelectorAll('.flat-select.open').forEach(s => s.classList.remove('open'));
  if (!isOpen) sel.classList.add('open');
}

// ── Filename ──────────────────────────────────────────────────────────────────

function generateFilename() {
  const ext   = state.format.toLowerCase();
  const url   = pendingCapture?.sourceUrl   ?? currentTab?.url   ?? '';
  const title = pendingCapture?.sourceTitle ?? currentTab?.title ?? '';
  const stem  = buildFilename(state.filenamePattern || '{domain}-{path}', {
    url, title, mode: state.mode,
  });
  return `${stem}.${ext}`;
}

function updateFilename() {
  const name = generateFilename();
  document.getElementById('filenameText').textContent = name;
  document.getElementById('filenameInput').value = name;
}

function toggleFilenameEdit() {
  filenameEditing = !filenameEditing;
  const text  = document.getElementById('filenameText');
  const input = document.getElementById('filenameInput');
  const link  = document.getElementById('editLink');

  text.classList.toggle('hidden', filenameEditing);
  input.classList.toggle('visible', filenameEditing);
  link.textContent = filenameEditing ? 'done' : 'edit';

  if (filenameEditing) {
    input.focus();
    input.select();
  } else {
    text.textContent = input.value || generateFilename();
  }
}

// ── Capture ───────────────────────────────────────────────────────────────────

async function doCapture() {
  if (captureState !== 'idle') return;

  captureState = 'loading';

  const btn  = document.getElementById('captureBtn');
  const icon = document.getElementById('btnIcon');
  const text = document.getElementById('btnText');

  btn.disabled = true;
  btn.classList.add('loading');
  icon.innerHTML = '<div class="spinner"></div>';
  text.textContent = 'Capturing…';

  try {
    if (!isExtension) {
      await new Promise((res, rej) =>
        setTimeout(() => Math.random() > 0.2 ? res() : rej(new Error('Simulated error')), 1000)
      );
      setCaptureSuccess(btn, icon, text);
      showToast('Preview: capture simulated.', 'success');
    } else {
      const filename = document.getElementById('filenameText').textContent;
      const dataUrl  = pendingCapture
        ? await convertPending(pendingCapture.dataUrl)
        : state.mode === 'fullpage'
          ? await captureFullPage()
          : await captureViewport(currentTab.id, {
              format:     state.format,
              quality:    state.quality,
              sizePreset: 'As-is',
            });
      _lastCaptureDataUrl = dataUrl;
      const finalDataUrl = state.format === 'PDF'
        ? await imageToPdfDataUrl(dataUrl, state.quality)
        : dataUrl;
      const blobUrl  = dataUrlToBlobUrl(finalDataUrl);

      await chrome.downloads.download({ url: blobUrl, filename, saveAs: true });
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);

      await saveToHistory(filename, dataUrl);
      if (pendingCapture) {
        pendingCapture = null;
        await chrome.storage.local.remove('pendingCapture');
      }
      setCaptureSuccess(btn, icon, text);
      showToast(`Saved as ${filename}`, 'success');
    }
  } catch (err) {
    captureState = 'error';
    btn.disabled = false;
    btn.classList.remove('loading');
    btn.classList.add('error');
    icon.innerHTML = svgX();
    text.textContent = 'Failed';

    const msg = err.message || '';
    if (msg === 'CONTENT_SCRIPT_BLOCKED') {
      showToast('This page blocks content scripts. Viewport capture still works.', 'error');
      // Disable modes that require content script injection
      document.querySelectorAll('.mode-btn[data-mode="fullpage"], .mode-btn[data-mode="element"]')
        .forEach(b => b.disabled = true);
      if (state.mode !== 'viewport') setMode('viewport');
    } else if (msg.includes('DOWNLOADS_') || msg.includes('disk') || msg.includes('permission')) {
      showToast(`Download failed: ${msg}. Copying image to clipboard instead.`, 'error');
      copyLastCaptureToClipboard();
    } else {
      showToast(msg || 'Capture failed.', 'error');
    }
  }

  setTimeout(() => resetCaptureBtn(btn, icon, text), 1800);
}

// Re-encode the stored PNG to the user's chosen format/quality
async function convertPending(dataUrl) {
  if (state.format === 'PNG' || state.format === 'PDF') return dataUrl;
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width  = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext('2d').drawImage(img, 0, 0);
      const mime = state.format === 'WebP' ? 'image/webp' : 'image/jpeg';
      resolve(canvas.toDataURL(mime, state.quality / 100));
    };
    img.src = dataUrl;
  });
}

// ── Full-page scroll-stitch ───────────────────────────────────────────────────

async function captureFullPage() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const MAX_HEIGHT = 15000;

  // 1. Get page dimensions
  const [{ result: dims }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => ({
      // Use Math.max to handle pages where <html> (not <body>) is the scroller.
      // On those pages document.body.scrollHeight equals window.innerHeight,
      // making totalHeight = 0 and producing a degenerate "data:," canvas URL.
      scrollHeight:      Math.max(document.body.scrollHeight, document.documentElement.scrollHeight),
      viewportHeight:    window.innerHeight,
      viewportWidth:     window.innerWidth,
      devicePixelRatio:  window.devicePixelRatio,
      originalScroll:    window.scrollY,
    }),
  });

  const totalHeight = Math.min(dims.scrollHeight, MAX_HEIGHT);
  if (dims.scrollHeight > MAX_HEIGHT) showToast(`Page was taller than ${MAX_HEIGHT}px — screenshot capped. Adjust in Settings.`, 'warning');

  // 2. Hide fixed/sticky elements (visibility:hidden has zero layout impact —
  //    position:relative would insert them into the flow and ghost them mid-page)
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      window.__snaprFixed = [];
      document.querySelectorAll('*').forEach(el => {
        const pos = getComputedStyle(el).position;
        if (pos === 'fixed' || pos === 'sticky') {
          window.__snaprFixed.push({ el, orig: el.style.visibility });
          el.style.setProperty('visibility', 'hidden', 'important');
        }
      });
    },
  });

  // 3. Scroll + capture loop
  const frames  = [];
  let offsetY   = 0;
  let prevActualY = -1;

  while (offsetY < totalHeight) {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (y) => window.scrollTo(0, y),
      args: [offsetY],
    });
    await new Promise(r => setTimeout(r, 200)); // wait for paint

    // Read back the real scroll position — the browser caps scroll at
    // (scrollHeight - viewportHeight), so the last frame may land higher
    // than requested. Using the actual Y prevents duplicate content overlap.
    const [{ result: actualY }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.scrollY,
    });

    const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'jpeg', quality: 92 });
    frames.push({ dataUrl, offsetY: actualY });

    // No scroll progress means we're at the bottom — stop to avoid inf-loop
    if (actualY === prevActualY) break;
    prevActualY = actualY;
    offsetY += dims.viewportHeight;
  }

  // 4. Restore and scroll back
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (origY) => {
      (window.__snaprFixed || []).forEach(({ el, orig }) => el.style.visibility = orig);
      window.scrollTo(0, origY);
    },
    args: [dims.originalScroll],
  });

  // 5. Composite all frames onto a single canvas in the popup
  return compositeFrames(frames, dims.viewportWidth, totalHeight, dims.devicePixelRatio);
}

async function compositeFrames(frames, cssWidth, cssHeight, dpr = 1) {
  // Canvas is in CSS pixels. Using device pixels (cssWidth * dpr) for the canvas
  // size risks exceeding the GPU's maximum texture dimension (~16 384 px), which
  // causes toDataURL() to silently return "data:," on long pages / retina displays.
  // captureVisibleTab frames are still drawn from their full device-pixel source,
  // so image quality is preserved — only the output canvas is at CSS-pixel scale.
  const canvasW = Math.round(cssWidth);
  const canvasH = Math.round(cssHeight);

  const canvas = document.createElement('canvas');
  canvas.width  = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext('2d');

  for (const frame of frames) {
    await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        // destY and destH in CSS pixels; source rows in device pixels (×dpr).
        const destY  = Math.round(frame.offsetY);
        const destH  = Math.min(Math.round(img.naturalHeight / dpr), canvasH - destY);
        const srcH   = Math.round(destH * dpr); // device-pixel rows to copy
        if (destH > 0) {
          ctx.drawImage(img,
            0, 0, img.naturalWidth, srcH,  // source: full width, srcH device rows
            0, destY, canvasW, destH       // dest:   CSS-pixel coordinates
          );
        }
        resolve();
      };
      img.onerror = () => resolve(); // skip broken frames rather than hanging
      img.src = frame.dataUrl;
    });
  }

  const mime = (state.format === 'PNG' || state.format === 'PDF') ? 'image/png'
             : state.format === 'WebP' ? 'image/webp'
             : 'image/jpeg';
  return canvas.toDataURL(mime, state.quality / 100);
}

function dataUrlToBlobUrl(dataUrl) {
  const [header, data] = dataUrl.split(',');
  const mimeMatch = header?.match(/:(.*?);/);
  if (!mimeMatch) throw new Error('Full-page capture produced an invalid image. The page may have no scrollable content.');
  const mime = mimeMatch[1];
  const bytes = atob(data);
  const arr   = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return URL.createObjectURL(new Blob([arr], { type: mime }));
}

async function saveToHistory(filename, dataUrl) {
  const thumbnail = await makeThumbnail(dataUrl);
  const items     = await historyStore.get();
  items.unshift({
    id:         crypto.randomUUID(),
    filename,
    format:     state.format.toLowerCase(),
    mode:       state.mode,
    thumbnail,
    capturedAt: new Date().toISOString(),
  });
  await historyStore.set(items.slice(0, 20));
  await loadHistory();
}

async function makeThumbnail(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const W      = 200;
      const scale  = W / img.naturalWidth;
      const canvas = document.createElement('canvas');
      canvas.width  = W;
      canvas.height = Math.round(img.naturalHeight * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };
    img.src = dataUrl;
  });
}

function setCaptureSuccess(btn, icon, text) {
  captureState = 'success';
  btn.disabled = false;
  btn.classList.remove('loading');
  btn.classList.add('success');
  icon.innerHTML = svgCheck();
  text.textContent = 'Captured!';
}

function resetCaptureBtn(btn, icon, text) {
  btn.classList.remove('success', 'error');
  icon.innerHTML = svgCamera();
  text.textContent = 'Capture';
  captureState = 'idle';
}

// ── Button SVGs ───────────────────────────────────────────────────────────────

const svgCheck  = () => `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2.5 7L6 10.5L11.5 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const svgX      = () => `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
const svgCamera = () => `<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="9" r="4" stroke="currentColor" stroke-width="1.5"/><path d="M6 3h4l1 2H5L6 3z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M2 5.5h1M13 5.5h1" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>`;

// ── History ───────────────────────────────────────────────────────────────────

function toggleHistory() {
  historyOpen = !historyOpen;
  document.getElementById('historyToggleBtn').classList.toggle('open', historyOpen);
  document.getElementById('historyList').classList.toggle('visible', historyOpen);
  document.getElementById('historyBtn').classList.toggle('active', historyOpen);
}

async function loadHistory() {
  const items = await historyStore.get();
  renderHistory(items);
}

function renderHistory(items) {
  const count = document.getElementById('historyCount');
  count.textContent = items.length > 0 ? `(${items.length} recent)` : '(empty)';

  const list   = document.getElementById('historyList');
  const footer = list.querySelector('.history-footer');

  // Remove old items (keep footer)
  list.querySelectorAll('.history-item').forEach(el => el.remove());

  items.slice(0, 3).forEach(record => {
    const item = document.createElement('div');
    item.className = 'history-item';
    item.innerHTML = `
      <div class="history-thumb">
        <img src="${record.thumbnail || ''}" alt="">
      </div>
      <div class="history-info">
        <div class="history-name">${escHtml(record.filename)}</div>
        <div class="history-meta">${timeAgo(record.capturedAt)}</div>
      </div>
      <div class="history-actions">
        <button class="history-action-btn recapture" title="Re-capture">↻</button>
        <button class="history-action-btn delete" title="Delete">✕</button>
      </div>`;

    item.querySelector('.delete').addEventListener('click', async () => {
      item.style.cssText = 'opacity:0;transform:translateX(8px);transition:opacity .2s,transform .2s';
      setTimeout(async () => {
        item.remove();
        const updated = (await historyStore.get()).filter(r => r.id !== record.id);
        await historyStore.set(updated);
        document.getElementById('historyCount').textContent =
          updated.length > 0 ? `(${updated.length} recent)` : '(empty)';
      }, 200);
    });

    item.querySelector('.recapture').addEventListener('click', () => {
      showToast(`Re-capturing ${record.filename}…`, 'info');
    });

    list.insertBefore(item, footer);
  });
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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

// ── Theme toggle ──────────────────────────────────────────────────────────────

const THEME_CYCLE = ['system', 'light', 'dark'];

async function cycleTheme() {
  const { theme: current = 'system' } = await storage.get({ theme: 'system' });
  const next = THEME_CYCLE[(THEME_CYCLE.indexOf(current) + 1) % THEME_CYCLE.length];
  await storage.set({ theme: next });
  if (next === 'system') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.dataset.theme = next;
  }
  updateThemeBtn(next);
}

function updateThemeBtn(theme) {
  const btn = document.getElementById('themeBtn');
  if (!btn) return;
  const ICONS = {
    system: `<svg width="13" height="13" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.4"/>
      <path d="M8 2v12" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
      <path d="M8 2A6 6 0 0 0 8 14V2z" fill="currentColor" opacity="0.6"/>
    </svg>`,
    light: `<svg width="13" height="13" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="3" stroke="currentColor" stroke-width="1.4"/>
      <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4"
        stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
    </svg>`,
    dark: `<svg width="13" height="13" viewBox="0 0 16 16" fill="none">
      <path d="M13.5 10.5A6 6 0 0 1 5.5 2.5a6 6 0 1 0 8 8z"
        stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
  };
  const TOOLTIPS = { system: 'Theme: System', light: 'Theme: Light', dark: 'Theme: Dark' };
  btn.innerHTML = ICONS[theme] || ICONS.system;
  btn.dataset.tooltip = TOOLTIPS[theme] || 'Toggle theme';
}


// ── Toast ─────────────────────────────────────────────────────────────────────

let _toastId = 0;

function showToast(msg, type = 'info') {
  const container = document.getElementById('toastContainer');
  const id        = ++_toastId;
  const icons     = { success: '✓', error: '⚠', warning: '!', info: 'ℹ' };

  const toast = document.createElement('div');
  toast.id = `toast-${id}`;
  toast.className = `toast ${type !== 'info' ? type : ''}`.trim();
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || 'ℹ'}</span>
    <span class="toast-msg">${escHtml(msg)}</span>
    <button class="toast-close">✕</button>`;
  toast.querySelector('.toast-close').addEventListener('click', () => dismissToast(id));

  container.appendChild(toast);
  setTimeout(() => dismissToast(id), 5000);
}

let _lastCaptureDataUrl = null;

async function copyLastCaptureToClipboard() {
  if (!_lastCaptureDataUrl) return;
  try {
    const res  = await fetch(_lastCaptureDataUrl);
    const blob = await res.blob();
    await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
    showToast('Image copied to clipboard.', 'success');
  } catch {
    showToast('Could not copy image to clipboard.', 'error');
  }
}

function dismissToast(id) {
  const toast = document.getElementById(`toast-${id}`);
  if (!toast) return;
  toast.classList.add('dismissing');
  setTimeout(() => toast.remove(), 300);
}
