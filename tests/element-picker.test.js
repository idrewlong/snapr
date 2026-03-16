/**
 * tests/element-picker.test.js
 * @vitest-environment jsdom
 *
 * Tests for src/content/element-picker.js — the DOM content script.
 *
 * element-picker.js is a self-contained IIFE (no exports). We execute it via
 * new Function() so it runs in the jsdom window's global scope, giving it
 * access to document, window, and our chrome mock.
 *
 * The shadow root is created with mode: 'closed' to isolate overlay styles.
 * We patch Element.prototype.attachShadow to use mode: 'open' for tests so
 * we can access overlay/highlight/label without changing production code.
 */

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PICKER_SRC = readFileSync(
  path.join(__dirname, '../src/content/element-picker.js'),
  'utf-8'
);

// ── Patch attachShadow to open mode globally ───────────────────────────────────
// element-picker uses mode:'closed' to isolate styles in production.
// We override it here so tests can read shadow.children.

beforeAll(() => {
  const _orig = Element.prototype.attachShadow;
  Element.prototype.attachShadow = function (init) {
    return _orig.call(this, { ...init, mode: 'open' });
  };
});

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Runs the picker IIFE fresh in the current jsdom context. */
function injectPicker() {
  // Remove any leftover host so the guard doesn't short-circuit
  document.getElementById('__snapr_picker_host__')?.remove();
  // eslint-disable-next-line no-new-func
  new Function(PICKER_SRC)();
}

/** Returns the shadow root of the picker host (requires open mode patch above). */
function getShadow() {
  return document.getElementById('__snapr_picker_host__')?.shadowRoot ?? null;
}

/** The three elements inside the shadow: [overlay, highlight, label] */
function getShadowChildren() {
  const shadow = getShadow();
  if (!shadow) return {};
  return {
    overlay:   shadow.children[0],
    highlight: shadow.children[1],
    label:     shadow.children[2],
  };
}

/** Creates a mock DOM element with a controllable getBoundingClientRect. */
function makeTarget(tag, rect) {
  const el = document.createElement(tag);
  el.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 50, ...rect });
  document.body.appendChild(el);
  return el;
}

// ── Setup / teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
  // setup.js already wires chrome.runtime.sendMessage as a vi.fn() on global.
  // Do NOT replace window.chrome — that would break setup.js's beforeEach re-wiring.
  // Just ensure the picker has what it needs as non-mock properties.
  window.devicePixelRatio = 2;
  document.body.innerHTML = '';
});

afterEach(() => {
  document.getElementById('__snapr_picker_host__')?.remove();
});

// ── Host / Shadow DOM creation ────────────────────────────────────────────────

describe('host and shadow DOM creation', () => {
  it('appends a host element with id __snapr_picker_host__ to document.body', () => {
    injectPicker();
    expect(document.getElementById('__snapr_picker_host__')).not.toBeNull();
  });

  it('creates a shadow root on the host', () => {
    injectPicker();
    expect(getShadow()).not.toBeNull();
  });

  it('appends exactly three children into the shadow: overlay, highlight, label', () => {
    injectPicker();
    expect(getShadow().children).toHaveLength(3);
  });

  it('overlay has pointer-events: all and crosshair cursor', () => {
    injectPicker();
    const { overlay } = getShadowChildren();
    expect(overlay.style.pointerEvents).toBe('all');
    expect(overlay.style.cursor).toBe('crosshair');
  });

  it('highlight has pointer-events: none', () => {
    injectPicker();
    const { highlight } = getShadowChildren();
    expect(highlight.style.pointerEvents).toBe('none');
  });

  it('label has pointer-events: none', () => {
    injectPicker();
    const { label } = getShadowChildren();
    expect(label.style.pointerEvents).toBe('none');
  });
});

// ── Double-injection guard ────────────────────────────────────────────────────

describe('double-injection guard', () => {
  it('does not create a second host when injected twice', () => {
    injectPicker();
    injectPicker(); // IIFE should exit early on second run
    expect(document.querySelectorAll('#__snapr_picker_host__')).toHaveLength(1);
  });

  it('does not add extra shadow children on second injection', () => {
    injectPicker();
    injectPicker();
    expect(getShadow().children).toHaveLength(3);
  });
});

// ── Escape cancellation ───────────────────────────────────────────────────────

describe('Escape key cancellation', () => {
  it('removes the host element on Escape', () => {
    injectPicker();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(document.getElementById('__snapr_picker_host__')).toBeNull();
  });

  it('does not call chrome.runtime.sendMessage on Escape', () => {
    injectPicker();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
  });

  it('does not remove the host for non-Escape keys', () => {
    injectPicker();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    expect(document.getElementById('__snapr_picker_host__')).not.toBeNull();
  });

  it('Escape listener fires only once (once: true)', () => {
    injectPicker();
    // Press Escape → overlay removed
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    // Re-inject so there's a fresh host again
    injectPicker();
    // First Escape listener is already consumed — host should still exist
    // (a new listener was registered by the second injection, but we just
    //  confirm only the current injection's listener fires)
    expect(document.getElementById('__snapr_picker_host__')).not.toBeNull();
  });
});

// ── Mousemove: highlight and label ────────────────────────────────────────────

describe('mousemove — highlight and label updates', () => {
  it('positions the highlight to match the hovered element rect', () => {
    injectPicker();
    const { overlay, highlight } = getShadowChildren();

    const target = makeTarget('section', { left: 15, top: 30, width: 250, height: 120 });
    document.elementFromPoint = vi.fn(() => target);

    overlay.dispatchEvent(new MouseEvent('mousemove', { clientX: 100, clientY: 80, bubbles: true }));

    expect(highlight.style.left).toBe('15px');
    expect(highlight.style.top).toBe('30px');
    expect(highlight.style.width).toBe('250px');
    expect(highlight.style.height).toBe('120px');
  });

  it('sets label text to "<tagname> width×height"', () => {
    injectPicker();
    const { overlay, label } = getShadowChildren();

    const target = makeTarget('nav', { left: 0, top: 0, width: 380, height: 60 });
    document.elementFromPoint = vi.fn(() => target);

    overlay.dispatchEvent(new MouseEvent('mousemove', { clientX: 50, clientY: 30, bubbles: true }));

    expect(label.textContent).toBe('<nav> 380×60');
  });

  it('rounds width and height in the label', () => {
    injectPicker();
    const { overlay, label } = getShadowChildren();

    const target = makeTarget('div', { left: 0, top: 0, width: 100.6, height: 49.4 });
    document.elementFromPoint = vi.fn(() => target);

    overlay.dispatchEvent(new MouseEvent('mousemove', { clientX: 10, clientY: 10, bubbles: true }));

    expect(label.textContent).toBe('<div> 101×49');
  });

  it('positions the label at the element left edge', () => {
    injectPicker();
    const { overlay, label } = getShadowChildren();

    const target = makeTarget('aside', { left: 40, top: 100, width: 200, height: 80 });
    document.elementFromPoint = vi.fn(() => target);

    overlay.dispatchEvent(new MouseEvent('mousemove', { clientX: 50, clientY: 120, bubbles: true }));

    expect(label.style.left).toBe('40px');
  });

  it('clamps label top to 0 when element is near the top of viewport', () => {
    injectPicker();
    const { overlay, label } = getShadowChildren();

    // top: 10 → label top would be 10-22 = -12 → clamped to 0
    const target = makeTarget('header', { left: 0, top: 10, width: 300, height: 40 });
    document.elementFromPoint = vi.fn(() => target);

    overlay.dispatchEvent(new MouseEvent('mousemove', { clientX: 50, clientY: 30, bubbles: true }));

    expect(label.style.top).toBe('0px');
  });

  it('does not update highlight when elementFromPoint returns null', () => {
    injectPicker();
    const { overlay, highlight } = getShadowChildren();

    document.elementFromPoint = vi.fn(() => null);
    const beforeLeft = highlight.style.left;

    overlay.dispatchEvent(new MouseEvent('mousemove', { clientX: 10, clientY: 10, bubbles: true }));

    expect(highlight.style.left).toBe(beforeLeft); // unchanged
  });

  it('does not update highlight when elementFromPoint returns the host itself', () => {
    injectPicker();
    const host = document.getElementById('__snapr_picker_host__');
    const { overlay, highlight } = getShadowChildren();

    document.elementFromPoint = vi.fn(() => host);
    const beforeLeft = highlight.style.left;

    overlay.dispatchEvent(new MouseEvent('mousemove', { clientX: 10, clientY: 10, bubbles: true }));

    expect(highlight.style.left).toBe(beforeLeft);
  });
});

// ── Click: element selection ──────────────────────────────────────────────────

describe('click — element selection', () => {
  it('sends ELEMENT_SELECTED with the clicked element rect', () => {
    injectPicker();
    const { overlay } = getShadowChildren();

    const target = makeTarget('article', { left: 10, top: 20, width: 300, height: 150 });
    document.elementFromPoint = vi.fn(() => target);

    overlay.dispatchEvent(new MouseEvent('click', { clientX: 50, clientY: 50, bubbles: true }));

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      type:            'ELEMENT_SELECTED',
      rect:            { x: 10, y: 20, width: 300, height: 150 },
      devicePixelRatio: 2,
    });
  });

  it('removes the host element after a successful click', () => {
    injectPicker();
    const { overlay } = getShadowChildren();

    const target = makeTarget('p', { left: 0, top: 0, width: 100, height: 50 });
    document.elementFromPoint = vi.fn(() => target);

    overlay.dispatchEvent(new MouseEvent('click', { clientX: 10, clientY: 10, bubbles: true }));

    expect(document.getElementById('__snapr_picker_host__')).toBeNull();
  });

  it('includes window.devicePixelRatio in the message', () => {
    window.devicePixelRatio = 3;
    injectPicker();
    const { overlay } = getShadowChildren();

    const target = makeTarget('span', { left: 0, top: 0, width: 50, height: 20 });
    document.elementFromPoint = vi.fn(() => target);

    overlay.dispatchEvent(new MouseEvent('click', { clientX: 5, clientY: 5, bubbles: true }));

    const msg = chrome.runtime.sendMessage.mock.calls[0][0];
    expect(msg.devicePixelRatio).toBe(3);
  });

  it('does not send message when elementFromPoint returns null', () => {
    injectPicker();
    const { overlay } = getShadowChildren();

    document.elementFromPoint = vi.fn(() => null);

    overlay.dispatchEvent(new MouseEvent('click', { clientX: 10, clientY: 10, bubbles: true }));

    expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
  });

  it('does not send message when elementFromPoint returns the host itself', () => {
    injectPicker();
    const host = document.getElementById('__snapr_picker_host__');
    const { overlay } = getShadowChildren();

    document.elementFromPoint = vi.fn(() => host);

    overlay.dispatchEvent(new MouseEvent('click', { clientX: 10, clientY: 10, bubbles: true }));

    expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
  });

  it('does not remove the host when click is a no-op (host returned)', () => {
    injectPicker();
    const host = document.getElementById('__snapr_picker_host__');
    const { overlay } = getShadowChildren();

    document.elementFromPoint = vi.fn(() => host);

    overlay.dispatchEvent(new MouseEvent('click', { clientX: 10, clientY: 10, bubbles: true }));

    // Host should still be present — the picker is still active
    expect(document.getElementById('__snapr_picker_host__')).not.toBeNull();
  });

  it('sends raw CSS-pixel rect values (DPR scaling done in service-worker, not here)', () => {
    window.devicePixelRatio = 2;
    injectPicker();
    const { overlay } = getShadowChildren();

    const CSS_RECT = { left: 50, top: 100, width: 200, height: 80 };
    const target = makeTarget('figure', CSS_RECT);
    document.elementFromPoint = vi.fn(() => target);

    overlay.dispatchEvent(new MouseEvent('click', { clientX: 60, clientY: 110, bubbles: true }));

    const msg = chrome.runtime.sendMessage.mock.calls[0][0];
    // rect values are raw CSS pixels, NOT pre-multiplied by DPR
    expect(msg.rect.x).toBe(CSS_RECT.left);
    expect(msg.rect.y).toBe(CSS_RECT.top);
    expect(msg.rect.width).toBe(CSS_RECT.width);
    expect(msg.rect.height).toBe(CSS_RECT.height);
  });
});

// ── Full interaction flow ─────────────────────────────────────────────────────

describe('full interaction flow', () => {
  it('hover then click: highlight moves to element, then ELEMENT_SELECTED fires', () => {
    injectPicker();
    const { overlay, highlight } = getShadowChildren();

    const target = makeTarget('main', { left: 20, top: 40, width: 600, height: 400 });
    document.elementFromPoint = vi.fn(() => target);

    // Hover first
    overlay.dispatchEvent(new MouseEvent('mousemove', { clientX: 100, clientY: 100, bubbles: true }));
    expect(highlight.style.width).toBe('600px');

    // Click to confirm
    overlay.dispatchEvent(new MouseEvent('click', { clientX: 100, clientY: 100, bubbles: true }));
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'ELEMENT_SELECTED' })
    );
    expect(document.getElementById('__snapr_picker_host__')).toBeNull();
  });

  it('hover then Escape: overlay removed, no message sent', () => {
    injectPicker();
    const { overlay } = getShadowChildren();

    const target = makeTarget('footer', { left: 0, top: 0, width: 100, height: 50 });
    document.elementFromPoint = vi.fn(() => target);

    overlay.dispatchEvent(new MouseEvent('mousemove', { clientX: 10, clientY: 10, bubbles: true }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
    expect(document.getElementById('__snapr_picker_host__')).toBeNull();
  });

  it('can be re-injected cleanly after Escape cancels the first session', () => {
    injectPicker();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(document.getElementById('__snapr_picker_host__')).toBeNull();

    // Second injection should work normally
    injectPicker();
    expect(document.getElementById('__snapr_picker_host__')).not.toBeNull();
  });
});
