/**
 * tests/capture-viewport.test.js
 * Unit tests for src/background/capture-viewport.js
 */

import { describe, it, expect } from 'vitest';
import { capture } from '../src/background/capture-viewport.js';
import { SIZE_PRESETS } from '../src/lib/constants.js';

const TAB_ID = 1;
const BASE_OPTIONS = { format: 'PNG', quality: 90, sizePreset: 'As-is' };
const FAKE_DATA_URL = 'data:image/png;base64,iVBORw0KGgo=';

// ── As-is (no emulation) ───────────────────────────────────────────────────────

describe('capture — As-is (no emulation)', () => {
  it('calls captureVisibleTab with png format for PNG', async () => {
    chrome.tabs.captureVisibleTab.mockResolvedValue(FAKE_DATA_URL);

    await capture(TAB_ID, { ...BASE_OPTIONS, format: 'PNG' });

    expect(chrome.tabs.captureVisibleTab).toHaveBeenCalledWith(null, {
      format:  'png',
      quality: 90,
    });
  });

  it('calls captureVisibleTab with jpeg format for JPG', async () => {
    chrome.tabs.captureVisibleTab.mockResolvedValue(FAKE_DATA_URL);

    await capture(TAB_ID, { ...BASE_OPTIONS, format: 'JPG' });

    expect(chrome.tabs.captureVisibleTab).toHaveBeenCalledWith(null, {
      format:  'jpeg',
      quality: 90,
    });
  });

  it('returns the data URL from captureVisibleTab', async () => {
    chrome.tabs.captureVisibleTab.mockResolvedValue(FAKE_DATA_URL);

    const result = await capture(TAB_ID, BASE_OPTIONS);

    expect(result).toBe(FAKE_DATA_URL);
  });

  it('does not touch the debugger for As-is', async () => {
    chrome.tabs.captureVisibleTab.mockResolvedValue(FAKE_DATA_URL);

    await capture(TAB_ID, BASE_OPTIONS);

    expect(chrome.debugger.attach).not.toHaveBeenCalled();
    expect(chrome.debugger.detach).not.toHaveBeenCalled();
  });
});

// ── WebP conversion ────────────────────────────────────────────────────────────

describe('capture — WebP format', () => {
  it('sends a CONVERT_FORMAT message to the offscreen document', async () => {
    chrome.tabs.captureVisibleTab.mockResolvedValue(FAKE_DATA_URL);
    chrome.runtime.sendMessage.mockResolvedValue('data:image/webp;base64,abc=');

    const result = await capture(TAB_ID, { ...BASE_OPTIONS, format: 'WebP' });

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'CONVERT_FORMAT', format: 'webp', target: 'offscreen' })
    );
    expect(result).toBe('data:image/webp;base64,abc=');
  });

  it('creates the offscreen document if it does not exist', async () => {
    chrome.tabs.captureVisibleTab.mockResolvedValue(FAKE_DATA_URL);
    chrome.offscreen.hasDocument.mockResolvedValue(false);
    chrome.runtime.sendMessage.mockResolvedValue('data:image/webp;base64,abc=');

    await capture(TAB_ID, { ...BASE_OPTIONS, format: 'WebP' });

    expect(chrome.offscreen.createDocument).toHaveBeenCalled();
  });

  it('does not recreate the offscreen document if it already exists', async () => {
    chrome.tabs.captureVisibleTab.mockResolvedValue(FAKE_DATA_URL);
    chrome.offscreen.hasDocument.mockResolvedValue(true);
    chrome.runtime.sendMessage.mockResolvedValue('data:image/webp;base64,abc=');

    await capture(TAB_ID, { ...BASE_OPTIONS, format: 'WebP' });

    expect(chrome.offscreen.createDocument).not.toHaveBeenCalled();
  });
});

// ── Viewport emulation ────────────────────────────────────────────────────────

describe('capture — with size preset (emulation)', () => {
  beforeEach(() => {
    chrome.tabs.captureVisibleTab.mockResolvedValue(FAKE_DATA_URL);
  });

  it('attaches the debugger for a non-As-is preset', async () => {
    await capture(TAB_ID, { ...BASE_OPTIONS, sizePreset: 'Desktop' });

    expect(chrome.debugger.attach).toHaveBeenCalledWith({ tabId: TAB_ID }, '1.3');
  });

  it('detaches the debugger after capture', async () => {
    await capture(TAB_ID, { ...BASE_OPTIONS, sizePreset: 'Desktop' });

    expect(chrome.debugger.detach).toHaveBeenCalledWith({ tabId: TAB_ID });
  });

  it('still detaches the debugger even when captureVisibleTab throws', async () => {
    chrome.tabs.captureVisibleTab.mockRejectedValue(new Error('capture failed'));

    await expect(
      capture(TAB_ID, { ...BASE_OPTIONS, sizePreset: 'Desktop' })
    ).rejects.toThrow('capture failed');

    expect(chrome.debugger.detach).toHaveBeenCalledWith({ tabId: TAB_ID });
  });
});

// ── Export size matches preset dimensions ─────────────────────────────────────

describe('capture — export size matches selected preset', () => {
  const RESIZED_DATA_URL = 'data:image/png;base64,RESIZED=';

  beforeEach(() => {
    chrome.permissions.contains.mockResolvedValue(true);
    chrome.tabs.captureVisibleTab.mockResolvedValue(FAKE_DATA_URL);
    chrome.runtime.sendMessage.mockResolvedValue(RESIZED_DATA_URL);
  });

  // Test every named preset
  const namedPresets = Object.entries(SIZE_PRESETS).filter(([, dims]) => dims !== null);

  namedPresets.forEach(([name, { w, h }]) => {
    it(`sends RESIZE_IMAGE with ${w}x${h} for "${name}" preset`, async () => {
      await capture(TAB_ID, { ...BASE_OPTIONS, sizePreset: name });

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type:   'RESIZE_IMAGE',
          width:  w,
          height: h,
          target: 'offscreen',
        })
      );
    });

    it(`returns the resized data URL for "${name}" preset`, async () => {
      const result = await capture(TAB_ID, { ...BASE_OPTIONS, sizePreset: name });
      expect(result).toBe(RESIZED_DATA_URL);
    });
  });

  it('sends RESIZE_IMAGE with customWidth/customHeight for "Custom" preset', async () => {
    await capture(TAB_ID, {
      ...BASE_OPTIONS,
      sizePreset:   'Custom',
      customWidth:  1600,
      customHeight: 900,
    });

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type:   'RESIZE_IMAGE',
        width:  1600,
        height: 900,
        target: 'offscreen',
      })
    );
  });

  it('does NOT send RESIZE_IMAGE for "As-is" preset', async () => {
    await capture(TAB_ID, BASE_OPTIONS); // sizePreset: 'As-is'

    const resizeCalls = chrome.runtime.sendMessage.mock.calls.filter(
      ([msg]) => msg?.type === 'RESIZE_IMAGE'
    );
    expect(resizeCalls).toHaveLength(0);
  });
});

// ── Offscreen document retry ───────────────────────────────────────────────────

describe('capture — offscreen document retry', () => {
  it('retries offscreen creation if first attempt fails but document appears', async () => {
    chrome.tabs.captureVisibleTab.mockResolvedValue(FAKE_DATA_URL);

    // First call to hasDocument: false
    // createDocument: throws
    // Second call to hasDocument: true (someone else created it)
    chrome.offscreen.hasDocument
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    chrome.offscreen.createDocument.mockRejectedValue(new Error('Already exists'));
    chrome.runtime.sendMessage.mockResolvedValue('data:image/webp;base64,abc=');

    // Should not throw
    await expect(
      capture(TAB_ID, { ...BASE_OPTIONS, format: 'WebP' })
    ).resolves.toBeDefined();
  });

  it('throws if offscreen creation fails and document is still absent', async () => {
    chrome.tabs.captureVisibleTab.mockResolvedValue(FAKE_DATA_URL);

    chrome.offscreen.hasDocument.mockResolvedValue(false);
    chrome.offscreen.createDocument.mockRejectedValue(new Error('Failed hard'));

    await expect(
      capture(TAB_ID, { ...BASE_OPTIONS, format: 'WebP' })
    ).rejects.toThrow('Failed to create offscreen document');
  });
});
