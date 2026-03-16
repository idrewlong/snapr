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

export async function capture(tabId, options) {
  // Inject content script
  await chrome.scripting.executeScript({
    target: { tabId },
    files:  ['content/full-page.js'],
  });

  // Get page dimensions and prepare fixed elements
  const { scrollHeight, viewportHeight, viewportWidth } =
    await chrome.tabs.sendMessage(tabId, { type: MSG.SCROLL_INFO });

  const maxHeight = options.maxFullPageHeight || 15000;
  const totalHeight = Math.min(scrollHeight, maxHeight);

  const frames = [];
  let offsetY = 0;

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

  // Restore fixed/sticky elements
  await chrome.scripting.executeScript({
    target: { tabId },
    func:   () => window.__snaprRestoreFixed?.(),
  });

  // Composite frames in offscreen document
  return compositeFrames(frames, { width: viewportWidth, height: totalHeight }, options);
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
  if (!await chrome.offscreen.hasDocument()) {
    await chrome.offscreen.createDocument({
      url:         '../offscreen/offscreen.html',
      reasons:     ['CANVAS'],
      justification: 'Full-page frame compositing',
    });
  }
}

const delay = (ms) => new Promise((r) => setTimeout(r, ms));
