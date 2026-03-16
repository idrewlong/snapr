# Snapr

**Clean screenshots. One click. No accounts.**

A Chrome extension that captures polished website screenshots for portfolios, documentation, and project showcases. Viewport, full page, or element capture. PNG, JPG, or WebP. Saves locally — no cloud, no login.

---

## Install for development

```bash
git clone https://github.com/idrewlong/snapr.git
cd snapr
npm install
```

Load the extension directly (no build step required):

1. Open Chrome → `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked** → select this repo's `src/` folder
4. Pin Snapr to your toolbar and click the icon

After any file change, click the **↺ refresh** icon on the extension card to reload.

---

## Project structure

```
snapr/
├── manifest.json                   ← Extension manifest (MV3)
├── popup-preview.html              ← Browser preview (no extension install needed)
│
├── src/
│   ├── popup/
│   │   ├── popup.html              ← Extension popup UI
│   │   ├── popup.css               ← All styles (10 labeled sections)
│   │   └── popup.js                ← Popup controller; Chrome API shimmed for preview
│   │
│   ├── background/
│   │   ├── service-worker.js       ← Message router + capture orchestrator
│   │   ├── capture-viewport.js     ← captureVisibleTab wrapper
│   │   ├── capture-fullpage.js     ← Scroll-stitch coordination
│   │   ├── capture-element.js      ← Element picker coordination
│   │   ├── downloader.js           ← chrome.downloads wrapper
│   │   └── viewport-emulation.js  ← Debugger API viewport override
│   │
│   ├── content/                    ← Injected on demand, never on page load
│   │   ├── full-page.js            ← Scroll measurement + fixed element handling
│   │   └── element-picker.js       ← Hover overlay + element selection (Shadow DOM)
│   │
│   ├── offscreen/
│   │   ├── offscreen.html
│   │   └── offscreen.js            ← Canvas: composite frames, crop, convert format
│   │
│   ├── options/
│   │   ├── options.html/css/js     ← Settings page
│   │
│   └── lib/
│       ├── constants.js            ← Size presets, format configs, defaults
│       ├── messages.js             ← All message type constants (single source of truth)
│       ├── storage.js              ← chrome.storage typed wrapper
│       └── filename.js             ← Token → slug → filename generation
│
└── tests/
    ├── setup.js                    ← Vitest global setup + Chrome API mocks
    ├── constants.test.js
    ├── filename.test.js
    ├── storage.test.js
    ├── messages.test.js
    ├── downloader.test.js
    ├── element-picker.test.js
    ├── offscreen.test.js
    ├── capture-element.test.js
    ├── capture-fullpage.test.js
    ├── capture-viewport.test.js
    ├── viewport-emulation.test.js
    ├── service-worker-element.test.js
    └── service-worker-quick-capture.test.js
```

---

## Testing

```bash
npm test          # Run all unit tests (Vitest)
npm run coverage  # Run tests with coverage report
```

Tests cover: filename generation, storage wrapper, message constants, downloader, offscreen compositing, all three capture modes, viewport emulation, and service worker routing.

---

## Testing the popup UI (no extension install)

```bash
python3 -m http.server 3000
```

Open `http://localhost:3000/popup-preview.html` in Chrome.

**Dark mode:** DevTools → Rendering → Emulate `prefers-color-scheme` → dark

---

## Architecture notes

**Content scripts** (`full-page.js`, `element-picker.js`) are self-contained IIFEs — no ES module imports. They're injected on demand via `chrome.scripting.executeScript` only when the user triggers full-page or element capture. Message type constants are inlined.

**Service worker + lib files** use ES module syntax (`import/export`). This works because the manifest declares `"type": "module"` for the background service worker.

**Chrome API shim** — `popup.js` checks `chrome.runtime?.id` at runtime. When absent (plain browser tab), it swaps in localStorage-backed mocks so the preview works identically to the real extension.

**Viewport emulation** uses the optional `debugger` permission, requested on first use. Chrome will show a yellow "Snapr is debugging this tab" banner for ~1–2 seconds while the viewport is overridden — this is unavoidable.

---

## Capture modes

| Mode | How it works |
|------|-------------|
| Viewport | `chrome.tabs.captureVisibleTab` — no content script needed |
| Full page | Inject `full-page.js` → scroll loop → composite frames in offscreen document |
| Element | Inject `element-picker.js` → user clicks element → crop in offscreen document |

---

## Permissions

| Permission | Required | Why |
|------------|----------|-----|
| `activeTab` | Yes | Capture the visible tab |
| `downloads` | Yes | Save files to disk |
| `storage` | Yes | Persist settings + history |
| `offscreen` | Yes | Canvas operations (compositing, cropping) |
| `scripting` | Yes | Inject content scripts on demand |
| `debugger` | Optional | Viewport emulation without resizing the window |

Snapr makes no network requests. All data stays in the browser.

---

## Contributing

```bash
# Clone and load unpacked (see Install above)
# Make changes
# npm test to verify
# Refresh extension at chrome://extensions
# Open an issue or PR at github.com/idrewlong/snapr
```
