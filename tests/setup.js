/**
 * tests/setup.js — Global Chrome Extension API mock
 *
 * Provides a minimal but realistic chrome.* API surface for unit tests.
 * Each test file can override individual methods with vi.fn() as needed.
 */

import { vi } from 'vitest';

// ── chrome.storage ────────────────────────────────────────────────────────────

const _syncStore  = {};
const _localStore = {};

const makeChromeStorage = (store) => ({
  get: vi.fn(async (keysOrDefaults) => {
    if (typeof keysOrDefaults === 'object' && !Array.isArray(keysOrDefaults)) {
      const result = {};
      for (const [k, def] of Object.entries(keysOrDefaults)) {
        result[k] = k in store ? store[k] : def;
      }
      return result;
    }
    if (Array.isArray(keysOrDefaults)) {
      return Object.fromEntries(keysOrDefaults.map(k => [k, store[k]]));
    }
    return { ...store };
  }),
  set: vi.fn(async (items) => {
    Object.assign(store, items);
  }),
  remove: vi.fn(async (keys) => {
    const ks = Array.isArray(keys) ? keys : [keys];
    ks.forEach(k => delete store[k]);
  }),
  clear: vi.fn(async () => {
    Object.keys(store).forEach(k => delete store[k]);
  }),
});

// ── chrome.tabs ───────────────────────────────────────────────────────────────

const chromeTabs = {
  captureVisibleTab: vi.fn(async () => 'data:image/png;base64,iVBORw0KGgo='),
  query:             vi.fn(async () => [{ id: 1, url: 'https://example.com', title: 'Example', windowId: 1 }]),
  sendMessage:       vi.fn(async () => ({ done: true })),
};

// ── chrome.scripting ──────────────────────────────────────────────────────────

const chromeScripting = {
  executeScript: vi.fn(async () => [{ result: undefined }]),
};

// ── chrome.downloads ──────────────────────────────────────────────────────────

const chromeDownloads = {
  download: vi.fn(async () => 42),
};

// ── chrome.offscreen ──────────────────────────────────────────────────────────

let _offscreenExists = false;

const chromeOffscreen = {
  hasDocument:    vi.fn(async () => _offscreenExists),
  createDocument: vi.fn(async () => { _offscreenExists = true; }),
  closeDocument:  vi.fn(async () => { _offscreenExists = false; }),
};

// ── chrome.debugger ───────────────────────────────────────────────────────────

const chromeDebugger = {
  attach:      vi.fn(async () => {}),
  detach:      vi.fn(async () => {}),
  sendCommand: vi.fn(async () => {}),
};

// ── chrome.permissions ────────────────────────────────────────────────────────

let _hasDebugger = false;

const chromePermissions = {
  contains: vi.fn(async ({ permissions }) => {
    if (permissions?.includes('debugger')) return _hasDebugger;
    return false;
  }),
  request: vi.fn(async ({ permissions }) => {
    if (permissions?.includes('debugger')) {
      _hasDebugger = true;
      return true;
    }
    return false;
  }),
};

// ── chrome.runtime ────────────────────────────────────────────────────────────

const chromeRuntime = {
  id:          'test-extension-id',
  lastError:   null,
  sendMessage: vi.fn(async () => ({})),
  getURL:      vi.fn((path) => `chrome-extension://test-extension-id/${path}`),
  onMessage:   { addListener: vi.fn(), removeListener: vi.fn() },
};

// ── chrome.windows ────────────────────────────────────────────────────────────

const chromeWindows = {
  create: vi.fn(async () => ({ id: 1 })),
};

// ── chrome.commands ───────────────────────────────────────────────────────────

const chromeCommands = {
  onCommand: { addListener: vi.fn() },
};

// ── Assemble global chrome object ─────────────────────────────────────────────

global.chrome = {
  storage: {
    sync:  makeChromeStorage(_syncStore),
    local: makeChromeStorage(_localStore),
  },
  tabs:        chromeTabs,
  scripting:   chromeScripting,
  downloads:   chromeDownloads,
  offscreen:   chromeOffscreen,
  debugger:    chromeDebugger,
  permissions: chromePermissions,
  runtime:     chromeRuntime,
  windows:     chromeWindows,
  commands:    chromeCommands,
};

// ── Browser APIs not available in Node ───────────────────────────────────────
// cropInWorker in service-worker.js uses these APIs. We provide lightweight
// mocks so the function runs end-to-end in the Node test environment.

global.createImageBitmap = vi.fn(async () => ({ width: 800, height: 600, close: vi.fn() }));

function _makeMockCanvas() {
  return {
    getContext:    vi.fn(() => ({ drawImage: vi.fn() })),
    convertToBlob: vi.fn(async () => new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' })),
  };
}
global.OffscreenCanvas = vi.fn(_makeMockCanvas);

// data: URL fetch used in cropInWorker — native Node fetch does not support data: URIs
global.fetch = vi.fn(async () => ({ blob: async () => new Blob(['x'], { type: 'image/png' }) }));

// ── Helpers exported for tests ────────────────────────────────────────────────

export function resetChromeStorage() {
  Object.keys(_syncStore).forEach(k  => delete _syncStore[k]);
  Object.keys(_localStore).forEach(k => delete _localStore[k]);
}

export function setDebuggerPermission(granted) {
  _hasDebugger = granted;
}

export function setOffscreenExists(exists) {
  _offscreenExists = exists;
}

// Reset mocks between tests
beforeEach(() => {
  vi.clearAllMocks();
  _offscreenExists = false;
  _hasDebugger     = false;
  resetChromeStorage();

  // Re-wire mocks after clearAllMocks wipes implementations
  chrome.offscreen.hasDocument.mockImplementation(async () => _offscreenExists);
  chrome.offscreen.createDocument.mockImplementation(async () => { _offscreenExists = true; });
  chrome.offscreen.closeDocument.mockImplementation(async () => { _offscreenExists = false; });
  chrome.permissions.contains.mockImplementation(async ({ permissions }) =>
    permissions?.includes('debugger') ? _hasDebugger : false
  );
  chrome.permissions.request.mockImplementation(async ({ permissions }) => {
    if (permissions?.includes('debugger')) { _hasDebugger = true; return true; }
    return false;
  });
  chrome.storage.sync.get.mockImplementation(async (keysOrDefaults) => {
    if (typeof keysOrDefaults === 'object' && !Array.isArray(keysOrDefaults)) {
      const result = {};
      for (const [k, def] of Object.entries(keysOrDefaults)) {
        result[k] = k in _syncStore ? _syncStore[k] : def;
      }
      return result;
    }
    return { ..._syncStore };
  });
  chrome.storage.sync.set.mockImplementation(async (items) => Object.assign(_syncStore, items));
  chrome.storage.sync.remove.mockImplementation(async (keys) => {
    const ks = Array.isArray(keys) ? keys : [keys];
    ks.forEach(k => delete _syncStore[k]);
  });
  chrome.storage.local.get.mockImplementation(async (keysOrDefaults) => {
    if (typeof keysOrDefaults === 'object' && !Array.isArray(keysOrDefaults)) {
      const result = {};
      for (const [k, def] of Object.entries(keysOrDefaults)) {
        result[k] = k in _localStore ? _localStore[k] : def;
      }
      return result;
    }
    return { ..._localStore };
  });
  chrome.storage.local.set.mockImplementation(async (items) => Object.assign(_localStore, items));
  chrome.storage.local.remove.mockImplementation(async (keys) => {
    const ks = Array.isArray(keys) ? keys : [keys];
    ks.forEach(k => delete _localStore[k]);
  });
  chrome.runtime.lastError = null;
  chrome.runtime.sendMessage.mockResolvedValue({});
  chrome.tabs.captureVisibleTab.mockResolvedValue('data:image/png;base64,iVBORw0KGgo=');
  chrome.tabs.query.mockResolvedValue([{ id: 1, url: 'https://example.com', title: 'Example', windowId: 1 }]);
  chrome.tabs.sendMessage.mockResolvedValue({ done: true });
  chrome.scripting.executeScript.mockResolvedValue([{ result: undefined }]);
  chrome.downloads.download.mockResolvedValue(42);
  chrome.debugger.attach.mockResolvedValue(undefined);
  chrome.debugger.detach.mockResolvedValue(undefined);
  chrome.debugger.sendCommand.mockResolvedValue(undefined);

  // Re-wire browser API mocks (cleared by vi.clearAllMocks)
  global.createImageBitmap.mockImplementation(async () => ({ width: 800, height: 600, close: vi.fn() }));
  global.OffscreenCanvas.mockImplementation(_makeMockCanvas);
  global.fetch.mockImplementation(async () => ({ blob: async () => new Blob(['x'], { type: 'image/png' }) }));
});
