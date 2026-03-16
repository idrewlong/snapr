/**
 * tests/capture-fullpage.test.js
 * Unit tests for src/background/capture-fullpage.js
 */

import { describe, it, expect, vi } from 'vitest';
import { capture } from '../src/background/capture-fullpage.js';

const TAB_ID = 1;
const FAKE_FRAME = 'data:image/jpeg;base64,/9j/abc=';
const BASE_OPTIONS = { format: 'PNG', quality: 90, maxFullPageHeight: 15000 };

// Simulates content script responding to SCROLL_INFO
const SCROLL_INFO_RESPONSE = {
  scrollHeight:   2000,
  viewportHeight: 800,
  viewportWidth:  1440,
};

function setupScrollMocks(scrollInfo = SCROLL_INFO_RESPONSE) {
  // executeScript for injection → resolves (no-op)
  chrome.scripting.executeScript.mockResolvedValue([{ result: undefined }]);
  // SCROLL_INFO message
  chrome.tabs.sendMessage
    .mockResolvedValueOnce(scrollInfo)   // SCROLL_INFO
    .mockResolvedValue({ done: true });   // SCROLL_TO (all subsequent)
  chrome.tabs.captureVisibleTab.mockResolvedValue(FAKE_FRAME);
  chrome.offscreen.hasDocument.mockResolvedValue(false);
  chrome.offscreen.createDocument.mockResolvedValue(undefined);
  chrome.runtime.sendMessage.mockResolvedValue('data:image/png;base64,composited=');
}

// ── Happy path ────────────────────────────────────────────────────────────────

describe('capture — happy path', () => {
  it('injects the full-page content script', async () => {
    setupScrollMocks();
    await capture(TAB_ID, BASE_OPTIONS);
    expect(chrome.scripting.executeScript).toHaveBeenCalledWith(
      expect.objectContaining({ files: ['src/content/full-page.js'] })
    );
  });

  it('requests SCROLL_INFO from the content script', async () => {
    setupScrollMocks();
    await capture(TAB_ID, BASE_OPTIONS);
    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(TAB_ID, { type: 'SCROLL_INFO' });
  });

  it('captures multiple frames for a tall page', async () => {
    // scrollHeight=2000, viewportHeight=800 → ceil(2000/800) = 3 frames
    setupScrollMocks({ scrollHeight: 2000, viewportHeight: 800, viewportWidth: 1440 });
    await capture(TAB_ID, BASE_OPTIONS);
    // captureVisibleTab called once per frame
    expect(chrome.tabs.captureVisibleTab.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('calls SCROLL_TO with incrementing y offsets', async () => {
    setupScrollMocks({ scrollHeight: 2000, viewportHeight: 800, viewportWidth: 1440 });
    await capture(TAB_ID, BASE_OPTIONS);
    const scrollToCalls = chrome.tabs.sendMessage.mock.calls
      .filter(([, msg]) => msg.type === 'SCROLL_TO');
    expect(scrollToCalls[0][1].y).toBe(0);
    expect(scrollToCalls[1][1].y).toBe(800);
  });

  it('sends COMPOSITE_FRAMES to the offscreen document', async () => {
    setupScrollMocks();
    await capture(TAB_ID, BASE_OPTIONS);
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'COMPOSITE_FRAMES', target: 'offscreen' })
    );
  });

  it('returns an object with dataUrl and capped: false for a short page', async () => {
    setupScrollMocks({ scrollHeight: 500, viewportHeight: 800, viewportWidth: 1440 });
    const result = await capture(TAB_ID, BASE_OPTIONS);
    expect(result).toMatchObject({ dataUrl: expect.any(String), capped: false });
  });

  it('restores fixed elements after capture', async () => {
    setupScrollMocks();
    await capture(TAB_ID, BASE_OPTIONS);
    const restoreCalls = chrome.scripting.executeScript.mock.calls.filter(
      ([opts]) => typeof opts.func === 'function'
    );
    expect(restoreCalls.length).toBeGreaterThanOrEqual(1);
  });
});

// ── Height cap ────────────────────────────────────────────────────────────────

describe('capture — height capping', () => {
  it('sets capped: true when scrollHeight exceeds maxFullPageHeight', async () => {
    setupScrollMocks({ scrollHeight: 20000, viewportHeight: 800, viewportWidth: 1440 });
    const result = await capture(TAB_ID, { ...BASE_OPTIONS, maxFullPageHeight: 15000 });
    expect(result.capped).toBe(true);
  });

  it('sets capped: false when scrollHeight is within limit', async () => {
    setupScrollMocks({ scrollHeight: 5000, viewportHeight: 800, viewportWidth: 1440 });
    const result = await capture(TAB_ID, { ...BASE_OPTIONS, maxFullPageHeight: 15000 });
    expect(result.capped).toBe(false);
  });

  it('respects custom maxFullPageHeight', async () => {
    setupScrollMocks({ scrollHeight: 6000, viewportHeight: 800, viewportWidth: 1440 });
    const result = await capture(TAB_ID, { ...BASE_OPTIONS, maxFullPageHeight: 5000 });
    expect(result.capped).toBe(true);
  });

  it('defaults maxFullPageHeight to 15000 when not provided', async () => {
    setupScrollMocks({ scrollHeight: 20000, viewportHeight: 800, viewportWidth: 1440 });
    const result = await capture(TAB_ID, { format: 'PNG', quality: 90 });
    expect(result.capped).toBe(true);
  });
});

// ── CSP / injection failure ────────────────────────────────────────────────────

describe('capture — content script injection failure', () => {
  it('throws CONTENT_SCRIPT_BLOCKED when Cannot access error occurs', async () => {
    chrome.scripting.executeScript.mockRejectedValue(new Error('Cannot access chrome://newtab'));

    await expect(capture(TAB_ID, BASE_OPTIONS)).rejects.toThrow('CONTENT_SCRIPT_BLOCKED');
  });

  it('throws CONTENT_SCRIPT_BLOCKED when page refuses injection', async () => {
    chrome.scripting.executeScript.mockRejectedValue(new Error('Script injection refused'));

    await expect(capture(TAB_ID, BASE_OPTIONS)).rejects.toThrow('CONTENT_SCRIPT_BLOCKED');
  });

  it('re-throws non-CSP errors unchanged', async () => {
    chrome.scripting.executeScript.mockRejectedValue(new Error('Tab was closed'));

    await expect(capture(TAB_ID, BASE_OPTIONS)).rejects.toThrow('Tab was closed');
  });
});

// ── Fixed element restore on error ────────────────────────────────────────────

describe('capture — fixed element restore on error', () => {
  it('restores fixed elements even when captureVisibleTab throws mid-loop', async () => {
    chrome.scripting.executeScript.mockResolvedValue([{ result: undefined }]);
    chrome.tabs.sendMessage
      .mockResolvedValueOnce({ scrollHeight: 2000, viewportHeight: 800, viewportWidth: 1440 })
      .mockResolvedValue({ done: true });
    chrome.tabs.captureVisibleTab
      .mockResolvedValueOnce(FAKE_FRAME)
      .mockRejectedValue(new Error('Capture failed'));

    await expect(capture(TAB_ID, BASE_OPTIONS)).rejects.toThrow('Capture failed');

    const restoreCalls = chrome.scripting.executeScript.mock.calls.filter(
      ([opts]) => typeof opts.func === 'function'
    );
    expect(restoreCalls.length).toBeGreaterThanOrEqual(1);
  });
});
