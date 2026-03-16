/**
 * offscreen.js — Canvas operations (crop, composite, format convert)
 *
 * Self-contained (no ES module imports). Receives messages from the
 * service worker, processes images via OffscreenCanvas, returns data URLs.
 */

'use strict';

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.target !== 'offscreen') return;

  const handlers = {
    CROP_IMAGE:        () => cropImage(message.dataUrl, message.rect, message.outputFormat, message.quality),
    COMPOSITE_FRAMES:  () => compositeFrames(message.frames, message.dimensions, message.format, message.quality),
    CONVERT_FORMAT:    () => convertFormat(message.dataUrl, message.format, message.quality),
  };

  const handler = handlers[message.type];
  if (!handler) return;

  handler()
    .then(result => sendResponse(result))
    .catch(err   => sendResponse({ error: err.message }));

  return true; // async
});

// ── Crop ──────────────────────────────────────────────────────────────────────

async function cropImage(dataUrl, rect, format, quality) {
  const bitmap = await loadBitmap(dataUrl);
  const canvas = new OffscreenCanvas(rect.width, rect.height);
  const ctx    = canvas.getContext('2d');
  ctx.drawImage(bitmap, rect.x, rect.y, rect.width, rect.height, 0, 0, rect.width, rect.height);
  bitmap.close();
  return canvasToDataUrl(canvas, format, quality);
}

// ── Composite (full-page frames) ──────────────────────────────────────────────

async function compositeFrames(frames, dimensions, format, quality) {
  const canvas = new OffscreenCanvas(dimensions.width, dimensions.height);
  const ctx    = canvas.getContext('2d');

  for (const frame of frames) {
    const bitmap = await loadBitmap(frame.dataUrl);
    ctx.drawImage(bitmap, 0, frame.offsetY);
    bitmap.close();
  }

  return canvasToDataUrl(canvas, format, quality);
}

// ── Convert format ────────────────────────────────────────────────────────────

async function convertFormat(dataUrl, format, quality) {
  const bitmap = await loadBitmap(dataUrl);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  canvas.getContext('2d').drawImage(bitmap, 0, 0);
  bitmap.close();
  return canvasToDataUrl(canvas, format, quality);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function loadBitmap(dataUrl) {
  const res  = await fetch(dataUrl);
  const blob = await res.blob();
  return createImageBitmap(blob);
}

async function canvasToDataUrl(canvas, format = 'jpeg', quality = 90) {
  const mime  = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };
  const mimeType = mime[(format || 'jpeg').toLowerCase()] || 'image/jpeg';
  const blob  = await canvas.convertToBlob({ type: mimeType, quality: quality / 100 });

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}
