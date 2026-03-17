/**
 * capture-element.js — Element picker + crop capture
 *
 * Flow:
 *  1. Inject element-picker.js content script
 *  2. Content script shows a hover overlay — user clicks an element
 *  3. Content script sends ELEMENT_SELECTED with the bounding rect
 *  4. captureVisibleTab grabs the full viewport
 *  5. Send to offscreen document for cropping to the element rect
 *  6. Return cropped data URL
 */

import * as MSG from '../lib/messages.js';

export async function startPicker(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files:  ['src/content/element-picker.js'],
    });
  } catch (err) {
    const msg = err.message || '';
    if (msg.includes('Cannot access') || msg.includes('chrome://') || msg.includes('refused')) {
      throw new Error('CONTENT_SCRIPT_BLOCKED');
    }
    throw err;
  }
  // ELEMENT_SELECTED message will arrive asynchronously when user clicks
}

export async function captureSelected(_tab, rect, devicePixelRatio, options) {
  // Grab the visible viewport
  const dataUrl = await chrome.tabs.captureVisibleTab(null, {
    format:  options.format === 'PNG' ? 'png' : 'jpeg',
    quality: options.quality,
  });

  // Scale rect from CSS px to image px
  const scaled = {
    x:      Math.round(rect.x      * devicePixelRatio),
    y:      Math.round(rect.y      * devicePixelRatio),
    width:  Math.round(rect.width  * devicePixelRatio),
    height: Math.round(rect.height * devicePixelRatio),
  };

  // Crop in offscreen document
  await ensureOffscreen();
  const result = await chrome.runtime.sendMessage({
    type:         MSG.CROP_IMAGE,
    dataUrl,
    rect:         scaled,
    outputFormat: options.format.toLowerCase(),
    quality:      options.quality,
    target:       'offscreen',
  });
  if (result?.error) throw new Error(`Offscreen error: ${result.error}`);
  return result;
}

async function ensureOffscreen() {
  if (!await chrome.offscreen.hasDocument()) {
    await chrome.offscreen.createDocument({
      url:         'src/offscreen/offscreen.html',
      reasons:     ['BLOBS'],
      justification: 'Element crop',
    });
  }
}
