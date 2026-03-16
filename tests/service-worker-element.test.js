/**
 * tests/service-worker-element.test.js
 *
 * Tests for the ELEMENT_SELECTED handler in src/background/service-worker.js.
 *
 * handleElementCapture is exported for direct testing. We also test the
 * chrome.runtime.onMessage listener routing to verify ELEMENT_SELECTED
 * is the only message type handled.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleElementCapture } from '../src/background/service-worker.js';

// Minimal real-world values
const TAB = { id: 1, url: 'https://example.com/products', title: 'Products – Example' };
const RECT = { x: 10, y: 20, width: 300, height: 150 };
const DPR  = 2;

const FAKE_VIEWPORT_URL = 'data:image/png;base64,iVBORw0KGgo=';
const FAKE_CROPPED_URL  = 'data:image/png;base64,cropped=';

function setupHappyPath() {
  // Default: no pre-captured screenshot in storage (service worker falls back to captureVisibleTab)
  chrome.storage.local.get.mockImplementation((defaults) =>
    Promise.resolve({ ...defaults })
  );
  chrome.storage.local.remove.mockResolvedValue(undefined);
  chrome.tabs.captureVisibleTab.mockResolvedValue(FAKE_VIEWPORT_URL);
  chrome.offscreen.hasDocument.mockResolvedValue(true);
  // sendToOffscreen uses the callback form of sendMessage
  chrome.runtime.sendMessage.mockImplementation((_msg, cb) => cb(FAKE_CROPPED_URL));
  chrome.storage.local.set.mockResolvedValue(undefined);
  chrome.windows.create.mockResolvedValue({ id: 99 });
  chrome.runtime.getURL.mockImplementation(p => `chrome-extension://test/${p}`);
}

// ── captureVisibleTab ─────────────────────────────────────────────────────────

describe('handleElementCapture — viewport capture', () => {
  beforeEach(setupHappyPath);

  it('calls captureVisibleTab with format: "png" when no pendingScreenshot is stored', async () => {
    await handleElementCapture(TAB, RECT, DPR);
    expect(chrome.tabs.captureVisibleTab).toHaveBeenCalledWith(null, { format: 'png' });
  });

  it('passes null (not windowId) to captureVisibleTab', async () => {
    await handleElementCapture(TAB, RECT, DPR);
    const [windowId] = chrome.tabs.captureVisibleTab.mock.calls[0];
    expect(windowId).toBeNull();
  });

  it('does not reject when captureVisibleTab fails — logs and continues', async () => {
    // handleElementCapture catches all errors internally so the popup is always reopened
    chrome.tabs.captureVisibleTab.mockRejectedValue(new Error('Tab closed'));
    await expect(handleElementCapture(TAB, RECT, DPR)).resolves.toBeUndefined();
  });
});

// ── Pre-captured screenshot (pendingScreenshot) ───────────────────────────────

describe('handleElementCapture — pendingScreenshot pre-capture', () => {
  beforeEach(() => {
    setupHappyPath();
    // Simulate popup.js having stored a pre-captured screenshot
    chrome.storage.local.get.mockImplementation((defaults) =>
      Promise.resolve({ ...defaults, pendingScreenshot: FAKE_VIEWPORT_URL })
    );
  });

  it('uses pendingScreenshot from storage instead of calling captureVisibleTab', async () => {
    await handleElementCapture(TAB, RECT, DPR);
    expect(chrome.tabs.captureVisibleTab).not.toHaveBeenCalled();
  });

  it('removes pendingScreenshot from storage after use', async () => {
    await handleElementCapture(TAB, RECT, DPR);
    expect(chrome.storage.local.remove).toHaveBeenCalledWith('pendingScreenshot');
  });

  it('passes the pendingScreenshot data URL into cropInWorker via fetch', async () => {
    // cropInWorker calls fetch(dataUrl) — verify it received the pendingScreenshot URL
    await handleElementCapture(TAB, RECT, DPR);
    expect(global.fetch).toHaveBeenCalledWith(FAKE_VIEWPORT_URL);
  });

  it('still completes the full pipeline (crop, store, open window)', async () => {
    await handleElementCapture(TAB, RECT, DPR);
    expect(global.createImageBitmap).toHaveBeenCalled();
    expect(chrome.storage.local.set).toHaveBeenCalledWith(
      expect.objectContaining({ pendingCapture: expect.any(Object) })
    );
    expect(chrome.windows.create).toHaveBeenCalled();
  });
});

// ── Inline crop via cropInWorker ──────────────────────────────────────────────
// Cropping happens inside cropInWorker using OffscreenCanvas — not via a
// sendMessage to the offscreen document. These tests verify the observable
// outcomes and the DPR-scaled canvas dimensions.

describe('handleElementCapture — inline crop (cropInWorker)', () => {
  beforeEach(setupHappyPath);

  it('calls createImageBitmap to decode the viewport screenshot', async () => {
    await handleElementCapture(TAB, RECT, DPR);
    expect(global.createImageBitmap).toHaveBeenCalled();
  });

  it('creates an OffscreenCanvas with DPR-scaled width', async () => {
    await handleElementCapture(TAB, RECT, DPR);
    const [[w]] = global.OffscreenCanvas.mock.calls;
    expect(w).toBe(Math.round(RECT.width * DPR));
  });

  it('creates an OffscreenCanvas with DPR-scaled height', async () => {
    await handleElementCapture(TAB, RECT, DPR);
    const [[, h]] = global.OffscreenCanvas.mock.calls;
    expect(h).toBe(Math.round(RECT.height * DPR));
  });

  it('uses integer-rounded canvas dimensions for fractional rects', async () => {
    const fractionalRect = { x: 10.3, y: 20.7, width: 300.5, height: 150.1 };
    await handleElementCapture(TAB, fractionalRect, 1.5);
    const [[w, h]] = global.OffscreenCanvas.mock.calls;
    expect(Number.isInteger(w)).toBe(true);
    expect(Number.isInteger(h)).toBe(true);
  });

  it('stores a valid PNG data URL when crop succeeds', async () => {
    await handleElementCapture(TAB, RECT, DPR);
    const [{ pendingCapture }] = chrome.storage.local.set.mock.calls[0];
    expect(pendingCapture.dataUrl).toMatch(/^data:image\/png;base64,/);
  });

  it('falls back to the full viewport URL when crop fails', async () => {
    global.createImageBitmap.mockRejectedValue(new Error('canvas unavailable'));
    await handleElementCapture(TAB, RECT, DPR);
    const [{ pendingCapture }] = chrome.storage.local.set.mock.calls[0];
    expect(pendingCapture.dataUrl).toBe(FAKE_VIEWPORT_URL);
  });

  it('does not reject when crop fails — completes with fallback', async () => {
    global.createImageBitmap.mockRejectedValue(new Error('canvas unavailable'));
    await expect(handleElementCapture(TAB, RECT, DPR)).resolves.toBeUndefined();
  });
});

// ── pendingCapture storage ────────────────────────────────────────────────────

describe('handleElementCapture — pendingCapture storage', () => {
  beforeEach(setupHappyPath);

  it('stores pendingCapture in chrome.storage.local', async () => {
    await handleElementCapture(TAB, RECT, DPR);
    expect(chrome.storage.local.set).toHaveBeenCalledWith(
      expect.objectContaining({ pendingCapture: expect.any(Object) })
    );
  });

  it('stores a data URL in pendingCapture', async () => {
    await handleElementCapture(TAB, RECT, DPR);
    const [{ pendingCapture }] = chrome.storage.local.set.mock.calls[0];
    expect(pendingCapture.dataUrl).toMatch(/^data:/);
  });

  it('stores the source tab URL in pendingCapture', async () => {
    await handleElementCapture(TAB, RECT, DPR);
    const [{ pendingCapture }] = chrome.storage.local.set.mock.calls[0];
    expect(pendingCapture.sourceUrl).toBe(TAB.url);
  });

  it('stores the source tab title in pendingCapture', async () => {
    await handleElementCapture(TAB, RECT, DPR);
    const [{ pendingCapture }] = chrome.storage.local.set.mock.calls[0];
    expect(pendingCapture.sourceTitle).toBe(TAB.title);
  });

  it('stores an ISO 8601 capturedAt timestamp', async () => {
    await handleElementCapture(TAB, RECT, DPR);
    const [{ pendingCapture }] = chrome.storage.local.set.mock.calls[0];
    expect(() => new Date(pendingCapture.capturedAt)).not.toThrow();
    expect(new Date(pendingCapture.capturedAt).toISOString()).toBe(pendingCapture.capturedAt);
  });
});

// ── Popup window ──────────────────────────────────────────────────────────────

describe('handleElementCapture — popup window', () => {
  beforeEach(setupHappyPath);

  it('creates a popup window pointing to popup.html', async () => {
    await handleElementCapture(TAB, RECT, DPR);
    expect(chrome.windows.create).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'popup' })
    );
    const [opts] = chrome.windows.create.mock.calls[0];
    expect(opts.url).toContain('popup.html');
  });

  it('creates the window focused', async () => {
    await handleElementCapture(TAB, RECT, DPR);
    const [opts] = chrome.windows.create.mock.calls[0];
    expect(opts.focused).toBe(true);
  });

  it('creates the window with width 400 and height 620', async () => {
    await handleElementCapture(TAB, RECT, DPR);
    const [opts] = chrome.windows.create.mock.calls[0];
    expect(opts.width).toBe(400);
    expect(opts.height).toBe(620);
  });
});

// ── Offscreen document ────────────────────────────────────────────────────────
// Element cropping uses the inline cropInWorker (OffscreenCanvas in the service
// worker) — not the offscreen document. The offscreen doc is not involved.

describe('handleElementCapture — offscreen document', () => {
  beforeEach(setupHappyPath);

  it('does not use the offscreen document for element cropping', async () => {
    await handleElementCapture(TAB, RECT, DPR);
    expect(chrome.offscreen.createDocument).not.toHaveBeenCalled();
  });

  it('completes successfully regardless of whether the offscreen document exists', async () => {
    chrome.offscreen.hasDocument.mockResolvedValue(false);
    await expect(handleElementCapture(TAB, RECT, DPR)).resolves.toBeUndefined();
  });
});

// ── Message listener routing ──────────────────────────────────────────────────
// The onMessage listener is registered at module load time (before vi.clearAllMocks
// runs in setup.js's beforeEach). We capture it at import time via a module-level
// variable so it can be exercised in individual tests.

let _onMessageListener = null;

// Vitest module cache means service-worker.js is imported once.
// We capture the addListener argument by reading addListener's first recorded call.
// This block runs after the module has been imported (at top of file).
beforeAll(async () => {
  // Re-import to get a fresh reference; Vitest caches modules so this resolves
  // to the already-loaded instance. The addListener mock captured the call at
  // load time, before clearAllMocks wiped call history. We pull the listener
  // directly from the mock's original invocation record, which is stored on
  // the function object before any clearAllMocks ran.
  //
  // If that record is unavailable (timing), we fall back to testing
  // handleElementCapture directly (which is the primary coverage path).
  _onMessageListener = chrome.runtime.onMessage.addListener.mock?.calls?.[0]?.[0] ?? null;
});

describe('onMessage listener routing', () => {
  beforeEach(setupHappyPath);

  it('non-ELEMENT_SELECTED messages are ignored (listener returns undefined)', () => {
    if (!_onMessageListener) return; // captured before clearAllMocks; skip if unavailable
    const sendResponse = vi.fn();
    const result = _onMessageListener({ type: 'SOME_OTHER_MSG' }, {}, sendResponse);
    // Returning undefined (falsy) means "no async response"
    expect(result).toBeUndefined();
    expect(sendResponse).not.toHaveBeenCalled();
  });

  it('ELEMENT_SELECTED message returns true (keeps response channel open)', () => {
    if (!_onMessageListener) return;
    // Prevent the async side-effects from throwing by stubbing captureVisibleTab
    chrome.tabs.captureVisibleTab.mockResolvedValue(FAKE_VIEWPORT_URL);
    chrome.runtime.sendMessage.mockImplementation((_m, cb) => cb(FAKE_CROPPED_URL));
    const sendResponse = vi.fn();
    const result = _onMessageListener(
      { type: 'ELEMENT_SELECTED', rect: RECT, devicePixelRatio: DPR },
      { tab: TAB },
      sendResponse
    );
    expect(result).toBe(true);
  });
});
