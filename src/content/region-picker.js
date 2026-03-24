/**
 * region-picker.js — Content script for drag-to-select region capture
 *
 * Injected programmatically via chrome.scripting.executeScript — must be a
 * self-contained IIFE with NO imports. Message constants are inlined here.
 *
 * Uses a Shadow DOM container to isolate the overlay from page styles.
 *
 * Flow:
 *  - Renders a full-viewport crosshair overlay with a dimmed backdrop
 *  - mousedown: anchors the start corner
 *  - mousemove: draws the selection rectangle live + shows size label
 *  - mouseup: locks selection, sends REGION_SELECTED, removes overlay
 *  - Escape: cancels, removes overlay
 */

(() => {
  // Inlined from lib/messages.js — keep in sync
  const MSG_REGION_SELECTED = 'REGION_SELECTED';

  // Guard against double-injection
  if (document.getElementById('__snapr_region_host__')) return;

  // ── Shadow DOM container ──────────────────────────────────

  const host = document.createElement('div');
  host.id = '__snapr_region_host__';
  host.style.cssText = 'position:fixed;inset:0;z-index:2147483647;cursor:crosshair;pointer-events:none;';
  const shadow = host.attachShadow({ mode: 'closed' });
  document.body.appendChild(host);

  // Full-viewport backdrop (dimmed)
  const backdrop = document.createElement('div');
  backdrop.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:2147483647',
    'cursor:crosshair', 'pointer-events:all',
    'background:rgba(0,0,0,0.35)',
    'user-select:none',
  ].join(';');

  // The bright selection rect cut-out (uses outline to dim everything outside)
  const selection = document.createElement('div');
  selection.style.cssText = [
    'position:fixed', 'pointer-events:none', 'box-sizing:border-box',
    'border:2px solid rgba(44,74,53,0.9)',
    'border-radius:2px',
    'background:transparent',
    // box-shadow creates the dimming effect outside the selection
    'box-shadow:0 0 0 9999px rgba(0,0,0,0.35)',
    'display:none',
  ].join(';');

  // Dimension label
  const label = document.createElement('div');
  label.style.cssText = [
    'position:fixed', 'pointer-events:none', 'z-index:1',
    'background:rgba(44,74,53,0.9)', 'color:#FAF8F4',
    "font:500 11px/1 'Geist Mono',monospace",
    'padding:3px 7px', 'border-radius:3px', 'white-space:nowrap',
    'display:none',
  ].join(';');

  // Hint text shown before dragging starts
  const hint = document.createElement('div');
  hint.textContent = 'Drag to select a region  •  Esc to cancel';
  hint.style.cssText = [
    'position:fixed', 'pointer-events:none',
    'left:50%', 'top:50%',
    'transform:translate(-50%,-50%)',
    'background:rgba(44,74,53,0.9)', 'color:#FAF8F4',
    "font:500 13px/1.4 'Geist Mono',monospace",
    'padding:10px 18px', 'border-radius:6px', 'white-space:nowrap',
    'box-shadow:0 2px 12px rgba(0,0,0,0.25)',
  ].join(';');

  shadow.append(backdrop, selection, label, hint);

  // ── Cursor ───────────────────────────────────────────────
  // Closing the popup immediately (no delay) causes Chrome to fire a
  // mouseenter on the tab right away, which re-evaluates the cursor.
  document.documentElement.style.setProperty('cursor', 'crosshair', 'important');
  document.body.style.setProperty('cursor', 'crosshair', 'important');

  // ── Drag state ────────────────────────────────────────────

  let dragging = false;
  let startX = 0;
  let startY = 0;

  backdrop.addEventListener('mousedown', (e) => {
    e.preventDefault();
    dragging  = true;
    startX    = e.clientX;
    startY    = e.clientY;
    hint.style.display = 'none';
    selection.style.display = 'block';
    label.style.display     = 'block';
    updateRect(e.clientX, e.clientY);
  });

  backdrop.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    updateRect(e.clientX, e.clientY);
  });

  backdrop.addEventListener('mouseup', (e) => {
    if (!dragging) return;
    dragging = false;

    const rect = computeRect(startX, startY, e.clientX, e.clientY);
    if (rect.width < 4 || rect.height < 4) {
      // Too small — treat as accidental click, reset
      selection.style.display = 'none';
      label.style.display     = 'none';
      hint.style.display      = 'block';
      return;
    }

    cleanup();

    chrome.runtime.sendMessage({
      type: MSG_REGION_SELECTED,
      rect: { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
      devicePixelRatio: window.devicePixelRatio,
    });
  });

  // ── Escape to cancel ─────────────────────────────────────

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') cleanup();
  }, { once: true });

  // ── Helpers ──────────────────────────────────────────────

  function computeRect(x1, y1, x2, y2) {
    return {
      left:   Math.min(x1, x2),
      top:    Math.min(y1, y2),
      width:  Math.abs(x2 - x1),
      height: Math.abs(y2 - y1),
    };
  }

  function updateRect(curX, curY) {
    const r = computeRect(startX, startY, curX, curY);

    Object.assign(selection.style, {
      left:   r.left   + 'px',
      top:    r.top    + 'px',
      width:  r.width  + 'px',
      height: r.height + 'px',
    });

    const w = Math.round(r.width);
    const h = Math.round(r.height);
    label.textContent = `${w} × ${h}`;

    // Keep label above the selection box, but clamp to viewport
    const labelTop = Math.max(0, r.top - 22);
    label.style.left = r.left + 'px';
    label.style.top  = labelTop + 'px';
  }

  function cleanup() {
    document.documentElement.style.removeProperty('cursor');
    document.body.style.removeProperty('cursor');
    host.remove();
  }
})();
