/**
 * capture-fullpage.js — Full-page scroll-and-stitch capture
 *
 * Flow:
 *  1. Inject full-page.js content script into the active tab
 *  2. Get scroll dimensions from the content script
 *  3. Content script stores + hides fixed/sticky elements
 *  4. Scroll loop: captureVisibleTab → SCROLL_TO → repeat
 *  5. Content script restores fixed/sticky elements
 *  6. Send all frames to offscreen document for compositing
 *  7. Return composited data URL
 *
 * See snapr.md § "Full-page capture" for edge case mitigations.
 */

import * as MSG from '../lib/messages.js';

/**
 * @param {number} tabId
 * @param {Object} options
 * @param {string} options.format
 * @param {number} options.quality
 * @param {number} [options.maxFullPageHeight]
 * @returns {Promise<{ dataUrl: string, capped: boolean }>}
 */
export async function capture(tabId, options) {
  // Inject content script — may fail on CSP-restricted pages
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files:  ['src/content/full-page.js'],
    });
  } catch (err) {
    const msg = err.message || '';
    if (msg.includes('Cannot access') || msg.includes('chrome://') || msg.includes('refused')) {
      throw new Error('CONTENT_SCRIPT_BLOCKED');
    }
    throw err;
  }

  // Get page dimensions and prepare fixed elements
  const { scrollHeight, viewportHeight, viewportWidth } =
    await chrome.tabs.sendMessage(tabId, { type: MSG.SCROLL_INFO });

  const maxHeight   = options.maxFullPageHeight || 15000;
  const capped      = scrollHeight > maxHeight;
  const totalHeight = Math.min(scrollHeight, maxHeight);

  const frames = [];
  let offsetY  = 0;

  try {
    while (offsetY < totalHeight) {
      await chrome.tabs.sendMessage(tabId, { type: MSG.SCROLL_TO, y: offsetY });
      await delay(200); // wait for paint + lazy loads

      const dataUrl = await chrome.tabs.captureVisibleTab(null, {
        format:  'jpeg',
        quality: 92,
      });

      const remaining = totalHeight - offsetY;
      frames.push({ dataUrl, offsetY, height: Math.min(viewportHeight, remaining) });
      offsetY += viewportHeight;
    }
  } finally {
    // Always restore fixed/sticky elements, even if capture throws mid-loop
    await chrome.scripting.executeScript({
      target: { tabId },
      func:   () => window.__snaprRestoreFixed?.(),
    }).catch(() => { /* tab may have closed */ });
  }

  // Composite frames in offscreen document
  const dataUrl = await compositeFrames(frames, { width: viewportWidth, height: totalHeight }, options);
  return { dataUrl, capped };
}

async function compositeFrames(frames, dimensions, options) {
  await ensureOffscreen();
  return chrome.runtime.sendMessage({
    type:    MSG.COMPOSITE_FRAMES,
    frames,
    dimensions,
    format:  options.format,
    quality: options.quality,
    target:  'offscreen',
  });
}

async function ensureOffscreen() {
  if (await chrome.offscreen.hasDocument()) return;
  try {
    await chrome.offscreen.createDocument({
      url:           'src/offscreen/offscreen.html',
      reasons:       ['CANVAS'],
      justification: 'Full-page frame compositing',
    });
  } catch (err) {
    const stillMissing = !(await chrome.offscreen.hasDocument());
    if (stillMissing) throw new Error(`Failed to create offscreen document: ${err.message}`);
  }
}

const delay = (ms) => new Promise((r) => setTimeout(r, ms));
