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
    COMPOSITE_FRAMES:  () => compositeFrames(message.frames, message.dimensions, message.format, message.quality, message.reference, message.fixedBarHeight, message.dpr),
    CONVERT_FORMAT:    () => convertFormat(message.dataUrl, message.format, message.quality),
    RESIZE_IMAGE:      () => resizeImage(message.dataUrl, message.width, message.height, message.format, message.quality),
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
  if (!rect || rect.width <= 0 || rect.height <= 0) {
    throw new Error(`Invalid crop rect: ${JSON.stringify(rect)}`);
  }
  const bitmap = await loadBitmap(dataUrl);
  // Clamp rect to bitmap bounds to avoid drawImage errors
  const x = Math.max(0, Math.min(rect.x, bitmap.width  - 1));
  const y = Math.max(0, Math.min(rect.y, bitmap.height - 1));
  const w = Math.min(rect.width,  bitmap.width  - x);
  const h = Math.min(rect.height, bitmap.height - y);
  const canvas = new OffscreenCanvas(w, h);
  const ctx    = canvas.getContext('2d');
  ctx.drawImage(bitmap, x, y, w, h, 0, 0, w, h);
  bitmap.close();
  return canvasToDataUrl(canvas, format, quality);
}

// ── Composite (full-page frames) ──────────────────────────────────────────────

/**
 * Stitch scroll tiles into one image, then overlay the fixed header once.
 *
 * DPR handling: captureVisibleTab returns images at device pixel density.
 * All CSS-pixel measurements (offsetY, height, fixedBarHeight) must be
 * multiplied by dpr before use as bitmap coordinates or canvas dimensions.
 *
 * @param {Array<{dataUrl, offsetY, height}>} frames  - CSS-pixel positions/sizes
 * @param {{width, height}} dimensions                - CSS-pixel canvas size
 * @param {string}  format
 * @param {number}  quality
 * @param {string|null} reference    - screenshot taken before headers were hidden
 * @param {number}  fixedBarHeight   - CSS pixels of header to overlay from reference
 * @param {number}  dpr              - window.devicePixelRatio of the captured tab
 */
async function compositeFrames(frames, dimensions, format, quality, reference, fixedBarHeight, dpr) {
  if (!frames || frames.length === 0) {
    throw new Error('compositeFrames: no frames provided.');
  }

  dpr = dpr || 1;

  // Canvas is sized in device pixels for full-resolution output
  const canvas = new OffscreenCanvas(dimensions.width * dpr, dimensions.height * dpr);
  const ctx    = canvas.getContext('2d');

  for (const frame of frames) {
    const bitmap = await loadBitmap(frame.dataUrl);

    // Crop: use only the rows that belong to this tile (fixes last-frame bleed).
    // Source is in device pixels; destination Y is also in device pixels.
    const srcH = Math.round(frame.height * dpr);
    const dstY = Math.round(frame.offsetY * dpr);
    ctx.drawImage(bitmap, 0, 0, bitmap.width, srcH, 0, dstY, bitmap.width, srcH);
    bitmap.close();
  }

  // Overlay the reference header once at the very top of the composite.
  // This gives one clean header with no duplication across tiles.
  if (reference && fixedBarHeight > 0) {
    const refBitmap = await loadBitmap(reference);
    const barH = Math.round(fixedBarHeight * dpr);
    ctx.drawImage(refBitmap, 0, 0, refBitmap.width, barH, 0, 0, refBitmap.width, barH);
    refBitmap.close();
  }

  return canvasToDataUrl(canvas, format, quality);
}

// ── Resize ────────────────────────────────────────────────────────────────────

async function resizeImage(dataUrl, width, height, format, quality) {
  const bitmap = await loadBitmap(dataUrl);
  const canvas = new OffscreenCanvas(width, height);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
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
  if (!dataUrl || !dataUrl.startsWith('data:')) {
    throw new Error('loadBitmap: expected a data: URI.');
  }
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
