/**
 * tests/capture-element.test.js
 * Unit tests for src/background/capture-element.js
 */

import { describe, it, expect, vi } from 'vitest';
import { startPicker, captureSelected } from '../src/background/capture-element.js';

const TAB_ID = 1;
const FAKE_VIEWPORT_URL = 'data:image/png;base64,iVBORw0KGgo=';
const FAKE_CROPPED_URL  = 'data:image/png;base64,cropped=';

const RECT = { x: 10, y: 20, width: 300, height: 200 };
const DPR  = 2;
const OPTIONS = { format: 'PNG', quality: 90 };

// ── startPicker ───────────────────────────────────────────────────────────────

describe('startPicker', () => {
  it('injects the element-picker content script', async () => {
    chrome.scripting.executeScript.mockResolvedValue([{ result: undefined }]);

    await startPicker(TAB_ID);

    expect(chrome.scripting.executeScript).toHaveBeenCalledWith(
      expect.objectContaining({ files: ['src/content/element-picker.js'] })
    );
  });

  it('targets the correct tabId', async () => {
    chrome.scripting.executeScript.mockResolvedValue([{ result: undefined }]);

    await startPicker(99);

    expect(chrome.scripting.executeScript).toHaveBeenCalledWith(
      expect.objectContaining({ target: { tabId: 99 } })
    );
  });

  it('throws CONTENT_SCRIPT_BLOCKED on restricted page', async () => {
    chrome.scripting.executeScript.mockRejectedValue(new Error('Cannot access chrome://settings'));

    await expect(startPicker(TAB_ID)).rejects.toThrow('CONTENT_SCRIPT_BLOCKED');
  });

  it('throws CONTENT_SCRIPT_BLOCKED when injection is refused', async () => {
    chrome.scripting.executeScript.mockRejectedValue(new Error('Script injection refused'));

    await expect(startPicker(TAB_ID)).rejects.toThrow('CONTENT_SCRIPT_BLOCKED');
  });

  it('re-throws non-CSP errors unchanged', async () => {
    chrome.scripting.executeScript.mockRejectedValue(new Error('Network error'));

    await expect(startPicker(TAB_ID)).rejects.toThrow('Network error');
  });
});

// ── captureSelected ───────────────────────────────────────────────────────────

describe('captureSelected', () => {
  beforeEach(() => {
    chrome.tabs.captureVisibleTab.mockResolvedValue(FAKE_VIEWPORT_URL);
    chrome.offscreen.hasDocument.mockResolvedValue(true);
    chrome.runtime.sendMessage.mockResolvedValue(FAKE_CROPPED_URL);
  });

  it('captures the visible tab viewport', async () => {
    await captureSelected(null, RECT, DPR, OPTIONS);

    expect(chrome.tabs.captureVisibleTab).toHaveBeenCalledWith(null, {
      format:  'png',
      quality: 90,
    });
  });

  it('uses jpeg format for JPG output', async () => {
    await captureSelected(null, RECT, DPR, { format: 'JPG', quality: 85 });

    expect(chrome.tabs.captureVisibleTab).toHaveBeenCalledWith(null, {
      format:  'jpeg',
      quality: 85,
    });
  });

  it('sends a CROP_IMAGE message to the offscreen document', async () => {
    await captureSelected(null, RECT, DPR, OPTIONS);

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'CROP_IMAGE', target: 'offscreen' })
    );
  });

  it('scales the rect by devicePixelRatio', async () => {
    await captureSelected(null, RECT, DPR, OPTIONS);

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        rect: {
          x:      Math.round(RECT.x      * DPR),
          y:      Math.round(RECT.y      * DPR),
          width:  Math.round(RECT.width  * DPR),
          height: Math.round(RECT.height * DPR),
        },
      })
    );
  });

  it('passes the output format in lowercase', async () => {
    await captureSelected(null, RECT, DPR, { format: 'PNG', quality: 90 });

    const msg = chrome.runtime.sendMessage.mock.calls[0][0];
    expect(msg.outputFormat).toBe('png');
  });

  it('returns the cropped data URL from the offscreen document', async () => {
    const result = await captureSelected(null, RECT, DPR, OPTIONS);
    expect(result).toBe(FAKE_CROPPED_URL);
  });

  it('works with DPR = 1 (no scaling)', async () => {
    await captureSelected(null, RECT, 1, OPTIONS);

    const msg = chrome.runtime.sendMessage.mock.calls[0][0];
    expect(msg.rect.x).toBe(RECT.x);
    expect(msg.rect.y).toBe(RECT.y);
    expect(msg.rect.width).toBe(RECT.width);
    expect(msg.rect.height).toBe(RECT.height);
  });

  it('creates the offscreen document when absent', async () => {
    chrome.offscreen.hasDocument.mockResolvedValue(false);

    await captureSelected(null, RECT, DPR, OPTIONS);

    expect(chrome.offscreen.createDocument).toHaveBeenCalled();
  });

  it('does not recreate offscreen document when it already exists', async () => {
    chrome.offscreen.hasDocument.mockResolvedValue(true);

    await captureSelected(null, RECT, DPR, OPTIONS);

    expect(chrome.offscreen.createDocument).not.toHaveBeenCalled();
  });
});
