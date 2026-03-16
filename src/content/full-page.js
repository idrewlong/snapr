/**
 * full-page.js — Content script for full-page scroll capture
 *
 * Injected programmatically via chrome.scripting.executeScript — must be a
 * self-contained IIFE with NO imports. Message constants are inlined here.
 *
 * Responsibilities:
 *  - Report scroll dimensions to the service worker
 *  - Hide all fixed/sticky elements before capture starts
 *  - Scroll to a given Y offset and confirm after paint
 *  - Restore fixed/sticky elements after capture completes
 */

(() => {
  // Inlined from lib/messages.js — keep in sync
  const MSG_SCROLL_INFO = 'SCROLL_INFO';
  const MSG_SCROLL_TO   = 'SCROLL_TO';

  // Guard against being injected more than once
  if (window.__snaprFullPageActive) return;
  window.__snaprFullPageActive = true;

  const fixedElements = [];

  function hideFixed() {
    document.querySelectorAll('*').forEach((el) => {
      const { position } = getComputedStyle(el);
      if (position === 'fixed' || position === 'sticky') {
        fixedElements.push({ el, original: el.style.position });
        el.style.position = 'relative';
      }
    });
  }

  window.__snaprRestoreFixed = function () {
    fixedElements.forEach(({ el, original }) => {
      el.style.position = original;
    });
    fixedElements.length = 0;
    window.__snaprFullPageActive = false;
  };

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === MSG_SCROLL_INFO) {
      hideFixed();
      sendResponse({
        scrollHeight:   document.body.scrollHeight,
        scrollWidth:    document.body.scrollWidth,
        viewportHeight: window.innerHeight,
        viewportWidth:  window.innerWidth,
      });
      return;
    }

    if (message.type === MSG_SCROLL_TO) {
      window.scrollTo(0, message.y);
      // Confirm after the next paint so the SW doesn't capture too early
      requestAnimationFrame(() => sendResponse({ done: true }));
      return true; // keep channel open for async response
    }
  });
})();
