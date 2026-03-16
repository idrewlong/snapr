/**
 * capture-viewport.js — Viewport screenshot capture
 *
 * Simplest capture path. Uses chrome.tabs.captureVisibleTab.
 * If a size preset is selected, temporarily emulates that viewport
 * via the Chrome Debugger API before capturing, then restores it.
 */

import { emulateViewport, clearViewportEmulation } from './viewport-emulation.js';

/**
 * @param {number} tabId
 * @param {Object} options
 * @param {string} options.format      - 'PNG' | 'JPG' | 'WebP'
 * @param {number} options.quality     - 1–100
 * @param {string} options.sizePreset  - 'As-is' | preset name | 'Custom'
 * @param {number} [options.customWidth]
 * @param {number} [options.customHeight]
 * @returns {Promise<string>} dataUrl
 */
export async function capture(tabId, options) {
  const needsEmulation = options.sizePreset && options.sizePreset !== 'As-is';

  if (needsEmulation) {
    await emulateViewport(tabId, options);
    await new Promise((r) => setTimeout(r, 300)); // wait for reflow
  }

  let dataUrl;
  try {
    dataUrl = await chrome.tabs.captureVisibleTab(null, {
      format:  options.format === 'PNG' ? 'png' : 'jpeg',
      quality: options.quality,
    });
  } finally {
    // Always restore viewport, even if capture throws
    if (needsEmulation) await clearViewportEmulation(tabId);
  }

  // captureVisibleTab doesn't support WebP — convert in offscreen document
  if (options.format === 'WebP') {
    return convertToWebP(dataUrl, options.quality);
  }

  return dataUrl;
}

async function convertToWebP(dataUrl, quality) {
  await ensureOffscreen();
  return chrome.runtime.sendMessage({
    type:    'CONVERT_FORMAT',
    dataUrl,
    format:  'webp',
    quality,
    target:  'offscreen',
  });
}

async function ensureOffscreen() {
  const existing = await chrome.offscreen.hasDocument();
  if (existing) return;
  try {
    await chrome.offscreen.createDocument({
      url:           'src/offscreen/offscreen.html',
      reasons:       ['CANVAS'],
      justification: 'Image format conversion and compositing',
    });
  } catch (err) {
    // Retry once — the document may have been closing concurrently
    const stillMissing = !(await chrome.offscreen.hasDocument());
    if (stillMissing) throw new Error(`Failed to create offscreen document: ${err.message}`);
  }
}
