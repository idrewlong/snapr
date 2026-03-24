/**
 * full-page.js — Content script for full-page scroll capture
 *
 * Injected programmatically via chrome.scripting.executeScript — must be a
 * self-contained IIFE with NO imports. Message constants are inlined here.
 *
 * Responsibilities:
 *  - Report scroll dimensions + DPR + fixedBarHeight to the service worker
 *  - Hide all fixed/sticky elements on demand (HIDE_FIXED message)
 *  - Scroll to a given Y offset and confirm after paint
 *  - Restore fixed/sticky elements after capture completes
 *
 * Two-phase approach:
 *  Phase 1 (SCROLL_INFO)  — measure everything; do NOT modify the page yet.
 *                           The service worker takes a reference screenshot
 *                           before anything is hidden.
 *  Phase 2 (HIDE_FIXED)   — remove fixed/sticky elements from the layout so
 *                           tiles show only the scrollable content. The service
 *                           worker overlays the reference header on the final
 *                           composite, giving one clean header at the top.
 */

(() => {
  // Inlined from lib/messages.js — keep in sync
  const MSG_SCROLL_INFO = 'SCROLL_INFO';
  const MSG_SCROLL_TO   = 'SCROLL_TO';
  const MSG_HIDE_FIXED  = 'HIDE_FIXED';

  // Guard against being injected more than once
  if (window.__snaprFullPageActive) return;
  window.__snaprFullPageActive = true;

  // Saved state for restoration
  const hiddenElements = [];

  /**
   * Completely remove fixed/sticky elements from the layout (display: none).
   * Returns the maximum bottom-edge of elements anchored to the top half of
   * the viewport — that is the "fixedBarHeight" the compositor uses to know
   * how many pixels of the reference screenshot to stitch at the top.
   */
  function hideFixed() {
    const viewportMidpoint = window.innerHeight / 2;
    let fixedBarHeight = 0;

    document.querySelectorAll('*').forEach((el) => {
      const { position } = getComputedStyle(el);
      if (position !== 'fixed' && position !== 'sticky') return;

      const rect = el.getBoundingClientRect();

      // Only count top-anchored elements for the header bar height
      if (rect.top < viewportMidpoint) {
        fixedBarHeight = Math.max(fixedBarHeight, rect.bottom);
      }

      hiddenElements.push({ el, display: el.style.display });
      el.style.display = 'none';
    });

    return Math.ceil(fixedBarHeight);
  }

  window.__snaprRestoreFixed = function () {
    hiddenElements.forEach(({ el, display }) => {
      el.style.display = display;
    });
    hiddenElements.length = 0;
    window.__snaprFullPageActive = false;
  };

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    // ── Phase 1: report dimensions, touch nothing ────────────────────────────
    if (message.type === MSG_SCROLL_INFO) {
      // Use the larger of body / documentElement to handle pages where the
      // html element (not body) is the scroll container (body { height:100% }).
      const scrollHeight = Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight,
      );
      const scrollWidth = Math.max(
        document.body.scrollWidth,
        document.documentElement.scrollWidth,
      );
      sendResponse({
        scrollHeight,
        scrollWidth,
        viewportHeight:   window.innerHeight,
        viewportWidth:    window.innerWidth,
        devicePixelRatio: window.devicePixelRatio || 1,
      });
      return;
    }

    // ── Phase 2: hide fixed/sticky elements, report bar height ───────────────
    if (message.type === MSG_HIDE_FIXED) {
      const fixedBarHeight = hideFixed();
      sendResponse({ fixedBarHeight });
      return;
    }

    // ── Scroll to position, confirm after paint ──────────────────────────────
    if (message.type === MSG_SCROLL_TO) {
      // scrollTo covers most pages; setting scrollTop directly covers pages
      // where documentElement (not window) is the actual scroll container.
      window.scrollTo(0, message.y);
      document.documentElement.scrollTop = message.y;
      // Confirm after the next paint so the SW doesn't capture too early
      requestAnimationFrame(() => sendResponse({ done: true }));
      return true; // keep channel open for async response
    }
  });
})();
