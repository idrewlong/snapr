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
  await chrome.scripting.executeScript({
    target: { tabId },
    files:  ['content/element-picker.js'],
  });
  // ELEMENT_SELECTED message will arrive asynchronously when user clicks
}

export async function captureSelected(tab, rect, devicePixelRatio, options) {
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
  return chrome.runtime.sendMessage({
    type:         MSG.CROP_IMAGE,
    dataUrl,
    rect:         scaled,
    outputFormat: options.format.toLowerCase(),
    quality:      options.quality,
    target:       'offscreen',
  });
}

async function ensureOffscreen() {
  if (!await chrome.offscreen.hasDocument()) {
    await chrome.offscreen.createDocument({
      url:         '../offscreen/offscreen.html',
      reasons:     ['CANVAS'],
      justification: 'Element crop',
    });
  }
}
