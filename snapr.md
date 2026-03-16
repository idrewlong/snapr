# Snapr

**Clean screenshots. One click. No accounts.**

A Chrome extension that captures polished website screenshots for portfolios, documentation, and project showcases. Click the toolbar icon, configure the shot, save. That's it.

---

## Why Snapr Exists

Every developer with a portfolio has done this dance: open the project site, resize the browser, maybe open DevTools to fake a viewport, hit Cmd+Shift+4 or the Windows snipping tool, crop out the browser chrome, rename the file, drop it into the project folder. Do it again for mobile. Do it again for the next project. Do it again next month when the site changes.

The existing tools don't solve this well either. Chrome's built-in screenshot is buried three menus deep in DevTools. GoFullPage only does full-page captures. Awesome Screenshot wants you to make an account, subscribe to a plan, and store your images on their cloud. Fireshot hasn't meaningfully updated its UI in years. Lightshot is optimized for quick sharing, not clean developer captures.

Snapr is the tool that should have existed already: open popup, click capture, get a clean JPG,PNG or Webp. No annotation tools you'll never use. No cloud sync you didn't ask for. No account creation. No upsell. Just screenshots.

---

## Who It's For

**Primary:** developers generating preview images for portfolio sites, README files, and case studies.

**Secondary:** technical writers documenting UI states, designers grabbing live-site references, agency teams producing client deliverables, QA engineers capturing bug reproductions.

**Not for:** casual users who want to annotate and share screenshots on social media (Lightshot/ShareX own that), enterprise teams who need centralized screenshot management (Screenpresso/Snagit own that).

---

## What It Does

Snapr is a Manifest V3 Chrome extension that lives in the browser toolbar. It captures screenshots of the current tab in three modes — viewport, full page, or targeted element — and saves them locally as PNG, JPG, or WebP.

Core capabilities in v1:

- **Viewport capture** — one-click screenshot of exactly what's visible
- **Full-page capture** — scroll-and-stitch the entire page into a single image
- **Element capture** — hover-to-select any DOM element and capture its bounding box
- **Viewport presets** — capture at Desktop HD, Laptop, Tablet, or Mobile dimensions without resizing your browser window
- **Format and quality controls** — PNG (lossless), JPG, or WebP with adjustable compression
- **Smart filenames** — auto-generated from the URL, editable before save
- **Configurable filename patterns** — tokens like `{domain}`, `{date}`, `{title}` for consistent naming
- **Capture history** — last 20 captures with thumbnails, re-capture in one click
- **Keyboard shortcut** — instant capture with no popup via `Alt+Shift+S`
- **Persistent defaults** — settings sync across devices via Chrome's storage API

---

## Popup Interface

### Layout

The popup is 380px wide with a fixed height that doesn't scroll. Every control is visible on open — no tabs, no accordions, no hidden panels. The visual hierarchy flows top to bottom: see the preview, choose your mode, set your options, capture.

```
┌─────────────────────────────────────┐
│  Snapr                        ⚙ ⏱  │
├─────────────────────────────────────┤
│  ┌─────────────────────────────┐    │
│  │                             │    │
│  │     Live tab thumbnail      │    │
│  │     16:10 aspect ratio      │    │
│  │     rounded corners         │    │
│  │                             │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌───────────┐┌──────────┐┌──────┐  │
│  │ ◉ Viewport ││ Full Page ││ Elem ││ │
│  └───────────┘└──────────┘└──────┘  │
│                                     │
│  Size     [ As-is          ▾ ]      │
│  Format   [ PNG ▾ ]  Quality [ 90 ] │
│                                     │
│  ┌─────────────────────────────┐    │
│  │         📸  Capture          │    │
│  └─────────────────────────────┘    │
│                                     │
│  example-com.png         ✏️ edit    │
│                                     │
│  ▸ History (3 recent)               │
└─────────────────────────────────────┘
```

### Component details

**Header bar:** "Snapr" wordmark on the left. Gear icon (⚙) opens the options page. Clock icon (⏱) expands capture history inline.

**Preview thumbnail:** Captured on popup open via `chrome.tabs.captureVisibleTab` at reduced resolution. 16:10 aspect ratio container with 8px border radius. Subtle drop shadow. Updates if the user switches tabs while the popup is open (via `chrome.tabs.onActivated` listener). Shows a placeholder skeleton state while loading.

**Mode selector:** Three-button segmented control. Active state uses a filled background with the brand accent color. Selecting "Element" closes the popup and activates the page overlay (the popup can't stay open while the user interacts with the page).

**Size dropdown:** Flat dropdown, not a native `<select>`. Options: As-is, Desktop HD (1920×1080), Desktop (1440×900), Laptop (1280×800), Tablet (768×1024), Mobile (375×812), Custom. Selecting Custom reveals two inline number inputs for width and height. Selecting any preset other than As-is shows a subtle badge on the Capture button indicating the emulated size.

**Format / Quality row:** Format is a small dropdown (PNG, JPG, WebP). Quality is a number input, 1–100, only enabled when format is JPG or WebP. Disabled state for quality when PNG is selected (PNG is always lossless).

**Capture button:** Full-width, prominent. Brand accent background. Press Enter to trigger from anywhere in the popup. Shows a brief loading spinner during capture, then a checkmark on success. If capture fails (e.g., restricted page like `chrome://`), the button flashes red with a tooltip explaining why.

**Filename display:** Shows the auto-generated filename below the button. Clicking "edit" makes it an inline text input. Changes persist for this capture only (the pattern setting governs future captures).

**History toggle:** Collapsed by default, showing count. Expands to show the last 3–5 captures as a compact list (thumbnail, filename, timestamp). "View all" links to the options page history section. Each entry has a re-capture icon button.

### Interaction states

| State                                                           | Behavior                                                                     |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Popup opens                                                     | Thumbnail loads, settings hydrate from storage, filename generates           |
| User changes any setting                                        | Setting persists immediately to `chrome.storage.sync`                        |
| Capture clicked                                                 | Button shows spinner → screenshot taken → checkmark → file downloads         |
| Element mode selected                                           | Popup closes, overlay activates on page                                      |
| Element selected on page                                        | Capture completes, small notification toast appears on the page              |
| Restricted page (`chrome://`, `chrome-extension://`, Web Store) | Capture button disabled with tooltip: "Can't capture browser internal pages" |
| No active tab / error                                           | Preview shows placeholder, capture disabled                                  |

### Design language

The popup should feel native to the browser — not like a web app crammed into a popup. Neutral grays for the background and controls, one accent color for interactive elements, system font stack (`-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`), tight spacing, no unnecessary decoration. Inspired by Arc's command bar and Raycast's minimal UI rather than the typical extension popup aesthetic.

Dark mode: respects `prefers-color-scheme` automatically. Light and dark palettes defined in CSS custom properties.

---

## Architecture

### Manifest V3

```json
{
	"manifest_version": 3,
	"name": "Snapr",
	"version": "1.0.0",
	"description": "Clean website screenshots in one click.",
	"permissions": ["activeTab", "downloads", "storage", "offscreen"],
	"optional_permissions": ["debugger"],
	"action": {
		"default_popup": "popup/popup.html",
		"default_icon": {
			"16": "icons/icon-16.png",
			"32": "icons/icon-32.png",
			"48": "icons/icon-48.png",
			"128": "icons/icon-128.png"
		}
	},
	"background": {
		"service_worker": "background/service-worker.js",
		"type": "module"
	},
	"content_scripts": [],
	"options_page": "options/options.html",
	"commands": {
		"quick-capture": {
			"suggested_key": { "default": "Alt+Shift+S" },
			"description": "Capture current tab with default settings"
		}
	},
	"icons": {
		"16": "icons/icon-16.png",
		"48": "icons/icon-48.png",
		"128": "icons/icon-128.png"
	}
}
```

Note: `content_scripts` is empty because scripts are injected programmatically only when needed (full-page or element capture), not on every page load.

### Project structure

```
snapr/
├── src/
│   ├── popup/
│   │   ├── popup.html
│   │   ├── popup.css
│   │   └── popup.js              # Popup controller
│   ├── background/
│   │   ├── service-worker.js     # Message router, capture orchestrator
│   │   ├── capture-viewport.js   # chrome.tabs.captureVisibleTab wrapper
│   │   ├── capture-fullpage.js   # Scroll-stitch coordination
│   │   ├── capture-element.js    # Element picker coordination
│   │   └── downloader.js         # chrome.downloads wrapper, filename generation
│   ├── content/
│   │   ├── full-page.js          # Scroll measurement, fixed-element disabling
│   │   └── element-picker.js     # Hover overlay, element selection, rect reporting
│   ├── offscreen/
│   │   ├── offscreen.html
│   │   └── offscreen.js          # Canvas compositing, crop, resize, format conversion
│   ├── options/
│   │   ├── options.html
│   │   ├── options.css
│   │   └── options.js
│   ├── lib/
│   │   ├── filename.js           # URL → filename slug generation
│   │   ├── storage.js            # chrome.storage.sync/local wrapper with defaults
│   │   ├── constants.js          # Size presets, format configs, default settings
│   │   └── messages.js           # Message type constants for runtime.sendMessage
│   └── icons/
│       ├── icon-16.png
│       ├── icon-32.png
│       ├── icon-48.png
│       └── icon-128.png
├── tests/
│   ├── filename.test.js
│   ├── storage.test.js
│   └── e2e/
│       └── capture.test.js       # Playwright extension testing
├── scripts/
│   └── build.js                  # esbuild bundler config
├── package.json
├── tsconfig.json                 # If using TypeScript (recommended)
├── .eslintrc.json
├── .prettierrc
└── README.md
```

### Build toolchain

**TypeScript** for all source files. Strict mode enabled. Extension APIs are typed via `@anthropic-ai/chrome-types` or `@anthropic/anthropic-chrome-types`.

**esbuild** for bundling. Fast builds, tree-shaking, no Webpack complexity. Separate entry points for popup, service worker, content scripts, and offscreen document. Output to `dist/` with source maps for development.

```javascript
// scripts/build.js
const entryPoints = [
	'src/popup/popup.ts',
	'src/background/service-worker.ts',
	'src/content/full-page.ts',
	'src/content/element-picker.ts',
	'src/offscreen/offscreen.ts',
	'src/options/options.ts',
];
```

**Vitest** for unit tests. **Playwright** for e2e extension testing (Chrome supports loading unpacked extensions in Playwright's persistent context).

### Component communication

All inter-component communication uses `chrome.runtime.sendMessage` with typed message objects. No direct function calls across contexts.

```
┌──────────┐   sendMessage    ┌────────────────┐   sendMessage    ┌────────────┐
│  Popup   │ ──────────────▶  │ Service Worker │ ──────────────▶  │  Content   │
│          │ ◀──────────────  │                │ ◀──────────────  │  Script    │
└──────────┘   response       │  (orchestrator)│   response       └────────────┘
                              │                │
                              │   sendMessage  │
                              │ ──────────────▶│  ┌────────────┐
                              │ ◀──────────────│  │ Offscreen  │
                              └────────────────┘  │ Document   │
                                                  └────────────┘
```

**Message types:**

| Message            | From → To      | Payload                                                        |
| ------------------ | -------------- | -------------------------------------------------------------- |
| `CAPTURE_VIEWPORT` | Popup → SW     | `{ format, quality, sizePreset }`                              |
| `CAPTURE_FULLPAGE` | Popup → SW     | `{ format, quality, maxHeight }`                               |
| `CAPTURE_ELEMENT`  | Popup → SW     | `{}` (initiates picker mode)                                   |
| `ELEMENT_SELECTED` | Content → SW   | `{ rect: { x, y, width, height }, devicePixelRatio }`          |
| `SCROLL_INFO`      | Content → SW   | `{ scrollHeight, scrollWidth, viewportHeight, viewportWidth }` |
| `SCROLL_TO`        | SW → Content   | `{ y }`                                                        |
| `COMPOSITE_FRAMES` | SW → Offscreen | `{ frames: dataUrl[], dimensions }`                            |
| `CROP_IMAGE`       | SW → Offscreen | `{ dataUrl, rect, outputFormat, quality }`                     |
| `CAPTURE_COMPLETE` | SW → Popup     | `{ success, filename, error? }`                                |
| `QUICK_CAPTURE`    | Command → SW   | `{}` (keyboard shortcut, no popup involved)                    |

---

## Technical Implementation

### Viewport capture

The simplest and most common path. No content script needed.

```typescript
// capture-viewport.ts
export async function captureViewport(
	tabId: number,
	options: CaptureOptions
): Promise<string> {
	// 1. If size preset !== 'as-is', emulate viewport first
	if (options.sizePreset !== 'as-is') {
		await emulateViewport(tabId, options.width, options.height);
		// Wait for reflow
		await new Promise((resolve) => setTimeout(resolve, 300));
	}

	// 2. Capture
	const dataUrl = await chrome.tabs.captureVisibleTab(null, {
		format: options.format === 'png' ? 'png' : 'jpeg',
		quality: options.quality,
	});

	// 3. If WebP requested, convert in offscreen document
	if (options.format === 'webp') {
		return await convertInOffscreen(dataUrl, 'webp', options.quality);
	}

	// 4. Restore viewport if emulated
	if (options.sizePreset !== 'as-is') {
		await clearViewportEmulation(tabId);
	}

	return dataUrl;
}
```

**Timing note:** `captureVisibleTab` returns a data URL of the visible area. It respects device pixel ratio, so a 1440×900 viewport on a 2x display produces a 2880×1800 image. This is desirable — portfolio images should be retina-quality. The size presets specify CSS pixels; actual image dimensions are CSS pixels × `devicePixelRatio`.

### Full-page capture

The most complex path. Requires coordination between service worker, content script, and offscreen document.

```
SW: Inject content script
          │
Content:  Measure scrollHeight, viewportHeight
Content:  Store all fixed/sticky elements, set them to position:relative
Content:  Scroll to top
          │
    ┌─────┴─────┐
    │   LOOP    │
    │           │
    SW: captureVisibleTab → push frame to array
    SW: sendMessage(SCROLL_TO, { y: nextOffset })
    Content: window.scrollTo(0, y)
    Content: await requestAnimationFrame (ensure paint)
    Content: respond with confirmation
    │           │
    │  y < scrollHeight?
    │     yes → loop
    │     no  → break
    └─────┬─────┘
          │
Content:  Restore fixed/sticky elements
SW:       Send all frames to offscreen document
Offscreen: Create canvas at full document dimensions
Offscreen: drawImage each frame at correct y offset
Offscreen: Export as target format
          │
SW:       Trigger download
```

**Edge cases and mitigations:**

| Edge case                                                      | Mitigation                                                                                                                                          |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fixed/sticky headers and navs repeat in every frame            | Content script records all `position: fixed` and `position: sticky` elements, temporarily sets them to `position: relative`, restores after capture |
| Lazy-loaded images not yet loaded at scroll position           | After each scroll, wait 200ms + check `document.readyState` and pending image loads before capturing                                                |
| Infinite scroll pages (Twitter, Pinterest)                     | Cap at configurable `maxHeight` (default: 15000px / ~15 viewports). Show a warning in the popup if the page exceeds the cap                         |
| Last frame is a partial viewport                               | Calculate the remainder height. On the final frame, crop the canvas `drawImage` to only include the remaining pixels, preventing overlap            |
| Horizontal scroll (wide tables, code blocks)                   | Measure `scrollWidth`. If wider than viewport, capture at `scrollWidth` using debugger viewport emulation                                           |
| Page reflows on scroll (parallax, scroll-triggered animations) | Unavoidable in some cases. Document this as a known limitation                                                                                      |

### Element capture

Two phases: selection (content script) and capture (service worker + offscreen).

**Selection phase — content script (`element-picker.js`):**

```typescript
// Inject a full-viewport overlay div (pointer-events: none)
// On mousemove over the page:
//   1. document.elementFromPoint(x, y)
//   2. el.getBoundingClientRect() → draw highlight box
//   3. Show element tag name + dimensions in a tooltip

// On click:
//   1. Lock selection
//   2. Send ELEMENT_SELECTED with rect and devicePixelRatio
//   3. Remove overlay and listeners

// On Escape:
//   1. Cancel selection
//   2. Remove overlay and listeners
```

**Highlight overlay styling:** semi-transparent blue fill (`rgba(59, 130, 246, 0.15)`), 2px solid blue border, with a small label showing `<tagName> widthxheight` floating above the element. The overlay must not interfere with the page's z-index — use a Shadow DOM container attached to `document.body` to isolate styles.

**Capture phase:** service worker calls `captureVisibleTab`, then sends the data URL and the element's rect to the offscreen document for cropping. The rect coordinates are multiplied by `devicePixelRatio` to match the actual image dimensions.

**Scroll handling:** if the selected element is partially off-screen, the content script scrolls it into full view before reporting the rect. If the element is taller than the viewport, fall back to the full-page stitch approach constrained to the element's bounding rect.

### Offscreen document

Manifest V3 service workers have no DOM access. All Canvas operations happen in an offscreen document.

```typescript
// offscreen.ts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	switch (message.type) {
		case 'COMPOSITE_FRAMES':
			return compositeFrames(message.frames, message.dimensions);
		case 'CROP_IMAGE':
			return cropImage(
				message.dataUrl,
				message.rect,
				message.format,
				message.quality
			);
		case 'CONVERT_FORMAT':
			return convertFormat(message.dataUrl, message.format, message.quality);
	}
});

async function compositeFrames(
	frames: { dataUrl: string; offsetY: number }[],
	dimensions: { width: number; height: number }
): Promise<string> {
	const canvas = new OffscreenCanvas(dimensions.width, dimensions.height);
	const ctx = canvas.getContext('2d');

	for (const frame of frames) {
		const img = await createImageBitmap(
			await (await fetch(frame.dataUrl)).blob()
		);
		ctx.drawImage(img, 0, frame.offsetY);
	}

	const blob = await canvas.convertToBlob({ type: 'image/png' });
	// Convert blob to data URL and return
}
```

The offscreen document is created on first use and kept alive for the duration of the capture session, then closed. Use `chrome.offscreen.createDocument` with reason `CANVAS` (this is the appropriate reason enum for image manipulation).

### Viewport emulation

Triggered when the user selects any size preset other than "As-is."

```typescript
async function emulateViewport(tabId: number, width: number, height: number) {
	// Request debugger permission if not already granted
	const hasPermission = await chrome.permissions.contains({
		permissions: ['debugger'],
	});
	if (!hasPermission) {
		const granted = await chrome.permissions.request({
			permissions: ['debugger'],
		});
		if (!granted) {
			throw new Error('Debugger permission required for viewport presets');
		}
	}

	await chrome.debugger.attach({ tabId }, '1.3');
	await chrome.debugger.sendCommand(
		{ tabId },
		'Emulation.setDeviceMetricsOverride',
		{
			width,
			height,
			deviceScaleFactor: 2, // Always capture at 2x for retina-quality output
			mobile: width <= 768, // Mobile UA behavior for tablet/phone presets
		}
	);
}

async function clearViewportEmulation(tabId: number) {
	await chrome.debugger.sendCommand(
		{ tabId },
		'Emulation.clearDeviceMetricsOverride',
		{}
	);
	await chrome.debugger.detach({ tabId });
}
```

**UX note:** when the debugger attaches, Chrome shows a yellow "Snapr is debugging this tab" bar. This is unavoidable and brief. The bar disappears when the debugger detaches after capture (~1–2 seconds total). Worth documenting in the extension's FAQ.

---

## Filename Generation

### Default pattern

`{domain}-{path}`

### Token reference

| Token         | Input URL: `https://shop.example.com/products/sale?ref=abc` | Output                              |
| ------------- | ----------------------------------------------------------- | ----------------------------------- | ------------------- |
| `{domain}`    | `shop.example.com`                                          | `shop-example-com`                  |
| `{path}`      | `/products/sale`                                            | `products-sale`                     |
| `{title}`     | `<title>Sale                                                | Example Shop</title>`               | `sale-example-shop` |
| `{date}`      | Capture timestamp                                           | `2026-03-14`                        |
| `{time}`      | Capture timestamp                                           | `14-30-45`                          |
| `{timestamp}` | Unix epoch                                                  | `1773696645`                        |
| `{width}`     | Captured width (CSS px)                                     | `1440`                              |
| `{height}`    | Captured height (CSS px)                                    | `900`                               |
| `{mode}`      | Capture mode                                                | `viewport` / `fullpage` / `element` |

### Slug rules

All tokens are sanitized through the same slug function:

1. Lowercase
2. Strip protocol, `www.`, trailing slashes
3. Replace non-alphanumeric characters with `-`
4. Collapse consecutive hyphens
5. Trim leading/trailing hyphens
6. Truncate to 80 characters (prevent filesystem issues)

### Collision handling

If the file already exists in the download location, Chrome's download API appends ` (1)`, ` (2)`, etc. automatically. Snapr does not override this behavior.

---

## Permissions Model

| Permission  | Type     | Why                                        | When requested             |
| ----------- | -------- | ------------------------------------------ | -------------------------- |
| `activeTab` | Required | Capture the visible tab                    | Install                    |
| `downloads` | Required | Save files to disk                         | Install                    |
| `storage`   | Required | Persist settings                           | Install                    |
| `offscreen` | Required | Canvas operations for compositing/cropping | Install                    |
| `debugger`  | Optional | Viewport emulation without window resize   | First use of a size preset |

**What Snapr cannot do:** read browsing history, access other tabs, run in the background, make network requests, read page content (except when user triggers full-page or element capture via explicit action on the active tab).

**Content script injection:** uses `chrome.scripting.executeScript` with `activeTab` permission. Only injected on user action (capture button or element picker). Never injected passively or on page load.

---

## State Management

### Storage schema

```typescript
// chrome.storage.sync — settings, synced across devices
interface SyncStorage {
	defaults: {
		format: 'png' | 'jpg' | 'webp';
		quality: number; // 1-100
		mode: 'viewport' | 'fullpage' | 'element';
		sizePreset: string; // 'as-is' | 'desktop-hd' | 'desktop' | etc.
		customWidth: number;
		customHeight: number;
	};
	filenamePattern: string; // '{domain}-{path}'
	saveLocation: 'prompt' | 'default';
	theme: 'system' | 'light' | 'dark';
	maxFullPageHeight: number; // Default 15000
}

// chrome.storage.local — history, not synced (larger quota)
interface LocalStorage {
	history: CaptureRecord[]; // Capped at 20
}

interface CaptureRecord {
	id: string; // crypto.randomUUID()
	url: string;
	filename: string;
	format: string;
	mode: string;
	width: number;
	height: number;
	thumbnail: string; // Base64, resized to ~200px wide (~3-5KB)
	capturedAt: string; // ISO 8601
	settings: SyncStorage['defaults']; // Settings used for this capture
}
```

### Storage wrapper

```typescript
// lib/storage.ts
const DEFAULTS: SyncStorage = {
	defaults: {
		format: 'png',
		quality: 90,
		mode: 'viewport',
		sizePreset: 'as-is',
		customWidth: 1440,
		customHeight: 900,
	},
	filenamePattern: '{domain}-{path}',
	saveLocation: 'prompt',
	theme: 'system',
	maxFullPageHeight: 15000,
};

export async function getSettings(): Promise<SyncStorage> {
	const stored = await chrome.storage.sync.get(DEFAULTS);
	return { ...DEFAULTS, ...stored };
}

export async function updateSettings(
	partial: Partial<SyncStorage>
): Promise<void> {
	await chrome.storage.sync.set(partial);
}
```

Settings are read once on popup open and cached in memory for the session. Writes are debounced (300ms) to avoid hitting Chrome's storage write rate limits (`MAX_WRITE_OPERATIONS_PER_MINUTE` is 120).

---

## Capture History

### Purpose

Re-capturing the same site with the same settings is a common workflow (site updated, need a fresh screenshot). History makes this one click instead of re-navigating and re-configuring.

### Implementation

After each successful capture, the service worker:

1. Generates a thumbnail by resizing the capture to 200px wide in the offscreen document
2. Creates a `CaptureRecord` with URL, filename, settings, and thumbnail
3. Prepends to the history array in `chrome.storage.local`
4. Evicts the oldest entry if the array exceeds 20 items

### History in the popup

Collapsed by default behind a "History (n)" toggle at the bottom. Expanded view shows a compact list:

```
┌──────────────────────────────────────┐
│  ▾ History (3 recent)                │
│                                      │
│  ┌──┐  example-com.png       ↻  🗑  │
│  │  │  example.com • 2 min ago       │
│  └──┘                                │
│  ┌──┐  shop-mysite-com.webp  ↻  🗑  │
│  │  │  shop.mysite.com • 1 hr ago    │
│  └──┘                                │
│  ┌──┐  docs-project-io.png   ↻  🗑  │
│  │  │  docs.project.io • yesterday   │
│  └──┘                                │
│                                      │
│  View all in settings →              │
└──────────────────────────────────────┘
```

The ↻ button re-captures: navigates to the URL (if not already there) and captures with the same settings. The 🗑 button removes the entry.

### History in the options page

Full history list with larger thumbnails, sortable by date, searchable by URL or filename. Bulk delete. Export history as JSON (for backup or migration).

---

## Options Page

### Sections

**Defaults** — same controls as the popup (format, quality, mode, size preset), but these are the persistent defaults that populate the popup on every open.

**Filename** — pattern input with live preview showing what the pattern produces for a sample URL. Token reference listed below the input.

**Saving** — toggle between "Always ask where to save" and "Save to default download folder." Note: Chrome's download API respects the user's Chrome download settings. Snapr doesn't override the download location, just whether to prompt.

**Appearance** — theme toggle (System / Light / Dark).

**Full-page limits** — max capture height slider (5000–50000px, default 15000). Explains that infinite-scroll pages are capped at this height.

**History** — full capture history list. Bulk operations. Clear all button with confirmation.

**Keyboard shortcut** — displays current shortcut with a link to `chrome://extensions/shortcuts`. Can't be set from within the extension (Chrome limitation).

**About** — version number, GitHub link, changelog link, credits.

---

## Error Handling

| Scenario                                                        | User-facing behavior                                                                                                               |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Restricted page (`chrome://`, `chrome-extension://`, Web Store) | Capture button disabled. Tooltip: "Screenshots aren't available on browser internal pages."                                        |
| Page still loading                                              | Capture button shows "Loading…" state. Enabled once `chrome.tabs.onUpdated` fires `complete`.                                      |
| Viewport emulation permission denied                            | Toast in popup: "Viewport presets need the debugger permission. Using current viewport size instead." Falls back to as-is capture. |
| Full-page capture exceeds max height                            | Captures up to the limit. Toast: "Page was taller than 15,000px — screenshot was capped. You can adjust this in Settings."         |
| Content script injection fails (CSP restriction)                | Toast: "This page blocks content scripts. Viewport capture still works." Mode selector disables Full Page and Element options.     |
| Download fails (disk full, permissions)                         | Toast with Chrome's error message. Offer to copy the image to clipboard as a fallback.                                             |
| Offscreen document creation fails                               | Retry once. If it fails again, show error: "Something went wrong processing the image."                                            |

All toasts are dismissible, appear at the bottom of the popup, and auto-dismiss after 5 seconds.

---

## Browser Compatibility

**Primary targets:** Chrome 116+ (Manifest V3 with offscreen document support), Edge 116+, Brave, Arc, Vivaldi.

**Not supported in v1:** Firefox (uses WebExtensions with different APIs), Safari (uses Safari Web Extensions with a native app wrapper).

**Manifest V3 specific considerations:**

- Service workers are ephemeral — no persistent background page. All state must go through `chrome.storage` or be reconstructible.
- `chrome.offscreen` requires Chrome 109+. Targeting 116+ gives comfortable margin.
- `chrome.tabs.captureVisibleTab` requires `activeTab` permission and only works when triggered by user gesture (toolbar click, keyboard shortcut, context menu).

---

## Distribution

### Chrome Web Store

**Listing copy:**

- **Name:** Snapr — Clean Screenshots
- **Short description (132 chars):** Clean website screenshots in one click. Viewport, full page, or element capture. PNG, JPG, WebP. No account needed.
- **Category:** Developer Tools
- **Language:** English

**Required assets:**

| Asset             | Dimensions     | Notes                                              |
| ----------------- | -------------- | -------------------------------------------------- |
| Extension icon    | 128×128        | Used in Web Store listing and chrome://extensions  |
| Store screenshots | 1280×800 (1–5) | Show the popup in action, element picker, settings |
| Small promo tile  | 440×280        | Used in Web Store search results                   |
| Marquee promo     | 1400×560       | Optional, for featured placement                   |

**Privacy practices disclosure:** Snapr does not collect, transmit, or store any user data externally. All data stays in the browser's local storage. No analytics, no telemetry, no network requests. This simplifies the Web Store privacy review significantly.

### GitHub

Public repo at `github.com/idrewlong/snapr`. README mirrors the Web Store description with development setup instructions, architecture overview, and contributing guide.

### Manual install

```bash
git clone https://github.com/idrewlong/snapr.git
cd snapr
npm install
npm run build
# Load dist/ as unpacked extension in chrome://extensions
```

---

## Branding

### Name

**Snapr** — "snap" (photograph) + the `-r` suffix common in developer tools (Flickr, Tumblr, Bundlr). Short, memorable, available as a Chrome extension name.

Alternate names considered and rejected: SiteShot (generic, SEO conflicts), ScreenSnap (too close to existing tools), Shotline (doesn't convey the camera metaphor), Capturo (sounds like a SaaS product with a pricing page).

### Icon

Concept: a minimal camera aperture/shutter icon rendered as a geometric shape. Not a literal camera — more of an abstract aperture mark that reads as "capture" at 16px. Single color on transparent background, works in both light and dark browser themes.

### Voice

Developer-to-developer. No marketing fluff, no "revolutionize your workflow" language. README and store description should read like a good tool's docs: here's what it does, here's how to use it, here's what it doesn't do.

---

## Development Workflow

### Setup

```bash
git clone https://github.com/idrewlong/snapr.git
cd snapr
npm install
npm run dev        # Watch mode: esbuild rebuilds on file change
```

Load `dist/` as an unpacked extension. After `npm run dev` rebuilds, click the refresh icon on `chrome://extensions` to reload.

### Popup dev

Right-click the Snapr icon → "Inspect Popup" opens DevTools attached to the popup. The popup closes if you click away, so pin the DevTools window separately.

Alternatively, load `popup/popup.html` directly in a browser tab during UI development (mock the Chrome APIs).

### Testing

```bash
npm test           # Unit tests (Vitest)
npm run test:e2e   # Integration tests (Playwright)
```

**Unit tests** cover: filename generation (slug function, token replacement, collision handling), storage wrapper (defaults, merging, migration), message type validation.

**Integration tests** use Playwright's persistent context to load the extension, open a test page, trigger captures via the extension popup, and verify the downloaded file dimensions and format.

### Build

```bash
npm run build      # Production build to dist/
npm run package    # Build + zip dist/ for Web Store upload
```

### CI

GitHub Actions workflow: lint → type-check → unit tests → build → e2e tests. Runs on push to `main` and on PRs. Produces a `snapr.zip` artifact for Web Store deployment.

---

## Implementation Milestones

For tracking progress during development:

**M1 — Viewport capture (core loop)**

- [x] Manifest, project scaffold, build pipeline
- [x] Service worker with `captureVisibleTab`
- [x] Popup with preview thumbnail and capture button
- [x] File download with auto-generated filename
- [x] Format selection (PNG/JPG/WebP)
- [x] Quality control
- [x] Settings persistence

**M2 — Viewport presets**

- [x] Size preset dropdown in popup
- [x] Debugger API viewport emulation
- [x] Optional permission request flow
- [x] Restore viewport after capture

**M3 — Full-page capture**

- [x] Content script: scroll measurement
- [x] Content script: fixed/sticky element handling
- [x] Scroll-and-capture loop
- [x] Offscreen document: frame compositing
- [x] Max height cap and warning

**M4 — Element capture**

- [x] Content script: hover overlay with Shadow DOM
- [x] Content script: element selection and rect reporting
- [x] Offscreen document: image cropping
- [x] Popup closes → overlay activates flow

**M5 — History and options**

- [x] Capture history storage and eviction
- [x] History UI in popup
- [x] Options page with all settings
- [x] Filename pattern with token system
- [x] Theme support (system/light/dark)

**M6 — Polish and ship**

- [x] Keyboard shortcut (quick capture)
- [x] Error handling for all edge cases
- [x] Build out Testing Suite to make sure everything works
- [ ] Icon design (all sizes)
- [ ] Web Store listing copy and screenshots
- [x] README and GitHub repo polish
- [ ] CI pipeline
- [ ] Chrome Web Store submission

---

## Prior Art

| Tool                       | What it does well             | Where Snapr differs                                                               |
| -------------------------- | ----------------------------- | --------------------------------------------------------------------------------- |
| Chrome DevTools screenshot | Built in, no install          | Buried in menus, no presets, no format options, no history                        |
| GoFullPage                 | Reliable full-page captures   | Full-page only, no viewport presets, no element capture, no format control        |
| Awesome Screenshot         | Feature-rich annotation       | Requires account, cloud storage, bloated UI, heavy permissions                    |
| Fireshot                   | Solid full-page + PDF export  | Dated interface, freemium nag screens, excessive permissions                      |
| Lightshot                  | Fast capture + share          | Optimized for sharing not saving, no presets, no developer focus                  |
| Screenpresso / Snagit      | Professional screenshot tools | Desktop apps, not extensions, enterprise pricing, overkill for portfolio captures |

Snapr's position: the developer's screenshot tool. Minimal UI, minimal permissions, maximal output quality, zero accounts, zero cloud. If you need annotation and sharing, use Lightshot. If you need enterprise features, use Snagit. If you need clean captures for your portfolio, use Snapr.
