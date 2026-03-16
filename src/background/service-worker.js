/**
 * service-worker.js
 *
 * Handles element capture after the popup closes:
 *   1. Receives ELEMENT_SELECTED from the content script
 *   2. Captures and crops the element
 *   3. Stores the result as pendingCapture in chrome.storage.local
 *   4. Reopens the popup as a small window so the user can confirm + download
 */

'use strict';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'ELEMENT_SELECTED') {
    handleElementCapture(sender.tab, message.rect, message.devicePixelRatio)
      .then(() => sendResponse({ success: true }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
});

async function handleElementCapture(tab, rect, dpr) {
  // 1. Capture full visible viewport.
  //    Pass null (not tab.windowId) — captureVisibleTab with a windowId from
  //    a content-script sender context can fail silently in some Chrome builds.
  const dataUrl = await chrome.tabs.captureVisibleTab(null, {
    format: 'png',
  });

  // 2. Crop to element bounds in the offscreen document
  await ensureOffscreen();
  const croppedDataUrl = await sendToOffscreen({
    type:         'CROP_IMAGE',
    dataUrl,
    rect: {
      x:      Math.round(rect.x      * dpr),
      y:      Math.round(rect.y      * dpr),
      width:  Math.round(rect.width  * dpr),
      height: Math.round(rect.height * dpr),
    },
    outputFormat: 'png',
    quality:      100,
    target:       'offscreen',
  });

  // 3. Store cropped image for the popup to pick up
  await chrome.storage.local.set({
    pendingCapture: {
      dataUrl:     croppedDataUrl,
      capturedAt:  new Date().toISOString(),
      sourceUrl:   tab.url,
      sourceTitle: tab.title,
    },
  });

  // 4. Reopen the popup as a confirmation window
  chrome.windows.create({
    url:     chrome.runtime.getURL('src/popup/popup.html'),
    type:    'popup',
    width:   400,
    height:  620,
    focused: true,
  });
}

// ── Offscreen helpers ─────────────────────────────────────────────────────────

async function ensureOffscreen() {
  const exists = await chrome.offscreen.hasDocument().catch(() => false);
  if (!exists) {
    await chrome.offscreen.createDocument({
      url:           'src/offscreen/offscreen.html',
      reasons:       ['CANVAS'],
      justification: 'Crop element screenshot',
    });
    // The document is created but its JS hasn't registered listeners yet.
    // A short wait lets offscreen.js finish loading before we send a message.
    await new Promise(r => setTimeout(r, 150));
  }
}

function sendToOffscreen(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
      if (response?.error)          return reject(new Error(response.error));
      resolve(response);
    });
  });
}

function dataUrlToBlobUrl(dataUrl) {
  const [header, data] = dataUrl.split(',');
  const mime  = header.match(/:(.*?);/)[1];
  const bytes = atob(data);
  const arr   = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return URL.createObjectURL(new Blob([arr], { type: mime }));
}
