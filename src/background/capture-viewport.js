/**
 * capture-viewport.js — Viewport screenshot capture
 *
 * Simplest capture path. Uses chrome.tabs.captureVisibleTab.
 * If a size preset is selected, temporarily emulates that viewport
 * via the Chrome Debugger API before capturing, then restores it.
 */

import { emulateViewport, clearViewportEmulation } from './viewport-emulation.js';
import { SIZE_PRESETS } from '../lib/constants.js';

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

  // Resize to preset dimensions — captureVisibleTab always captures at physical
  // display resolution, so we must resize explicitly to match the selected preset.
  if (needsEmulation) {
    const preset = SIZE_PRESETS[options.sizePreset];
    const targetW = preset ? preset.w : (options.customWidth  || 1440);
    const targetH = preset ? preset.h : (options.customHeight || 900);
    dataUrl = await resizeImage(dataUrl, targetW, targetH, options.format, options.quality);
  }

  // captureVisibleTab doesn't support WebP — convert in offscreen document
  if (options.format === 'WebP' && !needsEmulation) {
    return convertToWebP(dataUrl, options.quality);
  }

  return dataUrl;
}

async function resizeImage(dataUrl, width, height, format, quality) {
  await ensureOffscreen();
  return offscreenMessage({
    type:    'RESIZE_IMAGE',
    dataUrl,
    width,
    height,
    format:  format.toLowerCase(),
    quality,
    target:  'offscreen',
  });
}

async function convertToWebP(dataUrl, quality) {
  await ensureOffscreen();
  return offscreenMessage({
    type:    'CONVERT_FORMAT',
    dataUrl,
    format:  'webp',
    quality,
    target:  'offscreen',
  });
}

async function offscreenMessage(message) {
  const result = await chrome.runtime.sendMessage(message);
  if (result?.error) throw new Error(`Offscreen error: ${result.error}`);
  return result;
}

async function ensureOffscreen() {
  const existing = await chrome.offscreen.hasDocument();
  if (existing) return;
  try {
    await chrome.offscreen.createDocument({
      url:           'src/offscreen/offscreen.html',
      reasons:       ['BLOBS'],
      justification: 'Image format conversion and compositing',
    });
  } catch (err) {
    // Retry once — the document may have been closing concurrently
    const stillMissing = !(await chrome.offscreen.hasDocument());
    if (stillMissing) throw new Error(`Failed to create offscreen document: ${err.message}`);
  }
}
