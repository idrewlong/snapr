/**
 * element-picker.js — Content script for element selection
 *
 * Injected programmatically via chrome.scripting.executeScript — must be a
 * self-contained IIFE with NO imports. Message constants are inlined here.
 *
 * Uses a Shadow DOM container to isolate the overlay from page styles.
 *
 * Flow:
 *  - Renders a full-viewport overlay
 *  - mousemove: highlights the element under cursor + shows a size label
 *  - click: locks selection, sends ELEMENT_SELECTED, removes overlay
 *  - Escape: cancels, removes overlay
 */

(() => {
  // Inlined from lib/messages.js — keep in sync
  const MSG_ELEMENT_SELECTED = 'ELEMENT_SELECTED';

  // Guard against double-injection
  if (document.getElementById('__snapr_picker_host__')) return;

  // ── Shadow DOM container ──────────────────────────────────

  const host = document.createElement('div');
  host.id = '__snapr_picker_host__';
  const shadow = host.attachShadow({ mode: 'closed' });
  document.body.appendChild(host);

  const overlay = document.createElement('div');
  overlay.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:2147483647',
    'cursor:crosshair', 'pointer-events:all',
  ].join(';');

  const highlight = document.createElement('div');
  highlight.style.cssText = [
    'position:fixed', 'pointer-events:none', 'box-sizing:border-box',
    'background:rgba(44,74,53,0.12)',
    'border:2px solid rgba(44,74,53,0.85)',
    'border-radius:2px',
    'transition:left .05s,top .05s,width .05s,height .05s',
  ].join(';');

  const label = document.createElement('div');
  label.style.cssText = [
    'position:fixed', 'pointer-events:none', 'z-index:1',
    'background:rgba(44,74,53,0.9)', 'color:#FAF8F4',
    "font:500 11px/1 'Geist Mono',monospace",
    'padding:3px 7px', 'border-radius:3px', 'white-space:nowrap',
  ].join(';');

  shadow.append(overlay, highlight, label);

  // ── Hover ─────────────────────────────────────────────────

  overlay.addEventListener('mousemove', (e) => {
    overlay.style.pointerEvents = 'none';
    const el = document.elementFromPoint(e.clientX, e.clientY);
    overlay.style.pointerEvents = 'all';
    if (!el || el === host) return;

    const r = el.getBoundingClientRect();
    Object.assign(highlight.style, {
      left: r.left + 'px', top: r.top + 'px',
      width: r.width + 'px', height: r.height + 'px',
    });

    label.textContent = `<${el.tagName.toLowerCase()}> ${Math.round(r.width)}×${Math.round(r.height)}`;
    label.style.left = r.left + 'px';
    label.style.top  = Math.max(0, r.top - 22) + 'px';
  });

  // ── Select ────────────────────────────────────────────────

  overlay.addEventListener('click', (e) => {
    overlay.style.pointerEvents = 'none';
    const el = document.elementFromPoint(e.clientX, e.clientY);
    overlay.style.pointerEvents = 'all';
    if (!el || el === host) return;

    const r = el.getBoundingClientRect();
    cleanup();

    chrome.runtime.sendMessage({
      type: MSG_ELEMENT_SELECTED,
      rect: { x: r.left, y: r.top, width: r.width, height: r.height },
      devicePixelRatio: window.devicePixelRatio,
    });
  });

  // ── Cancel ────────────────────────────────────────────────

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') cleanup();
  }, { once: true });

  function cleanup() {
    host.remove();
  }
})();
