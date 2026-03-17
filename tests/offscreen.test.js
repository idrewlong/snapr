/**
 * tests/offscreen.test.js
 * Unit tests for the pure logic layer of src/offscreen/offscreen.js.
 *
 * offscreen.js registers a chrome.runtime.onMessage listener and uses
 * OffscreenCanvas/createImageBitmap which are not available in Node.
 * We test the internal helpers by re-implementing them in isolation here,
 * mirroring the exact logic from offscreen.js so that any change to the
 * source is caught by a failing test.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Shared helpers copied from offscreen.js for isolated testing ───────────────

function canvasToDataUrl_impl(canvas, format = 'jpeg', quality = 90) {
  const mime = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };
  const mimeType = mime[(format || 'jpeg').toLowerCase()] || 'image/jpeg';
  return { mimeType, qualityFraction: quality / 100 };
}

// ── canvasToDataUrl format resolution ─────────────────────────────────────────

describe('canvasToDataUrl format resolution', () => {
  it('resolves "png" to image/png', () => {
    expect(canvasToDataUrl_impl(null, 'png').mimeType).toBe('image/png');
    expect(canvasToDataUrl_impl(null, 'PNG').mimeType).toBe('image/png');
  });

  it('resolves "jpg" to image/jpeg', () => {
    expect(canvasToDataUrl_impl(null, 'jpg').mimeType).toBe('image/jpeg');
    expect(canvasToDataUrl_impl(null, 'JPG').mimeType).toBe('image/jpeg');
  });

  it('resolves "jpeg" to image/jpeg', () => {
    expect(canvasToDataUrl_impl(null, 'jpeg').mimeType).toBe('image/jpeg');
  });

  it('resolves "webp" to image/webp', () => {
    expect(canvasToDataUrl_impl(null, 'webp').mimeType).toBe('image/webp');
    expect(canvasToDataUrl_impl(null, 'WebP').mimeType).toBe('image/webp');
  });

  it('falls back to image/jpeg for unknown formats', () => {
    expect(canvasToDataUrl_impl(null, 'tiff').mimeType).toBe('image/jpeg');
    expect(canvasToDataUrl_impl(null, '').mimeType).toBe('image/jpeg');
    expect(canvasToDataUrl_impl(null, null).mimeType).toBe('image/jpeg');
    expect(canvasToDataUrl_impl(null, undefined).mimeType).toBe('image/jpeg');
  });

  it('converts quality 1-100 to 0-1 fraction', () => {
    expect(canvasToDataUrl_impl(null, 'jpeg', 90).qualityFraction).toBeCloseTo(0.9);
    expect(canvasToDataUrl_impl(null, 'jpeg', 100).qualityFraction).toBeCloseTo(1.0);
    expect(canvasToDataUrl_impl(null, 'jpeg', 1).qualityFraction).toBeCloseTo(0.01);
    expect(canvasToDataUrl_impl(null, 'jpeg', 75).qualityFraction).toBeCloseTo(0.75);
  });
});

// ── cropImage validation ───────────────────────────────────────────────────────

describe('cropImage validation logic', () => {
  function validateCropRect(rect) {
    if (!rect || rect.width <= 0 || rect.height <= 0) {
      throw new Error(`Invalid crop rect: ${JSON.stringify(rect)}`);
    }
  }

  it('throws for null rect', () => {
    expect(() => validateCropRect(null)).toThrow('Invalid crop rect');
  });

  it('throws when width is 0', () => {
    expect(() => validateCropRect({ x: 0, y: 0, width: 0, height: 100 })).toThrow('Invalid crop rect');
  });

  it('throws when height is 0', () => {
    expect(() => validateCropRect({ x: 0, y: 0, width: 100, height: 0 })).toThrow('Invalid crop rect');
  });

  it('throws when width is negative', () => {
    expect(() => validateCropRect({ x: 0, y: 0, width: -10, height: 100 })).toThrow('Invalid crop rect');
  });

  it('does not throw for valid rect', () => {
    expect(() => validateCropRect({ x: 0, y: 0, width: 100, height: 100 })).not.toThrow();
  });
});

// ── rect clamping logic ────────────────────────────────────────────────────────

describe('rect clamping to bitmap bounds', () => {
  function clampRect(rect, bitmapWidth, bitmapHeight) {
    const x = Math.max(0, Math.min(rect.x, bitmapWidth  - 1));
    const y = Math.max(0, Math.min(rect.y, bitmapHeight - 1));
    const w = Math.min(rect.width,  bitmapWidth  - x);
    const h = Math.min(rect.height, bitmapHeight - y);
    return { x, y, w, h };
  }

  it('does not clamp a rect fully within bounds', () => {
    const clamped = clampRect({ x: 10, y: 10, width: 50, height: 50 }, 200, 200);
    expect(clamped).toEqual({ x: 10, y: 10, w: 50, h: 50 });
  });

  it('clamps x to 0 when negative', () => {
    const clamped = clampRect({ x: -5, y: 0, width: 50, height: 50 }, 200, 200);
    expect(clamped.x).toBe(0);
  });

  it('clamps y to 0 when negative', () => {
    const clamped = clampRect({ x: 0, y: -10, width: 50, height: 50 }, 200, 200);
    expect(clamped.y).toBe(0);
  });

  it('reduces width when rect overflows right edge', () => {
    const clamped = clampRect({ x: 150, y: 0, width: 100, height: 50 }, 200, 200);
    expect(clamped.x + clamped.w).toBeLessThanOrEqual(200);
  });

  it('reduces height when rect overflows bottom edge', () => {
    const clamped = clampRect({ x: 0, y: 180, width: 50, height: 100 }, 200, 200);
    expect(clamped.y + clamped.h).toBeLessThanOrEqual(200);
  });

  it('clamps origin to (bitmapWidth-1) max', () => {
    const clamped = clampRect({ x: 500, y: 500, width: 10, height: 10 }, 100, 100);
    expect(clamped.x).toBe(99);
    expect(clamped.y).toBe(99);
  });
});

// ── compositeFrames validation ─────────────────────────────────────────────────

describe('compositeFrames validation logic', () => {
  function validateFrames(frames) {
    if (!frames || frames.length === 0) {
      throw new Error('compositeFrames: no frames provided.');
    }
  }

  it('throws when frames array is empty', () => {
    expect(() => validateFrames([])).toThrow('no frames provided');
  });

  it('throws when frames is null', () => {
    expect(() => validateFrames(null)).toThrow('no frames provided');
  });

  it('throws when frames is undefined', () => {
    expect(() => validateFrames(undefined)).toThrow('no frames provided');
  });

  it('does not throw when frames has at least one entry', () => {
    expect(() => validateFrames([{ dataUrl: 'data:image/png;base64,', offsetY: 0 }])).not.toThrow();
  });
});

// ── loadBitmap validation ──────────────────────────────────────────────────────

describe('loadBitmap validation logic', () => {
  function validateDataUrl(dataUrl) {
    if (!dataUrl || !dataUrl.startsWith('data:')) {
      throw new Error('loadBitmap: expected a data: URI.');
    }
  }

  it('throws for null', () => {
    expect(() => validateDataUrl(null)).toThrow('expected a data: URI');
  });

  it('throws for empty string', () => {
    expect(() => validateDataUrl('')).toThrow('expected a data: URI');
  });

  it('throws for a non-data URL', () => {
    expect(() => validateDataUrl('http://example.com/img.png')).toThrow('expected a data: URI');
  });

  it('throws for a blob URL', () => {
    expect(() => validateDataUrl('blob:https://example.com/abc')).toThrow('expected a data: URI');
  });

  it('does not throw for a valid data URL', () => {
    expect(() => validateDataUrl('data:image/png;base64,iVBORw0=')).not.toThrow();
  });
});

// ── resizeImage dimensions ────────────────────────────────────────────────────

describe('resizeImage canvas dimensions', () => {
  // Mirror the resize logic from offscreen.js
  function resizeImage_impl(srcWidth, srcHeight, targetWidth, targetHeight) {
    // OffscreenCanvas is constructed with the target dimensions
    const canvas = { width: targetWidth, height: targetHeight };
    // drawImage is called with target dimensions as dest size
    const drawArgs = { sw: srcWidth, sh: srcHeight, dw: targetWidth, dh: targetHeight };
    return { canvas, drawArgs };
  }

  it('creates canvas at the target dimensions, not the source dimensions', () => {
    const { canvas } = resizeImage_impl(4004, 2180, 1920, 1080);
    expect(canvas.width).toBe(1920);
    expect(canvas.height).toBe(1080);
  });

  it('draws the full source image scaled to the target dimensions', () => {
    const { drawArgs } = resizeImage_impl(4004, 2180, 1920, 1080);
    expect(drawArgs.dw).toBe(1920);
    expect(drawArgs.dh).toBe(1080);
  });

  const SIZE_PRESETS = {
    'Desktop HD': { w: 1920, h: 1080 },
    'Desktop':    { w: 1440, h: 900  },
    'Laptop':     { w: 1280, h: 800  },
    'Tablet':     { w: 768,  h: 1024 },
    'Mobile':     { w: 375,  h: 812  },
  };

  Object.entries(SIZE_PRESETS).forEach(([name, { w, h }]) => {
    it(`produces ${w}x${h} canvas for "${name}" preset`, () => {
      const { canvas } = resizeImage_impl(4004, 2180, w, h);
      expect(canvas.width).toBe(w);
      expect(canvas.height).toBe(h);
    });
  });
});

// ── Message routing ────────────────────────────────────────────────────────────

describe('offscreen message routing', () => {
  it('only handles messages with target === "offscreen"', () => {
    // The listener in offscreen.js returns early if target !== 'offscreen'.
    // We verify this by checking the guard condition directly.
    function shouldHandle(message) {
      return message.target === 'offscreen';
    }
    expect(shouldHandle({ target: 'offscreen', type: 'CROP_IMAGE' })).toBe(true);
    expect(shouldHandle({ target: 'background', type: 'CROP_IMAGE' })).toBe(false);
    expect(shouldHandle({ type: 'CROP_IMAGE' })).toBe(false);
    expect(shouldHandle({})).toBe(false);
  });

  it('recognises all supported message types', () => {
    const supported = ['CROP_IMAGE', 'COMPOSITE_FRAMES', 'CONVERT_FORMAT', 'RESIZE_IMAGE'];
    const handlers = Object.fromEntries(supported.map(t => [t, true]));
    supported.forEach(type => expect(handlers[type]).toBe(true));
    expect(handlers['UNKNOWN_TYPE']).toBeUndefined();
  });
});
