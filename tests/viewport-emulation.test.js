/**
 * tests/viewport-emulation.test.js
 * Unit tests for src/background/viewport-emulation.js
 */

import { describe, it, expect, vi } from 'vitest';
import { emulateViewport, clearViewportEmulation } from '../src/background/viewport-emulation.js';
import { SIZE_PRESETS } from '../src/lib/constants.js';

const TAB_ID = 42;

// ── emulateViewport ────────────────────────────────────────────────────────────

describe('emulateViewport', () => {
  it('attaches the debugger to the given tabId', async () => {
    await emulateViewport(TAB_ID, { sizePreset: 'Desktop' });

    expect(chrome.debugger.attach).toHaveBeenCalledWith({ tabId: TAB_ID }, '1.3');
  });

  it('sends Emulation.setDeviceMetricsOverride with Desktop preset dimensions', async () => {
    await emulateViewport(TAB_ID, { sizePreset: 'Desktop' });

    expect(chrome.debugger.sendCommand).toHaveBeenCalledWith(
      { tabId: TAB_ID },
      'Emulation.setDeviceMetricsOverride',
      expect.objectContaining({ width: 1440, height: 900 })
    );
  });

  it('sends Emulation.setDeviceMetricsOverride with Mobile preset dimensions', async () => {
    await emulateViewport(TAB_ID, { sizePreset: 'Mobile' });

    expect(chrome.debugger.sendCommand).toHaveBeenCalledWith(
      { tabId: TAB_ID },
      'Emulation.setDeviceMetricsOverride',
      expect.objectContaining({ width: 375, height: 812, mobile: true })
    );
  });

  it('sets mobile: true for widths <= 768', async () => {
    await emulateViewport(TAB_ID, { sizePreset: 'Tablet' }); // 768px

    const call = chrome.debugger.sendCommand.mock.calls[0][2];
    expect(call.mobile).toBe(true);
  });

  it('sets mobile: false for widths > 768', async () => {
    await emulateViewport(TAB_ID, { sizePreset: 'Laptop' }); // 1280px

    const call = chrome.debugger.sendCommand.mock.calls[0][2];
    expect(call.mobile).toBe(false);
  });

  it('always sets deviceScaleFactor to 2', async () => {
    await emulateViewport(TAB_ID, { sizePreset: 'Desktop HD' });

    const call = chrome.debugger.sendCommand.mock.calls[0][2];
    expect(call.deviceScaleFactor).toBe(2);
  });

  it('uses customWidth/customHeight when sizePreset is Custom', async () => {
    await emulateViewport(TAB_ID, {
      sizePreset:   'Custom',
      customWidth:  1600,
      customHeight: 1000,
    });

    expect(chrome.debugger.sendCommand).toHaveBeenCalledWith(
      { tabId: TAB_ID },
      'Emulation.setDeviceMetricsOverride',
      expect.objectContaining({ width: 1600, height: 1000 })
    );
  });

  it('falls back to 1440×900 when customWidth/customHeight are missing', async () => {
    await emulateViewport(TAB_ID, { sizePreset: 'Custom' });

    expect(chrome.debugger.sendCommand).toHaveBeenCalledWith(
      { tabId: TAB_ID },
      'Emulation.setDeviceMetricsOverride',
      expect.objectContaining({ width: 1440, height: 900 })
    );
  });

  it('covers all preset names defined in SIZE_PRESETS', async () => {
    for (const [name, dims] of Object.entries(SIZE_PRESETS)) {
      if (!dims) continue; // 'As-is' has no dimensions
      vi.clearAllMocks();
      chrome.debugger.attach.mockResolvedValue(undefined);
      chrome.debugger.sendCommand.mockResolvedValue(undefined);

      await emulateViewport(TAB_ID, { sizePreset: name });

      const cmd = chrome.debugger.sendCommand.mock.calls[0][2];
      expect(cmd.width).toBe(dims.w);
      expect(cmd.height).toBe(dims.h);
    }
  });

  it('does not call chrome.permissions.request (debugger is a required permission)', async () => {
    await emulateViewport(TAB_ID, { sizePreset: 'Desktop' });

    expect(chrome.permissions.request).not.toHaveBeenCalled();
  });
});

// ── clearViewportEmulation ────────────────────────────────────────────────────

describe('clearViewportEmulation', () => {
  it('sends Emulation.clearDeviceMetricsOverride', async () => {
    await clearViewportEmulation(TAB_ID);

    expect(chrome.debugger.sendCommand).toHaveBeenCalledWith(
      { tabId: TAB_ID },
      'Emulation.clearDeviceMetricsOverride',
      {}
    );
  });

  it('detaches the debugger', async () => {
    await clearViewportEmulation(TAB_ID);

    expect(chrome.debugger.detach).toHaveBeenCalledWith({ tabId: TAB_ID });
  });

  it('does not throw if sendCommand fails (already detached)', async () => {
    chrome.debugger.sendCommand.mockRejectedValue(new Error('Detached'));

    await expect(clearViewportEmulation(TAB_ID)).resolves.toBeUndefined();
  });

  it('does not throw if detach fails (already detached)', async () => {
    chrome.debugger.detach.mockRejectedValue(new Error('No debugger'));

    await expect(clearViewportEmulation(TAB_ID)).resolves.toBeUndefined();
  });

  it('still attempts detach even when sendCommand throws', async () => {
    chrome.debugger.sendCommand.mockRejectedValue(new Error('error'));

    await clearViewportEmulation(TAB_ID);

    expect(chrome.debugger.detach).toHaveBeenCalledWith({ tabId: TAB_ID });
  });
});
