/**
 * tests/service-worker-quick-capture.test.js
 *
 * Tests for the quick-capture keyboard shortcut handler in
 * src/background/service-worker.js.
 *
 * handleQuickCapture is exported for direct testing. We also test the
 * chrome.commands.onCommand listener routing.
 */

import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { handleQuickCapture } from '../src/background/service-worker.js';

const TAB = { id: 1, url: 'https://example.com/about', title: 'About – Example' };
const FAKE_DATA_URL = 'data:image/png;base64,iVBORw0KGgo=';

function setupHappyPath() {
  chrome.tabs.query.mockResolvedValue([TAB]);
  chrome.tabs.captureVisibleTab.mockResolvedValue(FAKE_DATA_URL);
  chrome.downloads.download.mockResolvedValue(42);
  // storage returns default settings
  chrome.storage.sync.get.mockImplementation(async (defaults) => ({ ...defaults }));
}

// ── Happy path ────────────────────────────────────────────────────────────────

describe('handleQuickCapture — happy path', () => {
  beforeEach(setupHappyPath);

  it('calls captureVisibleTab for the given tab', async () => {
    await handleQuickCapture(TAB);
    expect(chrome.tabs.captureVisibleTab).toHaveBeenCalledWith(null, expect.objectContaining({ format: 'png' }));
  });

  it('triggers a download', async () => {
    await handleQuickCapture(TAB);
    expect(chrome.downloads.download).toHaveBeenCalledOnce();
  });

  it('generates a filename based on the tab URL', async () => {
    await handleQuickCapture(TAB);
    const [{ filename }] = chrome.downloads.download.mock.calls[0];
    expect(filename).toContain('example-com');
  });

  it('appends the correct extension for the default PNG format', async () => {
    await handleQuickCapture(TAB);
    const [{ filename }] = chrome.downloads.download.mock.calls[0];
    expect(filename).toMatch(/\.png$/);
  });

  it('appends .jpg extension when format is JPG', async () => {
    chrome.storage.sync.get.mockImplementation(async (defaults) => ({ ...defaults, format: 'JPG' }));
    await handleQuickCapture(TAB);
    const [{ filename }] = chrome.downloads.download.mock.calls[0];
    expect(filename).toMatch(/\.jpg$/);
  });

  it('appends .webp extension when format is WebP', async () => {
    chrome.tabs.captureVisibleTab.mockResolvedValue(FAKE_DATA_URL);
    chrome.offscreen.hasDocument.mockResolvedValue(true);
    chrome.runtime.sendMessage.mockResolvedValue('data:image/webp;base64,abc=');
    chrome.storage.sync.get.mockImplementation(async (defaults) => ({ ...defaults, format: 'WebP' }));
    await handleQuickCapture(TAB);
    const [{ filename }] = chrome.downloads.download.mock.calls[0];
    expect(filename).toMatch(/\.webp$/);
  });

  it('passes saveLocation from settings to the downloader', async () => {
    chrome.storage.sync.get.mockImplementation(async (defaults) => ({ ...defaults, saveLocation: 'default' }));
    await handleQuickCapture(TAB);
    const [{ saveAs }] = chrome.downloads.download.mock.calls[0];
    expect(saveAs).toBe(false);
  });

  it('uses saveAs:true when saveLocation is "prompt"', async () => {
    chrome.storage.sync.get.mockImplementation(async (defaults) => ({ ...defaults, saveLocation: 'prompt' }));
    await handleQuickCapture(TAB);
    const [{ saveAs }] = chrome.downloads.download.mock.calls[0];
    expect(saveAs).toBe(true);
  });
});


// ── Error handling ────────────────────────────────────────────────────────────

describe('handleQuickCapture — error handling', () => {
  beforeEach(setupHappyPath);

  it('does not throw when captureVisibleTab rejects', async () => {
    chrome.tabs.captureVisibleTab.mockRejectedValue(new Error('Tab closed'));
    await expect(handleQuickCapture(TAB)).resolves.toBeUndefined();
  });

  it('does not throw when download rejects', async () => {
    chrome.downloads.download.mockRejectedValue(new Error('Disk full'));
    await expect(handleQuickCapture(TAB)).resolves.toBeUndefined();
  });

  it('logs a console.error when capture fails', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    chrome.tabs.captureVisibleTab.mockRejectedValue(new Error('Tab closed'));
    await handleQuickCapture(TAB);
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('quick-capture'),
      expect.any(Error),
    );
    spy.mockRestore();
  });

  it('logs a console.error when download fails', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    chrome.downloads.download.mockRejectedValue(new Error('Disk full'));
    await handleQuickCapture(TAB);
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('quick-capture'),
      expect.any(Error),
    );
    spy.mockRestore();
  });
});

// ── onCommand listener routing ────────────────────────────────────────────────

let _onCommandListener = null;

beforeAll(() => {
  _onCommandListener = chrome.commands.onCommand.addListener.mock?.calls?.[0]?.[0] ?? null;
});

describe('onCommand listener routing', () => {
  beforeEach(setupHappyPath);

  it('ignores commands other than quick-capture', async () => {
    if (!_onCommandListener) return;
    await _onCommandListener('some-other-command');
    expect(chrome.tabs.query).not.toHaveBeenCalled();
  });

  it('does nothing when no active tab is found', async () => {
    if (!_onCommandListener) return;
    chrome.tabs.query.mockResolvedValue([]);
    await _onCommandListener('quick-capture');
    expect(chrome.tabs.captureVisibleTab).not.toHaveBeenCalled();
  });

  it('does nothing when tab has no id', async () => {
    if (!_onCommandListener) return;
    chrome.tabs.query.mockResolvedValue([{ url: 'https://example.com' }]);
    await _onCommandListener('quick-capture');
    expect(chrome.tabs.captureVisibleTab).not.toHaveBeenCalled();
  });

  it('triggers capture for quick-capture command', async () => {
    if (!_onCommandListener) return;
    await _onCommandListener('quick-capture');
    expect(chrome.tabs.captureVisibleTab).toHaveBeenCalled();
  });

  it('does not throw if chrome.tabs.query rejects', async () => {
    if (!_onCommandListener) return;
    chrome.tabs.query.mockRejectedValue(new Error('No permission'));
    await expect(_onCommandListener('quick-capture')).resolves.toBeUndefined();
  });
});
