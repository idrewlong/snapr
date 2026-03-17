/**
 * service-worker.js
 *
 * Two responsibilities:
 *   1. Keyboard shortcut (Alt+Shift+S) — quick-capture command
 *      Captures the active tab with the user's saved default settings and
 *      downloads the file immediately, no popup required.
 *
 *   2. Element capture after the popup closes:
 *      Receives ELEMENT_SELECTED from the content script, crops the image,
 *      stores the result, and reopens the popup for confirm + download.
 */

import { capture }       from './capture-viewport.js';
import { download }      from './downloader.js';
import { getSettings }   from '../lib/storage.js';
import { buildFilename } from '../lib/filename.js';

// ── Keyboard shortcut ─────────────────────────────────────────────────────────

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'quick-capture') return;

  let tab;
  try {
    [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;
  } catch {
    return;
  }

  await handleQuickCapture(tab);
});

export async function handleQuickCapture(tab) {
  try {
    const settings = await getSettings();

    const dataUrl = await capture(tab.id, settings);

    const ext      = settings.format.toLowerCase();
    const basename = buildFilename(settings.filenamePattern, {
      url:   tab.url   || '',
      title: tab.title || '',
      mode:  'viewport',
    });
    await download(dataUrl, `${basename}.${ext}`, settings.saveLocation);
  } catch (err) {
    console.error('Snapr: quick-capture failed:', err);
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'ELEMENT_SELECTED') {
    handleElementCapture(sender.tab, message.rect, message.devicePixelRatio)
      .then(() => sendResponse({ success: true }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
});

export async function handleElementCapture(tab, rect, dpr) {
  try {
    // 1. Capture full visible viewport.
    //    Prefer the screenshot pre-captured by popup.js (before it closed), which
    //    was taken while the user-gesture / activeTab context was still live.
    //    In MV3, captureVisibleTab called from a service worker message handler
    //    lacks that context and can fail silently — the pre-capture sidesteps that.
    const { pendingScreenshot } = await chrome.storage.local.get({ pendingScreenshot: null });
    const fullDataUrl = pendingScreenshot
      ? pendingScreenshot
      : await chrome.tabs.captureVisibleTab(null, { format: 'png' });
    if (pendingScreenshot) await chrome.storage.local.remove('pendingScreenshot');

    // 2. Crop to element bounds directly using OffscreenCanvas (available in MV3
    //    service workers). Avoids the sendMessage roundtrip to the offscreen doc,
    //    which can fail because the service worker's own onMessage listener closes
    //    the channel before the offscreen doc gets a chance to respond.
    let croppedDataUrl = fullDataUrl;
    try {
      croppedDataUrl = await cropInWorker(fullDataUrl, {
        x:      Math.round(rect.x      * dpr),
        y:      Math.round(rect.y      * dpr),
        width:  Math.round(rect.width  * dpr),
        height: Math.round(rect.height * dpr),
      });
    } catch (cropErr) {
      console.warn('Snapr: element crop failed, falling back to full viewport.', cropErr);
    }

    // 3. Store cropped image for the popup to pick up
    await chrome.storage.local.set({
      pendingCapture: {
        dataUrl:     croppedDataUrl,
        capturedAt:  new Date().toISOString(),
        sourceUrl:   tab.url,
        sourceTitle: tab.title,
      },
    });
  } catch (err) {
    console.error('Snapr: handleElementCapture failed:', err);
  }

  // 4. Always reopen the popup as a confirmation window, even if capture failed,
  //    so the user is never left with a closed popup and no feedback.
  chrome.windows.create({
    url:     chrome.runtime.getURL('src/popup/popup.html'),
    type:    'popup',
    width:   400,
    height:  620,
    focused: true,
  });
}

// ── Canvas crop (runs directly in the service worker) ─────────────────────────

async function cropInWorker(dataUrl, rect) {
  const res    = await fetch(dataUrl);
  const blob   = await res.blob();
  const bitmap = await createImageBitmap(blob);

  const x = Math.max(0, Math.min(rect.x, bitmap.width  - 1));
  const y = Math.max(0, Math.min(rect.y, bitmap.height - 1));
  const w = Math.min(rect.width,  bitmap.width  - x);
  const h = Math.min(rect.height, bitmap.height - y);

  const canvas = new OffscreenCanvas(w, h);
  canvas.getContext('2d').drawImage(bitmap, x, y, w, h, 0, 0, w, h);
  bitmap.close();

  const outBlob = await canvas.convertToBlob({ type: 'image/png' });
  const buf     = await outBlob.arrayBuffer();
  const bytes   = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return `data:image/png;base64,${btoa(binary)}`;
}

