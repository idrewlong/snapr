/**
 * capture-fullpage.js — Full-page scroll-and-stitch capture
 *
 * Flow:
 *  1. Inject full-page.js content script into the active tab
 *  2. Get scroll dimensions + DPR from the content script (page untouched)
 *  3. Scroll to y=0 and take a reference screenshot (headers still visible)
 *  4. Content script hides fixed/sticky elements; returns fixedBarHeight
 *  5. Scroll loop: captureVisibleTab → SCROLL_TO → repeat
 *  6. Content script restores fixed/sticky elements
 *  7. Send all frames + reference to offscreen document for compositing
 *  8. Offscreen stitches tiles (DPR-correct), then overlays the reference
 *     header once at the top — giving one clean header, no repetition
 *  9. Return composited data URL
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

  // Phase 1: get dimensions — content script does NOT modify the page yet
  const { scrollHeight, viewportHeight, viewportWidth, devicePixelRatio } =
    await chrome.tabs.sendMessage(tabId, { type: MSG.SCROLL_INFO });

  const dpr       = devicePixelRatio || 1;
  const maxHeight = options.maxFullPageHeight || 15000;
  const capped    = scrollHeight > maxHeight;
  const totalHeight = Math.min(scrollHeight, maxHeight);

  // Scroll to the top so the reference screenshot shows the real header
  await chrome.tabs.sendMessage(tabId, { type: MSG.SCROLL_TO, y: 0 });
  await delay(150);

  // Phase 2: reference screenshot — headers still visible at y=0
  const referenceDataUrl = await chrome.tabs.captureVisibleTab(null, {
    format:  'jpeg',
    quality: 92,
  });

  // Phase 3: hide fixed/sticky elements, get the header bar height
  const { fixedBarHeight } = await chrome.tabs.sendMessage(tabId, { type: MSG.HIDE_FIXED });

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
  const dataUrl = await compositeFrames(
    frames,
    { width: viewportWidth, height: totalHeight },
    options,
    referenceDataUrl,
    fixedBarHeight,
    dpr,
  );
  return { dataUrl, capped };
}

async function compositeFrames(frames, dimensions, options, reference, fixedBarHeight, dpr) {
  await ensureOffscreen();
  const result = await chrome.runtime.sendMessage({
    type:           MSG.COMPOSITE_FRAMES,
    frames,
    dimensions,
    format:         options.format,
    quality:        options.quality,
    reference:      fixedBarHeight > 0 ? reference : null,
    fixedBarHeight: fixedBarHeight || 0,
    dpr:            dpr || 1,
    target:         'offscreen',
  });
  if (result?.error) throw new Error(`Offscreen error: ${result.error}`);
  return result;
}

async function ensureOffscreen() {
  if (await chrome.offscreen.hasDocument()) return;
  try {
    await chrome.offscreen.createDocument({
      url:           'src/offscreen/offscreen.html',
      reasons:       ['BLOBS'],
      justification: 'Full-page frame compositing',
    });
  } catch (err) {
    const stillMissing = !(await chrome.offscreen.hasDocument());
    if (stillMissing) throw new Error(`Failed to create offscreen document: ${err.message}`);
  }
}

const delay = (ms) => new Promise((r) => setTimeout(r, ms));
